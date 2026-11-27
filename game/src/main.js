// Ashwing — boot and director. One job: assemble the world, run the
// loop, and stage the four screenshots. Shot modes come from the URL:
// ?shot=cover (title) | river (scoop run) | dusk (water drop) |
// landing (end screen) | play (interactive). The playtest harness
// drives ?shot=play with real keys.
(function () {
  'use strict';
  var R = window.AshRng;
  var T = window.AshTerrain;

  var params = new URLSearchParams(window.location.search);
  var SHOT = params.get('shot') || 'play';
  var SEED = parseInt(params.get('seed') || '1', 10) || 1;
  var rng = R.makeRng(SEED * 7919 + 13);

  var canvas = document.getElementById('game');
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false });
  renderer.setPixelRatio(1);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x2a2140, 1);

  var scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x9a6248, 650, 3000);
  var camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 7000);
  camera.position.set(-560, 60, -620);

  // --- world ---
  scene.add(T.buildSkyDome());
  scene.add(T.buildClouds());
  scene.add(T.buildSunDisc());
  scene.add(T.buildTerrainMesh());
  scene.add(T.buildLakeMesh());
  scene.add(T.buildShore());
  scene.add(T.buildGlintMesh());
  scene.add(T.buildRidgeRing(rng));
  var lights = T.buildLights();
  scene.add(lights);
  scene.add(window.AshForest.buildForest(rng));
  var townGroup = window.AshForest.buildTown(rng);
  scene.add(townGroup);

  var fires = new window.AshFires.FireField(scene, rng);
  var physics = new window.AshPhysics.Physics(fires);
  var missions = new window.AshMissions.Missions(physics, fires, rng);
  var hud = new window.AshHud.Hud();
  var plane = window.AshAirtanker.buildAirtanker();
  plane.rotation.order = 'YXZ';
  scene.add(plane);
  var spray = window.AshAirtanker.buildSpray();
  scene.add(spray);

  physics.expose();
  missions.expose();

  // --- input ---
  function onKey(e, down) {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].indexOf(e.code) >= 0) e.preventDefault();
    physics.keys[e.code] = down;
    if (!down) return;
    if (e.code === 'Enter') startFlying();
    if (e.code === 'Digit1') missions.setupMission(1);
    if (e.code === 'Digit2') missions.setupMission(2);
    if (e.code === 'Digit3') missions.setupMission(3);
    if (e.code === 'KeyR') { missions.setupMission(missions.mission.id); hud.showEnd(false); }
  }
  window.addEventListener('keydown', function (e) { onKey(e, true); });
  window.addEventListener('keyup', function (e) { onKey(e, false); });
  canvas.addEventListener('mousedown', function () { physics.keys['MouseDrop'] = true; });
  window.addEventListener('mouseup', function () { physics.keys['MouseDrop'] = false; });
  canvas.addEventListener('click', function () { startFlying(); });

  var flying = false;
  function startFlying() {
    if (flying) return;
    flying = true;
    hud.showTitle(false);
    missions.say('Scoop the lake — stay low and fast over the water');
  }

  // --- shot staging ---
  var simTime = 0;
  var settled = false;
  var shotTarget = 0; // sim-seconds to fast-forward before settling
  var dropAt = -1;    // sim-time to trigger the scripted drop (dusk)
  var autopilot = false;
  var autoPhase = 'scoop';

  // per-shot field of view: the scoop run gets a tighter lens so the
  // plane and the shoreline read bigger and the lake stays a band.
  camera.fov = SHOT === 'river' ? 55 : 62;
  camera.updateProjectionMatrix();

  function stageShot() {
    if (SHOT === 'cover') {
      // Straight southwest run over the fire line toward Cedar Falls —
      // no autopilot, so the plane holds its line for the title frame.
      missions.setupMission(1);
      physics.reset(430, 330, 75, -2.23, 60);
      physics.throttle = 0.55;
      shotTarget = 6;
      hud.showTitle(true);
    } else if (SHOT === 'river') {
      // Scoop run tight against the eastern shore, angled southeast so
      // the fire line's smoke and Cedar Falls sit in the background.
      // The plane leaves the lake ~0.7 s before capture; the tank is
      // still filling, spray is still flying and SCOOPING… still shows.
      missions.setupMission(1);
      physics.reset(-250, -260, 6, Math.PI * 0.5 - 0.5, 0);
      physics.throttle = 0.6;
      shotTarget = 1.0; // settle mid-scoop, spray still flying
      flying = true; hud.showTitle(false);
    } else if (SHOT === 'dusk') {
      missions.setupMission(1);
      physics.reset(30, 110, 48, 0.71, 100);
      physics.throttle = 0.62;
      dropAt = 0.3;
      shotTarget = 0.9; // settle while the burst is mid-fall
      flying = true; hud.showTitle(false);
    } else if (SHOT === 'landing') {
      // Staged end screen: a short real mission the autopilot genuinely
      // flies and wins — 3 low-intensity fires (they do not spread),
      // full tank, plane already inbound. The fires sit on the town's
      // edge so Cedar Falls (houses, water tower, fire trucks) is the
      // backdrop behind the parked plane. Stats on screen are the sim's.
      missions.setupMission(1);
      fires.clear();
      fires.addFire(330, 180, 0.5);
      fires.addFire(390, 240, 0.5);
      fires.addFire(310, 290, 0.5);
      physics.reset(-260, -60, 50, 0.86, 100);
      autoPhase = 'attack';
      autopilot = true;
      shotTarget = 120; // cap; settles early when the mission ends
      flying = true; hud.showTitle(false);
    } else { // play
      missions.setupMission(1);
      shotTarget = 1.5;
      flying = true; hud.showTitle(false);
    }
  }

  function autopilotStep(dt) {
    if (!autopilot || missions.done) { physics.auto = null; return; }
    var burning = fires.burningCount();
    if (burning === 0) { physics.auto = null; return; }
    if (autoPhase === 'scoop') {
      var sdx = T.LAKE.x - physics.pos.x, sdz = T.LAKE.z - physics.pos.z;
      var sdist = Math.sqrt(sdx * sdx + sdz * sdz);
      physics.auto = { x: T.LAKE.x, z: T.LAKE.z, alt: 5, slow: sdist < 150 };
      if (physics.water >= 98) autoPhase = 'attack';
    } else {
      // nearest burning fire
      var best = null, bd = 1e12;
      for (var i = 0; i < fires.fires.length; i++) {
        var f = fires.fires[i];
        if (f.intensity <= 0.02) continue;
        var dx = f.x - physics.pos.x, dz = f.z - physics.pos.z;
        var d = dx * dx + dz * dz;
        if (d < bd) { bd = d; best = f; }
      }
      if (!best) { autoPhase = 'scoop'; return; }
      var dist = Math.sqrt(bd);
      physics.auto = { x: best.x, z: best.z, alt: 22, slow: dist < 150 };
      physics.keys['Space'] = dist < 70 && physics.water > 0;
      if (physics.water < 10) { autoPhase = 'scoop'; physics.keys['Space'] = false; }
    }
  }

  function step(dt) {
    autopilotStep(dt);
    physics.step(dt);
    fires.update(dt, simTime, missions.town);
    missions.update(dt);
    if (dropAt >= 0 && simTime >= dropAt) {
      physics.keys['Space'] = true;
      if (simTime >= dropAt + 1.0) { physics.keys['Space'] = false; dropAt = -1; }
    }
    simTime += dt;
  }

  function syncVisuals(dt, t) {
    // plane transform from physics
    plane.position.copy(physics.pos);
    plane.rotation.y = physics.heading + Math.PI;
    plane.rotation.x = -physics.pitch;
    // the dusk drop reads flat level — a visual bank makes it dynamic.
    // Physics is untouched; this is the mesh only, shot-staging only.
    plane.rotation.z = -physics.roll - (SHOT === 'dusk' ? 0.38 : 0);
    var spin = dt * physics.speed * 0.9;
    plane.userData.props[0].rotation.z += spin;
    plane.userData.props[1].rotation.z += spin;
    // spray behind the hull while scooping
    var fwd = physics.forward();
    var origin = {
      x: physics.pos.x - fwd.x * 4,
      y: Math.max(0.5, physics.pos.y - 1),
      z: physics.pos.z - fwd.z * 4
    };
    window.AshAirtanker.updateSpray(spray, origin, fwd, dt, physics.scooping, t);
    // fire glow flicker
    lights.userData.fireGlow.intensity = 1.9 + Math.sin(t * 9.3) * 0.5 + Math.sin(t * 23.7) * 0.25;
    // truck light bars blink
    var trucks = townGroup.userData.trucks || [];
    for (var i = 0; i < trucks.length; i++) {
      trucks[i].userData.barMat.color.setHex(Math.floor(t * 2 + i) % 2 === 0 ? 0xff2a1e : 0x2a6bff);
    }
    // camera: chase with a side offset so the airtanker reads as a
    // three-quarter silhouette and the valley ahead dominates — except
    // the cover, which is a front three-quarter: the camera sits ahead
    // of the nose looking back, so the cockpit, floats and red
    // cheatline read, with the fire line and Cedar Falls behind.
    var rx = -Math.cos(physics.heading), rz = Math.sin(physics.heading); // right vector
    var cx, cz, cy, lx, ly, lz;
    if (SHOT === 'cover') {
      cx = physics.pos.x + fwd.x * 24 + rx * -10;
      cz = physics.pos.z + fwd.z * 24 + rz * -10;
      cy = physics.pos.y + 3.5;
      lx = physics.pos.x; ly = physics.pos.y + 3; lz = physics.pos.z;
    } else {
      var dist = SHOT === 'dusk' ? 15 : (SHOT === 'river' ? 14 : 18);
      var height = SHOT === 'dusk' ? 4.5 : (SHOT === 'river' ? 3.5 : 5.0);
      var side = SHOT === 'river' ? 11 : 11;
      cx = physics.pos.x - fwd.x * dist + rx * side;
      cz = physics.pos.z - fwd.z * dist + rz * side;
      cy = physics.pos.y + height;
      lx = physics.pos.x + fwd.x * 34;
      ly = physics.pos.y + (SHOT === 'river' ? 6 : (SHOT === 'landing' ? 4 : 1.5));
      lz = physics.pos.z + fwd.z * 34;
    }
    var ground = T.heightAt(cx, cz);
    if (cy < ground + 3) cy = ground + 3;
    var k = 1 - Math.exp(-3.2 * Math.max(dt, 0.001));
    camera.position.x += (cx - camera.position.x) * k;
    camera.position.y += (cy - camera.position.y) * k;
    camera.position.z += (cz - camera.position.z) * k;
    camera.lookAt(lx, ly, lz);
    hud.update(physics, missions, fires);
    if (missions.done) hud.showEnd(true, missions.won, fires, missions);
  }

  function render() {
    renderer.render(scene, camera);
  }

  // --- fast-forward the staged shot, then start the live loop ---
  stageShot();
  var guard = 0;
  while (simTime < shotTarget && guard < 20000) {
    step(1 / 60);
    guard++;
    if (SHOT === 'landing' && missions.done) break;
  }
  syncVisuals(1 / 60, simTime);
  render();
  window.__gameReady = true;
  if (simTime >= shotTarget || (SHOT === 'landing' && missions.done)) {
    window.__shotSettled = true;
    settled = true;
  }

  var last = performance.now();
  function loop(now) {
    requestAnimationFrame(loop);
    // rAF timestamps can step backward in headless runs (screenshot /
    // compositor hitches): a negative dt would diverge speed and grow
    // the tank through the drop path, so clamp it to [0, 0.25].
    var dt = Math.max(0, Math.min((now - last) / 1000, 0.25));
    last = now;
    if (!settled) {
      step(dt);
      if (simTime >= shotTarget || (SHOT === 'landing' && missions.done)) {
        settled = true;
        window.__shotSettled = true;
      }
    } else {
      step(dt);
    }
    syncVisuals(dt, simTime);
    render();
  }
  requestAnimationFrame(loop);

  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  window.__ashwing = { physics: physics, missions: missions, fires: fires, SHOT: SHOT, simTime: function () { return simTime; } };
})();
