const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const SETTINGS_FILE = path.join(app.getPath('userData'), 'nightreign-settings.json');

const DEFAULTS = {
  ocrRuneRegion: null,  // { x, y, width, height } — rune counter (top-right)
  ocrLevelRegion: null, // { x, y, width, height } — level number (top-left)
  ocrDayRegion: null,   // { x, y, width, height } — day text (center screen)
  overlayPosition: { x: -1, y: 10 },
  ocrIntervalMs: 3000,
  hotkeys: {
    toggleOverlay: 'F5',
    startTimer: 'F6',
    levelUp: 'F7',
    levelDown: 'F8',
    calibrate: 'F9',
  },
};

let current = null;

function load() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      current = { ...DEFAULTS, ...JSON.parse(raw) };
    } else {
      current = { ...DEFAULTS };
    }
  } catch {
    current = { ...DEFAULTS };
  }
  return current;
}

function save(updates) {
  current = { ...current, ...updates };
  try {
    fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(current, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save settings:', err.message);
  }
  return current;
}

function get() {
  if (!current) load();
  return current;
}

module.exports = { load, save, get, DEFAULTS };
