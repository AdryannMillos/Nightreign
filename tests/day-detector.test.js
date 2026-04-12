/**
 * Tests for src/day-detector.js
 *
 * The game displays "DAY 1 / DAY 2 / DAY 3" (EN) or "DIA 1 / DIA 2 / DIA 3" (PT)
 * on-screen. Tesseract OCR is imperfect: it commonly swaps I ↔ 1 ↔ L and may
 * introduce extra noise. These tests verify detection across all realistic OCR
 * output variations.
 */
const { tryDetectDay } = require('../src/day-detector');

// ─── English "DAY N" ───────────────────────────────────────────────

describe('English DAY N', () => {
  test.each([
    ['DAY 1', 1],
    ['DAY 2', 2],
    ['DAY 3', 3],
  ])('"%s" → %i', (input, expected) => {
    expect(tryDetectDay(input)).toBe(expected);
  });

  test('lowercase "day 1" is accepted (case-insensitive)', () => {
    expect(tryDetectDay('day 1')).toBe(1);
  });

  test('"DAY1" without space', () => {
    expect(tryDetectDay('DAY1')).toBe(1);
  });
});

// ─── Portuguese "DIA N" ────────────────────────────────────────────

describe('Portuguese DIA N', () => {
  test.each([
    ['DIA 1', 1],
    ['DIA 2', 2],
    ['DIA 3', 3],
  ])('"%s" → %i', (input, expected) => {
    expect(tryDetectDay(input)).toBe(expected);
  });
});

// ─── Roman numeral OCR variants (I / II / III) ─────────────────────

describe('Roman numeral representations', () => {
  test('"DAY I" → 1 (Tesseract reads digit as letter I)', () => {
    expect(tryDetectDay('DAY I')).toBe(1);
  });

  test('"DAY II" → 2', () => {
    expect(tryDetectDay('DAY II')).toBe(2);
  });

  test('"DAY III" → 3', () => {
    expect(tryDetectDay('DAY III')).toBe(3);
  });

  test('"DIA I" → 1', () => {
    expect(tryDetectDay('DIA I')).toBe(1);
  });

  test('"DIA II" → 2', () => {
    expect(tryDetectDay('DIA II')).toBe(2);
  });

  test('"DIA III" → 3', () => {
    expect(tryDetectDay('DIA III')).toBe(3);
  });
});

// ─── Common I / 1 / L substitutions ───────────────────────────────

describe('I / 1 / L OCR substitutions', () => {
  test('"D1A 1" (I→1 in DIA)', () => {
    expect(tryDetectDay('D1A 1')).toBe(1);
  });

  test('"DLA 1" (I→L in DIA)', () => {
    expect(tryDetectDay('DLA 1')).toBe(1);
  });

  test('"DAY L" (1→L in digit)', () => {
    expect(tryDetectDay('DAY L')).toBe(1);
  });

  test('"DAY LL" → 2', () => {
    expect(tryDetectDay('DAY LL')).toBe(2);
  });

  test('"DAY LLL" → 3', () => {
    expect(tryDetectDay('DAY LLL')).toBe(3);
  });

  test('"DAY 1I" → 2 (mixed digit+letter for II)', () => {
    expect(tryDetectDay('DAY 1I')).toBe(2);
  });
});

// ─── Surrounding noise / partial matches ──────────────────────────

describe('Noise around the day label', () => {
  test('leading/trailing garbage ignored', () => {
    expect(tryDetectDay('... DAY 2 ...')).toBe(2);
  });

  test('extra whitespace between DAY and number', () => {
    expect(tryDetectDay('DAY   3')).toBe(3);
  });

  test('newlines treated as whitespace', () => {
    expect(tryDetectDay('DAY\n2')).toBe(2);
  });

  test('special characters stripped before matching', () => {
    // Tesseract may pick up punctuation artefacts
    expect(tryDetectDay('DAY! 1.')).toBe(1);
  });
});

// ─── No-match cases ────────────────────────────────────────────────

describe('Non-matching input', () => {
  test('empty string returns null', () => {
    expect(tryDetectDay('')).toBeNull();
  });

  test('null / undefined returns null', () => {
    expect(tryDetectDay(null)).toBeNull();
    expect(tryDetectDay(undefined)).toBeNull();
  });

  test('unrelated text returns null', () => {
    expect(tryDetectDay('ELDEN RING')).toBeNull();
  });

  test('pure number returns null', () => {
    expect(tryDetectDay('1')).toBeNull();
  });

  test('out-of-range day number returns null', () => {
    expect(tryDetectDay('DAY 4')).toBeNull();
    expect(tryDetectDay('DAY 0')).toBeNull();
  });

  test('"GOOD DAY" does not match (contextual false positive)', () => {
    // "GOOD DAY" — "DAY" is present but no number follows → should not match
    expect(tryDetectDay('GOOD DAY')).toBeNull();
  });
});

// ─── Day 3 priority over Day 1/2 patterns ─────────────────────────

describe('Pattern priority — Day 3 vs Day 1/2', () => {
  test('"DAY III" returns 3 and not 1 or 2', () => {
    expect(tryDetectDay('DAY III')).toBe(3);
  });

  test('"DIA III" returns 3', () => {
    expect(tryDetectDay('DIA III')).toBe(3);
  });

  test('"DAY II" returns 2 and not 1', () => {
    expect(tryDetectDay('DAY II')).toBe(2);
  });
});
