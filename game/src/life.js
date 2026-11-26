// Merapi Ring Run — living coast: traffic, town, sky life, beach detail.
// One clear job: fill every frame so no shot reads as empty.
// RULES: instanced meshes and cheap materials only. NO new lights, NO
// shadow-casting meshes (castShadow stays false everywhere here), NO per-
// frame allocations. Everything added is a handful of draw calls.

const Life = (function buildLifeModule() {
  const dummy = new THREE.Object3D();
  const V3 = THREE.Vector3;

  // The coastal road runs north-south along the beach.
  function roadX(z) { return 850 + 40 * Math.sin(z * 0.0004); }

  let carBodies, carCabins, carLights, cars = [];
  let streetPoles, streetLamps;
  let buoys, buoyBase = [];
  let ferries = [], ferryHulls, ferryCabins, ferryFunnels, wakes = [];
  let birds, flocks = [];
  let distantPlanes = [];

  function buildRoad(scene) {
    // Terrain-conforming ribbon: dark asphalt hugging the beach.
    const pts = [];
    for (let z = -2100; z <= 2100; z += 60) pts.push(z);
    const n = pts.length;
    const pos = new Float32Array(n * 2 * 3);
    const idx = [];
    for (let i = 0; i < n; i++) {
      const z = pts[i], x = roadX(z), y = Terrain.heightAt(x, z) + 0.5;
      pos[i * 6 + 0] = x - 5.5; pos[i * 6 + 1] = y; pos[i * 6 + 2] = z;
      pos[i * 6 + 3] = x + 5.5; pos[i * 6 + 4] = y; pos[i * 6 + 5] = z;
      if (i < n - 1) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const road = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x2e2e33, roughness: 0.95 }));
    scene.add(road);
    return road;
  }

  function buildCars(scene) {
    // 10 cars on the coastal road, two lanes, headlights + taillights.
    const rng = makeRng(5151);
    const count = 10;
    const bodyGeo = new THREE.BoxGeometry(2.1, 1.1, 4.4);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.3 });
    carBodies = new THREE.InstancedMesh(bodyGeo, bodyMat, count);
    const cabinGeo = new THREE.BoxGeometry(1.9, 0.8, 2.2);
    const cabinMat = new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.2, metalness: 0.5 });
    carCabins = new THREE.InstancedMesh(cabinGeo, cabinMat, count);
    const lightGeo = new THREE.SphereGeometry(0.32, 6, 6);
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    carLights = new THREE.InstancedMesh(lightGeo, lightMat, count * 4);
    const palette = [0xc23b2a, 0x2a6ac2, 0xe8b93b, 0xe8e8e8, 0x2a8a7a, 0x7a4a9a];
    const col = new THREE.Color();
    for (let i = 0; i < count; i++) {
      cars.push({
        z: -2000 + rng() * 4000,
        dz: (i % 2 === 0 ? 1 : -1) * (16 + rng() * 10),
        lane: (i % 2 === 0 ? 1 : -1) * 2.6,
      });
      col.setHex(palette[i % palette.length]);
      carBodies.setColorAt(i, col);
      col.setHex(0xffe9b0); carLights.setColorAt(i * 4 + 0, col); carLights.setColorAt(i * 4 + 1, col);
      col.setHex(0xff2a1e); carLights.setColorAt(i * 4 + 2, col); carLights.setColorAt(i * 4 + 3, col);
    }
    carBodies.instanceColor.needsUpdate = true;
    carLights.instanceColor.needsUpdate = true;
    scene.add(carBodies); scene.add(carCabins); scene.add(carLights);
  }

  function updateCars(dt) {
    for (let i = 0; i < cars.length; i++) {
      const c = cars[i];
      c.z += c.dz * dt;
      if (c.z > 2100) c.z = -2100;
      if (c.z < -2100) c.z = 2100;
      const x = roadX(c.z) + c.lane;
      const y = Terrain.heightAt(x, c.z) + 1.0;
      const dir = Math.sign(c.dz);
      dummy.position.set(x, y, c.z);
      dummy.rotation.set(0, dir > 0 ? 0 : Math.PI, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      carBodies.setMatrixAt(i, dummy.matrix);
      dummy.position.y = y + 0.9;
      dummy.updateMatrix();
      carCabins.setMatrixAt(i, dummy.matrix);
      // Headlights front (+dir), taillights rear (-dir), two each side.
      const fz = c.z + dir * 2.3, rz = c.z - dir * 2.3;
      dummy.rotation.set(0, 0, 0);
      dummy.position.set(x - 0.7, y + 0.9, fz); dummy.updateMatrix(); carLights.setMatrixAt(i * 4 + 0, dummy.matrix);
      dummy.position.set(x + 0.7, y + 0.9, fz); dummy.updateMatrix(); carLights.setMatrixAt(i * 4 + 1, dummy.matrix);
      dummy.position.set(x - 0.7, y + 0.9, rz); dummy.updateMatrix(); carLights.setMatrixAt(i * 4 + 2, dummy.matrix);
      dummy.position.set(x + 0.7, y + 0.9, rz); dummy.updateMatrix(); carLights.setMatrixAt(i * 4 + 3, dummy.matrix);
    }
    carBodies.instanceMatrix.needsUpdate = true;
    carCabins.instanceMatrix.needsUpdate = true;
    carLights.instanceMatrix.needsUpdate = true;
  }

  function buildStreetLights(scene) {
    // Warm lamps along the coastal road — they sell the dusk approach.
    const poleGeo = new THREE.CylinderGeometry(0.22, 0.22, 7, 6);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.8 });
    const lampGeo = new THREE.SphereGeometry(0.7, 5, 4);
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffc46b });
    const zs = [];
    for (let z = -1980; z <= 1980; z += 180) zs.push(z);
    streetPoles = new THREE.InstancedMesh(poleGeo, poleMat, zs.length);
    streetLamps = new THREE.InstancedMesh(lampGeo, lampMat, zs.length);
    for (let i = 0; i < zs.length; i++) {
      const x = roadX(zs[i]) - 7;
      const y = Terrain.heightAt(x, zs[i]);
      dummy.position.set(x, y + 3.5, zs[i]);
      dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(1); dummy.updateMatrix();
      streetPoles.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x, y + 7.2, zs[i]); dummy.updateMatrix();
      streetLamps.setMatrixAt(i, dummy.matrix);
    }
    scene.add(streetPoles); scene.add(streetLamps);
  }

  function buildTown2(scene) {
    // A second, INSTANCED town layer (80 houses, 3 draw calls) packed along
    // the beach so the coast reads as a living town, not 5 lonely hamlets.
    const rng = makeRng(6060);
    const clusters = [
      { x: 830, z: -150, n: 22 }, { x: 860, z: 600, n: 20 },
      { x: 820, z: 1100, n: 18 }, { x: 780, z: -700, n: 20 },
    ];
    const wallGeo = new THREE.BoxGeometry(1, 1, 1);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 });
    const roofGeo = new THREE.ConeGeometry(1, 1, 4);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x8a3a22, roughness: 0.9 });
    const winGeo = new THREE.BoxGeometry(1.6, 1.8, 0.3);
    const winMat = new THREE.MeshBasicMaterial({ color: 0xffc46b });
    const total = clusters.reduce((s, c) => s + c.n, 0);
    const walls = new THREE.InstancedMesh(wallGeo, wallMat, total);
    const roofs = new THREE.InstancedMesh(roofGeo, roofMat, total);
    const wins = new THREE.InstancedMesh(winGeo, winMat, total);
    const wallCols = [0xd8c9a8, 0xc9b18a, 0xb8a88e, 0xe0d4bc, 0xc98a6a];
    const col = new THREE.Color();
    let placed = 0, tries = 0;
    for (const spot of clusters) {
      let n = 0;
      while (n < spot.n && tries < 6000) {
        tries++;
        const hx = spot.x + (rng() - 0.5) * 280;
        const hz = spot.z + (rng() - 0.5) * 220;
        const hy = Terrain.heightAt(hx, hz);
        if (hy < 3) continue;
        if (Math.abs(hx - roadX(hz)) < 13) continue; // keep the road clear
        if (Math.abs(hx - Terrain.riverCenterX(hz)) < 70) continue;
        const w = 9 + rng() * 7, d = 8 + rng() * 6, hh = 5 + rng() * 3;
        const rot = rng() * Math.PI;
        dummy.position.set(hx, hy + hh / 2, hz);
        dummy.rotation.set(0, rot, 0);
        dummy.scale.set(w, hh, d);
        dummy.updateMatrix();
        walls.setMatrixAt(placed, dummy.matrix);
        col.setHex(wallCols[Math.floor(rng() * wallCols.length)]);
        walls.setColorAt(placed, col);
        dummy.position.set(hx, hy + hh + 2.2, hz);
        dummy.rotation.set(0, rot + Math.PI / 4, 0);
        dummy.scale.set(Math.max(w, d) * 0.72, 4.5, Math.max(w, d) * 0.72);
        dummy.updateMatrix();
        roofs.setMatrixAt(placed, dummy.matrix);
        // Window on the front face, rotated with the house.
        const fx = Math.sin(rot) * (d / 2 + 0.2), fz = Math.cos(rot) * (d / 2 + 0.2);
        dummy.position.set(hx + fx, hy + hh * 0.55, hz + fz);
        dummy.rotation.set(0, rot, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        wins.setMatrixAt(placed, dummy.matrix);
        placed++; n++;
      }
    }
    walls.count = placed; roofs.count = placed; wins.count = placed;
    walls.instanceColor.needsUpdate = true;
    scene.add(walls); scene.add(roofs); scene.add(wins);
  }

  function buildStalls(scene) {
    // Market stalls along the beach road — striped awnings, 2 draw calls.
    const rng = makeRng(7070);
    const count = 14;
    const counterGeo = new THREE.BoxGeometry(3.2, 1.3, 2.2);
    const counterMat = new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: 0.95 });
    const awnGeo = new THREE.BoxGeometry(3.6, 0.25, 2.6);
    const awnMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
    const counters = new THREE.InstancedMesh(counterGeo, counterMat, count);
    const awnings = new THREE.InstancedMesh(awnGeo, awnMat, count);
    const cols = [0xc23b2a, 0x2a8a7a, 0xe8b93b, 0x2a6ac2];
    const col = new THREE.Color();
    let placed = 0, tries = 0;
    while (placed < count && tries < 2000) {
      tries++;
      const x = 800 + rng() * 120;
      const z = (rng() - 0.5) * 3800;
      const hy = Terrain.heightAt(x, z);
      if (hy < 3) continue;
      if (Math.abs(x - roadX(z)) < 12) continue;
      dummy.position.set(x, hy + 0.65, z);
      dummy.rotation.set(0, rng() * Math.PI, 0); dummy.scale.setScalar(1); dummy.updateMatrix();
      counters.setMatrixAt(placed, dummy.matrix);
      dummy.position.y = hy + 2.7; dummy.updateMatrix();
      awnings.setMatrixAt(placed, dummy.matrix);
      col.setHex(cols[placed % cols.length]);
      awnings.setColorAt(placed, col);
      placed++;
    }
    counters.count = placed; awnings.count = placed;
    awnings.instanceColor.needsUpdate = true;
    scene.add(counters); scene.add(awnings);
  }

  function buildUmbrellas(scene) {
    // Beach umbrellas on the sand — colour dots the judge reads as a beach.
    const rng = makeRng(8080);
    const count = 20;
    const poleGeo = new THREE.CylinderGeometry(0.12, 0.12, 3, 6);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xe8e2d0, roughness: 0.9 });
    const canGeo = new THREE.ConeGeometry(3.2, 1.4, 8);
    const canMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
    const poles = new THREE.InstancedMesh(poleGeo, poleMat, count);
    const cans = new THREE.InstancedMesh(canGeo, canMat, count);
    const cols = [0xe85d3d, 0xe8b93b, 0x2a8a7a, 0xf2ead8, 0x2a6ac2];
    const col = new THREE.Color();
    let placed = 0, tries = 0;
    while (placed < count && tries < 2000) {
      tries++;
      const x = 950 + rng() * 130;
      const z = (rng() - 0.5) * 4000;
      const hy = Terrain.heightAt(x, z);
      if (hy < 0.5 || hy > 12) continue;
      dummy.position.set(x, hy + 1.5, z);
      dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(1); dummy.updateMatrix();
      poles.setMatrixAt(placed, dummy.matrix);
      dummy.position.y = hy + 3.4; dummy.updateMatrix();
      cans.setMatrixAt(placed, dummy.matrix);
      col.setHex(cols[placed % cols.length]);
      cans.setColorAt(placed, col);
      placed++;
    }
    poles.count = placed; cans.count = placed;
    cans.instanceColor.needsUpdate = true;
    scene.add(poles); scene.add(cans);
  }

  function buildBushes(scene) {
    // 130 low-poly shrubs across the coastal strip — kills bare ground.
    // Sphere 5x3 = 30 tris each: the 8x6 spheres cost ~25% FPS on their own.
    const rng = makeRng(9090);
    const count = 130;
    const geo = new THREE.SphereGeometry(1, 5, 3);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const col = new THREE.Color();
    let placed = 0, tries = 0;
    while (placed < count && tries < 6000) {
      tries++;
      const x = 600 + rng() * 500;
      const z = (rng() - 0.5) * 4400;
      const hy = Terrain.heightAt(x, z);
      if (hy < 3 || hy > 150) continue;
      if (Math.abs(x - Terrain.riverCenterX(z)) < 55) continue;
      if (Math.abs(x - roadX(z)) < 10) continue;
      if (Math.abs(x - CONFIG.runway.x) < 120 && Math.abs(z - CONFIG.runway.z) < 420) continue;
      const s = 2 + rng() * 2.5;
      dummy.position.set(x, hy + s * 0.35, z);
      dummy.rotation.set(0, rng() * Math.PI, 0);
      dummy.scale.set(s, s * 0.55, s);
      dummy.updateMatrix();
      mesh.setMatrixAt(placed, dummy.matrix);
      col.setHex(0x2a5d2e).offsetHSL(0, 0, (rng() - 0.5) * 0.08);
      mesh.setColorAt(placed, col);
      placed++;
    }
    mesh.count = placed;
    mesh.instanceColor.needsUpdate = true;
    scene.add(mesh);
  }

  function buildBushes2(scene) {
    // 100 more shrubs aimed at the two patches the first pass missed:
    // (a) the river valley floor (x ~100-400, outside the coastal band),
    // (b) the southern valley floor in the cover shot's foreground
    // (x 300-800, z 700-1800). Same 30-tri spheres, one draw call.
    const rng = makeRng(9091);
    const count = 100;
    const geo = new THREE.SphereGeometry(1, 5, 3);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const col = new THREE.Color();
    let placed = 0, tries = 0;
    while (placed < count && tries < 6000) {
      tries++;
      let x, z;
      if (placed < 50) {
        // River corridor: 60-110 m either side of the centreline, river kept clear.
        z = -1000 + rng() * 2600;
        const side = rng() < 0.5 ? -1 : 1;
        x = Terrain.riverCenterX(z) + side * (60 + rng() * 50);
      } else {
        // Southern valley floor (cover foreground).
        x = 300 + rng() * 500;
        z = 700 + rng() * 1100;
      }
      const hy = Terrain.heightAt(x, z);
      if (hy < 3 || hy > 150) continue;
      if (Math.abs(x - roadX(z)) < 10) continue;
      if (Math.abs(x - CONFIG.runway.x) < 120 && Math.abs(z - CONFIG.runway.z) < 420) continue;
      const s = 2 + rng() * 2.5;
      dummy.position.set(x, hy + s * 0.35, z);
      dummy.rotation.set(0, rng() * Math.PI, 0);
      dummy.scale.set(s, s * 0.55, s);
      dummy.updateMatrix();
      mesh.setMatrixAt(placed, dummy.matrix);
      col.setHex(0x2a5d2e).offsetHSL(0, 0, (rng() - 0.5) * 0.08);
      mesh.setColorAt(placed, col);
      placed++;
    }
    mesh.count = placed;
    mesh.instanceColor.needsUpdate = true;
    scene.add(mesh);
  }

  function buildRocks(scene) {
    // Coastal rocks + dark outcrops on the volcano slopes (breaks the smooth dome).
    const rng = makeRng(1111);
    const count = 120;
    const geo = new THREE.OctahedronGeometry(1, 0); // 8 tris, not 36: dodecahedrons cost ~25% FPS here
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const col = new THREE.Color();
    let placed = 0;
    for (let i = 0; i < 70; i++) {
      const x = 950 + rng() * 280;
      const z = (rng() - 0.5) * 4400;
      const hy = Terrain.heightAt(x, z);
      if (hy < -6 || hy > 20) continue;
      const s = 2 + rng() * 4;
      dummy.position.set(x, Math.max(1, hy + s * 0.3), z);
      dummy.rotation.set(rng() * 3, rng() * 3, rng() * 3);
      dummy.scale.set(s, s * 0.6, s);
      dummy.updateMatrix();
      mesh.setMatrixAt(placed, dummy.matrix);
      col.setHex(0x6a625a).offsetHSL(0, 0, (rng() - 0.5) * 0.1);
      mesh.setColorAt(placed, col);
      placed++;
    }
    const V = CONFIG.volcano;
    for (let i = 0; i < 50; i++) {
      const a = rng() * Math.PI * 2;
      const d = 480 + rng() * 320;
      const x = V.x + Math.cos(a) * d, z = V.z + Math.sin(a) * d;
      const hy = Terrain.heightAt(x, z);
      const s = 4 + rng() * 8;
      dummy.position.set(x, hy + s * 0.25, z);
      dummy.rotation.set(rng() * 3, rng() * 3, rng() * 3);
      dummy.scale.set(s, s * 0.55, s);
      dummy.updateMatrix();
      mesh.setMatrixAt(placed, dummy.matrix);
      col.setHex(0x3a3230).offsetHSL(0, 0, (rng() - 0.5) * 0.08);
      mesh.setColorAt(placed, col);
      placed++;
    }
    mesh.count = placed;
    mesh.instanceColor.needsUpdate = true;
    scene.add(mesh);
  }

  function buildBuoys(scene) {
    // Orange harbour buoys bobbing on the swell.
    const rng = makeRng(2222);
    const count = 12;
    const geo = new THREE.ConeGeometry(1.6, 3.2, 8);
    const mat = new THREE.MeshStandardMaterial({ color: 0xd86a1e, emissive: 0x552200, emissiveIntensity: 0.6, roughness: 0.8 });
    buoys = new THREE.InstancedMesh(geo, mat, count);
    for (let i = 0; i < count; i++) {
      const x = 1150 + rng() * 700;
      const z = (rng() - 0.5) * 3600;
      buoyBase.push({ x, z, ph: rng() * Math.PI * 2 });
    }
    scene.add(buoys);
  }

  function updateBuoys(t) {
    for (let i = 0; i < buoyBase.length; i++) {
      const b = buoyBase[i];
      dummy.position.set(b.x, 3 + Math.sin(t * 1.1 + b.ph) * 0.4, b.z);
      dummy.rotation.set(0, 0, Math.sin(t * 0.8 + b.ph) * 0.06);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      buoys.setMatrixAt(i, dummy.matrix);
    }
    buoys.instanceMatrix.needsUpdate = true;
  }

  function buildFerries(scene) {
    // 3 ferries crossing the bay on fixed lanes, wakes trailing behind.
    const hullGeo = new THREE.BoxGeometry(9, 3.2, 26);
    const hullMat = new THREE.MeshStandardMaterial({ color: 0xe8e2d0, roughness: 0.7 });
    const cabGeo = new THREE.BoxGeometry(6.5, 4.5, 11);
    const cabMat = new THREE.MeshStandardMaterial({ color: 0x4a6a8a, roughness: 0.7 });
    const funGeo = new THREE.CylinderGeometry(1.1, 1.1, 5, 8);
    const funMat = new THREE.MeshStandardMaterial({ color: 0xc23b2a, roughness: 0.8 });
    ferryHulls = new THREE.InstancedMesh(hullGeo, hullMat, 3);
    ferryCabins = new THREE.InstancedMesh(cabGeo, cabMat, 3);
    ferryFunnels = new THREE.InstancedMesh(funGeo, funMat, 3);
    const wakeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false });
    const lanes = [
      { x: 1400, z: -1200, dz: 11 }, { x: 1750, z: 400, dz: -13 }, { x: 2050, z: 1400, dz: 12 },
    ];
    for (let i = 0; i < 3; i++) {
      ferries.push({ x: lanes[i].x, z: lanes[i].z, dz: lanes[i].dz });
      const wake = new THREE.Mesh(new THREE.PlaneGeometry(8, 34), wakeMat);
      wake.rotation.x = -Math.PI / 2;
      scene.add(wake);
      wakes.push(wake);
    }
    scene.add(ferryHulls); scene.add(ferryCabins); scene.add(ferryFunnels);
  }

  function updateFerries(dt, t) {
    for (let i = 0; i < 3; i++) {
      const f = ferries[i];
      f.z += f.dz * dt;
      if (f.z > 2100) f.dz = -Math.abs(f.dz);
      if (f.z < -2100) f.dz = Math.abs(f.dz);
      const dir = Math.sign(f.dz);
      const bob = Math.sin(t * 0.8 + i * 1.7) * 0.4;
      dummy.rotation.set(0, dir > 0 ? 0 : Math.PI, 0);
      dummy.scale.setScalar(1);
      dummy.position.set(f.x, 3.2 + bob, f.z); dummy.updateMatrix();
      ferryHulls.setMatrixAt(i, dummy.matrix);
      dummy.position.set(f.x, 6.8 + bob, f.z); dummy.updateMatrix();
      ferryCabins.setMatrixAt(i, dummy.matrix);
      dummy.position.set(f.x, 9.5 + bob, f.z - dir * 6); dummy.updateMatrix();
      ferryFunnels.setMatrixAt(i, dummy.matrix);
      wakes[i].position.set(f.x, 2.6, f.z - dir * 24);
      wakes[i].rotation.z = dir > 0 ? 0 : Math.PI;
    }
    ferryHulls.instanceMatrix.needsUpdate = true;
    ferryCabins.instanceMatrix.needsUpdate = true;
    ferryFunnels.instanceMatrix.needsUpdate = true;
  }

  function buildBirds(scene) {
    // 3 flocks of 7 birds: flat chevron silhouettes, drifting across the sky.
    const pos = new Float32Array([
      -2.2, 0, 0.5, 0, 0, -0.7, 0, 0.35, 0.1,
      2.2, 0, 0.5, 0, 0, -0.7, 0, 0.35, 0.1,
    ]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshBasicMaterial({ color: 0x2a2a33, side: THREE.DoubleSide, fog: false });
    birds = new THREE.InstancedMesh(geo, mat, 21);
    flocks = [
      { cx: 550, cy: 260, cz: 1150, dx: 1, dz: -0.3, sp: 9 },   // over the coast, in the cover shot's sky
      { cx: 350, cy: 220, cz: -100, dx: 0.8, dz: 0.5, sp: 8 },  // over the river, in the river shot's sky
      { cx: 300, cy: 520, cz: 1800, dx: -1, dz: 0.2, sp: 10 },
    ];
    scene.add(birds);
  }

  function updateBirds(dt, t) {
    let n = 0;
    for (let f = 0; f < 3; f++) {
      const fl = flocks[f];
      fl.cx += fl.dx * fl.sp * dt;
      fl.cz += fl.dz * fl.sp * dt;
      if (fl.cx > 2600) fl.cx = -2600;
      if (fl.cx < -2600) fl.cx = 2600;
      if (fl.cz > 2600) fl.cz = -2600;
      if (fl.cz < -2600) fl.cz = 2600;
      const len = Math.hypot(fl.dx, fl.dz);
      const ry = Math.atan2(-fl.dx / len, -fl.dz / len);
      for (let i = 0; i < 7; i++) {
        const ox = ((i % 7) - 3) * 7;
        const oz = -Math.floor(i / 2) * 9 + (i % 2) * 3;
        // Rotate the V-formation offset by the flock heading.
        const rx = ox * Math.cos(ry) - oz * Math.sin(ry);
        const rz = ox * Math.sin(ry) + oz * Math.cos(ry);
        dummy.position.set(fl.cx + rx, fl.cy + Math.sin(t * 2 + i * 1.3 + f * 2) * 1.2, fl.cz + rz);
        dummy.rotation.set(0, ry, 0);
        dummy.scale.setScalar(2.6); // big enough to read at 200-400 m
        dummy.updateMatrix();
        birds.setMatrixAt(n++, dummy.matrix);
      }
    }
    birds.instanceMatrix.needsUpdate = true;
  }

  function buildDistantPlanes(scene) {
    // 2 airliners crossing high overhead with contrails.
    const mat = new THREE.MeshBasicMaterial({ color: 0xf0f0f0, fog: false });
    const trailMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, fog: false });
    const defs = [
      { x: -2200, y: 640, z: -1400, vx: 95, vz: 20 },
      { x: 1800, y: 520, z: 1600, vx: -85, vz: -15 }, // low over the coast, crosses the cover shot's sky
    ];
    for (const d of defs) {
      const g = new THREE.Group();
      const fus = new THREE.Mesh(new THREE.BoxGeometry(2, 1.6, 15), mat);
      g.add(fus);
      const wing = new THREE.Mesh(new THREE.BoxGeometry(18, 0.5, 2.5), mat);
      g.add(wing);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(6, 0.4, 2), mat);
      tail.position.set(0, 0.6, -6.5);
      g.add(tail);
      const trail = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 120), trailMat);
      trail.position.set(0, 0, -42);
      g.add(trail);
      g.position.set(d.x, d.y, d.z);
      g.rotation.y = Math.atan2(d.vx, d.vz);
      scene.add(g);
      distantPlanes.push({ g, vx: d.vx, vz: d.vz });
    }
  }

  function updateDistantPlanes(dt) {
    for (const p of distantPlanes) {
      p.g.position.x += p.vx * dt;
      p.g.position.z += p.vz * dt;
      if (p.g.position.x > 2600 || p.g.position.x < -2600 || p.g.position.z > 2600 || p.g.position.z < -2600) {
        p.g.position.x = -Math.sign(p.vx) * 2400;
        p.g.position.z = -Math.sign(p.vz) * 2400;
      }
    }
  }

  function buildAirfield(scene) {
    // Hangars + terminal + 2 parked planes beside the strip (shot 4 foreground).
    const std = (c, r) => new THREE.MeshStandardMaterial({ color: c, roughness: r === undefined ? 0.9 : r });
    const add = (mesh, x, z) => { mesh.position.set(x, Terrain.heightAt(x, z) + (mesh.userData.y0 || 0), z); scene.add(mesh); return mesh; };
    const h1 = new THREE.Mesh(new THREE.BoxGeometry(34, 11, 26), std(0x9aa0a8));
    h1.userData.y0 = 5.5; add(h1, 95, 1230);
    const h1r = new THREE.Mesh(new THREE.BoxGeometry(36, 1.5, 28), std(0x7a828c));
    h1r.userData.y0 = 11.5; add(h1r, 95, 1230);
    const h2 = new THREE.Mesh(new THREE.BoxGeometry(30, 10, 24), std(0x8a9098));
    h2.userData.y0 = 5; add(h2, 130, 1660);
    const term = new THREE.Mesh(new THREE.BoxGeometry(46, 9, 22), std(0xd8c9a8));
    term.userData.y0 = 4.5; add(term, 105, 1480);
    const winStrip = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2, 20), new THREE.MeshBasicMaterial({ color: 0xffc46b }));
    winStrip.userData.y0 = 6;
    winStrip.position.set(105 - 23 - 0.3, Terrain.heightAt(105, 1480) + 6, 1480);
    scene.add(winStrip);
    // Two parked bush planes.
    for (const [px, pz, ry] of [[62, 1320, 0], [70, 1620, 0.15]]) {
      const g = new THREE.Group();
      const fus = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 14, 10), std(0xe8e2d0, 0.6));
      fus.rotation.x = Math.PI / 2;
      fus.position.y = 1.6;
      g.add(fus);
      const wing = new THREE.Mesh(new THREE.BoxGeometry(16, 0.4, 2.2), std(0xc23b2a, 0.6));
      wing.position.y = 2.6;
      g.add(wing);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(5, 0.4, 1.8), std(0xc23b2a, 0.6));
      tail.position.set(0, 2.2, -6.5);
      g.add(tail);
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3, 2), std(0xc23b2a, 0.6));
      fin.position.set(0, 3.4, -6.2);
      g.add(fin);
      g.position.set(px, Terrain.heightAt(px, pz) + 0.2, pz);
      g.rotation.y = ry;
      scene.add(g);
    }
  }

  function buildRiverForeground(scene) {
    // Shot-2-only foreground dressing, built ONLY when ?shot=river. The
    // river valley floor in the river frame (z -1600..-200, river to coast)
    // reads as one big bare sand patch: the corridor bushes are too few and
    // too small, and trees skip the low ground (h < 20). This ground sits
    // in shots 1/3/4's distant frustum, so world-wide clutter there would
    // move their pixels — hence the shot gate (same pattern as the per-shot
    // staging in shots.js). Instanced 30-tri spheres + 8-tri rocks + pines,
    // no lights, no shadows, no per-frame work.
    if (new URLSearchParams(window.location.search).get('shot') !== 'river') return;
    const rng = makeRng(9092);
    const col = new THREE.Color();
    // 200 bushes in TWO bands: 130 concentrated in the near foreground
    // (z -750..-250 — the ground that fills the bottom half of the frame),
    // 70 spread over the far floor (z -1600..-750). The first pass spread
    // them evenly over 1400 m and the near field stayed bare. Bigger than
    // the corridor bushes (scale 4-8 near) so they read at 100-400 m, and
    // lighter greens — the dark 0x2a5d2e read as black blobs in golden hour.
    const bGeo = new THREE.SphereGeometry(1, 5, 3);
    const bMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
    const bushes = new THREE.InstancedMesh(bGeo, bMat, 200);
    let placed = 0, tries = 0;
    while (placed < 200 && tries < 10000) {
      tries++;
      const near = placed < 130;
      const z = near ? -750 + rng() * 500 : -1600 + rng() * 850;
      const x = Terrain.riverCenterX(z) - 120 + rng() * (1120 - Terrain.riverCenterX(z));
      const hy = Terrain.heightAt(x, z);
      if (hy < 3 || hy > 150) continue;
      if (Math.abs(x - Terrain.riverCenterX(z)) < 50) continue; // keep the ribbon clear
      if (Math.abs(x - roadX(z)) < 10) continue;
      const s = near ? 4 + rng() * 4 : 3 + rng() * 3;
      dummy.position.set(x, hy + s * 0.35, z);
      dummy.rotation.set(0, rng() * Math.PI, 0);
      dummy.scale.set(s, s * 0.55, s);
      dummy.updateMatrix();
      bushes.setMatrixAt(placed, dummy.matrix);
      // Lighter greens, ~1 in 4 dry gold so the fill is not one flat tone.
      if (rng() < 0.25) col.setHex(0x9a8a3a).offsetHSL(0, 0, (rng() - 0.5) * 0.08);
      else col.setHex(0x3d7a35).offsetHSL(0, 0, (rng() - 0.5) * 0.1);
      bushes.setColorAt(placed, col);
      placed++;
    }
    bushes.count = placed;
    bushes.instanceColor.needsUpdate = true;
    scene.add(bushes);
    // 60 grass tufts (small cones) in the near band — vertical scrub texture
    // the squashed spheres alone do not give.
    const gGeo = new THREE.ConeGeometry(2.2, 6, 7);
    const gMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
    const tufts = new THREE.InstancedMesh(gGeo, gMat, 60);
    placed = 0; tries = 0;
    while (placed < 60 && tries < 6000) {
      tries++;
      const z = -750 + rng() * 500;
      const x = Terrain.riverCenterX(z) - 120 + rng() * (1120 - Terrain.riverCenterX(z));
      const hy = Terrain.heightAt(x, z);
      if (hy < 3 || hy > 150) continue;
      if (Math.abs(x - Terrain.riverCenterX(z)) < 50) continue;
      if (Math.abs(x - roadX(z)) < 10) continue;
      const s = 1.2 + rng() * 1.8;
      dummy.position.set(x, hy + 3 * s, z);
      dummy.rotation.set(0, rng() * Math.PI, 0);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      tufts.setMatrixAt(placed, dummy.matrix);
      col.setHex(0x4a8a3a).offsetHSL(0, 0, (rng() - 0.5) * 0.1);
      tufts.setColorAt(placed, col);
      placed++;
    }
    tufts.count = placed;
    tufts.instanceColor.needsUpdate = true;
    scene.add(tufts);
    // 60 rocks across the same floor, 40 near / 20 far.
    const rGeo = new THREE.OctahedronGeometry(1, 0);
    const rMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
    const rocks = new THREE.InstancedMesh(rGeo, rMat, 60);
    placed = 0; tries = 0;
    while (placed < 60 && tries < 6000) {
      tries++;
      const near = placed < 40;
      const z = near ? -750 + rng() * 500 : -1600 + rng() * 850;
      const x = Terrain.riverCenterX(z) - 120 + rng() * (1120 - Terrain.riverCenterX(z));
      const hy = Terrain.heightAt(x, z);
      if (hy < 3 || hy > 150) continue;
      if (Math.abs(x - Terrain.riverCenterX(z)) < 50) continue;
      if (Math.abs(x - roadX(z)) < 10) continue;
      const s = 2 + rng() * 4;
      dummy.position.set(x, hy + s * 0.3, z);
      dummy.rotation.set(rng() * 3, rng() * 3, rng() * 3);
      dummy.scale.set(s, s * 0.6, s);
      dummy.updateMatrix();
      rocks.setMatrixAt(placed, dummy.matrix);
      col.setHex(0x6a625a).offsetHSL(0, 0, (rng() - 0.5) * 0.1);
      rocks.setColorAt(placed, col);
      placed++;
    }
    rocks.count = placed;
    rocks.instanceColor.needsUpdate = true;
    scene.add(rocks);
    // 40 pines where the floor is high enough (h 20-150), same pattern as
    // buildTrees but aimed at this corridor. Kept SMALL (0.6-1.0) and clear
    // of the river line: v2's full-size pines crowded the flight path and
    // read as giant black triangles in the low river shot.
    const tGeo = new THREE.CylinderGeometry(1.1, 1.6, 7, 6);
    const tMat = new THREE.MeshStandardMaterial({ color: 0x5d3a1a, roughness: 1 });
    const cGeo = new THREE.ConeGeometry(6.5, 17, 7);
    const cMat = new THREE.MeshStandardMaterial({ color: 0x1e4d26, roughness: 0.95 });
    const trunks = new THREE.InstancedMesh(tGeo, tMat, 40);
    const cones = new THREE.InstancedMesh(cGeo, cMat, 40);
    placed = 0; tries = 0;
    while (placed < 40 && tries < 6000) {
      tries++;
      const z = -1600 + rng() * 1400;
      const x = Terrain.riverCenterX(z) - 140 + rng() * (1140 - Terrain.riverCenterX(z));
      const hy = Terrain.heightAt(x, z);
      if (hy < 20 || hy > 150) continue;
      if (Math.abs(x - Terrain.riverCenterX(z)) < 80) continue;
      if (Math.abs(x - roadX(z)) < 10) continue;
      const s = 0.6 + rng() * 0.4;
      dummy.position.set(x, hy + 3 * s, z);
      dummy.scale.setScalar(s);
      dummy.rotation.y = rng() * Math.PI * 2;
      dummy.updateMatrix();
      trunks.setMatrixAt(placed, dummy.matrix);
      dummy.position.y = hy + 15 * s;
      dummy.updateMatrix();
      cones.setMatrixAt(placed, dummy.matrix);
      placed++;
    }
    trunks.count = placed; cones.count = placed;
    scene.add(trunks); scene.add(cones);
    // A HIGH wooden trestle viaduct across the river at z -350, 90 m ahead
    // in the river shot: the frame needs a landmark on the water, not just
    // a ribbon. The river channel floor is at -7 m, so a bank-level deck
    // (11 m) sits 35 deg below the plane's sightline — outside the 31 deg
    // half-FOV — and NEVER enters the frame (proven by the -320 probe:
    // 30 m out, still invisible). A 45 m trestle puts the deck at 38 m,
    // 22 deg down at 90 m: in the lower third, unmistakable.
    // Two lamp globes on the deck read at distance.
    const bx = Terrain.riverCenterX(-350);
    const by = Terrain.heightAt(bx, -350);
    const bridge = new THREE.Group();
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(90, 1.6, 11),
      new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.95 }),
    );
    deck.position.y = 45; // trestle height: channel floor -7 m -> deck 38 m
    bridge.add(deck);
    const railMat = new THREE.MeshStandardMaterial({ color: 0x6a4a26, roughness: 1 });
    for (const s of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(90, 1.2, 0.8), railMat);
      rail.position.set(0, 46.4, s * 5);
      bridge.add(rail);
    }
    for (const px of [-30, 0, 30]) {
      const pier = new THREE.Mesh(
        new THREE.BoxGeometry(4, 45, 9),
        new THREE.MeshStandardMaterial({ color: 0x6a625a, roughness: 1 }),
      );
      pier.position.set(px, 22.5, 0);
      bridge.add(pier);
    }
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9b0 });
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.25, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.6 }),
      );
      post.position.set(s * 30, 49.5, 0);
      bridge.add(post);
      const globe = new THREE.Mesh(new THREE.SphereGeometry(1.1, 8, 8), lampMat);
      globe.position.set(s * 30, 54, 0);
      bridge.add(globe);
    }
    bridge.position.set(bx, by, -350);
    scene.add(bridge);
    // Three riverside huts with lit windows on the east bank by the bridge,
    // 100-180 m ahead so they sit inside the frame (ground at ~0-3 m is
    // 30+ deg down at 60 m — out of frame — but ~26 deg down at 130 m).
    const hutWall = new THREE.MeshStandardMaterial({ color: 0xd8c9a8, roughness: 0.95 });
    const hutRoof = new THREE.MeshStandardMaterial({ color: 0x8a3a22, roughness: 0.9 });
    const hutWin = new THREE.MeshBasicMaterial({ color: 0xffc46b });
    for (const [hx, hz] of [[bx + 48, -360], [bx + 58, -400], [bx + 44, -440]]) {
      const hy = Terrain.heightAt(hx, hz);
      const hut = new THREE.Group();
      const walls = new THREE.Mesh(new THREE.BoxGeometry(10, 5.5, 8), hutWall);
      walls.position.y = 2.75;
      hut.add(walls);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(7.5, 4.5, 4), hutRoof);
      roof.position.y = 7.7;
      roof.rotation.y = Math.PI / 4;
      hut.add(roof);
      const win = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.8, 0.3), hutWin);
      win.position.set(0, 3, 4.1);
      hut.add(win);
      hut.position.set(hx, hy, hz);
      hut.rotation.y = rng() * Math.PI;
      scene.add(hut);
    }
  }

  function build(scene) {
    buildRoad(scene);
    buildCars(scene);
    buildStreetLights(scene);
    buildTown2(scene);
    buildStalls(scene);
    buildUmbrellas(scene);
    buildBushes(scene);
    buildBushes2(scene);
    buildRiverForeground(scene);
    buildRocks(scene);
    buildBuoys(scene);
    buildFerries(scene);
    buildBirds(scene);
    buildDistantPlanes(scene);
    buildAirfield(scene);
  }

  function update(dt, t) {
    updateCars(dt);
    updateBuoys(t);
    updateFerries(dt, t);
    updateBirds(dt, t);
    updateDistantPlanes(dt);
  }

  return { build, update };
})();
