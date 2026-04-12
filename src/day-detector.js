/**
 * Day detection from OCR text output.
 * Pure module — no Electron or side-effects. Fully unit-testable.
 *
 * Supports English ("DAY 1") and Portuguese ("DIA 1"), plus common OCR
 * misreads where Tesseract confuses I, 1, and L with each other.
 */

// Tesseract commonly substitutes I ↔ 1 ↔ L; this character class covers all three.
const I = '[I1L]';

// Patterns ordered Day 3 → Day 2 → Day 1.
// Day 3 must be checked first: "DAY III" would otherwise also match the Day 1
// and Day 2 patterns. The negative lookahead (?!I) in Day 1/2 patterns guards
// against most false-positive matches, but ordering is the primary safeguard.
const PATTERNS = [
  // Day 3 — DIA/DAY + III or literal 3
  { re: new RegExp(`D${I}?A\\s*${I}${I}${I}`, 'i'), day: 3 },
  { re: new RegExp(`DAY\\s*${I}${I}${I}`, 'i'),     day: 3 },
  { re: new RegExp(`D.?Y\\s*${I}${I}${I}`, 'i'),    day: 3 },
  { re: /D[I1L]?A\s*3/i,                             day: 3 },
  { re: /D.?Y\s*3/i,                                 day: 3 },

  // Day 2 — DIA/DAY + II or literal 2 (negative lookahead avoids matching III)
  { re: new RegExp(`D${I}?A\\s*${I}${I}(?!${I})`, 'i'), day: 2 },
  { re: new RegExp(`DAY\\s*${I}${I}(?!${I})`, 'i'),     day: 2 },
  { re: new RegExp(`D.?Y\\s*${I}${I}(?!${I})`, 'i'),    day: 2 },
  { re: /D[I1L]?A\s*2/i,                                 day: 2 },
  { re: /D.?Y\s*2/i,                                     day: 2 },

  // Day 1 — DIA/DAY + I or literal 1 (negative lookahead avoids matching II/III)
  { re: new RegExp(`D${I}?A\\s*${I}(?!${I})`, 'i'), day: 1 },
  { re: new RegExp(`DAY\\s*${I}(?!${I})`, 'i'),     day: 1 },
  { re: new RegExp(`D.?Y\\s*${I}(?!${I})`, 'i'),    day: 1 },
  { re: /D[I1L]?A\s*1/i,                             day: 1 },
  { re: /D.?Y\s*1/i,                                 day: 1 },
];

/**
 * Attempt to parse a day number from raw OCR text.
 *
 * @param {string} text - Raw OCR output (any case, any noise)
 * @returns {1|2|3|null} Detected day number, or null if not found
 */
function tryDetectDay(text) {
  if (!text) return null;

  // Normalise: uppercase, replace non-alphanumeric runs with a single space.
  const t = text
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  for (const { re, day } of PATTERNS) {
    if (re.test(t)) return day;
  }
  return null;
}

module.exports = { tryDetectDay };
