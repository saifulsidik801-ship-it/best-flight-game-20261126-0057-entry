// Aurora Ring Run v6 — living things: Polaris Station, the icebreaker,
// three supply camps, tern flocks, a distant airliner. Windows, drums and
// crates are InstancedMeshes (one draw call each) to protect the FPS.

const Life = (function buildLifeModule() {
  let ternMesh = null;
  let ternBase = [];
  let airliner = null;
  let stationBeacon = null;

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

  function build(scene) {
    const st = CONFIG.station;
    const stY = Terrain.heightAt(st.x, st.z);

    // ---------- Polaris Station: 6 buildings, pitched snow roofs,
    // lit amber windows, radar dome, comms mast, drums, crates. ----------
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xb8a888, roughness: 0.8 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xe8eef5, roughness: 0.7 });
    const winGeo = new THREE.PlaneGeometry(1.1, 0.9);
    const winMat = new THREE.MeshBasicMaterial({ color: 0xffc46b });
    const winXforms = [];
    const buildings = [
      // [dx, dz, w, l, h, rotY] — w across, l along, rotY faces the lead.
      [-52, -38, 9, 15, 5, 0.5], [-8, -52, 11, 18, 6, 0.1], [44, -30, 8, 13, 4.5, -0.4],
      [-46, 22, 10, 14, 5, 0.9], [6, 34, 12, 20, 6.5, 0.05], [58, 28, 9, 12, 4.5, -0.7],
    ];
    buildings.forEach(([dx, dz, w, l, h, rot]) => {
      const g = new THREE.Group();
      const walls = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), wallMat);
      walls.position.y = h / 2;
      walls.castShadow = true;
      walls.receiveShadow = true;
      g.add(walls);
      // Pitched roof: two sloped slabs meeting at the ridge.
      [-1, 1].forEach((side) => {
        const slab = new THREE.Mesh(new THREE.BoxGeometry(w / 2 + 0.7, 0.3, l + 0.8), roofMat);
        slab.position.set(side * w / 4.4, h + 1.1, 0);
        slab.rotation.z = -side * 0.6;
        slab.castShadow = true;
        g.add(slab);
      });
      // Lit windows on the long walls (both sides) + the gable ends.
      // Stored as building centre + building-local offset; the instancing
      // loop below rotates the offset by the building's rot.
      const perSide = Math.max(2, Math.floor(l / 5));
      for (let i = 0; i < perSide; i++) {
        const lx = -l / 2 + 2.5 + (i * (l - 5)) / Math.max(1, perSide - 1);
        winXforms.push({ cx: dx, cz: dz, lx: -w / 2 - 0.06, lz: lx, y: stY + h * 0.55, ry: -Math.PI / 2, rot });
        winXforms.push({ cx: dx, cz: dz, lx: w / 2 + 0.06, lz: lx, y: stY + h * 0.55, ry: Math.PI / 2, rot });
      }
      winXforms.push({ cx: dx, cz: dz, lx: 0, lz: -l / 2 - 0.06, y: stY + h * 0.55, ry: Math.PI, rot });
      g.position.set(st.x + dx, stY, st.z + dz);
      g.rotation.y = rot;
      scene.add(g);
    });
    // One InstancedMesh for every station window.
    const wins = new THREE.InstancedMesh(winGeo, winMat, winXforms.length);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const eul = new THREE.Euler();
    winXforms.forEach((w, i) => {
      // Rotate the building-local offset by the building's rot, then add
      // the building centre (THREE rotation.y: x' = x cos + z sin,
      // z' = -x sin + z cos).
      const c = Math.cos(w.rot), s = Math.sin(w.rot);
      const wx = st.x + w.cx + w.lx * c + w.lz * s;
      const wz = st.z + w.cz - w.lx * s + w.lz * c;
      eul.set(0, w.ry + w.rot, 0);
      q.setFromEuler(eul);
      m4.compose(new THREE.Vector3(wx, w.y, wz), q, new THREE.Vector3(1, 1, 1));
      wins.setMatrixAt(i, m4);
    });
    scene.add(wins);

    // Radar dome (white hemisphere on a mast) + comms mast + beacon.
    const domeBase = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.6, 7, 8),
      new THREE.MeshStandardMaterial({ color: 0x8a94a0, roughness: 0.6 }));
    domeBase.position.set(st.x - 70, stY + 3.5, st.z - 60);
    scene.add(domeBase);
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(3.4, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xeef2f7, roughness: 0.4 }),
    );
    dome.position.set(st.x - 70, stY + 7, st.z - 60);
    scene.add(dome);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 26, 8),
      new THREE.MeshStandardMaterial({ color: 0x8a94a0, roughness: 0.6 }));
    mast.position.set(st.x + 72, stY + 13, st.z + 48);
    scene.add(mast);
    stationBeacon = glowSprite(0xff5d5d, 22, 0.85);
    stationBeacon.position.set(st.x + 72, stY + 27, st.z + 48);
    scene.add(stationBeacon);

    // Fuel drums (instanced) + crates (instanced) around the station.
    const drumGeo = new THREE.CylinderGeometry(0.8, 0.8, 1.8, 10);
    const drumMat = new THREE.MeshStandardMaterial({ color: 0xb84a2a, roughness: 0.6 });
    const drums = new THREE.InstancedMesh(drumGeo, drumMat, 12);
    const drng = makeRng(606);
    for (let i = 0; i < 12; i++) {
      const x = st.x - 80 + drng() * 160;
      const z = st.z - 70 + drng() * 140;
      m4.makeTranslation(x, Terrain.heightAt(x, z) + 0.9, z);
      drums.setMatrixAt(i, m4);
    }
    scene.add(drums);
    const crateGeo = new THREE.BoxGeometry(1.6, 1.6, 1.6);
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x9a7b4a, roughness: 0.8 });
    const crates = new THREE.InstancedMesh(crateGeo, crateMat, 16);
    for (let i = 0; i < 16; i++) {
      const x = st.x - 75 + drng() * 150;
      const z = st.z - 65 + drng() * 130;
      eul.set(0, drng() * Math.PI, 0);
      q.setFromEuler(eul);
      m4.compose(new THREE.Vector3(x, Terrain.heightAt(x, z) + 0.8, z), q, new THREE.Vector3(1, 1, 1));
      crates.setMatrixAt(i, m4);
    }
    scene.add(crates);
    // Windsock on a pole at the station.
    const sockPole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 9, 6),
      new THREE.MeshStandardMaterial({ color: 0x8a94a0, roughness: 0.5, metalness: 0.6 }));
    sockPole.position.set(st.x + 20, stY + 4.5, st.z - 70);
    scene.add(sockPole);
    const sock = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3.4, 8),
      new THREE.MeshStandardMaterial({ color: 0xe86a1e, roughness: 0.7, side: THREE.DoubleSide }));
    sock.position.set(st.x + 21.2, stY + 8.6, st.z - 70);
    sock.rotation.z = -Math.PI / 2.4;
    scene.add(sock);

    // ---------- Icebreaker in the lead: dark hull, white superstructure,
    // lit windows, funnel glow. 60 m long — unmistakable in shot 2. ----------
    const sh = CONFIG.ship;
    const ship = new THREE.Group();
    const hullShape = new THREE.Shape();
    hullShape.moveTo(-30, 2.5);
    hullShape.lineTo(-26, -1.5);
    hullShape.lineTo(24, -1.5);
    hullShape.lineTo(30, 1.0);
    hullShape.lineTo(30, 4.5);
    hullShape.lineTo(-28, 4.5);
    hullShape.closePath();
    const hullGeo = new THREE.ExtrudeGeometry(hullShape, { depth: 11, bevelEnabled: false });
    hullGeo.translate(0, 0, -5.5);
    hullGeo.rotateY(-Math.PI / 2); // length along Z, bow north
    const hull = new THREE.Mesh(hullGeo, new THREE.MeshStandardMaterial({
      // Icebreaker red — a dark hull vanishes against the dark lead water;
      // red reads as a ship from 300 m, the way real icebreakers do.
      color: 0x9a2a1e, roughness: 0.55, metalness: 0.3,
    }));
    hull.castShadow = true;
    ship.add(hull);
    const deckMat = new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.5 });
    const super1 = new THREE.Mesh(new THREE.BoxGeometry(9, 4.5, 18), deckMat);
    super1.position.set(0, 6.5, 8);
    super1.castShadow = true;
    ship.add(super1);
    const super2 = new THREE.Mesh(new THREE.BoxGeometry(8, 3.5, 10), deckMat);
    super2.position.set(0, 10.2, 8);
    super2.castShadow = true;
    ship.add(super2);
    const bridgeWin = new THREE.Mesh(new THREE.BoxGeometry(8.2, 1.0, 6),
      new THREE.MeshBasicMaterial({ color: 0xffc46b }));
    bridgeWin.position.set(0, 11.0, 8);
    ship.add(bridgeWin);
    const funnel = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.9, 7, 10),
      new THREE.MeshStandardMaterial({ color: 0x8a2a20, roughness: 0.6 }));
    funnel.position.set(0, 12.5, -4);
    ship.add(funnel);
    const funnelGlow = glowSprite(0xffb347, 12, 0.7);
    funnelGlow.position.set(0, 16.4, -4);
    ship.add(funnelGlow);
    const shipMast = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 9, 6),
      new THREE.MeshStandardMaterial({ color: 0x8a94a0, roughness: 0.6 }));
    shipMast.position.set(0, 15, -12);
    ship.add(shipMast);
    const shipLights = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1.2, 0.8),
      new THREE.MeshBasicMaterial({ color: 0xffc46b }), 14,
    );
    for (let i = 0; i < 14; i++) {
      const side = i % 2 ? 1 : -1;
      const row = Math.floor(i / 2);
      eul.set(0, side > 0 ? Math.PI / 2 : -Math.PI / 2, 0);
      q.setFromEuler(eul);
      m4.compose(new THREE.Vector3(side * 4.56, 6.2 + (row % 2) * 1.6, 2 + row * 2.2), q, new THREE.Vector3(1, 1, 1));
      shipLights.setMatrixAt(i, m4);
    }
    ship.add(shipLights);
    ship.position.set(sh.x, -0.5, sh.z);
    ship.scale.set(1.35, 1.35, 1.35); // 81 m icebreaker — unmistakable
    // Moored at an angle across the lead so the river shot (which looks
    // straight up the lead) sees the broadside, not just the 15 m stern.
    // 0.5 rad shows ~52 m of hull — the most the 55 m lead will take.
    ship.rotation.y = 0.5;
    scene.add(ship);

    // ---------- Supply camps: orange tents with lit doors, crates, poles. ----------
    const tentMat = new THREE.MeshStandardMaterial({
      color: 0xc85a2a, roughness: 0.8, flatShading: true,
    });
    const doorMat = new THREE.MeshBasicMaterial({ color: 0xffc46b });
    CONFIG.camps.forEach((camp) => {
      const cy = Terrain.heightAt(camp.x, camp.z);
      const n = camp.name === 'east' ? 2 : 3;
      for (let i = 0; i < n; i++) {
        const tx = camp.x + (i - 1) * 9;
        const tz = camp.z + (i % 2) * 7;
        const tent = new THREE.Mesh(new THREE.ConeGeometry(2.6, 3.6, 7), tentMat);
        tent.position.set(tx, cy + 1.8, tz);
        tent.castShadow = true;
        scene.add(tent);
        const door = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.5), doorMat);
        door.position.set(tx, cy + 0.9, tz + 2.62);
        scene.add(door);
      }
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0x8a94a0, roughness: 0.5, metalness: 0.6 }));
      pole.position.set(camp.x + 14, cy + 4, camp.z + 6);
      scene.add(pole);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.4),
        new THREE.MeshBasicMaterial({ color: 0x39ff88, side: THREE.DoubleSide }));
      flag.position.set(camp.x + 15.2, cy + 7.2, camp.z + 6);
      scene.add(flag);
    });

    // ---------- Tern flocks: two white flocks, instanced, drift with the clock. ----------
    const birdGeo = new THREE.ConeGeometry(0.45, 1.8, 4);
    birdGeo.rotateX(Math.PI / 2);
    birdGeo.scale(1, 0.3, 1);
    ternMesh = new THREE.InstancedMesh(birdGeo, new THREE.MeshStandardMaterial({
      color: 0xf2f6fa, roughness: 0.6,
    }), 16);
    ternBase = [];
    const trng = makeRng(707);
    for (let i = 0; i < 16; i++) {
      const flock = i < 8 ? 0 : 1;
      ternBase.push({
        flock,
        ox: (trng() - 0.5) * 26,
        oy: (trng() - 0.5) * 8,
        oz: (trng() - 0.5) * 18,
        phase: trng() * 6.28,
      });
    }
    scene.add(ternMesh);

    // ---------- Distant airliner: high, far north-east, faint contrail. ----------
    airliner = new THREE.Group();
    const alWhite = new THREE.MeshStandardMaterial({ color: 0xe8ecf2, roughness: 0.5 });
    const alBody = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 30, 10), alWhite);
    alBody.rotation.x = Math.PI / 2;
    airliner.add(alBody);
    const alWing = new THREE.Mesh(new THREE.BoxGeometry(30, 0.4, 5), alWhite);
    airliner.add(alWing);
    const alTail = new THREE.Mesh(new THREE.BoxGeometry(10, 0.3, 3.5), alWhite);
    alTail.position.set(0, 1.2, 14);
    airliner.add(alTail);
    const alNavL = glowSprite(0xff2a2a, 5, 0.8);
    alNavL.position.set(-15, 0, 0);
    airliner.add(alNavL);
    const alNavR = glowSprite(0x2aff66, 5, 0.8);
    alNavR.position.set(15, 0, 0);
    airliner.add(alNavR);
    const contrail = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 90),
      new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false,
      }));
    contrail.position.set(0, 0.5, 55);
    airliner.add(contrail);
    airliner.position.set(1500, 640, -2500);
    scene.add(airliner);
  }

  // Terns drift, the airliner crosses slowly, the station beacon pulses —
  // all pure functions of the game clock (deterministic).
  function update(_dt, clock) {
    if (ternMesh) {
      const m4 = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const eul = new THREE.Euler();
      const flocks = [
        { x: -300 + Math.sin(clock * 0.03) * 120, y: 320, z: -600 + Math.cos(clock * 0.021) * 90, heading: 0.6 },
        { x: 500 + Math.sin(clock * 0.025 + 2) * 100, y: 380, z: 300 + Math.cos(clock * 0.017 + 1) * 80, heading: -0.9 },
      ];
      ternBase.forEach((b, i) => {
        const f = flocks[b.flock];
        const flap = Math.sin(clock * 6 + b.phase) * 0.35;
        eul.set(flap, f.heading, 0);
        q.setFromEuler(eul);
        m4.compose(
          new THREE.Vector3(f.x + b.ox + Math.sin(clock * 0.4 + b.phase) * 4, f.y + b.oy, f.z + b.oz),
          q, new THREE.Vector3(1, 1, 1),
        );
        ternMesh.setMatrixAt(i, m4);
      });
      ternMesh.instanceMatrix.needsUpdate = true;
    }
    if (airliner) {
      airliner.position.x = 1500 + Math.sin(clock * 0.008) * 800;
      airliner.rotation.y = 0.35 + Math.cos(clock * 0.008) * 0.12;
    }
    if (stationBeacon) stationBeacon.material.opacity = 0.6 + 0.3 * Math.sin(clock * 1.4);
  }

  return { build, update };
})();
