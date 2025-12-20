/**
 * Game State Persistence Hook
 * Saves/restores game state to localStorage for recovery
 */

import { useCallback, useEffect } from 'react';
import type { GameState, Player } from '@engine/types';

const STORAGE_KEY = 'quantum_chess_saved_game';

interface SavedGame {
  gameState: GameState;
  playerColor: Player;
  roomId: string;
  gameSeed: number;
  savedAt: number;
}

export function useGamePersistence() {
  /**
   * Save current game state to localStorage
   */
  const saveGame = useCallback((
    gameState: GameState,
    playerColor: Player,
    roomId: string,
    gameSeed: number
  ) => {
    const savedGame: SavedGame = {
      gameState,
      playerColor,
      roomId,
      gameSeed,
      savedAt: Date.now()
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedGame));
      console.log('[Persistence] Game saved');
    } catch (err) {
      console.error('[Persistence] Failed to save game:', err);
    }
  }, []);

  /**
   * Load saved game from localStorage
   */
  const loadGame = useCallback((): SavedGame | null => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return null;

      const saved = JSON.parse(data) as SavedGame;
      
      // Check if save is less than 24 hours old
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      if (Date.now() - saved.savedAt > maxAge) {
        console.log('[Persistence] Saved game expired');
        clearSavedGame();
        return null;
      }

      console.log('[Persistence] Game loaded from', new Date(saved.savedAt).toLocaleString());
      return saved;
    } catch (err) {
      console.error('[Persistence] Failed to load game:', err);
      return null;
    }
  }, []);

  /**
   * Clear saved game from localStorage
   */
  const clearSavedGame = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      console.log('[Persistence] Saved game cleared');
    } catch (err) {
      console.error('[Persistence] Failed to clear saved game:', err);
    }
  }, []);

  /**
   * Check if there's a saved game
   */
  const hasSavedGame = useCallback((): boolean => {
    return loadGame() !== null;
  }, [loadGame]);

  return {
    saveGame,
    loadGame,
    clearSavedGame,
    hasSavedGame
  };
}

/**
 * Hook to auto-save game state on changes
 */
export function useAutoSave(
  gameState: GameState | null,
  playerColor: Player,
  roomId: string | null,
  gameSeed: number | null,
  isConnected: boolean
) {
  const { saveGame, clearSavedGame } = useGamePersistence();

  useEffect(() => {
    // Only save if we have a valid game in progress
    if (gameState && roomId && gameSeed !== null && isConnected) {
      // Don't save if game is over
      if (gameState.gameStatus === 'active') {
        saveGame(gameState, playerColor, roomId, gameSeed);
      }
    }
  }, [gameState, playerColor, roomId, gameSeed, isConnected, saveGame]);

  // Clear saved game when intentionally leaving
  useEffect(() => {
    return () => {
      // This runs on unmount - don't clear since we might want to recover
    };
  }, []);

  return { clearSavedGame };
}

