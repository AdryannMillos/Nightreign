const { createWorker } = require('tesseract.js');

let digitWorker = null;
let textWorker  = null;

// Maximum milliseconds to wait for a single Tesseract recognize() call.
// Without this, a stalled worker would hold `isOCRRunning = true` in main.js
// forever, stopping all future OCR iterations.
const OCR_TIMEOUT_MS = 15000;

async function init() {
  if (!digitWorker) {
    digitWorker = await createWorker('eng', 1, { logger: () => {} });
    await digitWorker.setParameters({
      tessedit_char_whitelist: '0123456789,.',
      tessedit_pageseg_mode:   '7',
    });
  }

  if (!textWorker) {
    textWorker = await createWorker('eng', 1, { logger: () => {} });
    await textWorker.setParameters({
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ',
      tessedit_pageseg_mode:   '7',
    });
  }
}

/**
 * Race `promise` against a timeout. If the timeout fires first, the returned
 * promise rejects with a descriptive error so the caller's try/finally still
 * runs (releasing any flags) rather than hanging indefinitely.
 *
 * @param {Promise<T>} promise
 * @param {string}     label  - Included in the error message for easier debugging
 * @returns {Promise<T>}
 */
function withTimeout(promise, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`OCR timed out after ${OCR_TIMEOUT_MS}ms (${label})`)),
      OCR_TIMEOUT_MS,
    );
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e);  },
    );
  });
}

/**
 * Parse a rune value from raw Tesseract digit output.
 * Strips all non-digit characters (commas, dots, OCR artefacts) then converts
 * to an integer. Returns null for blank or non-numeric strings.
 *
 * Exported so it can be unit-tested without loading Tesseract.
 *
 * @param {string} raw - Text from Tesseract digitWorker
 * @returns {number|null}
 */
function parseRuneValue(raw) {
  const cleaned = raw.replace(/[^0-9]/g, '');
  return cleaned ? parseInt(cleaned, 10) : null;
}

/**
 * OCR a rune/level number image (digits only).
 *
 * @param {Buffer} imageBuffer
 * @returns {Promise<{ raw: string, value: number|null, confidence: number }>}
 */
async function recognizeRunes(imageBuffer) {
  if (!digitWorker) await init();

  const { data } = await withTimeout(
    digitWorker.recognize(imageBuffer),
    'recognizeRunes',
  );
  const raw = data.text.trim();
  return { raw, value: parseRuneValue(raw), confidence: data.confidence };
}

/**
 * OCR a region that may contain day-indicator text (letters + digits).
 *
 * @param {Buffer} imageBuffer
 * @returns {Promise<{ raw: string, confidence: number }>}
 */
async function recognizeText(imageBuffer) {
  if (!textWorker) await init();

  const { data } = await withTimeout(
    textWorker.recognize(imageBuffer),
    'recognizeText',
  );
  return { raw: data.text.trim().toUpperCase(), confidence: data.confidence };
}

async function terminate() {
  if (digitWorker) { await digitWorker.terminate(); digitWorker = null; }
  if (textWorker)  { await textWorker.terminate();  textWorker  = null; }
}

module.exports = { init, recognizeRunes, recognizeText, terminate, parseRuneValue };
