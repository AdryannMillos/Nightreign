const path = require('path');

const ICON_DIR = path.join(__dirname, 'bosses', 'icons');

// Damage types in table column order
const DAMAGE_TYPES = [
  'standard', 'slash', 'strike', 'pierce',
  'magic', 'fire', 'lightning', 'holy',
  'bleed', 'frostbite', 'poison', 'rot', 'sleep', 'madness',
];

function iconPath(type) {
  return path.join(ICON_DIR, `${type}.jpg`);
}

// 'weak' = green (boss takes MORE damage), 'resistant' = red (boss takes LESS)
// Only entries with a class of 'weak' or 'resistant' from the table are included.
const BOSSES = [
  {
    id: 'gladius',
    name: 'Gladius',
    folder: 'Tricephalos - Glagius',
    phases: [
      {
        phaseName: null,
        weak:      ['pierce', 'holy', 'sleep'],
        resistant: ['fire', 'frostbite', 'poison', 'madness'],
      },
    ],
    night1: ['Demi-Human Queen & Demi-Human Swordmaster', 'Bell Bearing Hunter'],
    night2: ['Fell Omen', 'Tree Sentinel', 'Royal Cavalrymen'],
  },
  {
    id: 'adel',
    name: 'Adel',
    folder: 'Gaping-Jaw - Adel',
    phases: [
      {
        phaseName: null,
        weak:      ['frostbite', 'poison', 'rot', 'sleep'],
        resistant: ['fire', 'lightning', 'bleed', 'madness'],
      },
    ],
    night1: ["Duke's Dear Freja", 'Gaping Dragon', "Night's Cavalries", 'Wormface', 'Valiant Gargoyle'],
    night2: ['Ancient Dragon', 'Outland Commander', 'Golden Hippopotamus and Crucible Knight'],
  },
  {
    id: 'gnoster',
    name: 'Gnoster',
    folder: 'Sentient-Pest - Gnoster',
    phases: [
      {
        phaseName: 'Moth',
        weak:      ['standard', 'slash', 'strike', 'pierce', 'fire', 'bleed', 'sleep'],
        resistant: ['magic', 'lightning', 'holy', 'frostbite', 'poison', 'madness'],
      },
      {
        phaseName: 'Scorpion',
        weak:      ['strike', 'pierce', 'fire', 'bleed', 'frostbite', 'sleep'],
        resistant: ['standard', 'slash', 'magic', 'lightning', 'holy', 'madness'],
      },
    ],
    night1: ['Centipede Demon', 'Battlefield Commander', 'Smelter Demon', 'Tibia Mariner', 'Ulcerated Tree Spirit'],
    night2: ['Royal Cavalrymen', 'Draconic Tree Sentinel', 'Nox Dragonkin Soldier', 'Great Wyrm'],
  },
  {
    id: 'maris',
    name: 'Maris',
    folder: 'Augur - Maris',
    phases: [
      {
        phaseName: null,
        weak:      ['slash', 'lightning', 'madness'],
        resistant: ['strike', 'pierce', 'magic', 'fire', 'holy', 'bleed', 'rot', 'sleep'],
      },
    ],
    night1: ['Grafted Monarch', 'Gaping Dragon', 'Wormface', 'Smelter Demon', 'Valiant Gargoyle'],
    night2: ['Godskin Duo', 'Full-Grown Fallingstar Beast', 'Tree Sentinel', 'Royal Cavalryman'],
  },
  {
    id: 'libra',
    name: 'Libra',
    folder: 'Equilibrious-Beast - Libra',
    phases: [
      {
        phaseName: null,
        weak:      ['slash', 'fire', 'holy', 'poison', 'rot', 'madness'],
        resistant: ['magic', 'sleep'],
      },
    ],
    night1: ['Centipede Demon', 'Tibia Mariner & Those Who Live in Death', 'Battlefield Commander', 'Royal Revenant', "Duke's Dear Freja"],
    night2: ['Golden Hippopotamus and Crucible Knight', 'Godskin Duo', 'Death Rite Bird'],
  },
  {
    id: 'fulghor',
    name: 'Fulghor',
    folder: 'Darkdrift-Knight - Fulghor',
    phases: [
      {
        phaseName: null,
        weak:      ['lightning', 'bleed', 'frostbite', 'poison', 'rot', 'sleep'],
        resistant: ['holy', 'madness'],
      },
    ],
    night1: ['Wormface', 'Gaping Dragon', 'Centipede Demon', 'Royal Revenant', "Night's Cavalry"],
    night2: ['Nameless King', 'Outland Commander', 'Nox Dragonkin Soldier'],
  },
  {
    id: 'caligo',
    name: 'Caligo',
    folder: 'Fissure-in-the-Fog - Caligo',
    phases: [
      {
        phaseName: null,
        weak:      ['strike', 'fire'],
        resistant: ['slash', 'pierce', 'magic', 'lightning', 'holy', 'frostbite', 'sleep', 'madness'],
      },
    ],
    night1: ['Smelter Demon', "Duke's Dear Freja", 'Grafted Monarch', 'Ulcerated Tree Spirit', 'Tibia Mariner'],
    night2: ['Draconic Tree Sentinel', 'Godskin Duo', 'Dancer of the Boreal Valley'],
  },
  {
    id: 'night-aspect',
    name: 'Night Aspect',
    folder: 'Night-Aspect - Heolstor',
    phases: [
      {
        phaseName: 'The Shape Of Night',
        weak:      ['slash', 'pierce', 'fire', 'holy'],
        resistant: ['strike', 'bleed', 'frostbite', 'poison', 'sleep', 'madness'],
      },
      {
        phaseName: 'Heolstor',
        weak:      ['strike', 'pierce', 'lightning', 'holy', 'sleep'],
        resistant: ['slash', 'bleed', 'frostbite', 'poison', 'madness'],
      },
    ],
    night1: ['Centipede Demon', 'Tibia Mariner & Those Who Live in Death', 'Battlefield Commander', 'Royal Revenant', "Duke's Dear Freja"],
    night2: ['Golden Hippopotamus and Crucible Knight', 'Godskin Duo', 'Death Rite Bird'],
  },
];

module.exports = { BOSSES, DAMAGE_TYPES, iconPath };
