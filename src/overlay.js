const $ = (sel) => document.querySelector(sel);

const lineTimer = $('#line-timer');
const lineRunes = $('#line-runes');
const toastEl = $('#toast');

let currentRunesForNext = null;
let currentRunes = null;
let currentLevelNum = 1;
let isMaxLevel = false;

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatRunes(n) {
  if (n == null) return '?';
  return n.toLocaleString('en-US');
}

// ─── Timer ──────────────────────────────────────────────────────────

window.nightreign.onTimerUpdate((data) => {
  lineTimer.classList.remove('hidden', 'shrinking', 'boss');

  if (data.isBossFight) {
    lineTimer.textContent = data.currentPhase;
    lineTimer.classList.add('boss');
  } else {
    lineTimer.textContent = `${data.currentPhase}  ${formatTime(data.phaseTimeLeft)}`;
    if (data.isShrinking) lineTimer.classList.add('shrinking');
  }
});

window.nightreign.onDayChange((day) => {
  lineTimer.classList.remove('hidden', 'shrinking', 'boss');
  if (day === 3) {
    lineTimer.textContent = 'Night Lord';
    lineTimer.classList.add('boss');
  } else {
    lineTimer.textContent = `Day ${day}`;
  }
});

window.nightreign.onTimerReset(() => {
  lineTimer.classList.add('hidden');
  lineTimer.textContent = '';
});

// ─── Level & Runes ──────────────────────────────────────────────────

window.nightreign.onLevelChange((data) => {
  currentLevelNum = data.currentLevel;
  isMaxLevel = data.isMaxLevel;

  if (data.isMaxLevel) {
    currentRunesForNext = null;
  } else {
    currentRunesForNext = data.runesForNext;
  }
  updateRuneDisplay();
});

window.nightreign.onRuneOCR((data) => {
  currentRunes = data.runes;
  updateRuneDisplay();
});

function updateRuneDisplay() {
  if (isMaxLevel) {
    lineRunes.textContent = `Lv. ${currentLevelNum}  ·  MAX`;
    return;
  }

  let runeText;
  if (currentRunes != null && currentRunesForNext != null) {
    const missing = Math.max(0, currentRunesForNext - currentRunes);
    runeText = missing === 0 ? 'Ready!' : `${formatRunes(missing)} to go`;
  } else {
    runeText = currentRunesForNext != null
      ? `need ${formatRunes(currentRunesForNext)}`
      : '';
  }

  lineRunes.textContent = `Lv. ${currentLevelNum}  ·  ${runeText}`;
}

// ─── F5 Visibility Toggle (opacity) ────────────────────────────────

window.nightreign.onVisibilityToggle(() => {
  const hidden = document.body.style.opacity === '0';
  document.body.style.opacity = hidden ? '1' : '0';
});

// ─── Toast ──────────────────────────────────────────────────────────

let toastTimeout = null;

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
  document.body.style.opacity = '0.3';
});

window.nightreign.onCalibrationEnd(() => {
  document.body.style.opacity = '1';
});
