import type { Position } from '@engine/types';
import type { ReactNode } from 'react';

interface SquareProps {
  position: Position;
  isLight: boolean;
  isSelected: boolean;
  isValidTarget: boolean;
  isSplitTarget: boolean;
  onClick: () => void;
  children: ReactNode;
}

export function Square({
  position,
  isLight,
  isSelected,
  isValidTarget,
  isSplitTarget,
  onClick,
  children
}: SquareProps) {
  const classes = [
    'square',
    isLight ? 'light' : 'dark',
    isSelected ? 'selected' : '',
    isValidTarget ? 'valid-target' : '',
    isSplitTarget ? 'split-target' : ''
  ].filter(Boolean).join(' ');

  // File labels (a-h) and rank labels (1-8)
  const fileLabel = position.rank === 0 ? String.fromCharCode(97 + position.file) : null;
  const rankLabel = position.file === 0 ? String(position.rank + 1) : null;

  return (
    <div className={classes} onClick={onClick} data-file={position.file} data-rank={position.rank}>
      {children}
      {isValidTarget && !isSplitTarget && <div className="move-indicator" />}
      {isSplitTarget && <div className="split-indicator">⟨1⟩</div>}
      {fileLabel && <span className="file-label">{fileLabel}</span>}
      {rankLabel && <span className="rank-label">{rankLabel}</span>}
    </div>
  );
}

