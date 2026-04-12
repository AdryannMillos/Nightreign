/**
 * Tests for src/timer-engine.js
 *
 * Uses the real TIDE_PHASES from game-data so the tests stay in sync with
 * any future timing adjustments. Phase schedule with PHASE_DELAY=0:
 *
 *   Phase 0 — Storm           triggerAt=0,   duration=272  → active   0..272
 *   Phase 1 — Storm Shrinking triggerAt=272,  duration=180  → active 272..452
 *   Phase 2 — Storm 2         triggerAt=452,  duration=210  → active 452..662
 *   Phase 3 — Storm 2 Shrink  triggerAt=662,  duration=180  → active 662..842
 *   Boss fight                                               → elapsed >= 842
 *
 * With PHASE_DELAY=0 there is no pre-Storm countdown or inter-phase gap,
 * so those code paths are exercised only for robustness.
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

// ─── Storm (Phase 0) — starts immediately at elapsed=0 ──────────────

describe('Storm phase (phase 0)', () => {
  const stormStart = gameData.TIDE_PHASES[0].triggerAt; // 0 with PHASE_DELAY=0

  test('elapsed=0 → Storm is already active', () => {
    const s = phase(0);
    expect(s.currentPhase).toBe('Storm');
    expect(s.isBossFight).toBe(false);
    expect(s.isShrinking).toBe(false);
    expect(s.phaseIndex).toBe(0);
  });

  test('elapsed at phase start → correct Storm state', () => {
    const s = phase(stormStart);
    expect(s.currentPhase).toBe('Storm');
    expect(s.isBossFight).toBe(false);
    expect(s.isShrinking).toBe(false);
    expect(s.phaseIndex).toBe(0);
  });

  test('elapsed=0 → phaseTimeLeft equals Storm duration', () => {
    const s = phase(0);
    expect(s.phaseTimeLeft).toBe(gameData.TIDE_PHASES[0].duration);
  });

  test('elapsed mid-Storm → phaseTimeLeft is positive', () => {
    const s = phase(100);
    expect(s.phaseTimeLeft).toBeGreaterThan(0);
    expect(s.currentPhase).toBe('Storm');
  });

  test('elapsed near end of Storm → phaseTimeLeft approaches 0', () => {
    const almostEnd = gameData.TIDE_PHASES[0].duration - 1;
    const s = phase(almostEnd);
    expect(s.phaseTimeLeft).toBeLessThanOrEqual(2);
  });

  test('nextPhase during Storm is "Storm Shrinking"', () => {
    const s = phase(0);
    expect(s.nextPhase).toBe(gameData.TIDE_PHASES[1].label);
  });
});

// ─── Storm Shrinking (Phase 1) ───────────────────────────────────────

describe('Storm Shrinking phase (phase 1)', () => {
  const shrinkStart = gameData.TIDE_PHASES[1].triggerAt;

  test('elapsed at phase start → isShrinking = true', () => {
    const s = phase(shrinkStart);
    expect(s.isShrinking).toBe(true);
    expect(s.currentPhase).toBe('Storm Shrinking');
    expect(s.phaseIndex).toBe(1);
  });

  test('phaseTimeLeft equals full duration at phase start', () => {
    const s = phase(shrinkStart);
    expect(s.phaseTimeLeft).toBe(gameData.TIDE_PHASES[1].duration);
  });
});

// ─── Storm 2 (Phase 2) ───────────────────────────────────────────────

describe('Storm 2 phase (phase 2)', () => {
  const storm2Start = gameData.TIDE_PHASES[2].triggerAt;

  test('elapsed at phase start → isShrinking = false', () => {
    const s = phase(storm2Start);
    expect(s.isShrinking).toBe(false);
    expect(s.currentPhase).toBe('Storm 2');
    expect(s.phaseIndex).toBe(2);
  });
});

// ─── Storm 2 Shrinking (Phase 3) ────────────────────────────────────

describe('Storm 2 Shrinking phase (phase 3)', () => {
  const shrink2Start = gameData.TIDE_PHASES[3].triggerAt;

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

// ─── Phase boundary transitions ──────────────────────────────────────

describe('Phase boundary transitions', () => {
  test('one tick before Storm Shrinking → still Storm', () => {
    const s = phase(gameData.TIDE_PHASES[1].triggerAt - 0.001);
    expect(s.currentPhase).toBe('Storm');
  });

  test('exact Storm Shrinking boundary → Storm Shrinking', () => {
    const s = phase(gameData.TIDE_PHASES[1].triggerAt);
    expect(s.currentPhase).toBe('Storm Shrinking');
    expect(s.isShrinking).toBe(true);
  });

  test('one tick before Storm 2 → still Storm Shrinking', () => {
    const s = phase(gameData.TIDE_PHASES[2].triggerAt - 0.001);
    expect(s.currentPhase).toBe('Storm Shrinking');
  });

  test('exact Storm 2 boundary → Storm 2', () => {
    const s = phase(gameData.TIDE_PHASES[2].triggerAt);
    expect(s.currentPhase).toBe('Storm 2');
  });

  test('one tick before Storm 2 Shrinking → still Storm 2', () => {
    const s = phase(gameData.TIDE_PHASES[3].triggerAt - 0.001);
    expect(s.currentPhase).toBe('Storm 2');
  });

  test('exact Storm 2 Shrinking boundary → Storm 2 Shrinking', () => {
    const s = phase(gameData.TIDE_PHASES[3].triggerAt);
    expect(s.currentPhase).toBe('Storm 2 Shrinking');
    expect(s.isShrinking).toBe(true);
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
  test('elapsed=0.5 is already in Storm', () => {
    const s = phase(0.5);
    expect(s.currentPhase).toBe('Storm');
  });

  test('phaseTimeLeft is always a whole number (Math.ceil applied)', () => {
    [0, 0.5, 100.7, 271.9, 272.0, 451.3, 662.0, 841.9, 842.0].forEach(e => {
      const s = phase(e);
      expect(Number.isInteger(s.phaseTimeLeft)).toBe(true);
    });
  });
});

// ─── DAY_DURATION sanity check ───────────────────────────────────────

describe('DAY_DURATION value (842 seconds = 14:02)', () => {
  test('equals 842 seconds with current timings', () => {
    // 272 + 180 + 210 + 180 = 842 (no inter-phase gaps)
    expect(gameData.DAY_DURATION).toBe(842);
  });
});
