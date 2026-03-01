const $ = (sel) => document.querySelector(sel);

const els = {
  dayLabel: $('#day-label'),
  shrinkBadge: $('#shrink-badge'),
  phaseName: $('#phase-name'),
  phaseCountdown: $('#phase-countdown'),
  phaseBar: $('#phase-bar'),
  nextPhase: $('#next-phase'),
  levelDisplay: $('#level-display'),
  runeCount: $('#rune-count'),
  runeBar: $('#rune-bar'),
  runeNeeded: $('#rune-needed'),
  overlay: $('#overlay'),
};

let currentRunesForNext = null;
let currentRunes = null;
let isVisible = true;

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatRunes(n) {
  if (n == null) return '?';
  return n.toLocaleString('en-US');
}

// ─── Timer Updates ──────────────────────────────────────────────────

window.nightreign.onTimerUpdate((data) => {
  els.dayLabel.textContent = `DAY ${data.day}`;

  // Phase name
  els.phaseName.textContent = data.currentPhase;
  els.phaseName.className = '';
  if (data.isBossFight) {
    els.phaseName.classList.add('boss');
  } else if (data.isShrinking) {
    els.phaseName.classList.add('shrinking');
  }

  // Shrinking badge
  if (data.isShrinking) {
    els.shrinkBadge.classList.remove('hidden');
  } else {
    els.shrinkBadge.classList.add('hidden');
  }

  // Countdown -- the big number
  els.phaseCountdown.className = '';
  if (data.isBossFight) {
    els.phaseCountdown.textContent = 'FIGHT';
    els.phaseCountdown.classList.add('boss');
  } else {
    els.phaseCountdown.textContent = formatTime(data.phaseTimeLeft);
    if (data.isShrinking) els.phaseCountdown.classList.add('shrinking');
  }

  // Progress bar (fills as time passes within the phase)
  els.phaseBar.className = '';
  if (data.isBossFight) {
    els.phaseBar.style.width = '100%';
    els.phaseBar.classList.add('boss');
  } else if (data.phaseDuration > 0) {
    const phaseElapsed = data.phaseDuration - data.phaseTimeLeft;
    const pct = Math.min(100, (phaseElapsed / data.phaseDuration) * 100);
    els.phaseBar.style.width = `${pct}%`;
    if (data.isShrinking) els.phaseBar.classList.add('shrinking');
  } else {
    els.phaseBar.style.width = '0%';
  }

  // Next phase hint
  if (data.nextPhase) {
    els.nextPhase.textContent = `Next: ${data.nextPhase}`;
  } else {
    els.nextPhase.textContent = '';
  }
});

window.nightreign.onDayChange((day) => {
  els.dayLabel.textContent = `DAY ${day}`;
  els.phaseName.textContent = 'Storm';
  els.phaseName.className = '';
  els.phaseCountdown.textContent = '...';
  els.phaseCountdown.className = '';
  els.phaseBar.style.width = '0%';
  els.phaseBar.className = '';
  els.shrinkBadge.classList.add('hidden');
  els.nextPhase.textContent = '';

  if (day === 3) {
    els.phaseName.textContent = 'Night Lord';
    els.phaseName.classList.add('boss');
    els.phaseCountdown.textContent = 'FINAL FIGHT';
    els.phaseCountdown.classList.add('boss');
  }
});

window.nightreign.onTimerReset(() => {
  els.dayLabel.textContent = 'PRESS F6 TO START';
  els.phaseName.textContent = 'Waiting...';
  els.phaseName.className = '';
  els.phaseCountdown.textContent = '--:--';
  els.phaseCountdown.className = '';
  els.phaseBar.style.width = '0%';
  els.phaseBar.className = '';
  els.shrinkBadge.classList.add('hidden');
  els.nextPhase.textContent = '';
});

// ─── Level Updates ──────────────────────────────────────────────────

window.nightreign.onLevelChange((data) => {
  els.levelDisplay.textContent = `Lv. ${data.currentLevel}`;

  if (data.isMaxLevel) {
    els.runeNeeded.innerHTML = '<span class="max-level">MAX LEVEL</span>';
    els.runeCount.textContent = '';
    els.runeBar.style.width = '100%';
    currentRunesForNext = null;
  } else {
    currentRunesForNext = data.runesForNext;
    els.runeNeeded.textContent = `Next level: ${formatRunes(data.runesForNext)} runes`;
    updateRuneDisplay();
  }
});

// ─── OCR Rune Updates ───────────────────────────────────────────────

window.nightreign.onRuneOCR((data) => {
  currentRunes = data.runes;
  updateRuneDisplay();
});

function updateRuneDisplay() {
  if (currentRunes != null && currentRunesForNext != null) {
    const missing = Math.max(0, currentRunesForNext - currentRunes);
    if (missing === 0) {
      els.runeCount.textContent = 'Ready to level!';
    } else {
      els.runeCount.textContent = `${formatRunes(missing)} to go`;
    }

    const pct = Math.min(100, (currentRunes / currentRunesForNext) * 100);
    els.runeBar.style.width = `${pct}%`;
  } else if (currentRunes != null) {
    els.runeCount.textContent = `${formatRunes(currentRunes)} runes`;
    els.runeBar.style.width = '0%';
  } else {
    els.runeCount.textContent = '? runes';
    els.runeBar.style.width = '0%';
  }
}

// ─── Visibility Toggle ─────────────────────────────────────────────

window.nightreign.onVisibilityToggle(() => {
  isVisible = !isVisible;
  els.overlay.style.display = isVisible ? 'block' : 'none';
});

// ─── Toast Notifications ────────────────────────────────────────────

let toastTimeout = null;
const toastEl = $('#toast');

window.nightreign.onToast((msg) => {
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toastEl.classList.add('hidden');
  }, 2000);
});

// ─── Calibration ────────────────────────────────────────────────────

window.nightreign.onCalibrationStart(() => {
  els.overlay.classList.add('calibrating');
});

window.nightreign.onCalibrationEnd(() => {
  els.overlay.classList.remove('calibrating');
});
