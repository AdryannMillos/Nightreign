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

// Delay in seconds: when day appears, and between each phase
const PHASE_DELAY = 5;

// Phases for Day 1 and Day 2 — durations in seconds
// Each phase has a duration; triggerAt is cumulative start time (includes delays)
const DAY_PHASES = [
  { name: 'Storm',              duration: 270, shrinking: false, label: 'Storm'              },
  { name: 'Storm Shrinking',    duration: 180, shrinking: true,  label: 'Storm Shrinking'    },
  { name: 'Storm 2',            duration: 210, shrinking: false, label: 'Storm 2'            },
  { name: 'Storm 2 Shrinking',  duration: 180, shrinking: true,  label: 'Storm 2 Shrinking'  },
];

// Build cumulative trigger times with PHASE_DELAY between each phase
let cumulative = PHASE_DELAY; // Initial delay before Storm starts
const TIDE_PHASES = DAY_PHASES.map((p, i) => {
  const phase = { ...p, triggerAt: cumulative };
  cumulative += p.duration;
  if (i < DAY_PHASES.length - 1) cumulative += PHASE_DELAY;
  return phase;
});

// Total time before boss fight starts
const DAY_DURATION = cumulative;

const BOSS_LABELS = {
  1: 'Night Boss',
  2: 'Final Boss',
};

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
  PHASE_DELAY,
  TIDE_PHASES,
  DAY_DURATION,
  BOSS_LABELS,
  getRuneCostForLevel,
  getRunesNeededForNextLevel,
};
