const {
  app,
  BrowserWindow,
  globalShortcut,
  desktopCapturer,
  screen,
  ipcMain,
} = require('electron');
const path = require('path');
const settings = require('./settings');
const gameData = require('./game-data');
const ocrWorker = require('./ocr-worker');

let overlayWin = null;
let calibrationWin = null;

let timerInterval = null;
let timerStartTime = null;
let currentDay = 0; // 0 = not started, 1-3
let currentLevel = 1;
let ocrInterval = null;
let isOCRRunning = false;

// ─── Window Creation ────────────────────────────────────────────────

function createOverlayWindow() {
  const cfg = settings.get();

  overlayWin = new BrowserWindow({
    width: 320,
    height: 220,
    x: cfg.overlayPosition.x,
    y: cfg.overlayPosition.y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  overlayWin.setIgnoreMouseEvents(true, { forward: true });
  overlayWin.setAlwaysOnTop(true, 'screen-saver');
  overlayWin.setVisibleOnAllWorkspaces(true);

  overlayWin.loadFile(path.join(__dirname, 'overlay.html'));

  overlayWin.webContents.once('did-finish-load', () => {
    overlayWin.webContents.send('settings:load', cfg);
    sendLevelUpdate();
  });

  overlayWin.on('closed', () => { overlayWin = null; });
}

function createCalibrationWindow() {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.size;

  calibrationWin = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    fullscreen: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  calibrationWin.setAlwaysOnTop(true, 'screen-saver');
  calibrationWin.loadFile(path.join(__dirname, 'calibration.html'));

  calibrationWin.on('closed', () => {
    calibrationWin = null;
    if (overlayWin) overlayWin.webContents.send('calibration:end');
  });
}

// ─── Timer Logic ────────────────────────────────────────────────────

function startDayTimer() {
  stopDayTimer();

  if (currentDay >= 3) {
    currentDay = 0;
  }
  currentDay++;

  timerStartTime = Date.now();
  if (overlayWin) overlayWin.webContents.send('day:change', currentDay);

  timerInterval = setInterval(() => {
    if (!overlayWin) return;

    const elapsed = (Date.now() - timerStartTime) / 1000;
    const phases = gameData.TIDE_PHASES;
    let currentPhaseIndex = -1;
    let nextPhaseTime = phases[0].triggerAt;

    for (let i = phases.length - 1; i >= 0; i--) {
      if (elapsed >= phases[i].triggerAt) {
        currentPhaseIndex = i;
        break;
      }
    }

    let timeToNext = 0;
    let nextPhaseName = '';

    if (currentPhaseIndex < phases.length - 1) {
      const nextIdx = currentPhaseIndex + 1;
      nextPhaseTime = phases[nextIdx].triggerAt;
      timeToNext = Math.max(0, nextPhaseTime - elapsed);
      nextPhaseName = phases[nextIdx].label;
    } else {
      timeToNext = Math.max(0, gameData.DAY_DURATION - elapsed);
      nextPhaseName = 'Day ends';
    }

    const currentPhaseName = currentPhaseIndex >= 0
      ? phases[currentPhaseIndex].label
      : 'Exploration — Tide inactive';

    overlayWin.webContents.send('timer:update', {
      elapsed: Math.floor(elapsed),
      day: currentDay,
      currentPhase: currentPhaseName,
      nextPhase: nextPhaseName,
      timeToNextPhase: Math.ceil(timeToNext),
      phaseIndex: currentPhaseIndex,
      totalPhases: phases.length,
      dayDuration: gameData.DAY_DURATION,
    });

    if (elapsed >= gameData.DAY_DURATION) {
      stopDayTimer();
    }
  }, 250);
}

function stopDayTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  timerStartTime = null;
}

// ─── Level Logic ────────────────────────────────────────────────────

function setLevel(delta) {
  const newLevel = currentLevel + delta;
  if (newLevel >= gameData.MIN_LEVEL && newLevel <= gameData.MAX_LEVEL) {
    currentLevel = newLevel;
    sendLevelUpdate();
  }
}

function sendLevelUpdate() {
  if (!overlayWin) return;

  const nextLevelData = gameData.getRunesNeededForNextLevel(currentLevel);
  overlayWin.webContents.send('level:change', {
    currentLevel,
    maxLevel: gameData.MAX_LEVEL,
    runesForNext: nextLevelData ? nextLevelData.cost : null,
    isMaxLevel: currentLevel >= gameData.MAX_LEVEL,
  });
}

// ─── OCR Screen Capture ─────────────────────────────────────────────

async function captureScreenRegion(region) {
  const display = screen.getPrimaryDisplay();
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: display.size,
  });

  if (!sources.length) return null;

  const thumbnail = sources[0].thumbnail;
  const cropped = thumbnail.crop(region);
  return cropped.toPNG();
}

function startOCR() {
  const cfg = settings.get();
  if (!cfg.ocrRegion) return;

  stopOCR();

  ocrInterval = setInterval(async () => {
    if (isOCRRunning || !overlayWin) return;
    isOCRRunning = true;

    try {
      const imageBuffer = await captureScreenRegion(cfg.ocrRegion);
      if (!imageBuffer) return;

      const result = await ocrWorker.recognizeRunes(imageBuffer);

      if (overlayWin && result.confidence > 40) {
        overlayWin.webContents.send('rune:ocr', {
          runes: result.value,
          raw: result.raw,
          confidence: result.confidence,
        });
      }
    } catch (err) {
      console.error('OCR error:', err.message);
    } finally {
      isOCRRunning = false;
    }
  }, cfg.ocrIntervalMs);
}

function stopOCR() {
  if (ocrInterval) {
    clearInterval(ocrInterval);
    ocrInterval = null;
  }
}

// ─── Hotkeys ────────────────────────────────────────────────────────

function registerHotkeys() {
  const keys = settings.get().hotkeys;

  globalShortcut.register(keys.toggleOverlay, () => {
    if (overlayWin) {
      if (overlayWin.isVisible()) {
        overlayWin.hide();
      } else {
        overlayWin.show();
      }
    }
  });

  globalShortcut.register(keys.startTimer, () => {
    startDayTimer();
  });

  globalShortcut.register(keys.levelUp, () => {
    setLevel(1);
  });

  globalShortcut.register(keys.levelDown, () => {
    setLevel(-1);
  });

  globalShortcut.register(keys.calibrate, () => {
    if (calibrationWin) {
      calibrationWin.close();
    } else {
      if (overlayWin) overlayWin.webContents.send('calibration:start');
      createCalibrationWindow();
    }
  });
}

// ─── IPC Handlers ───────────────────────────────────────────────────

function setupIPC() {
  ipcMain.on('calibration:region', (_e, region) => {
    settings.save({ ocrRegion: region });

    if (calibrationWin) {
      calibrationWin.close();
    }

    stopOCR();
    ocrWorker.init().then(() => startOCR());
  });
}

// ─── App Lifecycle ──────────────────────────────────────────────────

app.whenReady().then(async () => {
  settings.load();
  setupIPC();
  createOverlayWindow();
  registerHotkeys();

  await ocrWorker.init();
  if (settings.get().ocrRegion) {
    startOCR();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  stopDayTimer();
  stopOCR();
  ocrWorker.terminate();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
