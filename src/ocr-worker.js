const { createWorker } = require('tesseract.js');

let worker = null;

async function init() {
  if (worker) return;
  worker = await createWorker('eng', 1, {
    logger: () => {},
  });
  await worker.setParameters({
    tessedit_char_whitelist: '0123456789,.',
    tessedit_pageseg_mode: '7', // single line
  });
}

async function recognizeRunes(imageBuffer) {
  if (!worker) await init();

  const { data } = await worker.recognize(imageBuffer);
  const raw = data.text.trim();
  const cleaned = raw.replace(/[^0-9]/g, '');
  const value = cleaned ? parseInt(cleaned, 10) : null;

  return {
    raw,
    value,
    confidence: data.confidence,
  };
}

async function terminate() {
  if (worker) {
    await worker.terminate();
    worker = null;
  }
}

module.exports = { init, recognizeRunes, terminate };
