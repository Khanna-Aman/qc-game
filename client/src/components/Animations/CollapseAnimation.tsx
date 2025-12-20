import { useEffect, useState } from 'react';
import type { Position } from '@engine/types';
import './Animations.css';

export interface CollapseEvent {
  id: string;
  pieceType: string;
  owner: 'white' | 'black';
  fromPositions: Position[];  // Positions where the piece was in superposition
  toPosition: Position;       // Position where it collapsed
  timestamp: number;
}

interface CollapseAnimationProps {
  event: CollapseEvent;
  squareSize: number;
  boardFlipped: boolean;
  onComplete: () => void;
}

export function CollapseAnimation({ 
  event, 
  squareSize, 
  boardFlipped,
  onComplete 
}: CollapseAnimationProps) {
  const [phase, setPhase] = useState<'gathering' | 'flash' | 'done'>('gathering');

  useEffect(() => {
    // Gathering phase (particles fly to collapse position)
    const flashTimer = setTimeout(() => setPhase('flash'), 600);
    const doneTimer = setTimeout(() => {
      setPhase('done');
      onComplete();
    }, 1000);

    return () => {
      clearTimeout(flashTimer);
      clearTimeout(doneTimer);
    };
  }, [onComplete]);

  if (phase === 'done') return null;

  const getSquareCenter = (pos: Position) => {
    const file = boardFlipped ? 7 - pos.file : pos.file;
    const rank = boardFlipped ? pos.rank : 7 - pos.rank;
    return {
      x: file * squareSize + squareSize / 2,
      y: rank * squareSize + squareSize / 2
    };
  };

  const targetCenter = getSquareCenter(event.toPosition);

  return (
    <div className="collapse-animation-container">
      {/* Particles from each superposition position */}
      {phase === 'gathering' && event.fromPositions
        .filter(pos => pos.file !== event.toPosition.file || pos.rank !== event.toPosition.rank)
        .map((pos, i) => {
          const sourceCenter = getSquareCenter(pos);
          return (
            <div
              key={i}
              className="collapse-particle"
              style={{
                '--start-x': `${sourceCenter.x}px`,
                '--start-y': `${sourceCenter.y}px`,
                '--end-x': `${targetCenter.x}px`,
                '--end-y': `${targetCenter.y}px`,
              } as React.CSSProperties}
            />
          );
        })}

      {/* Flash effect at collapse position */}
      {phase === 'flash' && (
        <div
          className="collapse-flash"
          style={{
            left: targetCenter.x,
            top: targetCenter.y,
          }}
        />
      )}

      {/* Measurement indicator */}
      <div 
        className={`measurement-indicator ${phase}`}
        style={{
          left: targetCenter.x,
          top: targetCenter.y,
        }}
      >
        ⚛️
      </div>
    </div>
  );
}

