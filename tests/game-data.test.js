/**
 * Tests for game-data.js
 *
 * game-data.js has no Electron imports, so it can run in plain Node.js.
 * These tests verify the rune cost table, level helpers, and phase timing
 * calculations that the rest of the app depends on.
 */
const gameData = require('../src/game-data');

// ─── Constants ──────────────────────────────────────────────────────

describe('level constants', () => {
  test('MIN_LEVEL is 1', () => {
    expect(gameData.MIN_LEVEL).toBe(1);
  });

  test('MAX_LEVEL is 15', () => {
    expect(gameData.MAX_LEVEL).toBe(15);
  });
});

// ─── RUNE_COSTS table ───────────────────────────────────────────────

describe('RUNE_COSTS table', () => {
  test('has an entry for every level from 1 to MAX_LEVEL', () => {
    expect(gameData.RUNE_COSTS).toHaveLength(gameData.MAX_LEVEL);
    for (let lvl = 1; lvl <= gameData.MAX_LEVEL; lvl++) {
      expect(gameData.RUNE_COSTS.find(r => r.level === lvl)).toBeDefined();
    }
  });

  test('level 1 has cost 0 and total 0', () => {
    const entry = gameData.RUNE_COSTS.find(r => r.level === 1);
    expect(entry.cost).toBe(0);
    expect(entry.total).toBe(0);
  });

  test('totals are cumulative sums of costs', () => {
    // Verify two properties:
    //   1. total[i] = sum of all costs up to and including level i
    //   2. cost[i] = total[i] - total[i-1]  (each incremental cost is consistent)
    let sum = 0;
    for (let i = 0; i < gameData.RUNE_COSTS.length; i++) {
      const entry = gameData.RUNE_COSTS[i];
      sum += entry.cost;
      expect(entry.total).toBe(sum);

      if (i > 0) {
        const diff = entry.total - gameData.RUNE_COSTS[i - 1].total;
        expect(diff).toBe(entry.cost);
      }
    }
  });

  test('costs are non-negative and increase with level', () => {
    // Level 1 cost is 0 (start), then all subsequent costs must be > 0
    for (let i = 1; i < gameData.RUNE_COSTS.length; i++) {
      expect(gameData.RUNE_COSTS[i].cost).toBeGreaterThan(0);
    }
    // Each level costs more than the previous (progressive difficulty)
    for (let i = 2; i < gameData.RUNE_COSTS.length; i++) {
      expect(gameData.RUNE_COSTS[i].cost).toBeGreaterThan(gameData.RUNE_COSTS[i - 1].cost);
    }
  });
});

// ─── getRunesNeededForNextLevel ──────────────────────────────────────

describe('getRunesNeededForNextLevel', () => {
  test('returns the cost entry for the next level', () => {
    const result = gameData.getRunesNeededForNextLevel(1);
    expect(result).not.toBeNull();
    expect(result.level).toBe(2);
    expect(result.cost).toBeGreaterThan(0);
  });

  test('returns correct cost for level 7', () => {
    const result = gameData.getRunesNeededForNextLevel(7);
    expect(result.level).toBe(8);
    expect(result.cost).toBe(32137);
  });

  test('returns null when already at MAX_LEVEL', () => {
    expect(gameData.getRunesNeededForNextLevel(gameData.MAX_LEVEL)).toBeNull();
  });

  test('returns null for level above MAX_LEVEL', () => {
    expect(gameData.getRunesNeededForNextLevel(gameData.MAX_LEVEL + 1)).toBeNull();
  });
});

// ─── getRuneCostForLevel ─────────────────────────────────────────────

describe('getRuneCostForLevel', () => {
  test('returns the cost entry for a valid level', () => {
    const result = gameData.getRuneCostForLevel(5);
    expect(result).not.toBeNull();
    expect(result.level).toBe(5);
  });

  test('returns null for level below MIN_LEVEL', () => {
    expect(gameData.getRuneCostForLevel(0)).toBeNull();
  });

  test('returns null for level above MAX_LEVEL', () => {
    expect(gameData.getRuneCostForLevel(16)).toBeNull();
  });
});

// ─── TIDE_PHASES ────────────────────────────────────────────────────

describe('TIDE_PHASES', () => {
  test('has exactly 4 phases', () => {
    expect(gameData.TIDE_PHASES).toHaveLength(4);
  });

  test('first phase triggerAt equals PHASE_DELAY (initial countdown)', () => {
    expect(gameData.TIDE_PHASES[0].triggerAt).toBe(gameData.PHASE_DELAY);
  });

  test('each subsequent phase triggerAt = previous triggerAt + previous duration + PHASE_DELAY', () => {
    const phases = gameData.TIDE_PHASES;
    for (let i = 1; i < phases.length; i++) {
      const expected = phases[i - 1].triggerAt + phases[i - 1].duration + gameData.PHASE_DELAY;
      expect(phases[i].triggerAt).toBe(expected);
    }
  });

  test('shrinking phases are correctly flagged', () => {
    // Phases 1 and 3 (0-indexed) are shrinking; phases 0 and 2 are not
    expect(gameData.TIDE_PHASES[0].shrinking).toBe(false);
    expect(gameData.TIDE_PHASES[1].shrinking).toBe(true);
    expect(gameData.TIDE_PHASES[2].shrinking).toBe(false);
    expect(gameData.TIDE_PHASES[3].shrinking).toBe(true);
  });

  test('all phases have positive durations', () => {
    for (const phase of gameData.TIDE_PHASES) {
      expect(phase.duration).toBeGreaterThan(0);
    }
  });
});

// ─── DAY_DURATION ───────────────────────────────────────────────────

describe('DAY_DURATION', () => {
  test('equals last phase triggerAt + last phase duration', () => {
    const last = gameData.TIDE_PHASES[gameData.TIDE_PHASES.length - 1];
    expect(gameData.DAY_DURATION).toBe(last.triggerAt + last.duration);
  });

  test('is greater than 0', () => {
    expect(gameData.DAY_DURATION).toBeGreaterThan(0);
  });
});
