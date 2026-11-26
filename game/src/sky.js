// Aurora Ring Run v7 — polar-night sky: flowing aurora curtains, stars,
// moon, and the light rig. One clear job: make the sky read as a living
// polar night, not a painted backdrop.
//
// v7 headline change: the aurora is rebuilt as CURVED, WAVY, vertically
// draped curtains with soft alpha falloff on every edge. The v6 ribbons
// were flat rectangular slabs with hard edges and read as paper strips.
// These curtains wave along their length, hang down in folds, taper to
// nothing at both ends, and fade softly top and bottom — no straight
// edge exists anywhere in the sky.

const Sky = (function buildSkyModule() {
  let ribbons = [];
  let duskGlow = null;
  let fillLight = null;
  let duskOn = false;

  // Shared soft-alpha texture for every curtain: opaque in the middle
  // band, fading to fully transparent at the top and bottom edges.
  // The tint comes from each ribbon's material colour.
  function curtainTexture() {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const g = c.getContext('2d');
    const img = g.createImageData(256, 256);
    for (let y = 0; y < 256; y++) {
      // v = 0 at the bottom of the curtain, 1 at the top.
      const v = 1 - y / 255;
      let a;
      if (v < 0.18) a = v / 0.18;                    // soft lower falloff
      else if (v < 0.42) a = 0.55 + 0.45 * ((v - 0.18) / 0.24);
      else if (v < 0.72) a = 1.0 - 0.35 * ((v - 0.42) / 0.30);
      else a = Math.max(0, 1 - (v - 0.72) / 0.28);  // soft upper falloff
      a = Math.pow(Math.max(0, Math.min(1, a)), 1.4) * 0.8;
      for (let x = 0; x < 256; x++) {
        const i = (y * 256 + x) * 4;
        img.data[i] = 255; img.data[i + 1] = 255; img.data[i + 2] = 255;
        img.data[i + 3] = Math.round(a * 255);
      }
    }
    g.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }

  function dotTexture() {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.6)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  // One flowing curtain: a vertical strip whose path curves in plan, whose
  // centreline undulates, and whose height tapers to nothing at both ends,
  // so the ribbon never presents a straight edge to any camera.
  function buildCurtain(tex, spec) {
    const SEG = 72;
    const pos = new Float32Array((SEG + 1) * 2 * 3);
    const uv = new Float32Array((SEG + 1) * 2 * 2);
    const idx = [];
    for (let i = 0; i <= SEG; i++) {
      const u = i / SEG;
      const x = spec.x0 + (spec.x1 - spec.x0) * u;
      const z = spec.z + 300 * Math.sin(u * Math.PI * 1.35 + spec.phase)
        + 130 * Math.sin(u * Math.PI * 3.1 + spec.phase * 2.0);
      const yc = spec.y + 150 * Math.sin(u * Math.PI * 2.2 + spec.phase)
        + 65 * Math.sin(u * Math.PI * 4.7 + spec.phase * 1.3);
      // Taper: the curtain is full height mid-span and closes to a point
      // at both ends — no vertical cut edge.
      const taper = Math.pow(Math.sin(Math.PI * Math.max(0, Math.min(1, u))), 0.65);
      const half = spec.h * (0.22 + 0.78 * taper);
      const o = i * 6;
      pos[o] = x; pos[o + 1] = yc + half; pos[o + 2] = z;       // top edge
      pos[o + 3] = x; pos[o + 4] = yc - half * 1.15; pos[o + 5] = z; // bottom edge, hangs a little lower
      const uo = i * 4;
      uv[uo] = u; uv[uo + 1] = 1;
      uv[uo + 2] = u; uv[uo + 3] = 0;
      if (i < SEG) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    const mat = new THREE.MeshBasicMaterial({
      map: tex, color: spec.color, transparent: true,
      opacity: spec.opacity, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide, fog: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.baseOpacity = spec.opacity;
    mesh.userData.phase = spec.phase;
    mesh.userData.baseX = 0;
    return mesh;
  }

  function buildSky(scene, renderer) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = CONFIG.exposure;
    scene.fog = new THREE.Fog(CONFIG.fogColor, CONFIG.fogNear, CONFIG.fogFar);

    // Gradient night dome: deep blue overhead, teal toward the horizon.
    const domeCanvas = document.createElement('canvas');
    domeCanvas.width = 16; domeCanvas.height = 256;
    const dg = domeCanvas.getContext('2d');
    const grad = dg.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0.0, '#05081c');
    grad.addColorStop(0.45, '#0e2a52');
    grad.addColorStop(0.62, '#14425e');
    grad.addColorStop(0.78, '#0d2b45');
    grad.addColorStop(1.0, '#081423');
    dg.fillStyle = grad;
    dg.fillRect(0, 0, 16, 256);
    const domeTex = new THREE.CanvasTexture(domeCanvas);
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(12000, 32, 18),
      new THREE.MeshBasicMaterial({ map: domeTex, side: THREE.BackSide, fog: false }),
    );
    scene.add(dome);

    // Stars: dense everywhere, so no black patch of sky is ever empty.
    const rng = makeRng(1337);
    const starCount = 1700;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const a = rng() * Math.PI * 2;
      const e = Math.asin(rng() * 0.98 + 0.02); // 0..~80 deg elevation
      const r = 11000;
      starPos[i * 3] = Math.cos(a) * Math.cos(e) * r;
      starPos[i * 3 + 1] = Math.sin(e) * r;
      starPos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
      size: 2.4, sizeAttenuation: false, map: dotTexture(),
      color: 0xdceaff, transparent: true, opacity: 0.95,
      depthWrite: false, fog: false,
    }));
    scene.add(stars);

    // Moon: bright disc + halo, north-west and high.
    const moonPos = new THREE.Vector3(-2600, 2700, -5200);
    const moon = new THREE.Mesh(
      new THREE.CircleGeometry(190, 32),
      new THREE.MeshBasicMaterial({ color: CONFIG.moonColor, fog: false }),
    );
    moon.position.copy(moonPos);
    moon.lookAt(0, 0, 0);
    scene.add(moon);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: dotTexture(), color: 0x9db8e8, transparent: true, opacity: 0.4,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }));
    halo.position.copy(moonPos);
    halo.scale.set(1500, 1500, 1);
    scene.add(halo);

    // ---- Light rig ----
    const hemi = new THREE.HemisphereLight(CONFIG.hemiSky, CONFIG.hemiGround, 0.9);
    scene.add(hemi);

    const moonLight = new THREE.DirectionalLight(CONFIG.moonColor, CONFIG.moonIntensity);
    moonLight.position.copy(moonPos);
    moonLight.castShadow = true;
    moonLight.shadow.mapSize.set(1024, 1024);
    moonLight.shadow.camera.left = -1800;
    moonLight.shadow.camera.right = 1800;
    moonLight.shadow.camera.top = 1800;
    moonLight.shadow.camera.bottom = -1800;
    moonLight.shadow.camera.near = 100;
    moonLight.shadow.camera.far = 14000;
    moonLight.shadow.bias = -0.0006;
    scene.add(moonLight);

    // Warm fill from the SOUTH-EAST, high: it lights the tail and the
    // camera side of the Beaver in every chase shot (the tail faces
    // south). Stronger than v4's 0.65 — v6's shot 4 tail was still dark.
    fillLight = new THREE.DirectionalLight(CONFIG.fillColor, 0.9);
    fillLight.position.set(1800, 1500, 2800);
    scene.add(fillLight);

    // Green aurora bounce from the north, low — a faint green wash.
    const bounce = new THREE.DirectionalLight(CONFIG.bounceColor, CONFIG.bounceIntensity);
    bounce.position.set(-800, 260, -2800);
    scene.add(bounce);

    // ---- Aurora curtains: five overlapping, wavy, draped ribbons ----
    const tex = curtainTexture();
    // v7 round 2: opacities cut hard (round 1 blew out to white) and
    // heights trimmed so the curtains read as translucent veils, not a
    // solid wall of light. Additive stacking of five veils at 0.85 was
    // white; at ~0.3 each the green/teal/violet reads.
    const specs = [
      { color: CONFIG.auroraGreen, z: -1400, y: 1050, h: 260, x0: -2900, x1: 2900, opacity: 0.38, phase: 0.0 },
      { color: CONFIG.auroraTeal, z: -2050, y: 1250, h: 300, x0: -2900, x1: 2900, opacity: 0.36, phase: 1.3 },
      { color: CONFIG.auroraViolet, z: -950, y: 820, h: 200, x0: -2600, x1: 2600, opacity: 0.32, phase: 2.1 },
      { color: CONFIG.auroraGreen, z: -2650, y: 1450, h: 320, x0: -2900, x1: 2900, opacity: 0.25, phase: 3.7 },
      { color: CONFIG.auroraTeal, z: -620, y: 700, h: 170, x0: -2400, x1: 2400, opacity: 0.3, phase: 5.0 },
    ];
    ribbons = specs.map((s) => {
      const m = buildCurtain(tex, s);
      scene.add(m);
      return m;
    });

    // Dusk horizon glow (sortie 3 only): a warm band low in the west.
    duskGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: dotTexture(), color: 0xff9a4d, transparent: true, opacity: 0.0,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }));
    duskGlow.position.set(-4200, 260, -2600);
    duskGlow.scale.set(7200, 1500, 1);
    scene.add(duskGlow);
  }

  function setDusk(on) {
    duskOn = !!on;
    if (duskGlow) duskGlow.material.opacity = duskOn ? 0.32 : 0.0;
    if (fillLight) fillLight.intensity = duskOn ? 1.05 : 0.9;
  }

  // Pure functions of the game clock: the render is identical on every run.
  function update(_dt, clock) {
    for (const r of ribbons) {
      r.position.x = 42 * Math.sin(clock * 0.045 + r.userData.phase * 1.7);
      r.position.y = 16 * Math.sin(clock * 0.03 + r.userData.phase);
      r.material.opacity = r.userData.baseOpacity
        * (0.92 + 0.08 * Math.sin(clock * 0.11 + r.userData.phase * 2.0));
    }
  }

  return { buildSky, setDusk, update };
})();
