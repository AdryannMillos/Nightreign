/**
 * Watches for the Nightreign game process and fires callbacks when the game
 * starts or stops. Uses `tasklist` so no elevated privileges are needed.
 *
 * Default process names cover the most likely executable names for
 * ELDEN RING: Nightreign on Steam. The list is user-configurable via
 * settings (gameProcessNames).
 */
const { exec } = require('child_process');

const DEFAULT_PROCESS_NAMES = ['nightreign.exe', 'ELDENRING.exe'];
const POLL_INTERVAL_MS = 5000; // check every 5 s — low overhead, fast enough

let watchInterval = null;
let gameRunning   = false;

/**
 * Check whether any of the given executable names is currently running.
 * Runs `tasklist` and scans stdout (no admin rights required).
 *
 * @param {string[]} names - Executable filenames to look for
 * @returns {Promise<boolean>}
 */
function checkProcessRunning(names) {
  return new Promise((resolve) => {
    exec('tasklist /FO CSV /NH', (err, stdout) => {
      if (err) { resolve(false); return; }
      const lower = stdout.toLowerCase();
      resolve(names.some((n) => lower.includes(n.toLowerCase())));
    });
  });
}

/**
 * Begin polling for the game process.
 *
 * @param {object}   opts
 * @param {string[]} [opts.processNames] - Executables to watch for
 * @param {Function} opts.onStart        - Called once when game is detected
 * @param {Function} opts.onStop         - Called once when game exits
 */
function startWatching({ processNames = DEFAULT_PROCESS_NAMES, onStart, onStop } = {}) {
  stopWatching();

  async function tick() {
    const running = await checkProcessRunning(processNames);
    if (running && !gameRunning) {
      gameRunning = true;
      onStart?.();
    } else if (!running && gameRunning) {
      gameRunning = false;
      onStop?.();
    }
  }

  // Run once immediately so the state is correct before the first interval fires
  tick();
  watchInterval = setInterval(tick, POLL_INTERVAL_MS);
}

function stopWatching() {
  if (watchInterval) {
    clearInterval(watchInterval);
    watchInterval = null;
  }
  gameRunning = false;
}

/** Whether the game was detected as running on the last poll. */
function isRunning() {
  return gameRunning;
}

module.exports = { startWatching, stopWatching, isRunning, DEFAULT_PROCESS_NAMES };
