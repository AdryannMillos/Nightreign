/**
 * Timer phase calculation for the Night's Tide cycle.
 * Pure module — no Electron or side-effects. Fully unit-testable.
 *
 * Given how many seconds have elapsed since the day timer started, returns
 * a description of the current phase so the UI can render it without needing
 * to know anything about timing arithmetic.
 */

/**
 * @typedef {Object} PhaseState
 * @property {boolean} isBossFight    - True once the day duration has elapsed
 * @property {string}  currentPhase   - Display label for the overlay timer line
 * @property {number}  phaseTimeLeft  - Whole seconds remaining in the current phase/delay
 * @property {number}  phaseDuration  - Total duration of the current phase in seconds
 * @property {boolean} isShrinking    - True during shrinking phases (red text)
 * @property {string}  nextPhase      - Label of the upcoming phase (for preview)
 * @property {number}  phaseIndex     - Index into `phases` array (-1 = pre-first-phase)
 */

/**
 * Determine the active timer phase at `elapsed` seconds into a day.
 *
 * @param {number}   elapsed      - Seconds since day timer started (may be fractional)
 * @param {object[]} phases       - TIDE_PHASES from game-data (must have triggerAt, duration, label, shrinking)
 * @param {number}   dayDuration  - Total seconds before the boss fight begins
 * @param {number}   phaseDelay   - Gap in seconds between consecutive phases
 * @param {number}   currentDay   - Active day number (1–3), used to look up boss label
 * @param {object}   bossLabels   - Map of { [day]: string } from game-data
 * @returns {PhaseState}
 */
function getPhaseState(elapsed, phases, dayDuration, phaseDelay, currentDay, bossLabels) {
  // ── Boss fight ────────────────────────────────────────────────────────
  if (elapsed >= dayDuration) {
    return {
      isBossFight: true,
      currentPhase: bossLabels[currentDay] || 'Boss Fight',
      phaseTimeLeft: 0,
      phaseDuration: 0,
      isShrinking: false,
      nextPhase: currentDay < 3 ? 'Waiting for next day...' : '',
      phaseIndex: phases.length,
    };
  }

  // ── Find the last phase whose triggerAt has been reached ──────────────
  let phaseIndex = -1;
  for (let i = phases.length - 1; i >= 0; i--) {
    if (elapsed >= phases[i].triggerAt) {
      phaseIndex = i;
      break;
    }
  }

  // ── Active phase or inter-phase delay ────────────────────────────────
  if (phaseIndex >= 0) {
    const phase = phases[phaseIndex];
    const phaseEnd = phase.triggerAt + phase.duration;

    if (elapsed >= phaseEnd) {
      // We're in the brief gap between this phase and the next one.
      const nextPhase = phaseIndex < phases.length - 1 ? phases[phaseIndex + 1] : null;
      const nextStart = nextPhase ? nextPhase.triggerAt : dayDuration;
      const delayLeft = Math.max(0, nextStart - elapsed);
      const nextLabel = nextPhase ? nextPhase.label : (bossLabels[currentDay] || 'Boss Fight');
      return {
        isBossFight: false,
        currentPhase: `${nextLabel} in`,
        phaseTimeLeft: Math.ceil(delayLeft),
        phaseDuration: phaseDelay,
        isShrinking: false,
        nextPhase: nextLabel,
        phaseIndex,
      };
    }

    // Phase is actively running.
    const timeLeft = Math.max(0, phaseEnd - elapsed);
    const nextLabel = phaseIndex < phases.length - 1
      ? phases[phaseIndex + 1].label
      : (bossLabels[currentDay] || 'Boss Fight');
    return {
      isBossFight: false,
      currentPhase: phase.label,
      phaseTimeLeft: Math.ceil(timeLeft),
      phaseDuration: phase.duration,
      isShrinking: phase.shrinking,
      nextPhase: nextLabel,
      phaseIndex,
    };
  }

  // ── Before first phase — initial countdown to Storm ───────────────────
  const timeLeft = Math.max(0, phases[0].triggerAt - elapsed);
  return {
    isBossFight: false,
    currentPhase: 'Storm in',
    phaseTimeLeft: Math.ceil(timeLeft),
    phaseDuration: phases[0].triggerAt,
    isShrinking: false,
    nextPhase: phases[0].label,
    phaseIndex: -1,
  };
}

module.exports = { getPhaseState };
