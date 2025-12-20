import type { QuantumPiece } from '@engine/types';

interface PieceProps {
  piece: QuantumPiece;
  probability: number;
}

// Unicode chess pieces
const PIECE_SYMBOLS: Record<string, Record<string, string>> = {
  white: {
    king: '♔',
    queen: '♕',
    rook: '♖',
    bishop: '♗',
    knight: '♘',
    pawn: '♙'
  },
  black: {
    king: '♚',
    queen: '♛',
    rook: '♜',
    bishop: '♝',
    knight: '♞',
    pawn: '♟'
  }
};

export function Piece({ piece, probability }: PieceProps) {
  const symbol = PIECE_SYMBOLS[piece.owner]?.[piece.type] ?? '?';
  const isInSuperposition = probability < 0.99;
  const opacity = Math.max(0.3, probability);
  
  return (
    <div 
      className={`piece ${piece.owner} ${isInSuperposition ? 'superposition' : ''}`}
      style={{ opacity }}
      title={`${piece.owner} ${piece.type} (${Math.round(probability * 100)}%)`}
    >
      <span className="piece-symbol">{symbol}</span>
      {isInSuperposition && (
        <div className="probability-badge">
          {Math.round(probability * 100)}%
        </div>
      )}
      {isInSuperposition && (
        <div className="quantum-glow" />
      )}
    </div>
  );
}

