// Merapi Ring Run — rings and river drop markers.
// One clear job: the glowing goals the pilot flies through or drops onto.

const Rings = (function buildRingsModule() {
  let ringGroup, rings = [], markers = [], nextRing = 0;
  let ringMat, ringMatNext;

  function ringCourse() {
    // A course that tours the coast: runway → town → out over the sea →
    // up the coast → volcano shoulder → ridge → home along the beach.
    const pts = [
      { x: 700, y: 200, z: 900 }, { x: 1050, y: 210, z: 450 }, { x: 1200, y: 230, z: -100 },
      { x: 950, y: 280, z: -650 }, { x: 350, y: 340, z: -1000 }, { x: -350, y: 420, z: -1150 },
      { x: -900, y: 460, z: -700 }, { x: -750, y: 300, z: -100 }, { x: -350, y: 250, z: 350 },
      { x: 150, y: 220, z: 700 }, { x: 600, y: 210, z: 950 }, { x: 850, y: 200, z: 1250 },
    ];
    return pts;
  }

  function buildRings(scene) {
    ringGroup = new THREE.Group();
    ringMat = new THREE.MeshStandardMaterial({
      color: 0xffb347, emissive: 0xff8a1e, emissiveIntensity: 1.4,
      roughness: 0.35, metalness: 0.2, transparent: true, opacity: 0.92,
    });
    ringMatNext = new THREE.MeshStandardMaterial({
      color: 0x7dffb0, emissive: 0x1ed760, emissiveIntensity: 1.8,
      roughness: 0.35, metalness: 0.2, transparent: true, opacity: 0.95,
    });
    const geo = new THREE.TorusGeometry(16, 1.5, 12, 40);
    const course = ringCourse();
    rings = course.map((p, i) => {
      const ring = new THREE.Mesh(geo, ringMat);
      ring.position.set(p.x, p.y, p.z);
      // Face along the course direction so the pilot flies through the hole.
      const next = course[(i + 1) % course.length];
      ring.lookAt(next.x, next.y, next.z);
      ring.userData.index = i;
      ring.userData.baseY = p.y;
      ringGroup.add(ring);
      // No PointLight per ring: 12 beacons made every standard-material
      // fragment evaluate 12 extra lights. The rings glow via emissive
      // already, and the strip + volcano lights carry the dusk look.
      return ring;
    });
    scene.add(ringGroup);
    highlightNext();
    return rings;
  }

  function highlightNext() {
    rings.forEach((r, i) => {
      r.material = (i === nextRing) ? ringMatNext : ringMat;
      r.scale.setScalar(i === nextRing ? 1.12 : 1);
    });
  }

  function reset() {
    nextRing = 0;
    rings.forEach((r) => { r.visible = true; });
    highlightNext();
  }

  // Goals show only for their own sortie: rings in Ring Run, markers in
  // River Rescue, neither in Dusk Landing — v2 leaked green marker beams
  // and gold rings into the wrong shots.
  function setGoalsVisible(type) {
    if (ringGroup) ringGroup.visible = (type === 'rings');
    markers.forEach((m) => { m.visible = (type === 'crates'); });
  }

  // Returns the ring index if the plane just passed through it, else -1.
  function checkPass(pos) {
    if (nextRing >= rings.length) return -1;
    const r = rings[nextRing];
    const d = pos.distanceTo(r.position);
    if (d < 16) {
      r.visible = false;
      const hit = nextRing;
      nextRing++;
      highlightNext();
      return hit;
    }
    return -1;
  }

  function nextRingPos() {
    return nextRing < rings.length ? rings[nextRing].position : null;
  }

  function ringsLeft() { return rings.length - nextRing; }
  function ringsDone() { return nextRing; }

  function update(dt, t) {
    rings.forEach((r, i) => {
      if (!r.visible) return;
      // Gentle bob + slow spin so rings read as alive, not static.
      r.position.y = r.userData.baseY + Math.sin(t * 0.9 + i * 1.3) * 3;
      r.rotation.z += dt * 0.12;
    });
  }

  // ---- River Rescue drop markers ----
  function buildMarkers(scene) {
    const rng = makeRng(2024);
    markers = [];
    for (let i = 0; i < 6; i++) {
      const z = 1600 - i * 500;
      const x = Terrain.riverCenterX(z) + (rng() - 0.5) * 40;
      const y = Terrain.heightAt(x, z) + 2;
      const grp = new THREE.Group();
      const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(14, 14, 1.2, 24),
        new THREE.MeshStandardMaterial({ color: 0x1ed760, emissive: 0x0d8a3a, emissiveIntensity: 0.9 }),
      );
      pad.position.y = 0.6;
      grp.add(pad);
      // Ground ring around the pad: the target reads from the air.
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(18, 1.1, 8, 32),
        new THREE.MeshBasicMaterial({ color: 0x7dffb0 }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 1.4;
      grp.add(ring);
      // A crate stack waiting on the pad: the drop has something to land on.
      const crateMat = new THREE.MeshStandardMaterial({ color: 0xc98f4a, roughness: 0.9 });
      const crateMat2 = new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.9 });
      const c1 = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 5), crateMat);
      c1.position.set(-3, 3.7, 2);
      grp.add(c1);
      const c2 = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4), crateMat2);
      c2.position.set(3.5, 3.2, -2.5);
      grp.add(c2);
      const c3 = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3.4, 3.4), crateMat);
      c3.position.set(-2.5, 8.7, 1.5);
      grp.add(c3);
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(4, 4, 110, 8, 1, true),
        new THREE.MeshBasicMaterial({ color: 0x7dffb0, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }),
      );
      beam.position.y = 55;
      grp.add(beam);
      grp.userData.beam = beam;
      grp.userData.ring = ring;
      grp.position.set(x, y, z);
      grp.userData.done = false;
      scene.add(grp);
      markers.push(grp);
    }
    return markers;
  }

  function checkCrate(pos, alt) {
    for (let i = 0; i < markers.length; i++) {
      const m = markers[i];
      if (m.userData.done) continue;
      const dx = pos.x - m.position.x, dz = pos.z - m.position.z;
      if (Math.sqrt(dx * dx + dz * dz) < 22 && alt < 95) {
        m.userData.done = true;
        m.children[0].material = new THREE.MeshStandardMaterial({ color: 0x888888, emissive: 0x222222 });
        if (m.userData.beam) m.userData.beam.visible = false;
        if (m.userData.ring) m.userData.ring.visible = false;
        return i;
      }
    }
    return -1;
  }

  function markersLeft() { return markers.filter((m) => !m.userData.done).length; }

  function resetMarkers() {
    markers.forEach((m) => {
      m.userData.done = false;
      m.children[0].material = new THREE.MeshStandardMaterial({ color: 0x1ed760, emissive: 0x0d8a3a, emissiveIntensity: 0.9 });
      if (m.userData.beam) m.userData.beam.visible = true;
      if (m.userData.ring) m.userData.ring.visible = true;
    });
  }

  return {
    buildRings, reset, checkPass, nextRingPos, ringsLeft, ringsDone, update,
    buildMarkers, checkCrate, markersLeft, resetMarkers, setGoalsVisible,
  };
})();
