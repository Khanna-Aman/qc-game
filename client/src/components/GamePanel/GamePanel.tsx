import { useCallback } from 'react';
import type { GameState, Player } from '@engine/types';
import { getKingProbability } from '@engine/board';
import { serializeState } from '@engine/board';
import { MoveList } from './MoveList';
import './GamePanel.css';

interface GamePanelProps {
  gameState: GameState;
  playerColor: Player;
  isConnected: boolean;
  roomId?: string;
  onImportGame?: (gameState: GameState) => void;
}

export function GamePanel({ gameState, playerColor, isConnected, roomId, onImportGame }: GamePanelProps) {
  const whiteKingProb = getKingProbability(gameState, 'white');
  const blackKingProb = getKingProbability(gameState, 'black');
  const isMyTurn = gameState.currentPlayer === playerColor;

  const getStatusText = () => {
    switch (gameState.gameStatus) {
      case 'white_wins': return '👑 White Wins!';
      case 'black_wins': return '👑 Black Wins!';
      case 'draw_stalemate': return '🤝 Draw - Stalemate';
      case 'draw_50_move': return '🤝 Draw - 50 Move Rule';
      case 'draw_agreement': return '🤝 Draw by Agreement';
      default: return isMyTurn ? '🎯 Your Turn' : '⏳ Opponent\'s Turn';
    }
  };

  // Export game as JSON file
  const handleExportGame = useCallback(() => {
    const exported = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      gameState: serializeState(gameState),
      roomId
    };

    const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quantum-chess-${roomId || 'game'}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [gameState, roomId]);

  // Import game from JSON file
  const handleImportGame = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const imported = JSON.parse(event.target?.result as string);
          if (imported.gameState && onImportGame) {
            onImportGame(imported.gameState);
          }
        } catch (err) {
          console.error('Failed to import game:', err);
          alert('Invalid game file');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [onImportGame]);

  return (
    <div className="game-panel">
      <div className="panel-section">
        <h2>⚛️ Quantum Chess</h2>
        {roomId && (
          <div className="room-info">
            <span className="room-label">Room:</span>
            <code className="room-id">{roomId}</code>
          </div>
        )}
      </div>

      <div className="panel-section connection-status">
        <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`} />
        <span>{isConnected ? 'Connected' : 'Waiting for opponent...'}</span>
      </div>

      <div className="panel-section player-info">
        <div className={`player ${playerColor === 'black' ? 'current-player' : ''}`}>
          <span className="player-icon">♚</span>
          <span className="player-name">Black</span>
          <span className="king-probability" style={{
            color: blackKingProb < 0.5 ? '#e74c3c' : blackKingProb < 1 ? '#f39c12' : '#27ae60'
          }}>
            {Math.round(blackKingProb * 100)}%
          </span>
        </div>
        <div className={`player ${playerColor === 'white' ? 'current-player' : ''}`}>
          <span className="player-icon">♔</span>
          <span className="player-name">White</span>
          <span className="king-probability" style={{
            color: whiteKingProb < 0.5 ? '#e74c3c' : whiteKingProb < 1 ? '#f39c12' : '#27ae60'
          }}>
            {Math.round(whiteKingProb * 100)}%
          </span>
        </div>
      </div>

      <div className="panel-section turn-indicator">
        <div className={`turn-badge ${isMyTurn ? 'my-turn' : 'opponent-turn'}`}>
          {getStatusText()}
        </div>
        <div className="turn-number">Turn {gameState.turnNumber}</div>
      </div>

      <div className="panel-section">
        <h3>📜 Move History</h3>
        <MoveList moves={gameState.moveHistory} />
      </div>

      <div className="panel-section quantum-help">
        <h3>🎮 How to Play</h3>
        <ul>
          <li><strong>Click</strong> a piece to select it</li>
          <li><strong>Green dots</strong> show valid moves</li>
          <li><strong>Purple</strong> indicates quantum split targets</li>
          <li><strong>% badges</strong> show superposition probability</li>
          <li>Capturing triggers <strong>measurement</strong>!</li>
        </ul>
      </div>

      <div className="panel-section game-actions">
        <h3>💾 Game Data</h3>
        <div className="action-buttons">
          <button className="action-btn export-btn" onClick={handleExportGame}>
            📥 Export Game
          </button>
          {onImportGame && (
            <button className="action-btn import-btn" onClick={handleImportGame}>
              📤 Import Game
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

