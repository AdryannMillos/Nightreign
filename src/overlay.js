const $ = (sel) => document.querySelector(sel);

const els = {
  dayLabel: $('#day-label'),
  timerDisplay: $('#timer-display'),
  phaseBar: $('#phase-bar'),
  phaseLabel: $('#phase-label'),
  nextPhaseLabel: $('#next-phase-label'),
  nextPhaseTime: $('#next-phase-time'),
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
  els.timerDisplay.textContent = formatTime(data.elapsed);

  els.phaseLabel.textContent = data.currentPhase;

  if (data.nextPhase) {
    els.nextPhaseLabel.textContent = data.nextPhase;
    els.nextPhaseTime.textContent = `in ${formatTime(data.timeToNextPhase)}`;
  } else {
    els.nextPhaseLabel.textContent = '';
    els.nextPhaseTime.textContent = '';
  }

  const progress = Math.min(100, (data.elapsed / data.dayDuration) * 100);
  els.phaseBar.style.width = `${progress}%`;

  els.phaseBar.classList.remove('warning', 'danger');
  if (data.phaseIndex >= 1) {
    els.phaseBar.classList.add('danger');
  } else if (data.phaseIndex >= 0) {
    els.phaseBar.classList.add('warning');
  }
});

window.nightreign.onDayChange((day) => {
  els.dayLabel.textContent = `DAY ${day}`;
  els.timerDisplay.textContent = '0:00';
  els.phaseBar.style.width = '0%';
  els.phaseBar.classList.remove('warning', 'danger');
  els.phaseLabel.textContent = 'Exploration — Tide inactive';
  els.nextPhaseLabel.textContent = '';
  els.nextPhaseTime.textContent = '';

  if (day === 3) {
    els.phaseLabel.textContent = 'Final Day — Night Lord awaits';
    els.nextPhaseLabel.textContent = '';
    els.nextPhaseTime.textContent = '';
  }
});

window.nightreign.onTimerReset(() => {
  els.dayLabel.textContent = 'PRESS F6 TO START';
  els.timerDisplay.textContent = '--:--';
  els.phaseBar.style.width = '0%';
  els.phaseBar.classList.remove('warning', 'danger');
  els.phaseLabel.textContent = 'Waiting...';
  els.nextPhaseLabel.textContent = '';
  els.nextPhaseTime.textContent = '';
});

// ─── Level Updates ──────────────────────────────────────────────────

window.nightreign.onLevelChange((data) => {
  els.levelDisplay.textContent = `Lv. ${data.currentLevel}`;

  if (data.isMaxLevel) {
    els.runeNeeded.innerHTML = '<span class="max-level">MAX LEVEL</span>';
    els.runeBar.style.width = '100%';
    currentRunesForNext = null;
  } else {
    currentRunesForNext = data.runesForNext;
    els.runeNeeded.textContent = `Next level: ${formatRunes(data.runesForNext)} runes`;
    updateRuneBar();
  }
});

// ─── OCR Rune Updates ───────────────────────────────────────────────

window.nightreign.onRuneOCR((data) => {
  currentRunes = data.runes;

  if (data.runes != null) {
    els.runeCount.textContent = `${formatRunes(data.runes)} runes`;
  } else {
    els.runeCount.textContent = '? runes';
  }

  updateRuneBar();
});

function updateRuneBar() {
  if (currentRunes != null && currentRunesForNext != null && currentRunesForNext > 0) {
    const pct = Math.min(100, (currentRunes / currentRunesForNext) * 100);
    els.runeBar.style.width = `${pct}%`;
  } else {
    els.runeBar.style.width = '0%';
  }
}

// ─── Visibility Toggle ─────────────────────────────────────────────

window.nightreign.onVisibilityToggle(() => {
  isVisible = !isVisible;
  els.overlay.style.display = isVisible ? 'block' : 'none';
});

// ─── Calibration ────────────────────────────────────────────────────

window.nightreign.onCalibrationStart(() => {
  els.overlay.classList.add('calibrating');
});

window.nightreign.onCalibrationEnd(() => {
  els.overlay.classList.remove('calibrating');
});
