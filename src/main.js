const {
  app,
  BrowserWindow,
  globalShortcut,
  desktopCapturer,
  screen,
  ipcMain,
  nativeImage,
} = require('electron');
const fs   = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const settings    = require('./settings');
const gameData    = require('./game-data');
const bossData    = require('./boss-data');
const ocrWorker   = require('./ocr-worker');
const { tryDetectDay }  = require('./day-detector');
const { getPhaseState } = require('./timer-engine');

// ─── OCR tuning constants ────────────────────────────────────────────
// Minimum fraction of the day-detection region that must contain near-white
// pixels before we bother running Tesseract. Avoids false positives when the
// region is mostly dark sky / gameplay background.
const MIN_WHITE_RATIO = 0.08;

// Minimum Tesseract confidence score (0-100) to accept an OCR result.
const OCR_CONFIDENCE_THRESHOLD = 40;

// How long to keep the day-detection cooldown after a successful detection,
// so a single on-screen "DAY 1" banner doesn't re-trigger the timer.
const DAY_DETECT_COOLDOWN_MS = 30000;

// ─── State ──────────────────────────────────────────────────────────
let overlayWin     = null;
let calibrationWin = null;

let timerInterval    = null;
let timerStartTime   = null;
let currentDay       = 0; // 0 = not started, 1–3
let currentLevel     = 1;
let ocrInterval      = null;
let isOCRRunning     = false;
let keepOnTopInterval = null;
let lastDayDetectTime = 0;

// ─── Window Creation ────────────────────────────────────────────────

function createOverlayWindow() {
  const cfg     = settings.get();
  const display = screen.getPrimaryDisplay();
  const overlayWidth  = 300;
  const overlayHeight = 300;
  const posX = display.size.width - overlayWidth - 10;
  const posY = 100;

  overlayWin = new BrowserWindow({
    width:  overlayWidth,
    height: overlayHeight,
    x: posX,
    y: posY,
    frame:       false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable:   false,
    hasShadow:   false,
    type:        'toolbar',
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
    },
  });

  overlayWin.setIgnoreMouseEvents(true);
  overlayWin.setAlwaysOnTop(true, 'screen-saver');
  overlayWin.setVisibleOnAllWorkspaces(true);
  overlayWin.showInactive();

  // Re-assert on-top every second so the game can't bury the overlay.
  // Pauses while calibration is open so it doesn't cover that window.
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
    sendBossData();
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
  const display      = screen.getPrimaryDisplay();
  const { width, height } = display.size;

  calibrationWin = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    frame:       false,
    transparent: true,
    alwaysOnTop: true,
    resizable:   false,
    fullscreen:  false,
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
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

/**
 * Start (or restart) the day timer for the given day number.
 * Accepts an explicit day so callers don't need to pre-mutate `currentDay`.
 *
 * @param {1|2|3} targetDay
 */
function startDayTimer(targetDay) {
  stopDayTimer();
  currentDay = targetDay;
  timerStartTime = Date.now();

  if (overlayWin) overlayWin.webContents.send('day:change', currentDay);

  timerInterval = setInterval(() => {
    if (!overlayWin) return;

    const elapsed = (Date.now() - timerStartTime) / 1000;
    const state   = getPhaseState(
      elapsed,
      gameData.TIDE_PHASES,
      gameData.DAY_DURATION,
      gameData.PHASE_DELAY,
      currentDay,
      gameData.BOSS_LABELS,
    );

    overlayWin.webContents.send('timer:update', { day: currentDay, ...state });

    if (state.isBossFight) stopDayTimer();
  }, 250);
}

/**
 * Advance to the next day (wraps 3 → 1), used by the F6 hotkey.
 */
function advanceDay() {
  const next = currentDay >= 3 ? 1 : currentDay + 1;
  startDayTimer(next);
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
    maxLevel:   gameData.MAX_LEVEL,
    runesForNext: nextLevelData ? nextLevelData.cost : null,
    isMaxLevel: currentLevel >= gameData.MAX_LEVEL,
  });
}

// ─── OCR Screen Capture ─────────────────────────────────────────────

async function captureScreen() {
  const display = screen.getPrimaryDisplay();
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: display.size,
  });
  if (!sources.length) return null;
  return sources[0].thumbnail;
}

function cropRegion(thumbnail, region) {
  return thumbnail.crop(region).toPNG();
}

/**
 * Crop a region and binarise it: near-white game text becomes black ink on a
 * white background, which Tesseract reads much more reliably than coloured UI.
 *
 * Also returns `whiteRatio` — the fraction of pixels that were detected as
 * near-white — so callers can skip OCR on frames that contain no text.
 *
 * @param {Electron.NativeImage} thumbnail
 * @param {{ x, y, width, height }} region
 * @returns {{ png: Buffer, whiteRatio: number }}
 */
function cropAndPreprocess(thumbnail, region) {
  const cropped = thumbnail.crop(region);
  const size    = cropped.getSize();
  const bitmap  = cropped.toBitmap(); // BGRA on Windows
  const totalPixels = bitmap.length / 4;
  let whitePixels = 0;

  for (let i = 0; i < bitmap.length; i += 4) {
    const b = bitmap[i];
    const g = bitmap[i + 1];
    const r = bitmap[i + 2];

    // The game's day-text is near-white (neutral, high-brightness).
    // Sky / gameplay backgrounds are coloured (B >> R) or dark.
    // Criteria: all channels > 170 AND spread between min/max < 60.
    const min = Math.min(r, g, b);
    const max = Math.max(r, g, b);
    const isNearWhite = min > 170 && max > 200 && (max - min) < 60;

    if (isNearWhite) {
      bitmap[i] = 0; bitmap[i + 1] = 0; bitmap[i + 2] = 0; // black ink
      whitePixels++;
    } else {
      bitmap[i] = 255; bitmap[i + 1] = 255; bitmap[i + 2] = 255; // white background
    }
    bitmap[i + 3] = 255; // fully opaque
  }

  const whiteRatio = whitePixels / totalPixels;
  const processed  = nativeImage.createFromBitmap(bitmap, size);

  // Write the preprocessed image to disk only when DEBUG_OCR is set.
  // Without this guard the file was overwritten on every OCR tick (every 3 s),
  // which could consume gigabytes of disk space during a long session.
  if (process.env.DEBUG_OCR) {
    const debugPath = path.join(app.getPath('userData'), 'day-ocr-debug.png');
    fs.writeFileSync(debugPath, processed.toPNG());
  }

  return { png: processed.toPNG(), whiteRatio };
}

/**
 * Fall-back region used for day detection when the user has not calibrated.
 * Covers the centre-bottom portion of the screen where "DAY X" typically appears.
 */
function getCenterRegion() {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().size;
  const w = Math.round(sw * 0.30);
  const h = Math.round(sh * 0.12);
  return {
    x:      Math.round((sw - w) / 2),
    y:      Math.round(sh * 0.50),
    width:  w,
    height: h,
  };
}

function startOCR() {
  stopOCR();

  ocrInterval = setInterval(async () => {
    if (isOCRRunning || !overlayWin) return;
    isOCRRunning = true;

    try {
      const cfg       = settings.get();
      const thumbnail = await captureScreen();
      if (!thumbnail) return;

      // ── Rune count ────────────────────────────────────────────────
      if (cfg.ocrRuneRegion) {
        const runeImage  = cropRegion(thumbnail, cfg.ocrRuneRegion);
        const runeResult = await ocrWorker.recognizeRunes(runeImage);
        if (overlayWin && runeResult.confidence > OCR_CONFIDENCE_THRESHOLD) {
          overlayWin.webContents.send('rune:ocr', {
            runes:      runeResult.value,
            raw:        runeResult.raw,
            confidence: runeResult.confidence,
          });
        }
      }

      // ── Player level ──────────────────────────────────────────────
      if (cfg.ocrLevelRegion) {
        const levelImage  = cropRegion(thumbnail, cfg.ocrLevelRegion);
        const levelResult = await ocrWorker.recognizeRunes(levelImage);
        if (levelResult.value != null && levelResult.confidence > OCR_CONFIDENCE_THRESHOLD) {
          const detected = levelResult.value;
          if (
            detected >= gameData.MIN_LEVEL &&
            detected <= gameData.MAX_LEVEL &&
            detected !== currentLevel
          ) {
            currentLevel = detected;
            sendLevelUpdate();
          }
        }
      }

      // ── Day auto-detection ────────────────────────────────────────
      const now       = Date.now();
      const dayRegion = cfg.ocrDayRegion || getCenterRegion();

      if (now - lastDayDetectTime > DAY_DETECT_COOLDOWN_MS) {
        const { png, whiteRatio } = cropAndPreprocess(thumbnail, dayRegion);

        if (whiteRatio > MIN_WHITE_RATIO) {
          const textResult = await ocrWorker.recognizeText(png);

          if (textResult.raw.length > 0) {
            console.log(
              '[Day OCR] ratio:', (whiteRatio * 100).toFixed(1) + '%',
              'text:', JSON.stringify(textResult.raw),
            );
          }

          const detectedDay = tryDetectDay(textResult.raw);

          // Only accept the expected next day in sequence (1 → 2 → 3 → 1).
          // This prevents stale or spurious matches from resetting the timer.
          const expectedNext = currentDay >= 3 ? 1 : currentDay + 1;
          const isNewDay     = detectedDay != null && detectedDay !== currentDay;
          const isExpected   = detectedDay === expectedNext || currentDay === 0;

          if (isNewDay && isExpected) {
            lastDayDetectTime = now;
            console.log('[Day OCR] STARTING day', detectedDay);
            startDayTimer(detectedDay);
            if (overlayWin) {
              overlayWin.webContents.send('toast', `Day ${detectedDay} detected`);
            }
          }
        }
      }
    } catch (err) {
      console.error('[OCR] error:', err.message);
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
  const cfg         = settings.get();
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

// ─── Boss Data ──────────────────────────────────────────────────────

function sendBossData() {
  if (!overlayWin) return;

  const data = bossData.BOSSES.map((boss) => ({
    id:   boss.id,
    name: boss.name,
    phases: boss.phases.map((phase) => ({
      phaseName:  phase.phaseName,
      weak:       phase.weak.map((t) => pathToFileURL(bossData.iconPath(t)).href),
      resistant:  phase.resistant.map((t) => pathToFileURL(bossData.iconPath(t)).href),
    })),
    night1: boss.night1 || [],
    night2: boss.night2 || [],
  }));

  overlayWin.webContents.send('boss:data', data);
}

// ─── Hotkeys ────────────────────────────────────────────────────────

function registerHotkeys() {
  const keys = settings.get().hotkeys;

  const register = (key, fn) => {
    const ok = globalShortcut.register(key, fn);
    if (!ok) console.warn(`[Hotkeys] Failed to register "${key}" — may be taken by the OS`);
  };

  register(keys.toggleOverlay, () => {
    if (overlayWin) overlayWin.webContents.send('overlay:toggle');
  });

  register(keys.startTimer, () => advanceDay());

  register(keys.levelUp,   () => setLevel(1));
  register(keys.levelDown, () => setLevel(-1));

  // F10 = faster OCR, F11 = slower OCR
  register('F10', () => adjustOCRSpeed(-500));
  register('F11', () => adjustOCRSpeed(500));

  register(keys.calibrate, () => {
    if (calibrationWin) {
      calibrationWin.close();
    } else {
      if (overlayWin) overlayWin.webContents.send('calibration:start');
      createCalibrationWindow();
    }
  });

  register('Control+Alt+B',     () => { if (overlayWin) overlayWin.webContents.send('boss:toggle'); });
  register('Control+Alt+Left',  () => { if (overlayWin) overlayWin.webContents.send('boss:prev');   });
  register('Control+Alt+Right', () => { if (overlayWin) overlayWin.webContents.send('boss:next');   });
}

// ─── IPC Handlers ───────────────────────────────────────────────────

/**
 * Validate a calibration region object before persisting it.
 * Prevents garbage data from being written to settings if the calibration
 * UI sends unexpected payloads.
 */
function isValidRegion(region) {
  if (!region || typeof region !== 'object') return false;
  const { x, y, width, height } = region;
  return (
    typeof x === 'number' && x >= 0 &&
    typeof y === 'number' && y >= 0 &&
    typeof width  === 'number' && width  > 0 &&
    typeof height === 'number' && height > 0
  );
}

const VALID_CALIBRATION_TYPES = new Set(['runes', 'level', 'day']);

function setupIPC() {
  ipcMain.on('calibration:region', (_e, type, region) => {
    if (!VALID_CALIBRATION_TYPES.has(type) || !isValidRegion(region)) {
      console.warn('[IPC] Rejected invalid calibration:region payload:', type, region);
      return;
    }

    if (type === 'runes') {
      settings.save({ ocrRuneRegion: region });
    } else if (type === 'level') {
      settings.save({ ocrLevelRegion: region });
    } else if (type === 'day') {
      settings.save({ ocrDayRegion: region });
      if (calibrationWin) calibrationWin.close();
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
