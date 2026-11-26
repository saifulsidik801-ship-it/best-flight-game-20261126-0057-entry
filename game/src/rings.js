// Aurora Ring Run v6 — aurora rings + supply markers. The ring course is
// re-laid for the new scene: south over the bay, north past the station,
// a loop by the glacier, and back. Rings are BIG (30 m radius) and bright
// so none reads smaller than ~120 px in the cover shot. Markers sit on the
// lead, the station dock and the camps.

const Rings = (function buildRingsModule() {
  // 12-ring course. Kept clear of the glacier massif (-1150,-1250): the
  // closest rings (7-8) sit where the terrain is ~200 m, well below the
  // rings at 270-280 m, so no ring is buried in the glacier.
  const COURSE = [
    [150, 200, 1100], [80, 210, 700], [-120, 220, 350], [-50, 230, -50],
    [200, 240, -450], [-100, 250, -850], [-400, 280, -1100], [-650, 270, -700],
    [-600, 240, -300], [-350, 230, 100], [-100, 220, 500], [100, 210, 900],
  ];
  const RING_RADIUS = 30;

  // 6 supply markers: three on the lead, one at the station dock, two at
  // the north and south camps. M2 sits 250 m north of the icebreaker's bow
  // so the ship and the marker never overlap. (The east camp is a scenery
  // camp only.)
  const MARKER_SPOTS = [
    [0, 1020], [0, 900], [120, 800], [0, 300], [-280, -1300], [-300, 900],
  ];

  let rings = [];       // { mesh, glow, pos }
  let markers = [];     // { group, beam, pad, pos, done }
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
    const torusGeo = new THREE.TorusGeometry(RING_RADIUS, 1.6, 12, 40);
    COURSE.forEach(([x, y, z], i) => {
      const pos = new THREE.Vector3(x, y, z);
      // Face the ring along the course: the hole looks down the flight path.
      const prev = COURSE[Math.max(0, i - 1)];
      const nxt = COURSE[Math.min(COURSE.length - 1, i + 1)];
      const dir = new THREE.Vector3(nxt[0] - prev[0], nxt[1] - prev[1], nxt[2] - prev[2]).normalize();
      const mat = new THREE.MeshStandardMaterial({
        color: 0x0a2a1a, emissive: 0x39ff88, emissiveIntensity: 2.0, roughness: 0.4,
      });
      const mesh = new THREE.Mesh(torusGeo, mat);
      mesh.position.copy(pos);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
      scene.add(mesh);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, color: 0x39ff88, transparent: true, opacity: 0.5,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      glow.position.copy(pos);
      glow.scale.set(70, 70, 1);
      scene.add(glow);
      rings.push({ mesh, glow, pos, mat });
    });
    highlightNext();
  }

  function highlightNext() {
    rings.forEach((r, i) => {
      const isNext = i === nextRing;
      r.mat.emissiveIntensity = isNext ? 2.6 : (i < nextRing ? 0.5 : 2.0);
      r.glow.material.opacity = isNext ? 0.75 : (i < nextRing ? 0.0 : 0.5);
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
  // 30 m across and the autopilot aims at the centre, so a distance check
  // is the honest test — and generous to the player.
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

  function buildMarkers(scene) {
    markers = [];
    nextMarker = 0;
    const beamGeo = new THREE.CylinderGeometry(1.2, 1.2, 60, 8);
    const padGeo = new THREE.CircleGeometry(9, 20);
    const crateGeo = new THREE.BoxGeometry(1.8, 1.8, 1.8);
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x9a7b4a, roughness: 0.8 });
    MARKER_SPOTS.forEach(([x, z]) => {
      const y = Terrain.heightAt(x, z) + 2;
      const group = new THREE.Group();
      const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({
        color: 0x39ff88, transparent: true, opacity: 0.45,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      beam.position.y = 30;
      group.add(beam);
      const pad = new THREE.Mesh(padGeo, new THREE.MeshBasicMaterial({
        color: 0x39ff88, transparent: true, opacity: 0.5,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      }));
      pad.rotation.x = -Math.PI / 2;
      pad.position.y = 0.5;
      group.add(pad);
      const padGlow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, color: 0x39ff88, transparent: true, opacity: 0.6,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      padGlow.position.y = 3;
      padGlow.scale.set(26, 26, 1);
      group.add(padGlow);
      for (let k = 0; k < 3; k++) {
        const crate = new THREE.Mesh(crateGeo, crateMat);
        crate.position.set((k - 1) * 2.2, 0.9, (k % 2) * 2.0 - 1);
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

  // A crate lands when the plane is low (alt < 90 m) and within 30 m of the
  // next marker's centre. Delivered markers go dark.
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

  function resetMarkers() {
    nextMarker = 0;
    markers.forEach((m) => {
      m.done = false;
      m.beam.visible = true;
      m.pad.material.opacity = 0.5;
      m.padGlow.visible = true;
    });
  }

  // Pulse the next ring's glow and the next marker's beam — pure functions
  // of the game clock, so the render is identical on every run.
  function update(_dt, clock) {
    if (nextRing < rings.length) {
      const s = 70 + 8 * Math.sin(clock * 3);
      rings[nextRing].glow.scale.set(s, s, 1);
    }
    if (nextMarker < markers.length && !markers[nextMarker].done) {
      markers[nextMarker].beam.material.opacity = 0.38 + 0.14 * Math.sin(clock * 2.5);
    }
  }

  return {
    buildRings, reset, checkPass, nextRingPos, ringsLeft, ringsDone, update,
    buildMarkers, checkCrate, markersLeft, resetMarkers, setGoalsVisible,
  };
})();
