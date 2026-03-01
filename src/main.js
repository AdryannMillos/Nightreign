const {
  app,
  BrowserWindow,
  globalShortcut,
  desktopCapturer,
  screen,
  ipcMain,
  nativeImage,
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
let keepOnTopInterval = null;
let lastDayDetectTime = 0;
const DAY_DETECT_COOLDOWN_MS = 30000;

// ─── Window Creation ────────────────────────────────────────────────

function createOverlayWindow() {
  const cfg = settings.get();
  const display = screen.getPrimaryDisplay();
  const overlayWidth = 300;
  const overlayHeight = 80;
  const posX = display.size.width - overlayWidth - 10;
  const posY = 100;

  overlayWin = new BrowserWindow({
    width: overlayWidth,
    height: overlayHeight,
    x: posX,
    y: posY,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    type: 'toolbar',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  overlayWin.setIgnoreMouseEvents(true, { forward: true });
  overlayWin.setAlwaysOnTop(true, 'screen-saver');
  overlayWin.setVisibleOnAllWorkspaces(true);
  overlayWin.showInactive();

  // Re-assert on-top every second so the game can't bury the overlay
  // Pauses while calibration is open so it doesn't cover that window
  keepOnTopInterval = setInterval(() => {
    if (!overlayWin || overlayWin.isDestroyed()) return;
    if (calibrationWin) return;
    overlayWin.setAlwaysOnTop(false);
    overlayWin.setAlwaysOnTop(true, 'screen-saver');
    overlayWin.moveTop();
  }, 1000);

  overlayWin.loadFile(path.join(__dirname, 'overlay.html'));

  overlayWin.webContents.once('did-finish-load', () => {
    overlayWin.webContents.send('settings:load', cfg);
    sendLevelUpdate();
  });

  overlayWin.on('closed', () => {
    overlayWin = null;
    if (keepOnTopInterval) {
      clearInterval(keepOnTopInterval);
      keepOnTopInterval = null;
    }
  });
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

    // Find current phase
    let currentPhaseIndex = -1;
    for (let i = phases.length - 1; i >= 0; i--) {
      if (elapsed >= phases[i].triggerAt) {
        currentPhaseIndex = i;
        break;
      }
    }

    const isBossFight = elapsed >= gameData.DAY_DURATION;

    if (isBossFight) {
      const bossLabel = gameData.BOSS_LABELS[currentDay] || 'Boss Fight';
      overlayWin.webContents.send('timer:update', {
        day: currentDay,
        currentPhase: bossLabel,
        phaseTimeLeft: 0,
        phaseDuration: 0,
        isShrinking: false,
        nextPhase: currentDay < 3 ? 'Waiting for next day...' : '',
        phaseIndex: phases.length,
        isBossFight: true,
      });
      stopDayTimer();
      return;
    }

    if (currentPhaseIndex >= 0) {
      const phase = phases[currentPhaseIndex];
      const phaseEnd = phase.triggerAt + phase.duration;
      const timeLeft = Math.max(0, phaseEnd - elapsed);

      let nextLabel = '';
      if (currentPhaseIndex < phases.length - 1) {
        nextLabel = phases[currentPhaseIndex + 1].label;
      } else {
        nextLabel = gameData.BOSS_LABELS[currentDay] || 'Boss Fight';
      }

      overlayWin.webContents.send('timer:update', {
        day: currentDay,
        currentPhase: phase.label,
        phaseTimeLeft: Math.ceil(timeLeft),
        phaseDuration: phase.duration,
        isShrinking: phase.shrinking,
        nextPhase: nextLabel,
        phaseIndex: currentPhaseIndex,
        isBossFight: false,
      });
    } else {
      const timeLeft = Math.max(0, phases[0].triggerAt - elapsed);
      overlayWin.webContents.send('timer:update', {
        day: currentDay,
        currentPhase: 'Storm',
        phaseTimeLeft: Math.ceil(timeLeft),
        phaseDuration: phases[0].triggerAt,
        isShrinking: false,
        nextPhase: phases[0].label,
        phaseIndex: -1,
        isBossFight: false,
      });
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

let screenThumbnail = null;

async function captureScreen() {
  const display = screen.getPrimaryDisplay();
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: display.size,
  });
  if (!sources.length) return null;
  screenThumbnail = sources[0].thumbnail;
  return screenThumbnail;
}

function cropRegion(thumbnail, region) {
  const cropped = thumbnail.crop(region);
  return cropped.toPNG();
}

function cropAndPreprocess(thumbnail, region) {
  const cropped = thumbnail.crop(region);
  const size = cropped.getSize();
  const bitmap = cropped.toBitmap(); // BGRA on Windows
  const totalPixels = bitmap.length / 4;
  let whitePixels = 0;

  for (let i = 0; i < bitmap.length; i += 4) {
    const b = bitmap[i];
    const g = bitmap[i + 1];
    const r = bitmap[i + 2];

    // The game text is near-white (R≈G≈B, all high).
    // Sky/background is colored (blue channel much higher than red).
    // Check: all channels > 180 AND channels are close to each other (neutral)
    const min = Math.min(r, g, b);
    const max = Math.max(r, g, b);
    const isNearWhite = min > 170 && max > 200 && (max - min) < 60;

    if (isNearWhite) {
      bitmap[i] = 0; bitmap[i + 1] = 0; bitmap[i + 2] = 0;
      whitePixels++;
    } else {
      bitmap[i] = 255; bitmap[i + 1] = 255; bitmap[i + 2] = 255;
    }
    bitmap[i + 3] = 255;
  }

  const whiteRatio = whitePixels / totalPixels;
  const processed = nativeImage.createFromBitmap(bitmap, size);

  // Save debug image for inspection
  const fs = require('fs');
  const debugPath = path.join(app.getPath('userData'), 'day-ocr-debug.png');
  fs.writeFileSync(debugPath, processed.toPNG());

  return { png: processed.toPNG(), whiteRatio };
}

function getCenterRegion() {
  const display = screen.getPrimaryDisplay();
  const sw = display.size.width;
  const sh = display.size.height;
  const w = Math.round(sw * 0.30);
  const h = Math.round(sh * 0.12);
  return {
    x: Math.round((sw - w) / 2),
    y: Math.round(sh * 0.50),
    width: w,
    height: h,
  };
}

function tryDetectDay(text) {
  const t = text.toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

  // I/1/L are common OCR misreads of each other
  const I = '[I1L]';
  const patterns = [
    { re: new RegExp(`D${I}?A\\s*${I}${I}${I}`, 'i'), day: 3 },
    { re: new RegExp(`DAY\\s*${I}${I}${I}`, 'i'), day: 3 },
    { re: new RegExp(`D.?Y\\s*${I}${I}${I}`, 'i'), day: 3 },
    { re: /D[I1L]?A\s*3/i, day: 3 },
    { re: /D.?Y\s*3/i, day: 3 },
    { re: new RegExp(`D${I}?A\\s*${I}${I}(?!${I})`, 'i'), day: 2 },
    { re: new RegExp(`DAY\\s*${I}${I}(?!${I})`, 'i'), day: 2 },
    { re: new RegExp(`D.?Y\\s*${I}${I}(?!${I})`, 'i'), day: 2 },
    { re: /D[I1L]?A\s*2/i, day: 2 },
    { re: /D.?Y\s*2/i, day: 2 },
    { re: new RegExp(`D${I}?A\\s*${I}(?!${I})`, 'i'), day: 1 },
    { re: new RegExp(`DAY\\s*${I}(?!${I})`, 'i'), day: 1 },
    { re: new RegExp(`D.?Y\\s*${I}(?!${I})`, 'i'), day: 1 },
    { re: /D[I1L]?A\s*1/i, day: 1 },
    { re: /D.?Y\s*1/i, day: 1 },
  ];
  for (const p of patterns) {
    if (p.re.test(t)) {
      console.log('[Day OCR] matched day', p.day, 'from:', JSON.stringify(t));
      return p.day;
    }
  }
  return null;
}

function startOCR() {
  stopOCR();

  ocrInterval = setInterval(async () => {
    if (isOCRRunning || !overlayWin) return;
    isOCRRunning = true;

    try {
      const cfg = settings.get();
      const thumbnail = await captureScreen();
      if (!thumbnail) return;

      // OCR rune count
      if (cfg.ocrRuneRegion) {
        const runeImage = cropRegion(thumbnail, cfg.ocrRuneRegion);
        const runeResult = await ocrWorker.recognizeRunes(runeImage);
        if (overlayWin && runeResult.confidence > 40) {
          overlayWin.webContents.send('rune:ocr', {
            runes: runeResult.value,
            raw: runeResult.raw,
            confidence: runeResult.confidence,
          });
        }
      }

      // OCR level number
      if (cfg.ocrLevelRegion) {
        const levelImage = cropRegion(thumbnail, cfg.ocrLevelRegion);
        const levelResult = await ocrWorker.recognizeRunes(levelImage);
        if (levelResult.value != null && levelResult.confidence > 40) {
          const detectedLevel = levelResult.value;
          if (detectedLevel >= gameData.MIN_LEVEL && detectedLevel <= gameData.MAX_LEVEL && detectedLevel !== currentLevel) {
            currentLevel = detectedLevel;
            sendLevelUpdate();
          }
        }
      }

      // Auto-detect day from screen text
      const now = Date.now();
      const dayRegion = cfg.ocrDayRegion || getCenterRegion();
      if (now - lastDayDetectTime > DAY_DETECT_COOLDOWN_MS) {
        const { png, whiteRatio } = cropAndPreprocess(thumbnail, dayRegion);

        // Only attempt OCR if there's enough white text in the region
        if (whiteRatio > 0.08) {
          const textResult = await ocrWorker.recognizeText(png);
          if (textResult.raw.length > 0) {
            console.log('[Day OCR] ratio:', (whiteRatio * 100).toFixed(1) + '%', 'text:', JSON.stringify(textResult.raw));
          }

          const detectedDay = tryDetectDay(textResult.raw);
          // Only accept the expected next day in sequence (1→2→3→1)
          const expectedNext = currentDay >= 3 ? 1 : currentDay + 1;
          const isNewDay = detectedDay != null && detectedDay !== currentDay;
          const isExpected = detectedDay === expectedNext || currentDay === 0;

          if (isNewDay && isExpected) {
            lastDayDetectTime = now;
            console.log('[Day OCR] STARTING day', detectedDay);
            currentDay = detectedDay - 1;
            startDayTimer();
            if (overlayWin) {
              overlayWin.webContents.send('toast', `Day ${detectedDay} detected`);
            }
          }
        }
      }
    } catch (err) {
      console.error('OCR error:', err.message);
    } finally {
      isOCRRunning = false;
    }
  }, settings.get().ocrIntervalMs);
}

function stopOCR() {
  if (ocrInterval) {
    clearInterval(ocrInterval);
    ocrInterval = null;
  }
}

function adjustOCRSpeed(deltaMs) {
  const cfg = settings.get();
  const newInterval = Math.max(500, Math.min(10000, cfg.ocrIntervalMs + deltaMs));
  if (newInterval === cfg.ocrIntervalMs) return;

  settings.save({ ocrIntervalMs: newInterval });

  stopOCR();
  startOCR();

  if (overlayWin) {
    const seconds = (newInterval / 1000).toFixed(1);
    overlayWin.webContents.send('toast', `OCR speed: ${seconds}s`);
  }
}

// ─── Hotkeys ────────────────────────────────────────────────────────

function registerHotkeys() {
  const keys = settings.get().hotkeys;

  globalShortcut.register(keys.toggleOverlay, () => {
    if (overlayWin) {
      overlayWin.webContents.send('overlay:toggle');
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

  // OCR speed: F10 faster, F11 slower
  globalShortcut.register('F10', () => {
    adjustOCRSpeed(-500);
  });

  globalShortcut.register('F11', () => {
    adjustOCRSpeed(500);
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
  ipcMain.on('calibration:region', (_e, type, region) => {
    if (type === 'runes') {
      settings.save({ ocrRuneRegion: region });
    } else if (type === 'level') {
      settings.save({ ocrLevelRegion: region });
    } else if (type === 'day') {
      settings.save({ ocrDayRegion: region });

      if (calibrationWin) {
        calibrationWin.close();
      }
      stopOCR();
      startOCR();
    }
  });
}

// ─── App Lifecycle ──────────────────────────────────────────────────

app.whenReady().then(async () => {
  settings.load();
  setupIPC();
  createOverlayWindow();
  registerHotkeys();

  await ocrWorker.init();
  startOCR();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  stopDayTimer();
  stopOCR();
  ocrWorker.terminate();
  if (keepOnTopInterval) {
    clearInterval(keepOnTopInterval);
    keepOnTopInterval = null;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
