import type { GameState, Player } from '@engine/types';
import './GameEndScreen.css';

interface GameEndScreenProps {
  gameState: GameState;
  playerColor: Player;
  onRematch: () => void;
  onLeave: () => void;
}

export function GameEndScreen({
  gameState,
  playerColor,
  onRematch,
  onLeave
}: GameEndScreenProps) {
  const isWinner =
    (gameState.gameStatus === 'white_wins' && playerColor === 'white') ||
    (gameState.gameStatus === 'black_wins' && playerColor === 'black');

  const isDraw = gameState.gameStatus?.startsWith('draw');

  const getTitle = () => {
    if (isDraw) return '🤝 Draw!';
    if (isWinner) return '🎉 Victory!';
    return '😔 Defeat';
  };

  const getSubtitle = () => {
    switch (gameState.gameStatus) {
      case 'white_wins': return 'White wins by King capture';
      case 'black_wins': return 'Black wins by King capture';
      case 'draw_stalemate': return 'Game ended in stalemate';
      case 'draw_50_move': return 'Draw by 50-move rule';
      case 'draw_agreement': return 'Draw by agreement';
      default: return '';
    }
  };

  // Count pieces - handle both Map and Record types
  const piecesArray = gameState.pieces instanceof Map
    ? Array.from(gameState.pieces.values())
    : Object.values(gameState.pieces);

  const whitePieces = piecesArray.filter(p => p.owner === 'white').length;
  const blackPieces = piecesArray.filter(p => p.owner === 'black').length;

  // Count quantum events in move history (check move.type field)
  const quantumMoves = gameState.moveHistory.filter(
    m => m.move.type === 'split' || m.move.type === 'merge'
  ).length;

  return (
    <div className="game-end-overlay">
      <div className={`game-end-modal ${isWinner ? 'winner' : isDraw ? 'draw' : 'loser'}`}>
        <h1 className="end-title">{getTitle()}</h1>
        <p className="end-subtitle">{getSubtitle()}</p>

        <div className="game-stats">
          <h3>📊 Game Summary</h3>
          <div className="stat-grid">
            <div className="stat">
              <span className="stat-value">{gameState.turnNumber}</span>
              <span className="stat-label">Turns</span>
            </div>
            <div className="stat">
              <span className="stat-value">{gameState.moveHistory.length}</span>
              <span className="stat-label">Moves</span>
            </div>
            <div className="stat">
              <span className="stat-value">{quantumMoves}</span>
              <span className="stat-label">Quantum Moves</span>
            </div>
            <div className="stat">
              <span className="stat-value">{16 - whitePieces}/{16 - blackPieces}</span>
              <span className="stat-label">Captured</span>
            </div>
          </div>
        </div>

        <div className="end-actions">
          <button className="action-btn rematch-btn" onClick={onRematch}>
            🔄 Rematch
          </button>
          <button className="action-btn leave-btn" onClick={onLeave}>
            🚪 Leave
          </button>
        </div>
      </div>
    </div>
  );
}

