import type { MoveRecord } from '@engine/types';
import { positionToAlgebraic } from '@engine/types';

interface MoveListProps {
  moves: MoveRecord[];
}

function formatMove(record: MoveRecord): string {
  const move = record.move;
  
  switch (move.type) {
    case 'classical':
      return `${move.pieceId.substring(1)}: ${positionToAlgebraic(move.from)}→${positionToAlgebraic(move.to)}${move.promotion ? `=${move.promotion[0]?.toUpperCase()}` : ''}`;
    
    case 'split':
      return `${move.pieceId.substring(1)}: ${positionToAlgebraic(move.from)}⟨→⟩${positionToAlgebraic(move.to1)}+${positionToAlgebraic(move.to2)}`;
    
    case 'merge':
      return `${move.pieceId.substring(1)}: ${positionToAlgebraic(move.from1)}+${positionToAlgebraic(move.from2)}→${positionToAlgebraic(move.to)}`;
    
    case 'capture':
      return `${move.pieceId.substring(1)}: ${positionToAlgebraic(move.from)}x${positionToAlgebraic(move.to)}`;
    
    default:
      return '?';
  }
}

export function MoveList({ moves }: MoveListProps) {
  if (moves.length === 0) {
    return <div className="move-list empty">No moves yet</div>;
  }

  // Group moves into pairs (white, black)
  const movePairs: Array<{ white?: MoveRecord; black?: MoveRecord; number: number }> = [];
  
  for (let i = 0; i < moves.length; i += 2) {
    movePairs.push({
      number: Math.floor(i / 2) + 1,
      white: moves[i],
      black: moves[i + 1]
    });
  }

  return (
    <div className="move-list">
      {movePairs.map((pair) => (
        <div key={pair.number} className="move-pair">
          <span className="move-number">{pair.number}.</span>
          <span className="white-move">
            {pair.white ? formatMove(pair.white) : '...'}
          </span>
          <span className="black-move">
            {pair.black ? formatMove(pair.black) : ''}
          </span>
        </div>
      ))}
    </div>
  );
}

