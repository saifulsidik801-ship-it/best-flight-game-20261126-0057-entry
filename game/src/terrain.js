// Aurora Ring Run v7 — frozen-bay terrain: snow heightfield, the dark
// open-water lead, the lit water lane, station, ship, ice. One clear job:
// make every surface read as the material it is.
//
// v7 material fixes (the v6 shots read the wrong materials):
// - ICEBERGS ARE ICE: blue-white #dfeaf5 faces, blue #9db8d8 shadow
//   faces, snow caps — never grey/brown boulders. The two giant
//   foreground boulders in the old landing shot are shrunk to small
//   ice-blue bergs and pulled back from the lane.
// - WATER IS WATER: the lead and the landing lane are DARK blue-black
//   water with aurora reflection streaks and buoy/lane lights. There is
//   no white road band anywhere — the lane is defined by LIGHT, not by
//   a pale stripe.
// - SNOW IS NOT A VOID: floes, pressure ridges, sastrugi, rock outcrops
//   and cracks fill the bay at shot scale; no pale patch over 15% of
//   any frame.

const Terrain = (function buildTerrainModule() {
  const noise = makeNoise2D(4242);
  const rng = makeRng(20261127);
  const WATER_Y = 0;          // open-water surface level
  const LEAD_HALF = CONFIG.leadHalfWidth; // 55 m of open water

  // THE BUG (found 06:3x, round 3): this clamp was inverted — it returned
  // v when v>b and b when a<=v<=b. sstep() then returned garbage, carve
  // exploded, meshHeight plunged to -1.9e20, and the whole terrain sank
  // under the sea plane (ground read as black water in every shot).
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  // Smoothstep from 0 at edge0 to 1 at edge1 (edge0 < edge1).
  function sstep(e0, e1, x) {
    const t = clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  // The lead meanders, but runs dead straight through the lane corridor
  // (z 700..1600) so the runway, the station dock, the ship and the
  // river-shot flight path all sit on open water at x ~ 0.
  function riverCenterX(z) {
    const meander = 70 * Math.sin(z * 0.0006 + 0.5) + 35 * Math.sin(z * 0.0016);
    const lane = sstep(620, 780, z) * (1 - sstep(1520, 1680, z));
    return meander * (1 - lane);
  }

  // Snow height without the lead carve: rolling drifts plus the glacier
  // massif in the north-west.
  // v7 round 2: base lifted so the snow never dips below the sea plane
  // (round 1: low drifts went to -27 m, under the y=-0.5 water, and the
  // whole bay read as black water). Min height is now ~+5 m.
  function snowHeight(x, z) {
    let h = 58
      + noise.fbm(x * 0.0016, z * 0.0016) * 48
      + noise.fbm(x * 0.007 + 13.7, z * 0.007 - 4.2) * 8;
    const dx = x - CONFIG.volcano.x, dz = z - CONFIG.volcano.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < 950) h += 380 * (1 - sstep(350, 950, d));
    return h;
  }

  // Mesh height: the lead is carved below the water so dark water shows.
  function meshHeight(x, z) {
    const h = snowHeight(x, z);
    const d = Math.abs(x - riverCenterX(z));
    const carve = 1 - sstep(LEAD_HALF - 5, LEAD_HALF + 45, d);
    return lerp(h, -3, carve);
  }

  // The surface the plane (and the HUD, and the markers) interact with:
  // water in the lead, snow everywhere else.
  function heightAt(x, z) {
    return Math.max(meshHeight(x, z), WATER_Y);
  }

  function buildTerrainMesh(scene) {
    const size = CONFIG.worldSize;
    const seg = CONFIG.terrainSegments;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    const colors = new Float32Array(p.count * 3);
    const snow = new THREE.Color(0xe6eef8);
    const drift = new THREE.Color(0xb9cfe8);
    const high = new THREE.Color(0xf2f7fc);
    const massif = new THREE.Color(0xe8f2fb);
    const wet = new THREE.Color(0xa8c4e0);
    const c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const h = meshHeight(x, z);
      p.setY(i, h);
      // Colour by height and drift noise: low drifts read blue, high
      // snow reads white, the glacier reads pale blue, wet ice near the
      // water reads steel blue.
      const n = noise.fbm(x * 0.004 + 7.3, z * 0.004 - 2.1) * 0.5 + 0.5;
      c.copy(snow).lerp(drift, clamp(0.65 - h / 110, 0, 0.65));
      c.lerp(high, clamp((h - 130) / 180, 0, 0.5));
      const dx = x - CONFIG.volcano.x, dz = z - CONFIG.volcano.z;
      if (Math.sqrt(dx * dx + dz * dz) < 950) c.lerp(massif, 0.55);
      const dl = Math.abs(x - riverCenterX(z));
      if (dl < LEAD_HALF + 55) c.lerp(wet, 0.5 * (1 - sstep(LEAD_HALF + 10, LEAD_HALF + 55, dl)));
      c.multiplyScalar(0.92 + n * 0.16);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    // Restored: vertex colours (correct now the clamp is fixed) — snow
    // variation by height/drift/massif/wet, as designed.
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      vertexColors: true, flatShading: true, roughness: 0.92, metalness: 0.0,
    }));
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  // ---- Builders (function declarations, hoisted) ----

  function glowTexture() {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }
  let glowTex = null;
  function glowSprite(color, scale, opacity) {
    if (!glowTex) glowTex = glowTexture();
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color, transparent: true, opacity,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    s.scale.set(scale, scale, 1);
    return s;
  }
  function litWindow(w, h) {
    return new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: 0xffc46b }),
    );
  }

  // Buoys and the beacon pulse, animated from the game clock.
  const buoys = [];
  let beaconGlow = null;
  let smokePuffs = [];
  let streakMats = [];

  function buildRiver(scene) {
    // Dark open water following the lead, z -2600..2600.
    const SEG = 120;
    const pos = new Float32Array((SEG + 1) * 2 * 3);
    const idx = [];
    for (let i = 0; i <= SEG; i++) {
      const z = -2600 + (5200 * i) / SEG;
      const cx = riverCenterX(z);
      const o = i * 6;
      pos[o] = cx - 55; pos[o + 1] = 0.15; pos[o + 2] = z;
      pos[o + 3] = cx + 55; pos[o + 4] = 0.15; pos[o + 5] = z;
      if (i < SEG) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const water = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: 0x06121f, roughness: 0.12, metalness: 0.65,
    }));
    scene.add(water);

    // Aurora reflection streaks lying on the water: long, thin, additive.
    const streakCols = [0x39ff88, 0x2ad4c4, 0x39ff88, 0x7a4dff, 0x2ad4c4, 0x39ff88];
    streakMats = [];
    for (let k = 0; k < 6; k++) {
      const z = -1900 + k * 720 + rng() * 160;
      const cx = riverCenterX(z);
      const len = 170 + rng() * 160;
      const streak = new THREE.Mesh(
        new THREE.PlaneGeometry(7 + rng() * 5, len),
        new THREE.MeshBasicMaterial({
          color: streakCols[k], transparent: true, opacity: 0.20,
          blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
        }),
      );
      streak.rotation.x = -Math.PI / 2;
      streak.rotation.z = (rng() - 0.5) * 0.25;
      streak.position.set(cx + (rng() - 0.5) * 50, 0.35, z);
      streak.userData.phase = k * 1.7;
      streakMats.push(streak.material);
      scene.add(streak);
    }

    // Frozen edge ice along both banks of the lead.
    for (const side of [-1, 1]) {
      const epos = new Float32Array((SEG + 1) * 2 * 3);
      const eidx = [];
      for (let i = 0; i <= SEG; i++) {
        const z = -2600 + (5200 * i) / SEG;
        const cx = riverCenterX(z);
        const o = i * 6;
        epos[o] = cx + side * 52; epos[o + 1] = 0.45; epos[o + 2] = z;
        epos[o + 3] = cx + side * 66; epos[o + 4] = 0.45; epos[o + 5] = z;
        if (i < SEG) { const a = i * 2; eidx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      const egeo = new THREE.BufferGeometry();
      egeo.setAttribute('position', new THREE.BufferAttribute(epos, 3));
      egeo.setIndex(eidx);
      egeo.computeVertexNormals();
      scene.add(new THREE.Mesh(egeo, new THREE.MeshStandardMaterial({
        color: 0xdfeaf5, roughness: 0.85, metalness: 0,
      })));
    }

    // Floes: flat ice discs riding the lead edges, big enough to read.
    const floeMat = new THREE.MeshStandardMaterial({ color: 0xdfeaf5, roughness: 0.85, flatShading: true });
    const floeMat2 = new THREE.MeshStandardMaterial({ color: 0xc3d6ec, roughness: 0.85, flatShading: true });
    for (let k = 0; k < 26; k++) {
      const z = -2400 + rng() * 4800;
      const side = rng() > 0.5 ? 1 : -1;
      const cx = riverCenterX(z) + side * (62 + rng() * 26);
      const r = 9 + rng() * 22;
      const floe = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.92, 1.6, 7), k % 2 ? floeMat : floeMat2);
      floe.position.set(cx, 0.6, z);
      floe.rotation.y = rng() * Math.PI;
      floe.rotation.z = (rng() - 0.5) * 0.05;
      floe.receiveShadow = true;
      scene.add(floe);
    }
  }

  function buildRunway(scene) {
    // The lit WATER LANE: no white stripe, no pale band. The lane is
    // defined by its lights on dark water — amber buoys on both edges,
    // green centreline lights, an amber approach bar at the south end.
    const rw = CONFIG.runway;
    const z0 = rw.z - rw.length / 2, z1 = rw.z + rw.length / 2;
    const buoyGeo = new THREE.CylinderGeometry(1.3, 1.5, 1.1, 8);
    const buoyMat = new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.7 });
    const lampGeo = new THREE.SphereGeometry(0.75, 10, 8);
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffb347 });
    for (const side of [-1, 1]) {
      for (let z = z0 + 20; z <= z1; z += 55) {
        const g = new THREE.Group();
        const buoy = new THREE.Mesh(buoyGeo, buoyMat);
        buoy.position.y = 0.4;
        g.add(buoy);
        const lamp = new THREE.Mesh(lampGeo, lampMat);
        lamp.position.y = 1.5;
        g.add(lamp);
        const glow = glowSprite(0xffb347, 9, 0.85);
        glow.position.y = 1.5;
        g.add(glow);
        g.position.set(rw.x + side * 26, 0, z);
        g.userData.baseY = 0;
        g.userData.phase = z * 0.05 + (side > 0 ? 2 : 0);
        buoys.push(g);
        scene.add(g);
      }
    }
    // Green centreline lights down the middle of the lane.
    const clGeo = new THREE.SphereGeometry(0.55, 8, 6);
    const clMat = new THREE.MeshBasicMaterial({ color: 0x39ff88 });
    for (let z = z0 + 30; z <= z1; z += 44) {
      const dot = new THREE.Mesh(clGeo, clMat);
      dot.position.set(rw.x, 0.9, z);
      scene.add(dot);
      const glow = glowSprite(0x39ff88, 6, 0.55);
      glow.position.set(rw.x, 0.9, z);
      scene.add(glow);
    }
    // Amber approach bar across the south end + red threshold pair north.
    for (let k = -2; k <= 2; k++) {
      const bar = new THREE.Mesh(lampGeo, lampMat);
      bar.position.set(rw.x + k * 7, 1.2, z1 + 18);
      scene.add(bar);
      const glow = glowSprite(0xffb347, 8, 0.8);
      glow.position.set(rw.x + k * 7, 1.2, z1 + 18);
      scene.add(glow);
    }
    const thrMat = new THREE.MeshBasicMaterial({ color: 0xff4444 });
    for (const side of [-1, 1]) {
      const thr = new THREE.Mesh(new THREE.SphereGeometry(0.8, 10, 8), thrMat);
      thr.position.set(rw.x + side * 26, 1.4, z0 - 8);
      scene.add(thr);
      const glow = glowSprite(0xff4444, 8, 0.8);
      glow.position.set(rw.x + side * 26, 1.4, z0 - 8);
      scene.add(glow);
    }
  }

  function buildVolcanoSmoke(scene) {
    // Glacier steam: soft columns rising off the massif, plus the warm
    // ember glow at its foot (the second of the game's two PointLights).
    const cx = CONFIG.volcano.x, cz = CONFIG.volcano.z;
    smokePuffs = [];
    for (let k = 0; k < 5; k++) {
      const px = cx + (rng() - 0.5) * 320;
      const pz = cz + (rng() - 0.5) * 320;
      for (let j = 0; j < 3; j++) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({
          map: glowTexture(), color: 0xcfe0f2, transparent: true,
          opacity: 0.10 + j * 0.03, depthWrite: false,
        }));
        const sc = 130 + j * 90 + rng() * 40;
        s.scale.set(sc, sc * 0.8, 1);
        s.position.set(px, 130 + j * 150, pz);
        s.userData.baseX = px;
        s.userData.phase = k * 1.3 + j;
        smokePuffs.push(s);
        scene.add(s);
      }
    }
    const ember = new THREE.PointLight(0xff7733, 0.9, 700);
    ember.position.set(cx, 120, cz);
    scene.add(ember);
  }

  function buildSea(scene) {
    // The dark bay water under everything: visible only where the
    // terrain dips — the lead channel. Deep blue-black, slightly glossy.
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(CONFIG.worldSize, CONFIG.worldSize),
      new THREE.MeshStandardMaterial({ color: 0x04101c, roughness: 0.1, metalness: 0.7 }),
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -0.5;
    scene.add(sea);
    // Moon glitter far north on the open water.
    for (let k = 0; k < 4; k++) {
      const glint = new THREE.Mesh(
        new THREE.PlaneGeometry(9, 260 + k * 60),
        new THREE.MeshBasicMaterial({
          color: 0x9db8e8, transparent: true, opacity: 0.13,
          blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
        }),
      );
      glint.rotation.x = -Math.PI / 2;
      glint.rotation.z = (rng() - 0.5) * 0.2;
      glint.position.set(-500 + k * 320, 0.3, -1900 - k * 150);
      scene.add(glint);
    }
  }

  function buildVillages(scene) {
    // Polaris Station: main hall + houses + radar dome + mast, every
    // window lit amber so the station reads BIG and alive from the air.
    const st = CONFIG.station;
    const gy = heightAt(st.x, st.z);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xb8b0a0, roughness: 0.85 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x2c3a4e, roughness: 0.8 });
    const domeMat = new THREE.MeshStandardMaterial({ color: 0xe8eef4, roughness: 0.4, metalness: 0.2 });
    function house(x, z, w, h, d, rotY) {
      const g = new THREE.Group();
      const y = heightAt(x, z);
      const walls = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
      walls.position.y = h / 2;
      walls.castShadow = true;
      g.add(walls);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1.6, 1.4, d + 1.6), roofMat);
      roof.position.y = h + 0.7;
      g.add(roof);
      const nWin = Math.max(2, Math.round(w / 4));
      for (let k = 0; k < nWin; k++) {
        const win = litWindow(1.7, 1.3);
        win.position.set(-w / 2 + 2 + (k * (w - 4)) / Math.max(1, nWin - 1), h * 0.55, d / 2 + 0.06);
        g.add(win);
      }
      const win2 = litWindow(1.7, 1.3);
      win2.position.set(w / 2 + 0.06, h * 0.55, 0);
      win2.rotation.y = Math.PI / 2;
      g.add(win2);
      g.position.set(x, y, z);
      g.rotation.y = rotY;
      scene.add(g);
      return g;
    }
    // Main hall — the biggest building, dead ahead in the river shot.
    house(st.x, st.z, 28, 11, 17, 0.1);
    house(st.x - 34, st.z + 26, 12, 7, 9, -0.2);
    house(st.x + 36, st.z + 18, 12, 7, 9, 0.25);
    house(st.x - 6, st.z - 34, 10, 6, 8, 0.05);
    // Radar dome on a base, beside the hall.
    const domeBase = new THREE.Mesh(
      new THREE.CylinderGeometry(4.5, 5.5, 9, 10), wallMat);
    domeBase.position.set(st.x + 24, gy + 4.5, st.z - 26);
    domeBase.castShadow = true;
    scene.add(domeBase);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(5.2, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
    dome.position.set(st.x + 24, gy + 9, st.z - 26);
    scene.add(dome);
    // Mast with a red beacon.
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.9, 26, 8),
      new THREE.MeshStandardMaterial({ color: 0x8a94a4, roughness: 0.6, metalness: 0.4 }));
    mast.position.set(st.x - 22, gy + 13, st.z - 18);
    scene.add(mast);
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(1.1, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff4444 }));
    beacon.position.set(st.x - 22, gy + 26.5, st.z - 18);
    scene.add(beacon);
    const bg = glowSprite(0xff4444, 16, 0.9);
    bg.position.set(st.x - 22, gy + 26.5, st.z - 18);
    scene.add(bg);
    // Station yard lamps.
    for (const [lx, lz] of [[-14, 30], [30, -8], [8, -30]]) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.25, 7, 6),
        new THREE.MeshStandardMaterial({ color: 0x5a6468, roughness: 0.6 }));
      post.position.set(st.x + lx, gy + 3.5, st.z + lz);
      scene.add(post);
      const lampGlow = glowSprite(0xffc46b, 10, 0.8);
      lampGlow.position.set(st.x + lx, gy + 7.2, st.z + lz);
      scene.add(lampGlow);
    }
    // Supply camps: two huts + a lamp each.
    for (const camp of CONFIG.camps) {
      house(camp.x, camp.z, 7, 4.5, 6, 0.3);
      house(camp.x + 11, camp.z + 7, 6, 4, 5, -0.4);
      const lampGlow = glowSprite(0xffc46b, 9, 0.75);
      lampGlow.position.set(camp.x + 5, heightAt(camp.x + 5, camp.z + 3) + 6, camp.z + 3);
      scene.add(lampGlow);
    }
  }

  function buildTrees(scene) {
    // ICEBERGS: blue-white ice with snow caps, stacked 2–3 shapes.
    // They sit IN the shot corridors — foreground and mid-ground — and
    // they read as ice, not rock. The old landing-shot giants are gone:
    // the lane-flank bergs are small (0.45–0.55) and pulled back.
    // v7 round 2: a faint blue emissive lift so no ice face ever crushes
    // to black on its shadow side (round 1 spires read as black bars).
    const iceMat = new THREE.MeshStandardMaterial({ color: 0xdfeaf5, roughness: 0.55, flatShading: true, emissive: 0x1a2836, emissiveIntensity: 0.5 });
    const iceBlue = new THREE.MeshStandardMaterial({ color: 0xc3d6ec, roughness: 0.6, flatShading: true, emissive: 0x1a2836, emissiveIntensity: 0.5 });
    const capMat = new THREE.MeshStandardMaterial({ color: 0xf4f9ff, roughness: 0.9, flatShading: true });
    function berg(x, z, s, seed) {
      const g = new THREE.Group();
      const r = new THREE.Group();
      const r1 = makeRng(seed);
      const base = new THREE.Mesh(new THREE.IcosahedronGeometry(16 * s, 0), r1() > 0.5 ? iceMat : iceBlue);
      base.scale.set(1.25, 0.72, 1);
      base.position.y = 5 * s;
      base.rotation.y = r1() * Math.PI;
      base.castShadow = true;
      g.add(base);
      const mid = new THREE.Mesh(new THREE.IcosahedronGeometry(10 * s, 0), r1() > 0.5 ? iceBlue : iceMat);
      mid.scale.set(1.1, 0.85, 0.95);
      mid.position.set(5 * s, 13 * s, -3 * s);
      mid.rotation.y = r1() * Math.PI;
      mid.castShadow = true;
      g.add(mid);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(7 * s, 9 * s, 7), capMat);
      cap.position.set(5 * s, 21 * s, -3 * s);
      g.add(cap);
      const gy = heightAt(x, z);
      g.position.set(x, gy - 2 * s, z);
      scene.add(g);
      return g;
    }
    const bergs = [
      // Cover corridor (flight path x~60, z 700..1400).
      [260, 1180, 1.4], [-190, 1020, 1.1], [320, 860, 1.0], [-260, 1300, 1.3],
      // River corridor (lead flanks).
      [180, 1250, 1.2], [-170, 1080, 0.9], [210, 900, 1.1],
      // Dusk approach (lane flanks, z 1450..2100).
      [240, 1900, 1.2], [-220, 1750, 1.0], [280, 1600, 0.9],
      // Landing foreground: SMALL ice-blue bergs, pulled back from the lane.
      [150, 1620, 0.55], [-140, 1560, 0.5], [190, 1480, 0.45],
      // Mid-bay extras.
      [-420, 500, 1.2], [420, 300, 1.0], [-380, -400, 1.3], [520, -700, 1.1],
    ];
    bergs.forEach(([x, z, s], i) => berg(x, z, s, 777 + i * 13));

    // Ice spires: tall thin pinnacles scattered on the bay, clear of the
    // lead, the lane and the ring course — and clear of every shot's
    // flight corridor (round 1 spires stood IN the corridors and read as
    // black vertical bars across the frame).
    for (let k = 0; k < 34; k++) {
      const x = -2400 + rng() * 4800;
      const z = -2400 + rng() * 4800;
      if (Math.abs(x - riverCenterX(z)) < 130) continue;
      if (Math.abs(x) < 120 && z > 600 && z < 1900) continue; // lane corridor
      if (z > 400 && z < 2200 && Math.abs(x) < 400) continue; // cover/river corridors
      if (z > 1400 && z < 2150) { // dusk approach line (300,2100)->(0,1450)
        const xl = 300 * (z - 1450) / 650;
        if (Math.abs(x - xl) < 260) continue;
      }
      const h = 18 + rng() * 38;
      const spire = new THREE.Mesh(
        new THREE.ConeGeometry(3.5 + rng() * 4.5, h, 6),
        k % 2 ? iceMat : iceBlue);
      spire.position.set(x, heightAt(x, z) + h / 2 - 2, z);
      spire.rotation.y = rng() * Math.PI;
      spire.castShadow = true;
      scene.add(spire);
    }
  }

  function buildBoats(scene) {
    // The icebreaker: 81 m of red hull in the lead at (0, 800), lit
    // windows, funnel glow — unmistakable as a ship from the river shot.
    const sh = CONFIG.ship;
    const g = new THREE.Group();
    const hullMat = new THREE.MeshStandardMaterial({ color: 0xc04535, roughness: 0.6, metalness: 0.25 });
    const hull = new THREE.Mesh(new THREE.BoxGeometry(15, 6, 62), hullMat);
    hull.position.y = 2.5;
    hull.castShadow = true;
    g.add(hull);
    const bow = new THREE.Mesh(new THREE.ConeGeometry(7.5, 16, 4), hullMat);
    bow.rotation.x = -Math.PI / 2;
    bow.rotation.y = Math.PI / 4;
    bow.scale.set(1, 1, 0.45);
    bow.position.set(0, 2.5, -38);
    g.add(bow);
    const deckMat = new THREE.MeshStandardMaterial({ color: 0xe8eef4, roughness: 0.5 });
    const deckhouse = new THREE.Mesh(new THREE.BoxGeometry(11, 8, 24), deckMat);
    deckhouse.position.set(0, 9, 6);
    deckhouse.castShadow = true;
    g.add(deckhouse);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(12, 4, 8), deckMat);
    bridge.position.set(0, 14.5, -2);
    g.add(bridge);
    // Lit bridge + cabin windows.
    for (let k = -2; k <= 2; k++) {
      const w = litWindow(1.6, 1.4);
      w.position.set(k * 2.2, 14.5, -6.1);
      w.rotation.y = Math.PI;
      g.add(w);
    }
    for (const side of [-1, 1]) {
      for (let k = 0; k < 4; k++) {
        const w = litWindow(1.4, 1.2);
        w.position.set(side * 5.6, 9 + (k % 2) * 3, -2 + k * 5);
        w.rotation.y = side * Math.PI / 2;
        g.add(w);
      }
    }
    const funnel = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.6, 9, 10),
      new THREE.MeshStandardMaterial({ color: 0x30343a, roughness: 0.6 }));
    funnel.position.set(0, 17, 14);
    g.add(funnel);
    const funnelGlow = glowSprite(0xff9a4d, 16, 0.8);
    funnelGlow.position.set(0, 22, 14);
    // Mast with a bright white masthead light — the ship's vertical
    // signature, so it reads as a ship (not a berg) from the river shot.
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.5, 20, 6),
      new THREE.MeshStandardMaterial({ color: 0x8a94a4, roughness: 0.6 }));
    mast.position.set(0, 22, -12);
    g.add(mast);
    const mastLight = new THREE.Mesh(
      new THREE.SphereGeometry(1.0, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    mastLight.position.set(0, 32, -12);
    g.add(mastLight);
    const mastGlow = glowSprite(0xffffff, 14, 0.9);
    mastGlow.position.set(0, 32, -12);
    g.add(mastGlow);
    g.add(funnelGlow);
    const mastTop = glowSprite(0xffffff, 8, 0.8);
    mastTop.position.set(0, 20, -4);
    g.add(mastTop);
    g.position.set(sh.x, 0, sh.z);
    scene.add(g);
    // Two small boats near the station dock.
    for (const [bx, bz] of [[150, 860], [95, 880]]) {
      const b = new THREE.Group();
      const bh = new THREE.Mesh(new THREE.BoxGeometry(6, 2, 12),
        new THREE.MeshStandardMaterial({ color: 0x37424e, roughness: 0.6 }));
      bh.position.y = 0.8;
      b.add(bh);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(3.5, 2.2, 4),
        new THREE.MeshStandardMaterial({ color: 0xdde6ee, roughness: 0.5 }));
      cab.position.set(0, 2.8, -1);
      b.add(cab);
      const w = litWindow(1.2, 1);
      w.position.set(0, 2.8, 1.1);
      b.add(w);
      b.position.set(bx, 0, bz);
      b.rotation.y = 0.4;
      scene.add(b);
    }
  }

  function buildLighthouse(scene) {
    // Standalone beacon tower far north-west: dark tower, white band,
    // red lamp with a slow pulse.
    const b = CONFIG.beacon;
    const gy = heightAt(b.x, b.z);
    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(2.6, 4.2, 42, 10),
      new THREE.MeshStandardMaterial({ color: 0x3a4a5e, roughness: 0.7 }));
    tower.position.set(b.x, gy + 21, b.z);
    tower.castShadow = true;
    scene.add(tower);
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(3.1, 3.4, 6, 10),
      new THREE.MeshStandardMaterial({ color: 0xe8eef4, roughness: 0.6 }));
    band.position.set(b.x, gy + 30, b.z);
    scene.add(band);
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(1.6, 12, 10), new THREE.MeshBasicMaterial({ color: 0xff4444 }));
    lamp.position.set(b.x, gy + 44, b.z);
    scene.add(lamp);
    beaconGlow = glowSprite(0xff4444, 34, 0.85);
    beaconGlow.position.set(b.x, gy + 44, b.z);
    scene.add(beaconGlow);
  }

  function buildPalms(scene) {
    // Pressure ridges, sastrugi drifts, rock outcrops and cracks: the
    // texture that keeps the snow from reading as one flat pale sheet.
    const ridgeMat = new THREE.MeshStandardMaterial({ color: 0xdbe8f6, roughness: 0.9, flatShading: true });
    const ridgeMat2 = new THREE.MeshStandardMaterial({ color: 0xc3d6ec, roughness: 0.9, flatShading: true });
    for (let k = 0; k < 80; k++) {
      const x = -2500 + rng() * 5000;
      const z = -2500 + rng() * 5000;
      if (Math.abs(x - riverCenterX(z)) < 95) continue;
      if (Math.abs(x) < 60 && z > 1050 && z < 1800) continue; // keep the lane clear
      const len = 26 + rng() * 55;
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(len, 3 + rng() * 4.5, 6 + rng() * 6),
        k % 2 ? ridgeMat : ridgeMat2);
      ridge.position.set(x, heightAt(x, z) + 1, z);
      ridge.rotation.y = rng() * Math.PI;
      ridge.castShadow = true;
      scene.add(ridge);
    }
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x5a6a80, roughness: 0.95, flatShading: true });
    for (let k = 0; k < 12; k++) {
      const x = -2300 + rng() * 4600;
      const z = -2300 + rng() * 4600;
      if (Math.abs(x - riverCenterX(z)) < 110) continue;
      const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(4 + rng() * 7, 0), rockMat);
      rock.position.set(x, heightAt(x, z) + 2, z);
      rock.rotation.set(rng() * 3, rng() * 3, 0);
      rock.castShadow = true;
      scene.add(rock);
    }
    // Cracks: thin dark-blue seams in the snow, reading as ice at scale.
    const crackMat = new THREE.MeshBasicMaterial({ color: 0x1c3a5e, transparent: true, opacity: 0.5 });
    for (let k = 0; k < 26; k++) {
      const x = -2400 + rng() * 4800;
      const z = -2400 + rng() * 4800;
      if (Math.abs(x - riverCenterX(z)) < 90) continue;
      const crack = new THREE.Mesh(new THREE.PlaneGeometry(40 + rng() * 90, 1.4 + rng() * 1.6), crackMat);
      crack.rotation.x = -Math.PI / 2;
      crack.rotation.z = rng() * Math.PI;
      crack.position.set(x, heightAt(x, z) + 0.35, z);
      scene.add(crack);
    }
  }

  // Pure functions of the game clock: identical on every run.
  function updateSea(_dt, clock) {
    for (const b of buoys) {
      b.position.y = b.userData.baseY + 0.3 * Math.sin(clock * 1.3 + b.userData.phase);
    }
    if (beaconGlow) {
      beaconGlow.material.opacity = 0.45 + 0.4 * Math.sin(clock * 2.0);
    }
    for (const s of smokePuffs) {
      s.position.x = s.userData.baseX + 26 * Math.sin(clock * 0.1 + s.userData.phase);
    }
    for (let i = 0; i < streakMats.length; i++) {
      streakMats[i].opacity = 0.16 + 0.06 * Math.sin(clock * 0.7 + i * 1.7);
    }
  }

  return {
    heightAt, riverCenterX,
    buildTerrainMesh,
    buildRiver, buildRunway, buildVolcanoSmoke, buildVillages,
    buildTrees, buildSea, buildBoats, buildLighthouse, buildPalms,
    updateSea,
  };
})();
