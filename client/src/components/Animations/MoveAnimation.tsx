import { useEffect, useState } from 'react';
import type { Position, PieceType } from '@engine/types';
import './Animations.css';

// Unicode chess pieces
const PIECE_SYMBOLS: Record<string, Record<string, string>> = {
  white: {
    king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙'
  },
  black: {
    king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟'
  }
};

export interface MoveAnimationEvent {
  id: string;
  pieceType: PieceType;
  owner: 'white' | 'black';
  from: Position;
  to: Position;
  isSplit?: boolean;  // If true, this is one branch of a split
  splitTo2?: Position; // Second position for split moves
  timestamp: number;
}

interface MoveAnimationProps {
  event: MoveAnimationEvent;
  squareSize: number;
  boardFlipped: boolean;
  onComplete: () => void;
}

export function MoveAnimation({
  event,
  squareSize,
  boardFlipped,
  onComplete
}: MoveAnimationProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onComplete();
    }, 300);

    return () => clearTimeout(timer);
  }, [onComplete]);

  if (!visible) return null;

  const getSquareCenter = (pos: Position) => {
    const file = boardFlipped ? 7 - pos.file : pos.file;
    const rank = boardFlipped ? pos.rank : 7 - pos.rank;
    return {
      x: file * squareSize + squareSize / 2,
      y: rank * squareSize + squareSize / 2
    };
  };

  const fromCenter = getSquareCenter(event.from);
  const toCenter = getSquareCenter(event.to);
  const symbol = PIECE_SYMBOLS[event.owner]?.[event.pieceType] ?? '?';

  return (
    <div className="move-animation-container">
      {/* Main piece animation */}
      <div
        className={`moving-piece ${event.owner} ${event.isSplit ? 'split' : ''}`}
        style={{
          '--start-x': `${fromCenter.x}px`,
          '--start-y': `${fromCenter.y}px`,
          '--end-x': `${toCenter.x}px`,
          '--end-y': `${toCenter.y}px`,
          fontSize: `${squareSize * 0.7}px`,
        } as React.CSSProperties}
      >
        {symbol}
      </div>

      {/* Second piece for split moves */}
      {event.isSplit && event.splitTo2 && (
        <div
          className={`moving-piece ${event.owner} split`}
          style={{
            '--start-x': `${fromCenter.x}px`,
            '--start-y': `${fromCenter.y}px`,
            '--end-x': `${getSquareCenter(event.splitTo2).x}px`,
            '--end-y': `${getSquareCenter(event.splitTo2).y}px`,
            fontSize: `${squareSize * 0.7}px`,
          } as React.CSSProperties}
        >
          {symbol}
        </div>
      )}

      {/* Split trail effect */}
      {event.isSplit && (
        <div
          className="split-trail"
          style={{
            left: fromCenter.x,
            top: fromCenter.y,
          }}
        />
      )}
    </div>
  );
}

