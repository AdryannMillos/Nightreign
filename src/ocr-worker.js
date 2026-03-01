const { createWorker } = require('tesseract.js');

let digitWorker = null;
let textWorker = null;

async function init() {
  if (!digitWorker) {
    digitWorker = await createWorker('eng', 1, { logger: () => {} });
    await digitWorker.setParameters({
      tessedit_char_whitelist: '0123456789,.',
      tessedit_pageseg_mode: '7',
    });
  }

  if (!textWorker) {
    textWorker = await createWorker('eng', 1, { logger: () => {} });
    await textWorker.setParameters({
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ',
      tessedit_pageseg_mode: '7',
    });
  }
}

async function recognizeRunes(imageBuffer) {
  if (!digitWorker) await init();

  const { data } = await digitWorker.recognize(imageBuffer);
  const raw = data.text.trim();
  const cleaned = raw.replace(/[^0-9]/g, '');
  const value = cleaned ? parseInt(cleaned, 10) : null;

  return { raw, value, confidence: data.confidence };
}

async function recognizeText(imageBuffer) {
  if (!textWorker) await init();

  const { data } = await textWorker.recognize(imageBuffer);
  const raw = data.text.trim().toUpperCase();

  return { raw, confidence: data.confidence };
}

async function terminate() {
  if (digitWorker) { await digitWorker.terminate(); digitWorker = null; }
  if (textWorker) { await textWorker.terminate(); textWorker = null; }
}

module.exports = { init, recognizeRunes, recognizeText, terminate };
