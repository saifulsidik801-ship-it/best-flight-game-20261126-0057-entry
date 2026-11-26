// Aurora Ring Run v6 — polar-night sky: gradient dome, stars, moon,
// four aurora ribbons, and the light rig (moon + hemi + warm camera fill
// + green aurora bounce). The aurora is STATIC (no sway) so every render
// is deterministic.

const Sky = (function buildSkyModule() {
  let rendererRef = null;
  let ribbonMats = [];
  let duskMode = false;

  // Soft round glow texture, drawn once on a canvas (no external asset).
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

  function buildSky(scene, renderer) {
    rendererRef = renderer;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = CONFIG.exposure;
    scene.fog = new THREE.Fog(CONFIG.fogColor, CONFIG.fogNear, CONFIG.fogFar);

    // --- Gradient night dome (BackSide, no fog) ---
    const domeGeo = new THREE.SphereGeometry(7000, 28, 18);
    const domeMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      fog: false,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color(CONFIG.skyTop) },
        mid: { value: new THREE.Color(CONFIG.skyMid) },
        low: { value: new THREE.Color(CONFIG.skyLow) },
        green: { value: new THREE.Color(0x0f4a3a) },
      },
      vertexShader: [
        'varying vec3 vDir;',
        'void main() {',
        '  vDir = normalize(position);',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '}',
      ].join('\n'),
      fragmentShader: [
        'varying vec3 vDir;',
        'uniform vec3 top; uniform vec3 mid; uniform vec3 low; uniform vec3 green;',
        'void main() {',
        '  float h = clamp(vDir.y, -0.08, 1.0);',
        '  vec3 col = mix(low, mid, smoothstep(0.0, 0.28, h));',
        '  col = mix(col, top, smoothstep(0.28, 0.75, h));',
        '  float north = smoothstep(0.0, -0.6, vDir.z);',
        '  col = mix(col, green, north * smoothstep(0.22, 0.0, h) * 0.55);',
        '  gl_FragColor = vec4(col, 1.0);',
        '}',
      ].join('\n'),
    });
    scene.add(new THREE.Mesh(domeGeo, domeMat));

    // --- Stars: 700 spread over the upper dome + 300 extra in the
    // north-west sky, so no shot has a bare black corner up-left. ---
    const rng = makeRng(7);
    function starCloud(count, region) {
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const a = region === 'nw'
          ? Math.PI + rng() * Math.PI * 0.5
          : rng() * Math.PI * 2;
        const e = region === 'nw' ? 0.35 + rng() * 0.55 : 0.12 + rng() * 0.8;
        const r = 6400;
        pos[i * 3] = Math.cos(a) * Math.cos(e) * r;
        pos[i * 3 + 1] = Math.sin(e) * r;
        pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({
        color: 0xdfeaff, size: region === 'nw' ? 2.6 : 2.0,
        sizeAttenuation: false, transparent: true, opacity: 0.9, fog: false,
      });
      scene.add(new THREE.Points(geo, mat));
    }
    starCloud(700, 'all');
    starCloud(300, 'nw');

    // --- Moon: bright disc + halo, north-west so it fills the top-left
    // of the north-looking shots. The moonlight comes from this direction.
    const moonPos = new THREE.Vector3(-1800, 1500, -3400);
    const moon = new THREE.Mesh(
      new THREE.CircleGeometry(60, 32),
      new THREE.MeshBasicMaterial({ color: 0xf4f0dc, fog: false }),
    );
    moon.position.copy(moonPos);
    moon.lookAt(0, 0, 0);
    scene.add(moon);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(), color: 0xcfd8ff, transparent: true,
      opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }));
    halo.position.copy(moonPos);
    halo.scale.set(460, 460, 1);
    scene.add(halo);

    // --- Light rig (no new PointLights, no 2048 shadows) ---
    const moonLight = new THREE.DirectionalLight(CONFIG.moonColor, CONFIG.moonIntensity);
    moonLight.position.copy(moonPos).normalize().multiplyScalar(3500);
    moonLight.castShadow = true;
    moonLight.shadow.mapSize.set(1024, 1024);
    moonLight.shadow.camera.left = -1400;
    moonLight.shadow.camera.right = 1400;
    moonLight.shadow.camera.top = 1400;
    moonLight.shadow.camera.bottom = -1400;
    moonLight.shadow.camera.near = 500;
    moonLight.shadow.camera.far = 8000;
    moonLight.shadow.bias = -0.0005;
    scene.add(moonLight);
    scene.add(moonLight.target);

    scene.add(new THREE.HemisphereLight(CONFIG.hemiSky, CONFIG.hemiGround, 0.85));

    // Warm fill from the south (camera side for north-looking shots):
    // this is what keeps the Beaver's cream tail readable from behind.
    const fill = new THREE.DirectionalLight(CONFIG.fillColor, CONFIG.fillIntensity);
    fill.position.set(1500, 1200, 2500);
    scene.add(fill);
    scene.add(fill.target);

    // Green bounce from the aurora side (north, high).
    const bounce = new THREE.DirectionalLight(CONFIG.bounceColor, CONFIG.bounceIntensity);
    bounce.position.set(0, 900, -2500);
    scene.add(bounce);
    scene.add(bounce.target);

    // --- Aurora ribbons: four wide curved curtains across the northern
    // sky, overlapping so they span the full frame width from any
    // north-looking shot. Real geometry, vertex-colour gradient
    // green -> teal -> violet, fading to black at the lower edge
    // (additive blending makes black transparent). ---
    // The ribbons are the sky's CEILING: the nearest one is high (y 1150,
    // h 500) and close (z -600) so its top reaches ~29° above the horizon
    // and fills the TOP of every north-looking frame. The v6 ribbons sat
    // at y 540-860 — their tops only reached ~10°, a low band that left
    // the top third of every shot flat black. The far ribbons stack below.
    const ribbonDefs = [
      { x: 0, y: 1150, z: -600, w: 6000, h: 500, seed: 11, opacity: 0.55 },
      { x: -1400, y: 950, z: -1400, w: 6000, h: 450, seed: 23, opacity: 0.5 },
      { x: 1400, y: 800, z: -2200, w: 6000, h: 400, seed: 37, opacity: 0.55 },
      { x: 0, y: 900, z: -3000, w: 6000, h: 450, seed: 51, opacity: 0.38 },
    ];
    const green = new THREE.Color(CONFIG.auroraGreen);
    const teal = new THREE.Color(CONFIG.auroraTeal);
    const violet = new THREE.Color(CONFIG.auroraViolet);
    const black = new THREE.Color(0x000000);
    ribbonDefs.forEach((def) => {
      const geo = new THREE.PlaneGeometry(def.w, def.h, 64, 8);
      const posAttr = geo.attributes.position;
      const colors = new Float32Array(posAttr.count * 3);
      const r = makeRng(def.seed);
      const p1 = r() * 6.28, p2 = r() * 6.28, p3 = r() * 6.28;
      for (let i = 0; i < posAttr.count; i++) {
        const x = posAttr.getX(i);
        const y = posAttr.getY(i);
        const u = (x / def.w) + 0.5;          // 0..1 along the ribbon
        const v = (y / def.h) + 0.5;          // 0..1 bottom..top
        // Curtain curves: a slow sine arc plus a ripple, different per ribbon.
        posAttr.setY(i, y + Math.sin(u * 5.2 + p1) * 55 + Math.sin(u * 11.0 + p2) * 18);
        posAttr.setZ(i, Math.sin(u * 3.1 + p3) * 130);
        // Colour along the length: green -> teal -> violet.
        const c = new THREE.Color();
        if (u < 0.5) c.lerpColors(green, teal, u * 2);
        else c.lerpColors(teal, violet, (u - 0.5) * 2);
        // Fade to black at the lower edge (and a little at the top).
        const edge = Math.min(1, v / 0.45) * (0.75 + 0.25 * Math.min(1, (1 - v) / 0.25));
        c.lerp(black, 1 - edge);
        colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geo.computeVertexNormals();
      const mat = new THREE.MeshBasicMaterial({
        vertexColors: true, transparent: true, opacity: def.opacity,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        depthWrite: false, fog: false,
      });
      ribbonMats.push(mat);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(def.x, def.y, def.z);
      mesh.rotation.x = -0.12; // top leans north, like a curtain
      scene.add(mesh);
    });
  }

  // Landing-approach mode (mission 3, dusk flag): lift the exposure a touch
  // and dim the aurora slightly so the lane lights read harder.
  function setDusk(on) {
    duskMode = !!on;
    if (rendererRef) rendererRef.toneMappingExposure = duskMode ? 1.45 : CONFIG.exposure;
    ribbonMats.forEach((m) => { m.opacity = duskMode ? 0.42 : 0.55; });
  }

  // The sky is static (ribbons, stars, moon do not move) — determinism
  // first. The function exists because main.js calls Sky.update every tick.
  function update(_dt, _clock) { /* static sky */ }

  return { buildSky, update, setDusk };
})();
