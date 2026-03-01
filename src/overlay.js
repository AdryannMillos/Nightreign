const $ = (sel) => document.querySelector(sel);

const lineTimer = $('#line-timer');
const lineRunes = $('#line-runes');
const toastEl = $('#toast');
const bossPanel = $('#boss-panel');
const bossNameEl = $('#boss-name');
const bossPhasesEl = $('#boss-phases');

let currentRunesForNext = null;
let currentRunes = null;
let currentLevelNum = 1;
let isMaxLevel = false;
let bosses = [];
let currentBossIndex = 0;
let bossVisible = true;
let dayStarted = false;

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
  dayStarted = true;
  lineTimer.classList.remove('hidden', 'shrinking', 'boss');
  lineRunes.classList.remove('hidden');
  if (bossVisible) bossPanel.classList.remove('hidden');
  else bossPanel.classList.add('hidden');
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

// ─── Boss Panel ─────────────────────────────────────────────────────

window.nightreign.onBossData((data) => {
  bosses = data;
  if (bosses.length > 0) renderBoss();
});

function renderBoss() {
  if (!bosses.length) return;
  const boss = bosses[currentBossIndex];
  bossNameEl.textContent = boss.name;
  bossPhasesEl.innerHTML = '';

  for (const phase of boss.phases) {
    const div = document.createElement('div');
    div.className = 'boss-phase';

    if (phase.phaseName) {
      const nameEl = document.createElement('div');
      nameEl.className = 'boss-phase-name';
      nameEl.textContent = phase.phaseName;
      div.appendChild(nameEl);
    }

    if (phase.weak.length) {
      const row = document.createElement('div');
      row.className = 'icon-row weak';
      const label = document.createElement('span');
      label.className = 'icon-label weak';
      label.textContent = '+';
      row.appendChild(label);
      for (const iconSrc of phase.weak) {
        const img = document.createElement('img');
        img.src = iconSrc;
        row.appendChild(img);
      }
      div.appendChild(row);
    }

    if (phase.resistant.length) {
      const row = document.createElement('div');
      row.className = 'icon-row resistant';
      const label = document.createElement('span');
      label.className = 'icon-label resistant';
      label.textContent = '−';
      row.appendChild(label);
      for (const iconSrc of phase.resistant) {
        const img = document.createElement('img');
        img.src = iconSrc;
        row.appendChild(img);
      }
      div.appendChild(row);
    }

    bossPhasesEl.appendChild(div);
  }

  if (boss.night1?.length || boss.night2?.length) {
    const nightsDiv = document.createElement('div');
    nightsDiv.className = 'boss-nights';

    if (boss.night1?.length) {
      const n1 = document.createElement('div');
      n1.className = 'boss-night-row';
      const label1 = document.createElement('span');
      label1.className = 'boss-night-label';
      label1.textContent = 'Night 1:';
      n1.appendChild(label1);
      const list1 = document.createElement('span');
      list1.className = 'boss-night-list';
      list1.textContent = boss.night1.join(', ');
      n1.appendChild(list1);
      nightsDiv.appendChild(n1);
    }

    if (boss.night2?.length) {
      const n2 = document.createElement('div');
      n2.className = 'boss-night-row';
      const label2 = document.createElement('span');
      label2.className = 'boss-night-label';
      label2.textContent = 'Night 2:';
      n2.appendChild(label2);
      const list2 = document.createElement('span');
      list2.className = 'boss-night-list';
      list2.textContent = boss.night2.join(', ');
      n2.appendChild(list2);
      nightsDiv.appendChild(n2);
    }

    bossPhasesEl.appendChild(nightsDiv);
  }
}

window.nightreign.onBossToggle(() => {
  bossVisible = !bossVisible;
  bossPanel.classList.toggle('hidden', !bossVisible);
});

window.nightreign.onBossPrev(() => {
  if (!bosses.length) return;
  currentBossIndex = (currentBossIndex - 1 + bosses.length) % bosses.length;
  renderBoss();
});

window.nightreign.onBossNext(() => {
  if (!bosses.length) return;
  currentBossIndex = (currentBossIndex + 1) % bosses.length;
  renderBoss();
});

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
