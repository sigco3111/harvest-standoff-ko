// Every number that changes how the game FEELS lives here, so tuning is one file.

export const MOVE = {
  run: 6.2, // metres per second
  walk: 3.0, // holding Shift: slower, silent footsteps
  crouch: 2.6,
  accel: 55,
  airControl: 0.3,
  gravity: 22,
  jump: 7.4,
  eye: 1.62,
  eyeCrouch: 1.15,
  radius: 0.4,
  height: 1.8,
  heightCrouch: 1.3,
};

export const ROUND = {
  freeze: 8, // seconds at the start line: this is shopping time
  length: 100, // seconds to plant the pumpkin
  winTarget: 6, // first team to this many rounds wins the match
  half: 5, // teams swap jobs after this many rounds
  endDelay: 5,
  reveal: 30, // Last Team Standing: with this many seconds left, everyone still standing shows on the map
};

// the ways to play (all texts live in lang-ko.js / lang-en.js: mode.*, job.*, how.*)
export const MODES = { pumpkin: {}, lts: {} };

// the Stink-Pumpkin
export const OBJ = {
  plantTime: 3, // seconds holding E to plant
  corkTime: 8, // seconds holding E to cork it
  corkTimeKit: 4, // ...with a Cork Kit
  fuse: 40, // seconds from planted to "pee-yew"
  reach: 1.7, // how close you must be to cork or pick up
};

// corn coins
export const ECON = {
  start: 800,
  max: 16000,
  win: 3000,
  lose: [1400, 1900, 2400, 2900], // grows with each loss in a row
  splat: 300,
  plant: 300,
  cork: 300,
};

export const TEAM = {
  herd: { color: '#f08a24' },
  hands: { color: '#3f8fd9' },
};

// spread values are angles in radians (0.01 is roughly 20 cm off at 20 m)
export const GADGETS = {
  squirter: {
    id: 'squirter', auto: false, rate: 5.5,
    dmg: 24, head: 2, tank: 12, reload: 1.4,
    spread: 0.004, moveSpread: 0.03, airSpread: 0.06, bloom: 0.005, bloomMax: 0.03,
    kick: 0.011, speed: 110, color: 0x57c7ff, splat: 0.2, sound: 'sfx_squirt',
  },
  egg: {
    id: 'egg', auto: true, rate: 11,
    dmg: 13, head: 1.8, tank: 28, reload: 1.9,
    spread: 0.012, moveSpread: 0.03, airSpread: 0.07, bloom: 0.004, bloomMax: 0.04,
    kick: 0.006, speed: 100, color: 0xffe9a8, splat: 0.2, sound: 'sfx_egg',
  },
  tomato: {
    id: 'tomato', auto: true, rate: 7.5,
    dmg: 27, head: 2, tank: 20, reload: 2.2,
    spread: 0.003, moveSpread: 0.075, airSpread: 0.1, bloom: 0.008, bloomMax: 0.06,
    kick: 0.015, speed: 115, color: 0xe5412d, splat: 0.25, sound: 'sfx_tomato',
  },
  pea: {
    id: 'pea', auto: false, rate: 0.95,
    dmg: 88, head: 2, tank: 5, reload: 2.8,
    spread: 0.035, zoomSpread: 0.0007, moveSpread: 0.12, airSpread: 0.15, bloom: 0, bloomMax: 0,
    kick: 0.03, speed: 170, color: 0x8fd94a, splat: 0.22, sound: 'sfx_pea', zoom: true, slow: 0.86,
  },
};
export const PRIMARIES = ['egg', 'tomato', 'pea'];

// what the round shop sells (press B, then the number)
export const SHOP = [
  { id: 'egg', kind: 'gadget', price: 1200, icon: 'icon_egg' },
  { id: 'tomato', kind: 'gadget', price: 2700, icon: 'icon_tomato' },
  { id: 'pea', kind: 'gadget', price: 4200, icon: 'icon_pea' },
  { id: 'overalls', kind: 'gear', price: 650, icon: 'icon_overalls' },
  { id: 'kit', kind: 'gear', price: 400, icon: 'icon_cork_kit', role: 'defend' },
  { id: 'flour', kind: 'throw', price: 300, icon: 'icon_flour' },
  { id: 'rooster', kind: 'throw', price: 200, icon: 'icon_rooster' },
  { id: 'mud', kind: 'throw', price: 300, icon: 'icon_mud' },
];

// things you throw (you can carry one of each)
export const THROWS = {
  flour: { id: 'flour', key: 3, fuse: 1.5, radius: 4.6, life: 12 },
  rooster: { id: 'rooster', key: 4, fuse: 1.5, radius: 16, daze: 3.2 },
  mud: { id: 'mud', key: 5, radius: 3.6, life: 9, slow: 0.45 },
};

export const DIFFICULTY = {
  easy: { reaction: 0.8, aimErr: 0.085, turn: 3.2, dmgToPlayer: 0.55, fireMoving: true },
  medium: { reaction: 0.48, aimErr: 0.05, turn: 5.0, dmgToPlayer: 0.8, fireMoving: false },
  hard: { reaction: 0.28, aimErr: 0.027, turn: 7.5, dmgToPlayer: 1.0, fireMoving: false },
};

// 'name' is only the dictionary key for lang-*.js ('name.<id>'), not displayed text
export const ROSTER = {
  herd: [
    { name: 'Clucky', kind: 'chicken' },
    { name: 'Hamlet', kind: 'pig' },
    { name: 'Daisy', kind: 'cow' },
    { name: 'Woolly', kind: 'sheep' },
    { name: 'Billy', kind: 'goat' },
  ],
  hands: [
    { name: 'Farmer Joe', kind: 'farmer', look: 0 },
    { name: 'Rosie', kind: 'farmer', look: 1 },
    { name: 'Hank', kind: 'farmer', look: 2 },
    { name: 'Pip', kind: 'farmer', look: 3 },
    { name: 'Mabel', kind: 'farmer', look: 4 },
  ],
};
