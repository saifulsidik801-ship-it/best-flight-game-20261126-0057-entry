// Aurora Ring Run — living bay: Polaris Station, camps, floes, icebergs.
// One clear job: fill every frame so no shot reads as empty.
// RULES: instanced meshes and cheap materials only. NO new lights, NO
// shadow-casting meshes (castShadow stays false everywhere here), NO per-
// frame allocations. Everything added is a handful of draw calls.

const Life = (function buildLifeModule() {
  const dummy = new THREE.Object3D();
  let flocks = [];
  let airliner = null;

  // One station building: warm walls, gable roof, lit windows, one glow.
  function buildStationBuilding(scene, x, z, w, h, d, rotY) {
    const g = new THREE.Group();
    const gy = Terrain.heightAt(x, z);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xb8a888, roughness: 0.85 });
    const walls = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    walls.position.y = h / 2;
    g.add(walls);
    // Gable roof: two sloped slabs meeting at a ridge.
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xdfe8f2, roughness: 0.8 });
    const slopeLen = (w / 2) / Math.cos(0.6) + 0.8;
    [-1, 1].forEach((s) => {
      const slope = new THREE.Mesh(new THREE.BoxGeometry(slopeLen, 0.4, d + 1.5), roofMat);
      slope.position.set(-s * w * 0.22, h + 1.4, 0);
      slope.rotation.z = s * 0.6;
      g.add(slope);
    });
    // Lit window strips on the front face (the side facing the strip).
    const winMat = new THREE.MeshBasicMaterial({ color: 0xffc46b });
    const nWin = Math.max(2, Math.floor(w / 7));
    for (let i = 0; i < nWin; i++) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.5), winMat);
      win.position.set(-w / 2 + 4 + i * ((w - 8) / Math.max(1, nWin - 1)), h * 0.55, d / 2 + 0.08);
      g.add(win);
    }
    const glow = makeGlowSprite(0xffc46b, 13);
    glow.position.set(0, h * 0.6, d / 2 + 3);
    g.add(glow);
    g.position.set(x, gy, z);
    g.rotation.y = rotY;
    scene.add(g);
  }

  function buildStation(scene) {
    // Polaris Station, west of the strip, every building lit.
    buildStationBuilding(scene, 150, 1380, 26, 10, 16, 0.1);
    buildStationBuilding(scene, 210, 1450, 20, 9, 14, -0.15);
    buildStationBuilding(scene, 130, 1520, 18, 8, 12, 0.2);
    buildStationBuilding(scene, 240, 1340, 30, 12, 20, 0.05); // hangar
    buildStationBuilding(scene, 180, 1560, 14, 7, 10, -0.1);
    buildStationBuilding(scene, 260, 1480, 16, 8, 12, 0.12);
  }

  function buildCamp(scene, x, z) {
    const gy = Terrain.heightAt(x, z);
    const tentMat = new THREE.MeshStandardMaterial({
      color: 0xc85a2a, roughness: 0.85, flatShading: true,
    });
    const doorMat = new THREE.MeshBasicMaterial({ color: 0xffc46b });
    const positions = [[0, 0], [9, 5], [-8, 6]];
    positions.forEach(([dx, dz], i) => {
      const tent = new THREE.Mesh(new THREE.ConeGeometry(3.6, 5.2, 7), tentMat);
      tent.position.set(x + dx, gy + 2.6, z + dz);
      scene.add(tent);
      const door = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.2), doorMat);
      door.position.set(x + dx, gy + 1.1, z + dz + 3.5);
      scene.add(door);
    });
    // Crates + flag pole.
    const crateMat = new THREE.MeshStandardMaterial({ color: 0xc98f4a, roughness: 0.9 });
    const c = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4), crateMat);
    c.position.set(x + 12, gy + 2, z - 4);
    scene.add(c);
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.15, 7, 6),
      new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.6, metalness: 0.5 }),
    );
    pole.position.set(x - 12, gy + 3.5, z - 2);
    scene.add(pole);
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 1.5),
      new THREE.MeshBasicMaterial({ color: 0x39ff88, side: THREE.DoubleSide }),
    );
    flag.position.set(x - 10.8, gy + 6, z - 2);
    scene.add(flag);
    const glow = makeGlowSprite(0xffc46b, 12);
    glow.position.set(x, gy + 4, z + 3);
    scene.add(glow);
  }

  function buildCamps(scene) {
    buildCamp(scene, 330, -800);   // north camp, beside the lead
    buildCamp(scene, -600, 400);   // west camp, on the bay
    buildCamp(scene, 950, -300);   // east camp, on the field
  }

  function buildFloes(scene) {
    // One jittered disc geometry, instanced 44 times — floes on the bay
    // and floating in the lead.
    const geo = new THREE.CircleGeometry(1, 7);
    const pos = geo.attributes.position;
    const rng = makeRng(3131);
    for (let i = 1; i < pos.count; i++) {
      const s = 0.75 + rng() * 0.5;
      pos.setX(i, pos.getX(i) * s);
      pos.setY(i, pos.getY(i) * s);
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.05 });
    const floes = new THREE.InstancedMesh(geo, mat, 44);
    const col = new THREE.Color();
    const floeCols = [0xdfeaf5, 0xb8d4e8, 0xdfeaf5, 0xcfe0f2];
    for (let i = 0; i < 44; i++) {
      let x, z, y;
      if (i < 30) {
        x = -2400 + rng() * 2100;
        z = -1600 + rng() * 2800;
        y = 12.7;
      } else {
        z = -1600 + rng() * 3200;
        x = Terrain.riverCenterX(z) + (rng() - 0.5) * 90;
        y = 4.7;
      }
      dummy.position.set(x, y, z);
      dummy.rotation.set(-Math.PI / 2, 0, rng() * Math.PI);
      dummy.scale.set(8 + rng() * 14, 8 + rng() * 14, 1);
      dummy.updateMatrix();
      floes.setMatrixAt(i, dummy.matrix);
      floes.setColorAt(i, col.setHex(floeCols[i % floeCols.length]));
    }
    scene.add(floes);
  }

  function buildIcebergs(scene) {
    // Three lathe berg profiles, reused with different scales/rotations.
    function bergGeo(seed, peak) {
      const rng = makeRng(seed);
      const pts = [];
      const steps = 6;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const r = (1 - t * 0.75) * (20 + rng() * 6) * (t === 0 ? 0.01 : 1);
        pts.push(new THREE.Vector2(Math.max(0.01, r), t * peak));
      }
      return new THREE.LatheGeometry(pts, 9);
    }
    const geos = [bergGeo(71, 46), bergGeo(72, 58), bergGeo(73, 34)];
    const mat = new THREE.MeshStandardMaterial({
      color: 0xd8e4f2, roughness: 0.4, metalness: 0.05, flatShading: true,
    });
    const rng = makeRng(7171);
    for (let i = 0; i < 14; i++) {
      const berg = new THREE.Mesh(geos[i % 3], mat);
      let x, z;
      if (i < 9) {
        x = -2350 + rng() * 2000;
        z = -1600 + rng() * 2700;
      } else {
        x = -400 + rng() * 1800;
        z = -2100 + rng() * 900;
      }
      const s = 0.5 + rng() * 0.8;
      berg.scale.set(s, 0.7 + rng() * 0.6, s);
      berg.rotation.y = rng() * Math.PI * 2;
      berg.position.set(x, Terrain.heightAt(x, z) - 3, z);
      scene.add(berg);
    }
  }

  function buildTerns(scene) {
    // Two white tern flocks in V formation, circling the bay.
    const birdGeo = new THREE.BufferGeometry();
    const verts = new Float32Array([
      -1.6, 0, 0, 0, 0, 0.7, 0, 0, 0,
      0, 0, 0, 1.6, 0, 0, 0, 0, 0.7,
    ]);
    birdGeo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    birdGeo.computeVertexNormals();
    const birdMat = new THREE.MeshBasicMaterial({
      color: 0xf2f6fa, side: THREE.DoubleSide,
    });
    [[-600, 420, -900, 260], [700, 380, 300, 200]].forEach(([cx, cy, cz, r]) => {
      const flock = new THREE.Group();
      for (let i = 0; i < 7; i++) {
        const b = new THREE.Mesh(birdGeo, birdMat);
        const row = Math.floor(i / 2);
        const side = i % 2 === 0 ? -1 : 1;
        b.position.set(side * row * 7, -row * 1.5, row * 9);
        flock.add(b);
      }
      flock.userData = { cx, cy, cz, r, phase: (cx + cz) * 0.001 };
      scene.add(flock);
      flocks.push(flock);
    });
  }

  function buildAirliner(scene) {
    // One distant airliner, high and far north, red/green nav lights and
    // a faint contrail — the night sky's far traffic.
    const g = new THREE.Group();
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x2a2e33, roughness: 0.6 });
    const fus = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 22, 8), darkMat);
    fus.rotation.x = Math.PI / 2;
    g.add(fus);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(30, 0.4, 4), darkMat);
    g.add(wing);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(9, 0.4, 3), darkMat);
    tail.position.z = -10;
    g.add(tail);
    const navR = makeGlowSprite(0xff3b30, 8);
    navR.position.set(-15, 0, 0);
    g.add(navR);
    const navG = makeGlowSprite(0x39ff88, 8);
    navG.position.set(15, 0, 0);
    g.add(navG);
    const strobe = makeGlowSprite(0xffffff, 10);
    strobe.position.set(0, 0, -11);
    g.add(strobe);
    const contrail = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 130),
      new THREE.MeshBasicMaterial({
        color: 0xdfe8f2, transparent: true, opacity: 0.3, depthWrite: false,
      }),
    );
    contrail.rotation.x = -Math.PI / 2;
    contrail.position.set(0, 0.4, 78);
    g.add(contrail);
    g.position.set(-2000, 900, -1900);
    scene.add(g);
    airliner = g;
  }

  function build(scene) {
    buildStation(scene);
    buildCamps(scene);
    buildFloes(scene);
    buildIcebergs(scene);
    buildTerns(scene);
    buildAirliner(scene);
  }

  // Terns circle, the airliner crosses — all by sim time, so the
  // screenshots stay reproducible.
  function update(dt, clock) {
    flocks.forEach((f) => {
      const u = f.userData;
      const a = clock * 0.045 + u.phase;
      f.position.set(
        u.cx + Math.cos(a) * u.r,
        u.cy + Math.sin(clock * 0.3 + u.phase) * 12,
        u.cz + Math.sin(a) * u.r,
      );
      f.rotation.y = -a;
    });
    if (airliner) {
      const x = -2400 + ((clock * 14) % 4800);
      airliner.position.set(x, 900, -1900);
    }
  }

  return { build, update };
})();
