# Nightreign Overlay

A transparent desktop overlay for **Elden Ring: Nightreign** that tracks the Night's Tide storm phases and your rune/level progress using screen OCR — completely anti-cheat safe.

## Features

- **Storm Timer** — Phase-by-phase countdown: Storm, Shrinking, Storm 2, Shrinking 2, Boss
- **Level Auto-Detection (OCR)** — Reads your level number from the screen automatically
- **Runes Missing** — Shows how many runes you need for the next level
- **Rune Count (OCR)** — Reads your current rune count from the screen
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
| F6  | Start day timer (press again for Day 2, again for Day 3) |
| F7  | Manual level up (+1) |
| F8  | Manual level down (-1) |
| F9  | Open OCR calibration (2-step: runes then level) |

## First Run — OCR Calibration

1. Launch the overlay and start the game in **Borderless Windowed** mode
2. Press **F9** to enter calibration mode
3. **Step 1**: Draw a rectangle over the **rune counter number** (top-right of the screen)
4. **Step 2**: Draw a rectangle over the **level number** (top-left, near the health bar)
5. The overlay will begin reading both values automatically every 3 seconds

## How It Works

The overlay uses Tesseract.js to OCR-read numbers directly from screen pixels. It never touches game memory or network traffic, so it is completely safe with Easy Anti-Cheat.

Storm phase timings per day:
- Storm: 4:30
- Storm Shrinking: 3:00
- Storm 2: 3:30
- Storm 2 Shrinking: 3:00
- Boss Fight
