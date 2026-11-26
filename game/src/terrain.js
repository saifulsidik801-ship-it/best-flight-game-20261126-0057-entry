// Aurora Ring Run v6 — arctic terrain: snow heightfield, open-water lead,
// lit water landing lane, icebergs, floes, pressure ridges, ice spires,
// glacier mist, beacon tower, workboats. One height function rules the
// physics (heightAt), the mesh, and every placement — no drift between them.

const Terrain = (function buildTerrainModule() {
  const noise = makeNoise2D(101);
  const fbm = noise.fbm;
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const sstep = (a, b, v) => {
    const t = clamp01((v - a) / (b - a));
    return t * t * (3 - 2 * t);
  };

  // The lead (open-water channel) meanders gently north-south near x = 0.
  // At the landing lane (z = 1450) its centre is ~10 m east of x = 0, so
  // the whole 34 m runway rect sits in open water.
  function riverCenterX(z) {
    return 25 * Math.sin(z * 0.0006) + 10 * Math.sin(z * 0.0016 + 2.0);
  }

  // Single source of truth for ground height. Ice plateau ~26 m, far-north
  // bay flattened toward 15 m, glacier massif north-west (+320 m peak),
  // map-edge mountains, and the lead carved down to water level 0.
  function groundHeight(x, z) {
    let h = 26 + 5 * fbm(x * 0.0016, z * 0.0016) + 2.5 * fbm(x * 0.006, z * 0.006);
    h += 1.2 * Math.abs(fbm(x * 0.02, z * 0.02)); // sastrugi ridges
    const northness = clamp01((-z - 400) / 600);
    h = h * (1 - 0.5 * northness) + 15 * 0.5 * northness;
    const mdx = x + 1150, mdz = z + 1250;
    h += 320 * Math.exp(-(mdx * mdx + mdz * mdz) / (2 * 700 * 700));
    const edge = Math.max(Math.abs(x), Math.abs(z));
    h += 160 * sstep(1900, 2600, edge);
    const d = Math.abs(x - riverCenterX(z));
    const w = CONFIG.leadHalfWidth;
    h *= sstep(w * 0.45, w, d); // carve the channel down to water
    return h;
  }

  function heightAt(x, z) { return groundHeight(x, z); }

  // Glow texture for sprites (moon glint, beacons, lane lights).
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
  const glowTex = glowTexture();

  function glowSprite(color, scale, opacity) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color, transparent: true, opacity,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    s.scale.set(scale, scale, 1);
    return s;
  }

  // Animated bits (driven by game clock in updateSea — deterministic).
  let glintMat = null;
  let mistSprites = [];
  let beaconGlow = null;

  function buildTerrainMesh(scene) {
    const geo = new THREE.PlaneGeometry(5200, 5200, 140, 140);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, groundHeight(pos.getX(i), pos.getZ(i)));
    }
    geo.computeVertexNormals();
    // Vertex colours: snow by height, blue shadow on slopes, dark rock
    // where it is steep, wet ice along the lead.
    const nrm = geo.attributes.normal;
    const colors = new Float32Array(pos.count * 3);
    const snowHi = new THREE.Color(0xdfe8f2);
    const snowLo = new THREE.Color(0xc8d6e8);
    const blueShade = new THREE.Color(0x8aa4c8);
    const rock = new THREE.Color(0x3a3f4a);
    const wet = new THREE.Color(0xa8c8e0);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const ny = nrm.getY(i);
      c.lerpColors(snowLo, snowHi, clamp01((y - 10) / 30));
      if (ny < 0.88) c.lerp(blueShade, Math.min(1, (0.88 - ny) / 0.3));
      if (ny < 0.65) c.lerp(rock, Math.min(1, (0.65 - ny) / 0.25));
      const d = Math.abs(x - riverCenterX(z));
      if (d < CONFIG.leadHalfWidth + 20) c.lerp(wet, 0.5);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.9, metalness: 0.0,
    }));
    mesh.receiveShadow = true;
    scene.add(mesh);

    // --- Icebergs IN the shot corridors (16): big faceted chunks,
    // 2-3 stacked, white with a blue shadow side. They sit in the ice
    // (never in the lead, never in the landing lane) AND inside the
    // cameras' frustums at capture — a berg behind the camera or 70°
    // off-axis is invisible, however big it is. ---
    const bergSpots = [
      // Cover corridor (south, in the chase camera's frustum at capture).
      [60, 1200, 44], [280, 1050, 40], [-80, 950, 36], [220, 1000, 28],
      // River corridor (along the lead, both banks, in frame at capture).
      // (250,880) sits at the right frame edge — it used to be (140,920),
      // directly between the river camera and the station, hiding it.
      [250, 880, 40], [-110, 850, 36], [180, 650, 38], [-180, 600, 44],
      [190, 380, 26],
      // Landing-lane flanks (big on both sides of the final).
      [-150, 1250, 42], [150, 1300, 40], [120, 1100, 36], [-110, 1150, 24],
      // North bay.
      [-420, -820, 56], [320, -1120, 42], [-720, -420, 36],
    ];
    const bergGeo = new THREE.DodecahedronGeometry(1, 0);
    const bergMat = new THREE.MeshStandardMaterial({
      color: 0xdfeaf5, roughness: 0.55, metalness: 0.05, flatShading: true,
    });
    const bergShade = new THREE.MeshStandardMaterial({
      color: 0x9db8d8, roughness: 0.6, metalness: 0.05, flatShading: true,
    });
    const brng = makeRng(20261126);
    bergSpots.forEach(([bx, bz, size]) => {
      const baseY = groundHeight(bx, bz);
      const group = new THREE.Group();
      const chunks = 2 + Math.floor(brng() * 2);
      for (let k = 0; k < chunks; k++) {
        const m = new THREE.Mesh(bergGeo, k % 2 ? bergShade : bergMat);
        const s = size * (0.55 + brng() * 0.5);
        m.scale.set(s, s * (0.45 + brng() * 0.3), s * (0.7 + brng() * 0.4));
        m.position.set((brng() - 0.5) * size * 0.7, s * 0.22 + k * s * 0.16, (brng() - 0.5) * size * 0.7);
        m.rotation.set(brng() * 0.6, brng() * Math.PI, brng() * 0.6);
        m.castShadow = true;
        group.add(m);
      }
      group.position.set(bx, baseY - 2, bz);
      scene.add(group);
    });
  }

  function buildRiver(scene) {
    // Dark water ribbon following the lead, plus a soft moon-glint strip
    // down its middle. The water sits at y = 0.4, just above the carved
    // channel floor (height 0), so the shoreline reads as ice meeting water.
    const geo = new THREE.PlaneGeometry(116, 5200, 6, 130);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setX(i, pos.getX(i) + riverCenterX(pos.getZ(i)));
      pos.setY(i, 0.4);
    }
    geo.computeVertexNormals();
    const water = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: 0x0a2038, roughness: 0.25, metalness: 0.6,
    }));
    water.receiveShadow = true;
    scene.add(water);

    const glintGeo = new THREE.PlaneGeometry(18, 5200, 1, 130);
    glintGeo.rotateX(-Math.PI / 2);
    const gp = glintGeo.attributes.position;
    for (let i = 0; i < gp.count; i++) {
      gp.setX(i, gp.getX(i) + riverCenterX(gp.getZ(i)));
      gp.setY(i, 0.55);
    }
    glintMat = new THREE.MeshBasicMaterial({
      color: 0x8fb8dd, transparent: true, opacity: 0.32,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    scene.add(new THREE.Mesh(glintGeo, glintMat));

    // Floes: flat irregular polygons crowding both banks of the lead.
    const floeGeo = new THREE.CircleGeometry(1, 7);
    const fp = floeGeo.attributes.position;
    const frng = makeRng(77);
    for (let i = 0; i < fp.count; i++) {
      const a = Math.atan2(fp.getY(i), fp.getX(i));
      const r = 1 + (frng() - 0.5) * 0.5;
      fp.setX(i, Math.cos(a) * r);
      fp.setY(i, Math.sin(a) * r);
    }
    floeGeo.rotateX(-Math.PI / 2);
    const floes = new THREE.InstancedMesh(floeGeo, new THREE.MeshStandardMaterial({
      color: 0xd6e4f2, roughness: 0.7, metalness: 0.05,
    }), 46);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const eul = new THREE.Euler();
    for (let i = 0; i < 46; i++) {
      const z = -2400 + frng() * 4800;
      const side = frng() > 0.5 ? 1 : -1;
      const x = riverCenterX(z) + side * (62 + frng() * 55);
      const s = 6 + frng() * 16;
      eul.set(0, frng() * Math.PI, 0);
      q.setFromEuler(eul);
      m4.compose(new THREE.Vector3(x, 0.8, z), q, new THREE.Vector3(s, 1, s * (0.6 + frng() * 0.6)));
      floes.setMatrixAt(i, m4);
    }
    floes.receiveShadow = true;
    scene.add(floes);
  }

  function buildRunway(scene) {
    // The lit WATER LANE: the landing strip is the lead itself. Amber
    // buoys + floating amber lights line both banks along the runway rect
    // (z 1140..1760), a green threshold at the north end, an approach bar
    // at the south end. No ice strip is drawn — the water IS the lane.
    const rw = CONFIG.runway;
    const z0 = rw.z - rw.length / 2, z1 = rw.z + rw.length / 2;
    const buoyGeo = new THREE.CylinderGeometry(1.1, 1.4, 2.6, 8);
    const buoyMat = new THREE.MeshStandardMaterial({ color: 0xd8842a, roughness: 0.5 });
    const buoyTopMat = new THREE.MeshBasicMaterial({ color: 0xffc46b });
    const postGeo = new THREE.CylinderGeometry(0.35, 0.5, 7, 6);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x2c3844, roughness: 0.6 });
    const lampGeo = new THREE.SphereGeometry(0.9, 8, 6);
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffb347 });
    const postMesh = new THREE.InstancedMesh(postGeo, postMat, 16);
    const lampMesh = new THREE.InstancedMesh(lampGeo, lampMat, 16);
    const m4 = new THREE.Matrix4();
    let pi = 0;
    for (let s = 0; s <= 7; s++) {
      const z = z0 + (s / 7) * (z1 - z0);
      [-1, 1].forEach((side) => {
        const x = riverCenterX(z) + side * (rw.width / 2 + 7);
        // Buoy in the water.
        const b = new THREE.Mesh(buoyGeo, buoyMat);
        b.position.set(x, 1.2, z);
        scene.add(b);
        const bt = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), buoyTopMat);
        bt.position.set(x, 3.0, z);
        scene.add(bt);
        const gl = glowSprite(0xffb347, 12, 0.6);
        gl.position.set(x, 3.2, z);
        scene.add(gl);
        // Floating light post on the ice edge.
        const px = riverCenterX(z) + side * (rw.width / 2 + 16);
        m4.makeTranslation(px, groundHeight(px, z) + 3.5, z);
        postMesh.setMatrixAt(pi, m4);
        m4.makeTranslation(px, groundHeight(px, z) + 7.4, z);
        lampMesh.setMatrixAt(pi, m4);
        const lg = glowSprite(0xffb347, 16, 0.55);
        lg.position.set(px, groundHeight(px, z) + 7.6, z);
        scene.add(lg);
        pi++;
      });
    }
    scene.add(postMesh);
    scene.add(lampMesh);
    // Green threshold (north end) + amber approach bar (south end).
    const thr = glowSprite(0x37e08b, 26, 0.8);
    thr.position.set(riverCenterX(z0), 4, z0);
    scene.add(thr);
    const app = glowSprite(0xffb347, 26, 0.8);
    app.position.set(riverCenterX(z1), 4, z1);
    scene.add(app);
  }

  function buildVolcanoSmoke(scene) {
    // Glacier mist: soft pale columns rising over the massif (the updraft
    // zone). Static sprites that drift slowly with the game clock.
    mistSprites = [];
    const spots = [[-1150, -1250, 340], [-980, -1420, 260], [-1330, -1080, 300], [-1150, -1250, 420]];
    spots.forEach(([x, z, y], i) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, color: 0xbfd4e8, transparent: true,
        opacity: 0.16, depthWrite: false,
      }));
      const sc = 260 + i * 60;
      s.scale.set(sc, sc * 0.75, 1);
      s.position.set(x, y, z);
      s.userData.baseX = x;
      scene.add(s);
      mistSprites.push(s);
    });
  }

  function buildVillages(scene) {
    // Pressure-ridge "villages": dense fields of tilted ice blocks at
    // three spots — bay east edge, west of the lane, north of the station.
    // They fill the mid-distance in shots 1, 3 and 4.
    const ridgeGeo = new THREE.BoxGeometry(1, 1, 1);
    const ridgeMat = new THREE.MeshStandardMaterial({
      color: 0xcfe0f2, roughness: 0.6, metalness: 0.05, flatShading: true,
    });
    const fields = [[700, 400, 34], [-420, 1750, 30], [620, -300, 28]];
    const total = fields.reduce((a, f) => a + f[2], 0);
    const ridges = new THREE.InstancedMesh(ridgeGeo, ridgeMat, total);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const eul = new THREE.Euler();
    const rng = makeRng(303);
    let idx = 0;
    fields.forEach(([cx, cz, count]) => {
      for (let i = 0; i < count; i++) {
        const x = cx + (rng() - 0.5) * 260;
        const z = cz + (rng() - 0.5) * 260;
        const y = groundHeight(x, z);
        eul.set((rng() - 0.5) * 0.9, rng() * Math.PI, (rng() - 0.5) * 0.9);
        q.setFromEuler(eul);
        m4.compose(
          new THREE.Vector3(x, y + 1.5, z), q,
          new THREE.Vector3(4 + rng() * 9, 2 + rng() * 4, 3 + rng() * 6),
        );
        ridges.setMatrixAt(idx++, m4);
      }
    });
    ridges.castShadow = true;
    ridges.receiveShadow = true;
    scene.add(ridges);
  }

  function buildTrees(scene) {
    // Ice spires: tall thin cones on the ice, big enough to read at shot
    // scale (3-8 m) — not the dirt specks v5 had. Plus dark rock outcrops
    // near the massif and the lane flanks.
    const rng = makeRng(404);
    const spireGeo = new THREE.ConeGeometry(1, 1, 5);
    const spireMat = new THREE.MeshStandardMaterial({
      color: 0xd6e6f5, roughness: 0.55, metalness: 0.05, flatShading: true,
    });
    const spires = new THREE.InstancedMesh(spireGeo, spireMat, 52);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const eul = new THREE.Euler();
    for (let i = 0; i < 52; i++) {
      const x = -1800 + rng() * 3600;
      const z = -2000 + rng() * 4200;
      if (Math.abs(x - riverCenterX(z)) < 70) { // keep the lead clear
        i--; continue;
      }
      const h = 3 + rng() * 5;
      eul.set((rng() - 0.5) * 0.15, rng() * Math.PI, (rng() - 0.5) * 0.15);
      q.setFromEuler(eul);
      m4.compose(
        new THREE.Vector3(x, groundHeight(x, z) + h / 2 - 0.5, z), q,
        new THREE.Vector3(1.5 + rng() * 2, h, 1.5 + rng() * 2),
      );
      spires.setMatrixAt(i, m4);
    }
    spires.castShadow = true;
    scene.add(spires);

    const rockGeo = new THREE.ConeGeometry(1, 1, 6);
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x3a3f4a, roughness: 0.95, metalness: 0.0, flatShading: true,
    });
    const rocks = new THREE.InstancedMesh(rockGeo, rockMat, 24);
    for (let i = 0; i < 24; i++) {
      const x = -1600 + rng() * 3200;
      const z = -1800 + rng() * 3600;
      if (Math.abs(x - riverCenterX(z)) < 70) { i--; continue; }
      const h = 2 + rng() * 4;
      eul.set((rng() - 0.5) * 0.3, rng() * Math.PI, (rng() - 0.5) * 0.3);
      q.setFromEuler(eul);
      m4.compose(
        new THREE.Vector3(x, groundHeight(x, z) + h / 2 - 0.5, z), q,
        new THREE.Vector3(2 + rng() * 3, h, 2 + rng() * 3),
      );
      rocks.setMatrixAt(i, m4);
    }
    rocks.castShadow = true;
    scene.add(rocks);
  }

  function buildSea(scene) {
    // Frozen bay: a flat ice sheet over the far north with crack lines.
    const bay = new THREE.Mesh(
      new THREE.PlaneGeometry(3600, 2000),
      new THREE.MeshStandardMaterial({ color: 0xb8d4e8, roughness: 0.35, metalness: 0.3 }),
    );
    bay.rotation.x = -Math.PI / 2;
    bay.position.set(0, 14.6, -1500);
    bay.receiveShadow = true;
    scene.add(bay);
    const crackMat = new THREE.MeshBasicMaterial({ color: 0x5a7a9e });
    const rng = makeRng(505);
    for (let i = 0; i < 10; i++) {
      const len = 120 + rng() * 220;
      const crack = new THREE.Mesh(new THREE.BoxGeometry(len, 0.3, 1.6), crackMat);
      crack.position.set(-1400 + rng() * 2800, 14.9, -2400 + rng() * 1700);
      crack.rotation.y = rng() * Math.PI;
      scene.add(crack);
    }
  }

  function buildBoats(scene) {
    // Two small workboats + a fuel barge moored near the station dock,
    // in the lead — small dark hulls with lit windows, for density.
    const hullMat = new THREE.MeshStandardMaterial({ color: 0x2c3844, roughness: 0.6 });
    const cabMat = new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.5 });
    const winMat = new THREE.MeshBasicMaterial({ color: 0xffc46b });
    const spots = [
      [170, 640, 0.4, 14], [120, 950, -0.3, 11], [205, 1080, 0.9, 18],
    ];
    spots.forEach(([x, z, rot, len]) => {
      const g = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.BoxGeometry(4.5, 2.2, len), hullMat);
      hull.position.y = 0.6;
      g.add(hull);
      const bow = new THREE.Mesh(new THREE.BoxGeometry(4.5, 2.0, 3), hullMat);
      bow.position.set(0, 0.6, -len / 2 - 1);
      bow.rotation.x = 0.35;
      g.add(bow);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.0, 4), cabMat);
      cab.position.set(0, 2.6, 1);
      g.add(cab);
      const win = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.7, 2.5), winMat);
      win.position.set(0, 2.9, 1);
      g.add(win);
      g.position.set(x, 0, z);
      g.rotation.y = rot;
      scene.add(g);
    });
  }

  function buildLighthouse(scene) {
    // Standalone beacon tower on the north-west ice: red/white striped
    // cylinder + bright beacon glow — a far landmark in shots 1 and 2.
    const b = CONFIG.beacon;
    const y = groundHeight(b.x, b.z);
    const g = new THREE.Group();
    const stripeA = new THREE.MeshStandardMaterial({ color: 0xc8352c, roughness: 0.6 });
    const stripeB = new THREE.MeshStandardMaterial({ color: 0xe8eef5, roughness: 0.6 });
    for (let i = 0; i < 5; i++) {
      const seg = new THREE.Mesh(
        new THREE.CylinderGeometry(2.2 - i * 0.18, 2.4 - i * 0.18, 5.6, 10),
        i % 2 ? stripeB : stripeA,
      );
      seg.position.y = 2.8 + i * 5.6;
      g.add(seg);
    }
    const cap = new THREE.Mesh(new THREE.SphereGeometry(1.6, 10, 8), stripeA);
    cap.position.y = 29;
    g.add(cap);
    beaconGlow = glowSprite(0xff5d5d, 34, 0.85);
    beaconGlow.position.y = 30;
    g.add(beaconGlow);
    const hut = new THREE.Mesh(new THREE.BoxGeometry(7, 4, 5),
      new THREE.MeshStandardMaterial({ color: 0xb8a888, roughness: 0.8 }));
    hut.position.set(7, 2, 4);
    g.add(hut);
    const hutWin = new THREE.Mesh(new THREE.BoxGeometry(7.1, 1.1, 2),
      new THREE.MeshBasicMaterial({ color: 0xffc46b }));
    hutWin.position.set(7, 2.4, 4);
    g.add(hutWin);
    g.position.set(b.x, y, b.z);
    scene.add(g);
  }

  function buildPalms(scene) {
    // Flag poles + orange windsocks: thin vertical accents around the
    // station, the lane ends and the camps.
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x8a94a0, roughness: 0.5, metalness: 0.6 });
    const sockMat = new THREE.MeshStandardMaterial({
      color: 0xe86a1e, roughness: 0.7, side: THREE.DoubleSide,
    });
    const flagMat = new THREE.MeshBasicMaterial({ color: 0x39ff88, side: THREE.DoubleSide });
    const spots = [];
    const st = CONFIG.station;
    for (let i = 0; i < 4; i++) spots.push([st.x - 70 + i * 46, st.z + 95, 'sock']);
    const rw = CONFIG.runway;
    spots.push([riverCenterX(rw.z - rw.length / 2) - 40, rw.z - rw.length / 2 - 20, 'flag']);
    spots.push([riverCenterX(rw.z + rw.length / 2) + 40, rw.z + rw.length / 2 + 20, 'flag']);
    CONFIG.camps.forEach((c) => spots.push([c.x + 18, c.z + 12, 'flag']));
    spots.push([CONFIG.ship.x + 30, CONFIG.ship.z - 60, 'sock']);
    spots.push([CONFIG.ship.x - 30, CONFIG.ship.z + 60, 'sock']);
    spots.forEach(([x, z, kind]) => {
      const y = groundHeight(x, z);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 9, 6), poleMat);
      pole.position.set(x, y + 4.5, z);
      scene.add(pole);
      if (kind === 'sock') {
        const sock = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3.4, 8), sockMat);
        sock.position.set(x + 1.2, y + 8.6, z);
        sock.rotation.z = -Math.PI / 2.4;
        scene.add(sock);
      } else {
        const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.5), flagMat);
        flag.position.set(x + 1.3, y + 8.2, z);
        scene.add(flag);
      }
    });
  }

  // Water glint breathes, mist drifts, beacon pulses — all pure functions
  // of the game clock, so the render is identical on every run.
  function updateSea(_dt, clock) {
    if (glintMat) glintMat.opacity = 0.3 + 0.08 * Math.sin(clock * 0.5);
    mistSprites.forEach((s, i) => {
      s.position.x = s.userData.baseX + Math.sin(clock * 0.05 + i * 1.7) * 26;
    });
    if (beaconGlow) beaconGlow.material.opacity = 0.6 + 0.3 * Math.sin(clock * 1.4);
  }

  return {
    buildTerrainMesh, buildRiver, buildRunway, buildVolcanoSmoke,
    buildVillages, buildTrees, buildSea, buildBoats, buildLighthouse,
    buildPalms, updateSea, heightAt, riverCenterX,
  };
})();
