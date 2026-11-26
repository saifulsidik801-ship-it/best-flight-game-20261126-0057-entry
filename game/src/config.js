// Merapi Ring Run — tuning, palette and mission definitions.
// One clear job: every number the game balances on lives here.

const CONFIG = {
  // World scale: 1 unit = 1 metre, valley is 5200 x 5200 m.
  worldSize: 5200,
  terrainSegments: 180,
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
  // Golden-hour palette.
  skyTop: 0x2e4a7a,
  skyMid: 0xd97b3f,
  skyLow: 0xffb347,
  sunColor: 0xffc46b,
  sunIntensity: 2.4,
  hemiSky: 0x8fb4e8,
  hemiGround: 0x5d3a1a,
  fogColor: 0xe8956b,
  fogNear: 900,
  fogFar: 4200,
  // Runway.
  runway: { x: 0, z: 1450, heading: 0, length: 620, width: 34 },
  // Volcano (Merapi) — the valley's landmark, north-west.
  volcano: { x: -1150, z: -1250, height: 640, radius: 900 },
};

// Three sorties, different goals so the game has depth.
const MISSIONS = [
  {
    id: 1, name: 'SORTIE 1 · RING RUN',
    goal: 'Thread all 12 golden rings over the Merapi valley. Mind the volcano thermals.',
    type: 'rings', target: 12,
    start: { x: 0, y: 260, z: 1750, heading: 0, speed: 55 },
  },
  {
    id: 2, name: 'SORTIE 2 · RIVER RESCUE',
    goal: 'Fly low along the river and drop 6 supply crates on the glowing markers. Stay under 90 m.',
    type: 'crates', target: 6,
    start: { x: 420, y: 150, z: 2100, heading: -0.35, speed: 50 },
  },
  {
    id: 3, name: 'SORTIE 3 · DUSK LANDING',
    goal: 'Bring Kestrel-9 home at dusk. Line up with the lit strip, gear down, touch down gentle.',
    type: 'landing', target: 1,
    start: { x: -260, y: 420, z: 2600, heading: 0.12, speed: 58 },
    dusk: true,
  },
];

const HUD_NAMES = ['NORTH', 'NORTH-EAST', 'EAST', 'SOUTH-EAST', 'SOUTH', 'SOUTH-WEST', 'WEST', 'NORTH-WEST'];
