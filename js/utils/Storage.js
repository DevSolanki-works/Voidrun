/**
 * Storage.js
 * Browser localStorage persistence manager for VOIDRUN
 * Safely persists best agent genome, training metrics, and high scores.
 */

const STORAGE_KEYS = {
  BEST_AGENT: 'voidrun_best_agent_v1',
  TRAINING_STATE: 'voidrun_training_state_v1',
  HIGH_SCORE: 'voidrun_high_score_v1',
  SETTINGS: 'voidrun_settings_v1'
};

export const DEFAULT_SETTINGS = {
  // Gameplay & Challenge
  difficulty: 'standard',     // 'relaxed' | 'standard' | 'intense'
  adaptiveArena: 'gentle',    // 'off' | 'gentle' | 'strong'

  // Audio & Feedback
  soundEnabled: true,
  volume: 0.7,
  screenShake: 'on',          // 'on' | 'reduced' | 'off'
  flashEffects: 'on',         // 'on' | 'off'

  // AI & Viewing
  aiViewMode: 'game',         // 'game' (polished gameplay) | 'insight' (AI overlay)
  trainingSpeed: 'fast',      // '1x' (Watchable) | '5x' (Fast) | 'fast' (Turbo/25x) | 'max' (Max/Headless)

  // Advanced AI Hyperparameters (applied to future training generations)
  populationSize: 36,         // 20 - 60
  mutationRate: 0.08,         // 0.01 - 0.30
  elitismCount: 2             // 1 - 5
};

export class Storage {
  static saveBestAgent(genome, fitness, generation, metadata = {}) {
    try {
      const payload = {
        genome,
        fitness,
        generation,
        savedAt: new Date().toISOString(),
        metadata
      };
      localStorage.setItem(STORAGE_KEYS.BEST_AGENT, JSON.stringify(payload));
      return true;
    } catch (err) {
      console.warn('Failed to save best agent to localStorage:', err);
      return false;
    }
  }

  static loadBestAgent() {
    try {
      const item = localStorage.getItem(STORAGE_KEYS.BEST_AGENT);
      if (!item) return null;
      return JSON.parse(item);
    } catch (err) {
      console.warn('Failed to load best agent from localStorage:', err);
      return null;
    }
  }

  static clearBestAgent() {
    try {
      localStorage.removeItem(STORAGE_KEYS.BEST_AGENT);
      return true;
    } catch (err) {
      return false;
    }
  }

  static hasBestAgent() {
    return localStorage.getItem(STORAGE_KEYS.BEST_AGENT) !== null;
  }

  static saveHighScore(score, time) {
    try {
      const current = this.loadHighScore();
      const next = {
        score: Math.max(Number(current?.score) || 0, Number(score) || 0),
        time: current?.time || time,
        survivalTime: Math.max(Number(current?.survivalTime) || 0, Number(time) || 0),
        date: current?.date || new Date().toISOString()
      };
      if (!current || score > current.score || Number(time) > (Number(current.survivalTime) || Number(current.time) || 0)) {
        if (Number(time) > (Number(current?.survivalTime) || Number(current?.time) || 0)) {
          next.date = new Date().toISOString();
        }
        localStorage.setItem(
          STORAGE_KEYS.HIGH_SCORE,
          JSON.stringify(next)
        );
      }
    } catch (err) {
      console.warn('Failed to save high score:', err);
    }
  }

  static loadHighScore() {
    try {
      const item = localStorage.getItem(STORAGE_KEYS.HIGH_SCORE);
      if (!item) return { score: 0, time: 0, survivalTime: 0 };
      const saved = JSON.parse(item);
      return { ...saved, survivalTime: Number(saved.survivalTime) || Number(saved.time) || 0 };
    } catch (err) {
      return { score: 0, time: 0, survivalTime: 0 };
    }
  }

  static loadSettings() {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (!saved) return { ...DEFAULT_SETTINGS };
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch (err) {
      console.warn('Failed to load settings from localStorage:', err);
      return { ...DEFAULT_SETTINGS };
    }
  }

  static saveSettings(settings) {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
      return true;
    } catch (err) {
      console.warn('Failed to save settings to localStorage:', err);
      return false;
    }
  }

  static resetSettings() {
    try {
      localStorage.removeItem(STORAGE_KEYS.SETTINGS);
      return { ...DEFAULT_SETTINGS };
    } catch (err) {
      return { ...DEFAULT_SETTINGS };
    }
  }

  static clearAllData() {
    try {
      localStorage.removeItem(STORAGE_KEYS.BEST_AGENT);
      localStorage.removeItem(STORAGE_KEYS.TRAINING_STATE);
      localStorage.removeItem(STORAGE_KEYS.HIGH_SCORE);
      localStorage.removeItem(STORAGE_KEYS.SETTINGS);
      return true;
    } catch (err) {
      console.warn('Failed to clear all data:', err);
      return false;
    }
  }
}
