// Merapi Ring Run — rings and river drop markers.
// One clear job: the glowing goals the pilot flies through or drops onto.

const Rings = (function buildRingsModule() {
  let ringGroup, rings = [], markers = [], nextRing = 0;
  let ringMat, ringMatNext;

  function ringCourse() {
    // A course that tours the valley: runway → river → volcano shoulder → ridge → home.
    const pts = [
      { x: 0, y: 210, z: 1080 }, { x: -260, y: 230, z: 620 }, { x: -620, y: 280, z: 120 },
      { x: -780, y: 340, z: -420 }, { x: -560, y: 420, z: -900 }, { x: -140, y: 380, z: -1080 },
      { x: 320, y: 300, z: -820 }, { x: 640, y: 250, z: -380 }, { x: 780, y: 210, z: 120 },
      { x: 560, y: 230, z: 620 }, { x: 240, y: 200, z: 980 }, { x: 0, y: 190, z: 1180 },
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
      // A small beacon light under each ring for dusk visibility.
      const beacon = new THREE.PointLight(0xffa040, 1.1, 120);
      beacon.position.copy(ring.position);
      ringGroup.add(beacon);
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

  // Returns the ring index if the plane just passed through it, else -1.
  function checkPass(pos) {
    if (nextRing >= rings.length) return -1;
    const r = rings[nextRing];
    const d = pos.distanceTo(r.position);
    if (d < 15) {
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
      const z = 1600 - i * 480;
      const x = Terrain.riverCenterX(z) + (rng() - 0.5) * 40;
      const y = Terrain.heightAt(x, z) + 2;
      const grp = new THREE.Group();
      const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(14, 14, 1.2, 24),
        new THREE.MeshStandardMaterial({ color: 0x1ed760, emissive: 0x0d8a3a, emissiveIntensity: 0.9 }),
      );
      pad.position.y = 0.6;
      grp.add(pad);
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(2.2, 2.2, 90, 8, 1, true),
        new THREE.MeshBasicMaterial({ color: 0x7dffb0, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
      );
      beam.position.y = 45;
      grp.add(beam);
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
        m.children[1].visible = false;
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
      m.children[1].visible = true;
    });
  }

  return {
    buildRings, reset, checkPass, nextRingPos, ringsLeft, ringsDone, update,
    buildMarkers, checkCrate, markersLeft, resetMarkers,
  };
})();
