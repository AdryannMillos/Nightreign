const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nightreign', {
  // Timer
  onTimerUpdate: (cb) => ipcRenderer.on('timer:update', (_e, data) => cb(data)),
  onTimerPhase: (cb) => ipcRenderer.on('timer:phase', (_e, data) => cb(data)),
  onTimerReset: (cb) => ipcRenderer.on('timer:reset', (_e) => cb()),

  // Level & Runes
  onLevelChange: (cb) => ipcRenderer.on('level:change', (_e, data) => cb(data)),
  onRuneOCR: (cb) => ipcRenderer.on('rune:ocr', (_e, data) => cb(data)),

  // Overlay
  onVisibilityToggle: (cb) => ipcRenderer.on('overlay:toggle', (_e) => cb()),

  // Calibration
  onCalibrationStart: (cb) => ipcRenderer.on('calibration:start', (_e) => cb()),
  onCalibrationEnd: (cb) => ipcRenderer.on('calibration:end', (_e) => cb()),
  sendCalibrationRegion: (type, region) => ipcRenderer.send('calibration:region', type, region),

  // Settings
  onSettingsLoad: (cb) => ipcRenderer.on('settings:load', (_e, data) => cb(data)),

  // Day control
  onDayChange: (cb) => ipcRenderer.on('day:change', (_e, day) => cb(day)),

  // Toast notifications
  onToast: (cb) => ipcRenderer.on('toast', (_e, msg) => cb(msg)),

  // Boss info
  onBossData: (cb) => ipcRenderer.on('boss:data', (_e, data) => cb(data)),
  onBossToggle: (cb) => ipcRenderer.on('boss:toggle', (_e) => cb()),
  onBossPrev: (cb) => ipcRenderer.on('boss:prev', (_e) => cb()),
  onBossNext: (cb) => ipcRenderer.on('boss:next', (_e) => cb()),
});
