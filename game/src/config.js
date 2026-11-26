// Aurora Ring Run — tuning, palette and mission definitions.
// One clear job: every number the game balances on lives here.

const CONFIG = {
  // World scale: 1 unit = 1 metre, the frozen bay is 5200 x 5200 m.
  worldSize: 5200,
  terrainSegments: 140, // 140x140 keeps the bay's shape at ~40% fewer tris than 180 — Swiftshader win, same heights (heightAt is unchanged)
  // Flight model (SI-ish, tuned for feel).
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
  // Damage / fuel.
  startFuel: 100,
  fuelBurnCruise: 0.55,   // per second at full throttle
  fuelBurnIdle: 0.10,
  terrainHitDamage: 34,
  hardLandingDamage: 26,
  ringScore: 150,
  crateScore: 200,
  landingScore: 500,
  timeBonusPerSec: 4,
  // Polar-night palette: deep blue, aurora green, amber station lights.
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
  // Ice runway — same strip the v4 landing staging was validated against
  // (flat 26 m plateau, 60 kt / -705 FPM on final), so the v4 numbers carry.
  runway: { x: 0, z: 1450, heading: 0, length: 620, width: 34 },
  // Glacier updraft zone — the thermal physics.js lifts the plane in.
  // (Key stays "volcano" because the engine reads CONFIG.volcano; the
  // massif itself is the glacier at the same coordinates.)
  volcano: { x: -1150, z: -1250, height: 520, radius: 900 },
};

// Three sorties, different goals so the game has depth.
const MISSIONS = [
  {
    id: 1, name: 'SORTIE 1 · AURORA RING RUN',
    goal: 'Thread all 12 aurora rings over the frozen bay and the glacier. Ride the aurora updrafts.',
    type: 'rings', target: 12,
    start: { x: 0, y: 260, z: 1750, heading: 0, speed: 55 },
  },
  {
    id: 2, name: 'SORTIE 2 · ICE RIVER DROP',
    goal: 'Fly low along the ice river and drop 6 supply crates on the glowing markers at the station and ice camps. Stay under 90 m.',
    type: 'crates', target: 6,
    start: { x: 420, y: 150, z: 2100, heading: -0.35, speed: 50 },
  },
  {
    id: 3, name: 'SORTIE 3 · GLACIER LANDING',
    goal: 'Bring Ptarmigan home in the dark. Line up with the lit ice strip, skis down, touch down gentle.',
    type: 'landing', target: 1,
    start: { x: -260, y: 420, z: 2600, heading: 0.12, speed: 58 },
    dusk: true,
  },
];

const HUD_NAMES = ['NORTH', 'NORTH-EAST', 'EAST', 'SOUTH-EAST', 'SOUTH', 'SOUTH-WEST', 'WEST', 'NORTH-WEST'];
