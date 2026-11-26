// Aurora Ring Run v6 — Beaver + density rebuild. Tuning, palette, layout.
// One clear job: every number the game balances on lives here.
//
// v6 changes vs v5: the plane is a DHC-2 Beaver on FLOATS (no skis), so
// sortie 3 lands on the lit WATER LANE — the open-water lead itself —
// instead of an ice strip. The runway rect (physics + staging anchor)
// sits on the lead at the same coordinates v5 validated, so every staging
// number and every physics constant below carries over unchanged.

const CONFIG = {
  // World scale: 1 unit = 1 metre. The frozen bay is 5200 x 5200 m.
  worldSize: 5200,
  terrainSegments: 140,

  // ---- Flight model (SI-ish, tuned for feel — DO NOT RETUNE) ----
  maxThrottle: 1.0,
  throttleRate: 0.45,
  cruiseSpeed: 62,        // m/s at full throttle, level
  stallSpeed: 24,         // m/s — below this the nose drops
  maxSpeed: 95,
  rollRate: 1.55,         // rad/s at full deflection
  pitchRate: 0.85,
  yawRate: 0.35,
  gravity: 9.8,
  liftFactor: 0.055,
  dragBase: 0.012,
  airbrakeDrag: 0.09,
  groundEffect: 1.0,

  // ---- Damage / fuel / scoring (DO NOT RETUNE) ----
  startFuel: 100,
  fuelBurnCruise: 0.55,   // per second at full throttle
  fuelBurnIdle: 0.10,
  terrainHitDamage: 34,
  hardLandingDamage: 26,
  ringScore: 150,
  crateScore: 200,
  landingScore: 500,
  timeBonusPerSec: 4,

  // ---- Polar-night palette: deep blue, aurora green, amber lights ----
  skyTop: 0x070b24,
  skyMid: 0x0e2a52,
  skyLow: 0x14425e,
  auroraGreen: 0x39ff88,
  auroraTeal: 0x2ad4c4,
  auroraViolet: 0x7a4dff,
  moonColor: 0xbfd4ff,
  moonIntensity: 1.3,
  hemiSky: 0x2a4a7a,
  hemiGround: 0x1a2438,
  fillColor: 0xffe0b0,
  fillIntensity: 0.6,
  bounceColor: 0x66ffaa,
  bounceIntensity: 0.25,
  exposure: 1.40,
  fogColor: 0x0a1c30,
  fogNear: 900,
  fogFar: 3000,

  // ---- Shared anchors: one source of truth for the scene layout ----
  // The lead (open-water channel) runs north-south near x = 0. The landing
  // lane IS the lead: the runway rect sits on the water at these coords.
  runway: { x: 0, z: 1450, heading: 0, length: 620, width: 34 },
  // Glacier updraft zone — the thermal physics.js lifts the plane in.
  // (Key stays "volcano" because the engine reads CONFIG.volcano.)
  volcano: { x: -1150, z: -1250, height: 520, radius: 900 },
  // Polaris Station: close to the lead (120 m east) so it reads BIG in
  // the river shot — at 250 m it sat too far right, out of the chase
  // camera's frame at close range. Dead ahead in the cover/landing shots.
  station: { x: 120, z: 800 },
  // Icebreaker: moored IN the lead, 314 m ahead of the river shot at
  // capture, so it reads BIG and unmistakable above the Beaver's nose
  // (at 465 m it was a small dark blob lost at the horizon).
  ship: { x: 0, z: 800 },
  // Supply camps: north (far), south (near the lane), east (far north-east).
  camps: [
    { x: -280, z: -1300, name: 'north' },
    { x: -300, z: 900, name: 'south' },
    { x: 550, z: -200, name: 'east' },
  ],
  // Standalone beacon tower: far north-west landmark, visible in shots 1-2.
  beacon: { x: -600, z: -1600 },
  // Lead geometry: half-width of open water, and the meander amplitude.
  leadHalfWidth: 55,
};

// Three sorties, different goals so the game has depth.
// The Beaver is a floatplane: sortie 3 is a night WATER landing on the lit
// lane — floats down, gentle as you can. (Sortie 2's name MUST contain
// "RIVER": the playtest harness checks for it.)
const MISSIONS = [
  {
    id: 1, name: 'SORTIE 1 · AURORA RING RUN',
    goal: 'Thread all 12 aurora rings over the frozen bay and the glacier. Ride the aurora updrafts.',
    type: 'rings', target: 12,
    start: { x: 100, y: 260, z: 1700, heading: 0.1, speed: 55 },
  },
  {
    id: 2, name: 'SORTIE 2 · RIVER SUPPLY DROP',
    goal: 'Fly low along the ice river and drop 6 supply crates on the glowing markers at the station and ice camps. Stay under 90 m.',
    type: 'crates', target: 6,
    start: { x: 0, y: 150, z: 1400, heading: 0.05, speed: 50 },
  },
  {
    id: 3, name: 'SORTIE 3 · GLACIER WATER LANDING',
    goal: 'Bring the Beaver home in the dark. Line up with the lit water lane, floats down, touch down gentle.',
    type: 'landing', target: 1,
    start: { x: -300, y: 420, z: 2600, heading: 0.15, speed: 58 },
    dusk: true,
  },
];

const HUD_NAMES = ['NORTH', 'NORTH-EAST', 'EAST', 'SOUTH-EAST', 'SOUTH', 'SOUTH-WEST', 'WEST', 'NORTH-WEST'];
