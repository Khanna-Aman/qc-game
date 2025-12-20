"""
Quantum Chess Signaling Server
Lightweight FastAPI server for WebRTC signaling.
After P2P connection is established, server is no longer involved.
"""

import os
import json
import secrets
from typing import Dict, Set
from datetime import datetime, timedelta
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


# Room storage (in-memory, for simplicity)
rooms: Dict[str, "Room"] = {}


class Room:
    """Represents a game room with two players"""
    def __init__(self, room_id: str, host_seed: int, max_superpositions: int = 2):
        self.room_id = room_id
        self.host_seed = host_seed
        self.max_superpositions = max_superpositions
        self.guest_seed: int | None = None
        self.host_ws: WebSocket | None = None
        self.guest_ws: WebSocket | None = None
        self.created_at = datetime.now()
    
    @property
    def is_full(self) -> bool:
        return self.host_ws is not None and self.guest_ws is not None
    
    @property
    def game_seed(self) -> int | None:
        if self.guest_seed is None:
            return None
        # XOR seeds for shared randomness
        return self.host_seed ^ self.guest_seed
    
    def get_other_ws(self, ws: WebSocket) -> WebSocket | None:
        if ws == self.host_ws:
            return self.guest_ws
        elif ws == self.guest_ws:
            return self.host_ws
        return None


class CreateRoomRequest(BaseModel):
    seed: int
    maxSuperpositions: int = 2  # 1-5


class CreateRoomResponse(BaseModel):
    room_id: str
    player_color: str
    max_superpositions: int


class JoinRoomRequest(BaseModel):
    room_id: str
    seed: int


class JoinRoomResponse(BaseModel):
    room_id: str
    player_color: str
    game_seed: int
    max_superpositions: int


def generate_room_id() -> str:
    """Generate a short, readable room ID"""
    return secrets.token_urlsafe(6)[:8].upper()


def cleanup_old_rooms():
    """Remove rooms older than 1 hour"""
    cutoff = datetime.now() - timedelta(hours=1)
    expired = [rid for rid, room in rooms.items() if room.created_at < cutoff]
    for rid in expired:
        del rooms[rid]


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown logic"""
    print("🚀 Quantum Chess Signaling Server starting...")
    yield
    print("👋 Signaling server shutting down...")
    rooms.clear()


app = FastAPI(
    title="Quantum Chess Signaling Server",
    description="WebRTC signaling for P2P quantum chess",
    version="1.0.0",
    lifespan=lifespan
)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Root endpoint - server info"""
    return {
        "name": "Quantum Chess Signaling Server",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "health": "/api/health",
            "create_room": "POST /api/rooms",
            "join_room": "POST /api/rooms/join",
            "websocket": "/ws/{room_id}"
        },
        "active_rooms": len(rooms)
    }


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "rooms": len(rooms)}


@app.post("/api/rooms", response_model=CreateRoomResponse)
async def create_room(request: CreateRoomRequest):
    """Create a new game room"""
    cleanup_old_rooms()

    room_id = generate_room_id()
    while room_id in rooms:
        room_id = generate_room_id()

    # Clamp maxSuperpositions to 1-5
    max_sup = max(1, min(5, request.maxSuperpositions))
    rooms[room_id] = Room(room_id, request.seed, max_sup)

    return CreateRoomResponse(
        room_id=room_id,
        player_color="white",  # Host is always white
        max_superpositions=max_sup
    )


@app.post("/api/rooms/join", response_model=JoinRoomResponse)
async def join_room(request: JoinRoomRequest):
    """Join an existing room"""
    room = rooms.get(request.room_id.upper())
    
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    if room.is_full:
        raise HTTPException(status_code=400, detail="Room is full")
    
    room.guest_seed = request.seed

    return JoinRoomResponse(
        room_id=room.room_id,
        player_color="black",  # Guest is always black
        game_seed=room.game_seed or 0,
        max_superpositions=room.max_superpositions
    )


@app.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str):
    """WebSocket for signaling (SDP/ICE exchange)"""
    room_id = room_id.upper()
    room = rooms.get(room_id)
    
    if not room:
        await websocket.close(code=4004, reason="Room not found")
        return
    
    await websocket.accept()
    
    # Assign to host or guest slot
    is_host = room.host_ws is None
    if is_host:
        room.host_ws = websocket
        role = "host"
    elif room.guest_ws is None:
        room.guest_ws = websocket
        role = "guest"
        # Notify host that guest joined
        if room.host_ws:
            await room.host_ws.send_json({
                "type": "peer_joined",
                "game_seed": room.game_seed
            })
    else:
        await websocket.close(code=4001, reason="Room is full")
        return
    
    try:
        # Send role confirmation
        await websocket.send_json({
            "type": "connected",
            "role": role,
            "game_seed": room.game_seed
        })
        
        # Relay messages between peers
        while True:
            data = await websocket.receive_json()
            other_ws = room.get_other_ws(websocket)
            
            if other_ws:
                # Relay signaling messages
                await other_ws.send_json(data)
    
    except WebSocketDisconnect:
        # Clean up on disconnect
        if room.host_ws == websocket:
            room.host_ws = None
        elif room.guest_ws == websocket:
            room.guest_ws = None
        
        # Notify other peer
        other_ws = room.get_other_ws(websocket)
        if other_ws:
            try:
                await other_ws.send_json({"type": "peer_disconnected"})
            except:
                pass
        
        # Delete room if empty
        if room.host_ws is None and room.guest_ws is None:
            del rooms[room_id]


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

