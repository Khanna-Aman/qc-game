import { useState } from 'react';
import './Lobby.css';

interface LobbyProps {
  onCreateRoom: (maxSuperpositions: number) => Promise<void>;
  onJoinRoom: (roomId: string) => Promise<void>;
  roomId: string | null;
  isConnecting: boolean;
  isConnected: boolean;
  error: string | null;
}

export function Lobby({
  onCreateRoom,
  onJoinRoom,
  roomId,
  isConnecting,
  isConnected,
  error
}: LobbyProps) {
  const [joinRoomId, setJoinRoomId] = useState('');
  const [copied, setCopied] = useState(false);
  const [maxSuperpositions, setMaxSuperpositions] = useState(2);

  const handleCreateRoom = async () => {
    await onCreateRoom(maxSuperpositions);
  };

  const handleJoinRoom = async () => {
    if (joinRoomId.trim()) {
      await onJoinRoom(joinRoomId.trim().toUpperCase());
    }
  };

  const copyRoomId = async () => {
    if (roomId) {
      await navigator.clipboard.writeText(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Waiting for opponent
  if (roomId && !isConnected) {
    return (
      <div className="lobby">
        <div className="lobby-card waiting">
          <h1>⚛️ Quantum Chess</h1>
          <div className="waiting-section">
            <div className="spinner" />
            <h2>Waiting for opponent...</h2>
            <p>Share this room code with your friend:</p>
            <div className="room-code-display">
              <code>{roomId}</code>
              <button onClick={copyRoomId} className="copy-btn">
                {copied ? '✓ Copied!' : '📋 Copy'}
              </button>
            </div>
            <p className="hint">
              Your friend should enter this code to join the game
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="lobby">
      <div className="lobby-card">
        <h1>⚛️ Quantum Chess</h1>
        <p className="subtitle">
          A peer-to-peer quantum chess game where pieces exist in superposition
        </p>

        {error && (
          <div className="error-message">
            ⚠️ {error}
          </div>
        )}

        <div className="lobby-actions">
          <div className="action-section">
            <h2>Create New Game</h2>
            <p>Start a new game and invite a friend</p>

            <div className="settings-row">
              <label htmlFor="maxSuperpositions">Max Superpositions per player:</label>
              <select
                id="maxSuperpositions"
                value={maxSuperpositions}
                onChange={(e) => setMaxSuperpositions(parseInt(e.target.value))}
                className="settings-select"
              >
                <option value={1}>1 piece</option>
                <option value={2}>2 pieces</option>
                <option value={3}>3 pieces</option>
                <option value={4}>4 pieces</option>
                <option value={5}>5 pieces</option>
              </select>
            </div>

            <button
              onClick={handleCreateRoom}
              disabled={isConnecting}
              className="primary-btn"
            >
              {isConnecting ? 'Creating...' : '🎮 Create Room'}
            </button>
          </div>

          <div className="divider">
            <span>OR</span>
          </div>

          <div className="action-section">
            <h2>Join Existing Game</h2>
            <p>Enter a room code to join</p>
            <div className="join-form">
              <input
                type="text"
                placeholder="Enter room code"
                value={joinRoomId}
                onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
                maxLength={8}
                disabled={isConnecting}
              />
              <button
                onClick={handleJoinRoom}
                disabled={isConnecting || !joinRoomId.trim()}
                className="secondary-btn"
              >
                {isConnecting ? 'Joining...' : '🚀 Join'}
              </button>
            </div>
          </div>
        </div>

        <div className="lobby-footer">
          <h3>🎯 How to Play</h3>
          <ul>
            <li><strong>Split moves</strong> put pieces in superposition (two places at once)</li>
            <li><strong>Merge moves</strong> combine superposed pieces</li>
            <li><strong>Captures</strong> trigger quantum measurement</li>
            <li>Reduce opponent's King probability to 0 to win!</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

