// Merapi Ring Run — boot, render loop, cameras and game flow.
// One clear job: own the frame — input → physics → missions → render → HUD.

const Game = (function buildMainModule() {
  let renderer, scene, camera;
  let plane;
  let cameraMode = 'chase';
  let autopilot = false;
  let paused = false;
  let running = false;      // a sortie is in progress
  let endShown = false;     // end screen already shown for this sortie
  let settle = 0;           // frames to run before a screenshot is "settled"
  let clock = 0;
  let camShake = 0;
  const tmpV = new THREE.Vector3();

  function boot() {
    const app = document.getElementById('app');
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); // cap 1.5: dpr 2 quadruples fragment work on hi-dpi screens for no visible gain at this art style
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    app.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 15000);
    camera.position.set(0, 300, 1900);

    Sky.buildSky(scene, renderer);
    Terrain.buildTerrainMesh(scene);
    Terrain.buildRiver(scene);
    Terrain.buildRunway(scene);
    Terrain.buildVolcanoSmoke(scene);
    Terrain.buildVillages(scene);
    Terrain.buildTrees(scene);
    Terrain.buildSea(scene);
    Terrain.buildBoats(scene);
    Terrain.buildLighthouse(scene);
    Terrain.buildPalms(scene);
    plane = Aircraft.buildAircraft(scene);
    Rings.buildRings(scene);
    Rings.buildMarkers(scene);

    Input.init();
    Input.setKeyHandler(onKey);
    document.getElementById('flyBtn').addEventListener('click', () => startSortie(0));
    document.getElementById('againBtn').addEventListener('click', () => startSortie(Missions.getState().mission.id - 1));

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Screenshot staging (?shot=...) or the title screen.
    const query = new URLSearchParams(window.location.search);
    const staged = Shots.apply(query, api);
    if (!staged) {
      HUD.showTitle();
      Missions.select(0);
      Missions.start();
      running = false;
      api.setCameraMode('orbit-title');
    }

    let last = performance.now();
    function frame(now) {
      requestAnimationFrame(frame);
      const rawDt = Math.max(0, (now - last) / 1000);
      last = now;
      // Fixed-step simulation: on a slow renderer one wall second can be a
      // single frame, and clamping dt to 0.05 made the game run at 1/20 speed.
      // Instead, advance up to 1.0 s of game time per rendered frame in
      // 0.05 s slices, so physics stays stable AND the game keeps real-time
      // pace even at ~1 FPS. At 60 fps this is exactly one ~0.0167 s step —
      // behaviour unchanged. (Physics is cheap vs the render; 20 slices/frame
      // cost milliseconds, while the render costs ~a second.)
      if (!paused) {
        const simDt = Math.min(rawDt, 1.0);
        const steps = Math.max(1, Math.ceil(simDt / 0.05));
        const h = simDt / steps;
        for (let i = 0; i < steps; i++) tick(h, h);
        // Screenshot settle counts down in GAME seconds, not rendered frames:
        // with substepping, 25 rendered frames can be 25 s of game time, and
        // the staged plane would fly far from its setup before the shot.
        if (settle > 0) {
          settle -= simDt;
          if (settle <= 0) { settle = 0; window.__shotSettled = true; }
        }
      }
      renderer.render(scene, camera);
    }
    requestAnimationFrame(frame);
    window.__gameReady = true;
  }

  function onKey(code) {
    if (code === 'Enter') {
      const title = document.getElementById('titleScreen');
      const end = document.getElementById('endScreen');
      if (title.style.display === 'flex') startSortie(0);
      else if (end.style.display === 'flex') startSortie(Missions.getState().mission.id - 1);
      return;
    }
    if (code === 'KeyP') { paused = !paused; return; }
    if (code === 'KeyM') { AudioSys.toggleMute(); return; }
    if (code === 'KeyC') {
      cameraMode = cameraMode === 'chase' ? 'cockpit' : cameraMode === 'cockpit' ? 'chase-low' : 'chase';
      return;
    }
    if (code === 'KeyR') { startSortie(Missions.getState().mission.id - 1); return; }
    if (code === 'Digit1') startSortie(0);
    if (code === 'Digit2') startSortie(1);
    if (code === 'Digit3') startSortie(2);
  }

  function startSortie(index) {
    Missions.select(index);
    Missions.start();
    running = true;
    paused = false;
    autopilot = false;
    endShown = false;
    cameraMode = 'chase';
    HUD.hideScreens();
    AudioSys.ensure();
  }

  function autopilotControls() {
    const p = Physics.state;
    const ms = Missions.getState();
    let target = null;
    let targetAlt = 230;
    if (ms.mission.type === 'rings') {
      target = Rings.nextRingPos();
      if (target) targetAlt = target.y;
    } else if (ms.mission.type === 'crates') {
      target = new THREE.Vector3(Terrain.riverCenterX(p.pos.z - 300), 120, p.pos.z - 300);
      targetAlt = 120;
    } else {
      target = new THREE.Vector3(CONFIG.runway.x, 120, CONFIG.runway.z);
      targetAlt = Math.max(60, 120 + (p.pos.z - CONFIG.runway.z) * 0.12);
    }
    if (!target) return Input.controls();
    const dx = target.x - p.pos.x, dz = target.z - p.pos.z;
    let desired = Math.atan2(dx, -dz);
    let err = desired - p.heading;
    while (err > Math.PI) err -= Math.PI * 2;
    while (err < -Math.PI) err += Math.PI * 2;
    const roll = Math.max(-0.75, Math.min(0.75, err * 1.1));
    const pitch = Math.max(-0.18, Math.min(0.22, (targetAlt - p.pos.y) * 0.0022));
    return { pitch: pitch / 0.42, roll: roll / 0.95, yaw: 0, brake: 0 };
  }

  function tick(dt, rawDt) {
    clock += dt;
    const p = Physics.state;
    const ctrl = autopilot ? autopilotControls() : Input.controls();
    // Gentle throttle hold for the autopilot so shots stay airborne.
    if (autopilot && p.throttle < 0.65) p.throttle = 0.65;

    let stepInfo = { event: null, clearance: 999, stalled: false };
    if (running) {
      stepInfo = Physics.step(dt, ctrl);
      Missions.update(dt, stepInfo);
      if (stepInfo.event && (stepInfo.event.type === 'crash' || stepInfo.event.type === 'destroyed')) {
        camShake = 0.6;
      }
      const ms = Missions.getState();
      if (ms.finished && !endShown) {
        endShown = true;
        running = false;
        setTimeout(() => HUD.showEnd(ms), 900);
      }
    } else {
      // Title orbit: the plane sits on the strip, prop idling.
      p.throttle = 0.12;
    }

    Physics.applyToPlane(plane);
    Aircraft.update(dt, p.throttle, p.speed, clock);
    Rings.update(dt, clock);
    Sky.update(dt, clock);
    Terrain.updateSea(dt, clock);
    AudioSys.update(p.throttle, p.speed);
    updateCamera(rawDt || dt);
    HUD.update(dt, clock);
  }

  function updateCamera(dt) {
    const p = Physics.state;
    const fwd = Physics.forward();
    const right = tmpV.set(Math.cos(p.heading), 0, Math.sin(p.heading)).clone();
    // While a screenshot is settling, snap the camera — no lag trail.
    const snap = settle > 0 ? 1 : Math.min(1, dt * 5);

    if (cameraMode === 'cockpit') {
      // Over the pilot's shoulder: nose and lit panel in frame.
      const eye = p.pos.clone().addScaledVector(fwd, 1.4).add(new THREE.Vector3(0, 1.35, 0));
      camera.position.copy(eye);
      camera.lookAt(p.pos.clone().addScaledVector(fwd, 120).add(new THREE.Vector3(0, 1.0, 0)));
      camera.rotation.z += -p.roll * 0.55;
    } else if (cameraMode === 'chase-low') {
      const eye = p.pos.clone().addScaledVector(fwd, -20).add(new THREE.Vector3(0, 4.5, 0));
      camera.position.lerp(eye, snap);
      camera.lookAt(p.pos.clone().addScaledVector(fwd, 90).add(new THREE.Vector3(0, 1.5, 0)));
    } else if (cameraMode === 'title-fixed') {
      // Title shot: parked on the strip, plane right of frame, volcano behind.
      const eye = new THREE.Vector3(p.pos.x + 34, p.pos.y + 12, p.pos.z + 46);
      camera.position.lerp(eye, settle > 0 ? 1 : Math.min(1, dt * 2.5));
      // Look well west of the plane so it sits right of the title card.
      camera.lookAt(p.pos.x - 60, p.pos.y + 3, p.pos.z);
    } else if (cameraMode === 'orbit-title') {
      const a = clock * 0.11;
      const eye = new THREE.Vector3(
        p.pos.x + Math.sin(a) * 26,
        p.pos.y + 9 + Math.sin(clock * 0.3) * 1.2,
        p.pos.z + Math.cos(a) * 26,
      );
      camera.position.lerp(eye, settle > 0 ? 1 : Math.min(1, dt * 2.5));
      camera.lookAt(p.pos.x, p.pos.y + 2, p.pos.z);
    } else {
      // Chase: behind, above, slightly to the side — aircraft in frame, world ahead.
      const eye = p.pos.clone().addScaledVector(fwd, -24).add(new THREE.Vector3(0, 7.5, 0))
        .addScaledVector(right, 3.5);
      camera.position.lerp(eye, snap);
      camera.lookAt(p.pos.clone().addScaledVector(fwd, 90).add(new THREE.Vector3(0, 2.5, 0)));
    }
    if (camShake > 0) {
      camShake = Math.max(0, camShake - dt);
      camera.position.x += (Math.random() - 0.5) * camShake * 2;
      camera.position.y += (Math.random() - 0.5) * camShake * 2;
    }
  }

  const api = {
    boot,
    startSortie,
    setCameraMode(m) { cameraMode = m; },
    setAutopilot(on) { autopilot = on; },
    // n counts "frames" at the old 0.05 s simulation step: 25 frames ≈ 1.25 s
    // of game time, on any hardware. (Settle is game-time based so the staged
    // plane does not fly away from its setup on a slow renderer.)
    settleFrames(n) { settle = n * 0.05; window.__shotSettled = false; },
  };

  return api;
})();

window.addEventListener('DOMContentLoaded', () => Game.boot());
