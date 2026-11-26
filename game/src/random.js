// Merapi Ring Run — deterministic randomness.
// One clear job: a seeded RNG and smooth value noise so the valley,
// the wind and the ring course are identical on every load.

function makeRng(seed) {
  let s = seed >>> 0;
  return function rng() {
    // mulberry32 — small, fast, deterministic.
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 2D value noise with smooth interpolation, built from a hash grid.
function makeNoise2D(seed) {
  const rng = makeRng(seed);
  const perm = new Uint8Array(512);
  const base = new Uint8Array(256);
  for (let i = 0; i < 256; i++) base[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = base[i]; base[i] = base[j]; base[j] = tmp;
  }
  for (let i = 0; i < 512; i++) perm[i] = base[i & 255];
  const fade = (t) => t * t * (3 - 2 * t);
  function hash(ix, iy) { return perm[(perm[ix & 255] + iy) & 255] / 255; }
  function noise(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const a = hash(ix, iy), b = hash(ix + 1, iy);
    const c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
    const u = fade(fx), v = fade(fy);
    return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
  }
  // Fractal sum: 4 octaves, the shape the valley is built from.
  function fbm(x, y) {
    let sum = 0, amp = 0.5, freq = 1;
    for (let o = 0; o < 4; o++) {
      sum += amp * noise(x * freq, y * freq);
      amp *= 0.5; freq *= 2.03;
    }
    return sum;
  }
  return { noise, fbm };
}
