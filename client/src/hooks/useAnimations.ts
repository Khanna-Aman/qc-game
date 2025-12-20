/**
 * Animation Manager Hook
 * Manages queued animations for moves and collapses
 */

import { useState, useCallback } from 'react';
import type { CollapseEvent } from '../components/Animations';
import type { MoveAnimationEvent } from '../components/Animations';

export function useAnimations() {
  const [collapseAnimations, setCollapseAnimations] = useState<CollapseEvent[]>([]);
  const [moveAnimations, setMoveAnimations] = useState<MoveAnimationEvent[]>([]);

  const addCollapseAnimation = useCallback((event: Omit<CollapseEvent, 'id' | 'timestamp'>) => {
    const newEvent: CollapseEvent = {
      ...event,
      id: `collapse-${Date.now()}-${Math.random()}`,
      timestamp: Date.now()
    };
    setCollapseAnimations(prev => [...prev, newEvent]);
  }, []);

  const removeCollapseAnimation = useCallback((id: string) => {
    setCollapseAnimations(prev => prev.filter(a => a.id !== id));
  }, []);

  const addMoveAnimation = useCallback((event: Omit<MoveAnimationEvent, 'id' | 'timestamp'>) => {
    const newEvent: MoveAnimationEvent = {
      ...event,
      id: `move-${Date.now()}-${Math.random()}`,
      timestamp: Date.now()
    };
    setMoveAnimations(prev => [...prev, newEvent]);
  }, []);

  const removeMoveAnimation = useCallback((id: string) => {
    setMoveAnimations(prev => prev.filter(a => a.id !== id));
  }, []);

  const clearAllAnimations = useCallback(() => {
    setCollapseAnimations([]);
    setMoveAnimations([]);
  }, []);

  return {
    collapseAnimations,
    moveAnimations,
    addCollapseAnimation,
    removeCollapseAnimation,
    addMoveAnimation,
    removeMoveAnimation,
    clearAllAnimations
  };
}

