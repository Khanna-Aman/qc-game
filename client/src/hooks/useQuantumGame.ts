/**
 * Quantum Chess Game Hook
 * Manages game state, P2P sync, and move execution
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { GameState, Move, Player, Position } from '@engine/types';
import { createGame, makeMove, hashState } from '@engine/index';
import { WebRTCConnection, type ConnectionState } from '../networking';
import type { CollapseEvent, MoveAnimationEvent } from '../components/Animations';

export interface GameMessage {
  type: 'move' | 'sync_request' | 'sync_response' | 'state_hash';
  move?: Move;
  turnSeed?: number;
  stateHash?: string;
  gameState?: GameState;
}

export interface AnimationCallbacks {
  onMoveAnimation?: (event: Omit<MoveAnimationEvent, 'id' | 'timestamp'>) => void;
  onCollapseAnimation?: (event: Omit<CollapseEvent, 'id' | 'timestamp'>) => void;
}

interface UseQuantumGameOptions {
  serverUrl: string;
  animations?: AnimationCallbacks;
}

export function useQuantumGame({ serverUrl, animations }: UseQuantumGameOptions) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerColor, setPlayerColor] = useState<Player>('white');
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [gameSeed, setGameSeed] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const connectionRef = useRef<WebRTCConnection | null>(null);
  const localSeedRef = useRef<number>(Math.floor(Math.random() * 0xFFFFFFFF));

  // Helper to get piece from state (handles Map or Record)
  const getPiece = useCallback((state: GameState, pieceId: string) => {
    if (state.pieces instanceof Map) {
      return state.pieces.get(pieceId);
    }
    return state.pieces[pieceId];
  }, []);

  // Helper to trigger move animations
  const triggerMoveAnimation = useCallback((move: Move, state: GameState) => {
    if (!animations?.onMoveAnimation) return;

    const piece = getPiece(state, move.pieceId);
    if (!piece) return;

    if (move.type === 'classical' || move.type === 'capture') {
      animations.onMoveAnimation({
        pieceType: piece.type,
        owner: piece.owner,
        from: move.from,
        to: move.to
      });
    } else if (move.type === 'split') {
      animations.onMoveAnimation({
        pieceType: piece.type,
        owner: piece.owner,
        from: move.from,
        to: move.to1,
        isSplit: true,
        splitTo2: move.to2
      });
    } else if (move.type === 'merge') {
      animations.onMoveAnimation({
        pieceType: piece.type,
        owner: piece.owner,
        from: move.from1,
        to: move.to
      });
    }
  }, [animations]);

  // Helper to trigger collapse animations
  const triggerCollapseAnimation = useCallback((
    pieceType: string,
    owner: 'white' | 'black',
    fromPositions: Position[],
    toPosition: Position
  ) => {
    if (!animations?.onCollapseAnimation) return;
    animations.onCollapseAnimation({
      pieceType,
      owner,
      fromPositions,
      toPosition
    });
  }, [animations]);

  // Handle incoming P2P messages
  const handleMessage = useCallback((data: unknown) => {
    const message = data as GameMessage;
    console.log('[Game] Received:', message.type);

    switch (message.type) {
      case 'move':
        if (message.move && message.turnSeed !== undefined) {
          setGameState(prev => {
            if (!prev) return prev;
            const result = makeMove(prev, message.move!, message.turnSeed);
            if (!result.success) {
              console.error('[Game] Invalid move from peer:', result.error);
              return prev;
            }
            return result.newState;
          });
        }
        break;

      case 'state_hash':
        // Verify state sync
        setGameState(prev => {
          if (!prev) return prev;
          const localHash = hashState(prev);
          if (localHash !== message.stateHash) {
            console.error('[Game] State desync detected!');
            setError('Game state desync detected. Please restart the game.');
          }
          return prev;
        });
        break;

      case 'sync_request':
        // Peer is requesting full state
        if (gameState) {
          connectionRef.current?.send({
            type: 'sync_response',
            gameState: gameState
          });
        }
        break;

      case 'sync_response':
        // Received full state from peer
        if (message.gameState) {
          setGameState(message.gameState);
        }
        break;
    }
  }, [gameState]);

  // Handle game seed from signaling
  const handleGameSeed = useCallback((seed: number) => {
    console.log('[Game] Game seed:', seed);
    setGameSeed(seed);
    setGameState(createGame(seed));
  }, []);

  // Create a new room
  const createRoom = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(`${serverUrl}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seed: localSeedRef.current })
      });

      if (!response.ok) {
        throw new Error('Failed to create room');
      }

      const data = await response.json();
      setRoomId(data.room_id);
      setPlayerColor(data.player_color as Player);

      // Connect to signaling
      connectionRef.current = new WebRTCConnection({
        onStateChange: setConnectionState,
        onMessage: handleMessage,
        onGameSeed: handleGameSeed
      });

      await connectionRef.current.connect(serverUrl, data.room_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create room');
    }
  }, [serverUrl, handleMessage, handleGameSeed]);

  // Join an existing room
  const joinRoom = useCallback(async (targetRoomId: string) => {
    try {
      setError(null);
      const response = await fetch(`${serverUrl}/api/rooms/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_id: targetRoomId,
          seed: localSeedRef.current
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to join room');
      }

      const data = await response.json();
      setRoomId(data.room_id);
      setPlayerColor(data.player_color as Player);
      setGameSeed(data.game_seed);
      setGameState(createGame(data.game_seed));

      // Connect to signaling
      connectionRef.current = new WebRTCConnection({
        onStateChange: setConnectionState,
        onMessage: handleMessage,
        onGameSeed: handleGameSeed
      });

      await connectionRef.current.connect(serverUrl, data.room_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join room');
    }
  }, [serverUrl, handleMessage, handleGameSeed]);

  // Execute a move locally and send to peer
  const executeMove = useCallback((move: Move) => {
    if (!gameState) return;

    // Trigger move animation before applying
    triggerMoveAnimation(move, gameState);

    // Generate turn seed for this move
    const turnSeed = Math.floor(Math.random() * 0xFFFFFFFF);

    const result = makeMove(gameState, move, turnSeed);
    if (!result.success) {
      console.error('[Game] Invalid move:', result.error);
      return;
    }

    // Check for collapse events and trigger animations
    if (result.collapseEvents && result.collapseEvents.length > 0) {
      for (const event of result.collapseEvents) {
        const piece = getPiece(result.newState, event.pieceId);
        if (piece && event.collapsedTo) {
          triggerCollapseAnimation(
            piece.type,
            piece.owner,
            event.previousPositions.map(qp => qp.position),
            event.collapsedTo
          );
        }
      }
    }

    // Update local state
    setGameState(result.newState);

    // Send move to peer
    connectionRef.current?.send({
      type: 'move',
      move,
      turnSeed
    });

    // Send state hash for verification
    connectionRef.current?.send({
      type: 'state_hash',
      stateHash: hashState(result.newState)
    });
  }, [gameState, triggerMoveAnimation, triggerCollapseAnimation]);

  // Disconnect and cleanup
  const disconnect = useCallback(() => {
    connectionRef.current?.disconnect();
    connectionRef.current = null;
    setConnectionState('disconnected');
    setRoomId(null);
    setGameState(null);
    setGameSeed(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      connectionRef.current?.disconnect();
    };
  }, []);

  return {
    // State
    gameState,
    playerColor,
    connectionState,
    roomId,
    gameSeed,
    error,
    isMyTurn: gameState?.currentPlayer === playerColor,
    isConnected: connectionState === 'connected',

    // Actions
    createRoom,
    joinRoom,
    executeMove,
    disconnect
  };
}

