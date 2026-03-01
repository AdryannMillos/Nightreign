# Nightreign Overlay

A transparent desktop overlay for **Elden Ring: Nightreign** that tracks the Night's Tide shrink timer and your rune/level progress using screen OCR — completely anti-cheat safe.

## Features

- **Night's Tide Timer** — Countdown through all 3 shrink phases per day, with color-coded progress
- **Rune Tracking (OCR)** — Reads your rune count from the screen automatically
- **Level Progress** — Shows runes needed for the next level (levels 1–15)
- **Click-through overlay** — Sits on top of the game without blocking any input

## Requirements

- Windows 10/11
- Elden Ring: Nightreign running in **Borderless Windowed** mode
- Node.js 18+

## Setup

```bash
npm install
npm start
```

## Hotkeys

| Key | Action |
|-----|--------|
| F5  | Toggle overlay visibility |
| F6  | Start / advance day timer (Day 1 → 2 → 3 → reset) |
| F7  | Level up (+1) |
| F8  | Level down (-1) |
| F9  | Open OCR region calibration |

## First Run — OCR Calibration

1. Launch the overlay and start the game in **Borderless Windowed** mode
2. Press **F9** to enter calibration mode
3. Draw a rectangle over the **rune counter** (top-right corner of the game screen)
4. The overlay will begin reading your rune count automatically

## How It Works

The overlay uses Tesseract.js to OCR-read the rune count directly from screen pixels. It never touches game memory or network traffic, so it is completely safe to use with Easy Anti-Cheat.

Night's Tide phase timings are based on community-measured values:
- ~4:30 — Tide begins shrinking
- ~11:00 — Final shrink toward boss arena
- ~14:00 — Boss fight begins
