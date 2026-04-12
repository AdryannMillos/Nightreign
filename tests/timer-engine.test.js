/**
 * Tests for src/timer-engine.js
 *
 * Uses the real TIDE_PHASES from game-data so the tests are tied to actual
 * game timings rather than brittle hard-coded copies. Specific elapsed values
 * are derived from the known phase schedule:
 *
 *   Phase 0 — Storm           triggerAt=5,   duration=270  → active 5..275
 *   Phase 1 — Storm Shrinking triggerAt=280,  duration=180  → active 280..460
 *   Phase 2 — Storm 2         triggerAt=465,  duration=210  → active 465..675
 *   Phase 3 — Storm 2 Shrink  triggerAt=680,  duration=180  → active 680..860
 *   Boss fight                                               → elapsed >= 860
 */
const { getPhaseState } = require('../src/timer-engine');
const gameData          = require('../src/game-data');

// Convenience: call getPhaseState with real game constants
function phase(elapsed, day = 1) {
  return getPhaseState(
    elapsed,
    gameData.TIDE_PHASES,
    gameData.DAY_DURATION,
    gameData.PHASE_DELAY,
    day,
    gameData.BOSS_LABELS,
  );
}

// ─── Pre-first-phase initial delay ──────────────────────────────────

describe('Initial delay before Storm', () => {
  test('elapsed=0 → "Storm in", not boss, not shrinking', () => {
    const s = phase(0);
    expect(s.isBossFight).toBe(false);
    expect(s.currentPhase).toBe('Storm in');
    expect(s.isShrinking).toBe(false);
    expect(s.phaseIndex).toBe(-1);
  });

  test('elapsed=0 → phaseTimeLeft equals first phase triggerAt', () => {
    const s = phase(0);
    expect(s.phaseTimeLeft).toBe(gameData.TIDE_PHASES[0].triggerAt);
  });

  test('elapsed=2 → phaseTimeLeft counts down correctly', () => {
    const s = phase(2);
    const expected = Math.ceil(gameData.TIDE_PHASES[0].triggerAt - 2);
    expect(s.phaseTimeLeft).toBe(expected);
  });

  test('nextPhase is the first phase label', () => {
    const s = phase(0);
    expect(s.nextPhase).toBe(gameData.TIDE_PHASES[0].label);
  });
});

// ─── Storm (Phase 0) ────────────────────────────────────────────────

describe('Storm phase (phase 0)', () => {
  const stormStart = gameData.TIDE_PHASES[0].triggerAt; // 5

  test('elapsed at phase start → currentPhase is "Storm"', () => {
    const s = phase(stormStart);
    expect(s.currentPhase).toBe('Storm');
    expect(s.isBossFight).toBe(false);
    expect(s.isShrinking).toBe(false);
    expect(s.phaseIndex).toBe(0);
  });

  test('elapsed mid-Storm → phaseTimeLeft is positive', () => {
    const midStorm = stormStart + 100;
    const s = phase(midStorm);
    expect(s.phaseTimeLeft).toBeGreaterThan(0);
    expect(s.currentPhase).toBe('Storm');
  });

  test('elapsed near end of Storm → phaseTimeLeft approaches 0', () => {
    const almostEnd = stormStart + gameData.TIDE_PHASES[0].duration - 1;
    const s = phase(almostEnd);
    expect(s.phaseTimeLeft).toBeLessThanOrEqual(2);
  });
});

// ─── Inter-phase delay (between Storm and Storm Shrinking) ──────────

describe('Inter-phase delay (Storm → Storm Shrinking)', () => {
  const stormEnd         = gameData.TIDE_PHASES[0].triggerAt + gameData.TIDE_PHASES[0].duration; // 275
  const nextPhaseStart   = gameData.TIDE_PHASES[1].triggerAt; // 280

  test('elapsed at exact stormEnd → shows upcoming phase label', () => {
    const s = phase(stormEnd);
    expect(s.isBossFight).toBe(false);
    expect(s.currentPhase).toBe(`${gameData.TIDE_PHASES[1].label} in`);
    expect(s.isShrinking).toBe(false);
  });

  test('delay phaseTimeLeft is within the PHASE_DELAY window', () => {
    const s = phase(stormEnd);
    expect(s.phaseTimeLeft).toBeGreaterThanOrEqual(0);
    expect(s.phaseTimeLeft).toBeLessThanOrEqual(gameData.PHASE_DELAY);
  });

  test('elapsed one second before next phase start → phaseTimeLeft = 1', () => {
    const s = phase(nextPhaseStart - 1);
    expect(s.phaseTimeLeft).toBe(1);
  });
});

// ─── Storm Shrinking (Phase 1) ───────────────────────────────────────

describe('Storm Shrinking phase (phase 1)', () => {
  const shrinkStart = gameData.TIDE_PHASES[1].triggerAt; // 280

  test('elapsed at phase start → isShrinking = true', () => {
    const s = phase(shrinkStart);
    expect(s.isShrinking).toBe(true);
    expect(s.currentPhase).toBe('Storm Shrinking');
    expect(s.phaseIndex).toBe(1);
  });
});

// ─── Storm 2 (Phase 2) ───────────────────────────────────────────────

describe('Storm 2 phase (phase 2)', () => {
  const storm2Start = gameData.TIDE_PHASES[2].triggerAt; // 465

  test('elapsed at phase start → isShrinking = false', () => {
    const s = phase(storm2Start);
    expect(s.isShrinking).toBe(false);
    expect(s.currentPhase).toBe('Storm 2');
    expect(s.phaseIndex).toBe(2);
  });
});

// ─── Storm 2 Shrinking (Phase 3) ────────────────────────────────────

describe('Storm 2 Shrinking phase (phase 3)', () => {
  const shrink2Start = gameData.TIDE_PHASES[3].triggerAt; // 680

  test('elapsed at phase start → isShrinking = true', () => {
    const s = phase(shrink2Start);
    expect(s.isShrinking).toBe(true);
    expect(s.currentPhase).toBe('Storm 2 Shrinking');
    expect(s.phaseIndex).toBe(3);
  });

  test('nextPhase points to the boss label for day 1', () => {
    const s = phase(shrink2Start, 1);
    expect(s.nextPhase).toBe(gameData.BOSS_LABELS[1] || 'Boss Fight');
  });
});

// ─── Boss fight ──────────────────────────────────────────────────────

describe('Boss fight', () => {
  test('elapsed at exact DAY_DURATION → isBossFight = true', () => {
    const s = phase(gameData.DAY_DURATION);
    expect(s.isBossFight).toBe(true);
    expect(s.phaseTimeLeft).toBe(0);
  });

  test('elapsed well past DAY_DURATION still returns boss fight', () => {
    const s = phase(gameData.DAY_DURATION + 300);
    expect(s.isBossFight).toBe(true);
  });

  test('boss phase label for day 1 uses BOSS_LABELS[1]', () => {
    const s = phase(gameData.DAY_DURATION, 1);
    expect(s.currentPhase).toBe(gameData.BOSS_LABELS[1] || 'Boss Fight');
  });

  test('boss phase label for day 2 uses BOSS_LABELS[2]', () => {
    const s = phase(gameData.DAY_DURATION, 2);
    expect(s.currentPhase).toBe(gameData.BOSS_LABELS[2] || 'Boss Fight');
  });

  test('day < 3: nextPhase is "Waiting for next day..."', () => {
    const s = phase(gameData.DAY_DURATION, 1);
    expect(s.nextPhase).toBe('Waiting for next day...');
  });

  test('day 3: nextPhase is empty string (no more days)', () => {
    const s = phase(gameData.DAY_DURATION, 3);
    expect(s.nextPhase).toBe('');
  });
});

// ─── Fractional elapsed values ───────────────────────────────────────

describe('Fractional elapsed (sub-second ticks)', () => {
  test('elapsed=4.9 is still in the initial delay', () => {
    const s = phase(4.9);
    expect(s.currentPhase).toBe('Storm in');
    expect(s.phaseTimeLeft).toBe(1); // Math.ceil(5 - 4.9) = 1
  });

  test('elapsed=5.5 is already in Storm', () => {
    const s = phase(5.5);
    expect(s.currentPhase).toBe('Storm');
  });

  test('phaseTimeLeft is always a whole number (Math.ceil applied)', () => {
    [0, 1.1, 5.5, 100.7, 279.3, 680.0, 860.0].forEach(e => {
      const s = phase(e);
      expect(Number.isInteger(s.phaseTimeLeft)).toBe(true);
    });
  });
});
