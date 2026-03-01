const RUNE_COSTS = [
  { level: 1,  cost: 0,     total: 0 },
  { level: 2,  cost: 3698,  total: 3698 },
  { level: 3,  cost: 7922,  total: 11620 },
  { level: 4,  cost: 12348, total: 23968 },
  { level: 5,  cost: 16798, total: 40946 },
  { level: 6,  cost: 21818, total: 62764 },
  { level: 7,  cost: 26869, total: 89633 },
  { level: 8,  cost: 32137, total: 121770 },
  { level: 9,  cost: 37624, total: 159394 },
  { level: 10, cost: 43335, total: 202729 },
  { level: 11, cost: 49271, total: 252000 },
  { level: 12, cost: 55439, total: 307439 },
  { level: 13, cost: 61840, total: 369279 },
  { level: 14, cost: 68479, total: 437758 },
  { level: 15, cost: 75358, total: 513116 },
];

const MAX_LEVEL = 15;
const MIN_LEVEL = 1;

// Night's Tide phase timings in seconds from the start of each day
const TIDE_PHASES = [
  { name: 'Tide Shrinks',    triggerAt: 270, label: 'Phase 1 — Tide begins shrinking' },
  { name: 'Final Shrink',    triggerAt: 660, label: 'Phase 2 — Final shrink toward arena' },
  { name: 'Boss Fight',      triggerAt: 840, label: 'Phase 3 — Boss fight begins' },
];

const DAY_DURATION = 900; // ~15 minutes total per day

function getRuneCostForLevel(level) {
  if (level < MIN_LEVEL || level > MAX_LEVEL) return null;
  return RUNE_COSTS.find(r => r.level === level);
}

function getRunesNeededForNextLevel(currentLevel) {
  if (currentLevel >= MAX_LEVEL) return null;
  return RUNE_COSTS.find(r => r.level === currentLevel + 1);
}

module.exports = {
  RUNE_COSTS,
  MAX_LEVEL,
  MIN_LEVEL,
  TIDE_PHASES,
  DAY_DURATION,
  getRuneCostForLevel,
  getRunesNeededForNextLevel,
};
