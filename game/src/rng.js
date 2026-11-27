// Ashwing — seeded random helpers. One tiny job: deterministic numbers
// from a seed, so every screenshot run composes the same valley.
(function (global) {
  'use strict';

  // mulberry32: small fast seeded PRNG.
  function makeRng(seed) {
    var s = seed >>> 0;
    return function () {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function range(rng, lo, hi) { return lo + rng() * (hi - lo); }
  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length) % arr.length]; }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smoothstep(a, b, x) {
    var t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  }

  // 2D value noise from a seeded hash grid, 3 octaves.
  function makeNoise(seed) {
    var hash = function (ix, iz) {
      var h = (ix * 374761393 + iz * 668265263 + seed * 974634211) | 0;
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      return (((h ^ (h >>> 16)) >>> 0) / 4294967296) * 2 - 1;
    };
    function at(ix, iz) { return hash(ix, iz); }
    function noise2(x, z) {
      var ix = Math.floor(x), iz = Math.floor(z);
      var fx = x - ix, fz = z - iz;
      var sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
      var a = at(ix, iz), b = at(ix + 1, iz), c = at(ix, iz + 1), d = at(ix + 1, iz + 1);
      return lerp(lerp(a, b, sx), lerp(c, d, sx), sz);
    }
    return function (x, z) {
      return noise2(x * 0.004, z * 0.004) * 0.55
        + noise2(x * 0.011 + 31, z * 0.011 + 17) * 0.30
        + noise2(x * 0.031 + 7, z * 0.031 + 53) * 0.15;
    };
  }

  global.AshRng = { makeRng: makeRng, range: range, pick: pick, clamp: clamp, lerp: lerp, smoothstep: smoothstep, makeNoise: makeNoise };
})(typeof window !== 'undefined' ? window : globalThis);
