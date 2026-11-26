// Aurora Ring Run v7 — aurora rings + supply markers. One clear job: the
// goals the pilot flies through, bright enough to read from 400 m.
//
// v7 changes: the ring course is re-laid so its second station crossing
// lands on ring 10 — the cover shot stages mid-sortie (9 rings flown)
// with the station and the next ring both dead ahead. Rings alternate
// aurora green and teal, emissive with strong glow sprites; the next
// ring burns brightest, flown rings go dim. Markers are bright green
// beams with glow pads, never pale pillars.

const Rings = (function buildRingsModule() {
  // 12-ring course: south over the bay, past the station, north to the
  // glacier, back south along the return leg — and across the station
  // a second time at ring 10. Kept clear of the glacier massif
  // (-1150,-1250): rings 6–7 sit where the terrain is ~200 m, well
  // below the rings at 260–280 m.
  const COURSE = [
    [150, 200, 1150], [60, 210, 750], [-100, 220, 400], [-250, 230, -50],
    [-400, 250, -550], [-550, 270, -1000], [-700, 260, -500], [-450, 250, -100],
    [-200, 240, 300], [60, 220, 700], [200, 220, 1050], [100, 210, 650],
  ];
  const RING_RADIUS = 30;

  // 6 supply markers: two on the lead south of the station, one at the
  // station dock, one mid-lead, two at the north and south camps.
  const MARKER_SPOTS = [
    [0, 1020], [0, 900], [120, 800], [0, 300], [-280, -1300], [-300, 900],
  ];

  let rings = [];       // { mesh, glow, pos, mat }
  let markers = [];     // { group, beam, pad, padGlow, pos, done }
  let nextRing = 0;
  let nextMarker = 0;

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

  function buildRings(scene) {
    rings = [];
    const torusGeo = new THREE.TorusGeometry(RING_RADIUS, 1.7, 12, 44);
    COURSE.forEach(([x, y, z], i) => {
      const pos = new THREE.Vector3(x, y, z);
      // Face the ring along the course: the hole looks down the flight path.
      const prev = COURSE[Math.max(0, i - 1)];
      const nxt = COURSE[Math.min(COURSE.length - 1, i + 1)];
      const dir = new THREE.Vector3(
        nxt[0] - prev[0], nxt[1] - prev[1], nxt[2] - prev[2]).normalize();
      const tint = i % 2 === 0 ? CONFIG.auroraGreen : CONFIG.auroraTeal;
      const mat = new THREE.MeshStandardMaterial({
        color: 0x0a2a1a, emissive: tint, emissiveIntensity: 2.1, roughness: 0.35,
      });
      const mesh = new THREE.Mesh(torusGeo, mat);
      mesh.position.copy(pos);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
      scene.add(mesh);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, color: tint, transparent: true, opacity: 0.55,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      glow.position.copy(pos);
      glow.scale.set(78, 78, 1);
      scene.add(glow);
      rings.push({ mesh, glow, pos, mat });
    });
    highlightNext();
  }

  // The next ring burns brightest; flown rings go dim and lose their
  // glow; later rings stay lit so the course reads ahead.
  function highlightNext() {
    rings.forEach((r, i) => {
      const isNext = i === nextRing;
      r.mat.emissiveIntensity = isNext ? 2.8 : (i < nextRing ? 0.5 : 2.1);
      r.glow.material.opacity = isNext ? 0.8 : (i < nextRing ? 0.0 : 0.55);
    });
  }

  function reset() {
    nextRing = 0;
    rings.forEach((r) => {
      r.mesh.visible = true;
      r.glow.visible = true;
    });
    highlightNext();
  }

  function setGoalsVisible(type) {
    rings.forEach((r) => {
      r.mesh.visible = type === 'rings';
      r.glow.visible = type === 'rings';
    });
    markers.forEach((m) => { m.group.visible = type === 'crates'; });
  }

  // Through the hole: within the ring radius of the centre. The ring is
  // 30 m across and the autopilot aims at the centre, so a distance
  // check is the honest test — and generous to the player.
  function checkPass(pos) {
    if (nextRing >= rings.length) return false;
    if (pos.distanceTo(rings[nextRing].pos) < RING_RADIUS) {
      nextRing++;
      highlightNext();
      return true;
    }
    return false;
  }

  function nextRingPos() {
    return nextRing < rings.length ? rings[nextRing].pos : null;
  }
  function ringsLeft() { return rings.length - nextRing; }
  function ringsDone() { return nextRing; }
  function courseAt(i) { return COURSE[i] ? new THREE.Vector3(COURSE[i][0], COURSE[i][1], COURSE[i][2]) : null; }

  function buildMarkers(scene) {
    markers = [];
    nextMarker = 0;
    const beamGeo = new THREE.CylinderGeometry(1.4, 1.4, 64, 10);
    const padGeo = new THREE.CircleGeometry(10, 24);
    const crateGeo = new THREE.BoxGeometry(1.9, 1.9, 1.9);
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x9a7b4a, roughness: 0.8 });
    MARKER_SPOTS.forEach(([x, z]) => {
      const y = Terrain.heightAt(x, z) + 2;
      const group = new THREE.Group();
      const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({
        color: 0x39ff88, transparent: true, opacity: 0.5,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      beam.position.y = 32;
      group.add(beam);
      const pad = new THREE.Mesh(padGeo, new THREE.MeshBasicMaterial({
        color: 0x39ff88, transparent: true, opacity: 0.55,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      }));
      pad.rotation.x = -Math.PI / 2;
      pad.position.y = 0.5;
      group.add(pad);
      const padGlow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, color: 0x39ff88, transparent: true, opacity: 0.65,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      padGlow.position.y = 3;
      padGlow.scale.set(30, 30, 1);
      group.add(padGlow);
      for (let k = 0; k < 3; k++) {
        const crate = new THREE.Mesh(crateGeo, crateMat);
        crate.position.set((k - 1) * 2.3, 0.95, (k % 2) * 2.1 - 1);
        crate.rotation.y = k * 0.7;
        crate.castShadow = true;
        group.add(crate);
      }
      group.position.set(x, y, z);
      group.visible = false;
      scene.add(group);
      markers.push({ group, beam, pad, padGlow, pos: new THREE.Vector3(x, y, z), done: false });
    });
  }

  // A crate lands when the plane is low (alt < 90 m) and within 30 m of
  // the next marker's centre. Delivered markers go dark.
  function checkCrate(pos, alt) {
    if (nextMarker >= markers.length) return false;
    const m = markers[nextMarker];
    const dx = pos.x - m.pos.x, dz = pos.z - m.pos.z;
    if (Math.sqrt(dx * dx + dz * dz) < 30 && alt < 90) {
      m.done = true;
      m.beam.visible = false;
      m.pad.material.opacity = 0.12;
      m.padGlow.visible = false;
      nextMarker++;
      return true;
    }
    return false;
  }

  function markersLeft() { return markers.filter((m) => !m.done).length; }
  function markerAt(i) { return markers[i] ? markers[i].pos.clone() : null; }

  function resetMarkers() {
    nextMarker = 0;
    markers.forEach((m) => {
      m.done = false;
      m.beam.visible = true;
      m.pad.material.opacity = 0.55;
      m.padGlow.visible = true;
    });
  }

  // Pulse the next ring's glow and the next marker's beam — pure
  // functions of the game clock, so the render is identical on every run.
  function update(_dt, clock) {
    if (nextRing < rings.length) {
      const s = 78 + 9 * Math.sin(clock * 3);
      rings[nextRing].glow.scale.set(s, s, 1);
    }
    if (nextMarker < markers.length && !markers[nextMarker].done) {
      markers[nextMarker].beam.material.opacity = 0.42 + 0.15 * Math.sin(clock * 2.5);
    }
  }

  return {
    buildRings, reset, checkPass, nextRingPos, ringsLeft, ringsDone,
    courseAt, update,
    buildMarkers, checkCrate, markersLeft, markerAt, resetMarkers,
    setGoalsVisible,
  };
})();
