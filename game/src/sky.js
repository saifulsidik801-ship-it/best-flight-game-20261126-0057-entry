// Aurora Ring Run — polar night sky: gradient dome, stars, moon, aurora.
// One clear job: make the sky the spectacle, so no shot ever has a flat patch.
//
// Shared helper: makeGlowSprite(color, scale) is a global used by terrain,
// life, aircraft and rings too — it is defined here because the sky owns
// light, and boot() runs after every script has parsed.

// JS smoothstep (the dome shader has its own built-in — this one is for
// the aurora ribbon vertex colours).
function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

let _glowTex = null;
function makeGlowTexture() {
  if (_glowTex) return _glowTex;
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  _glowTex = new THREE.CanvasTexture(c);
  return _glowTex;
}

function makeGlowSprite(color, scale) {
  const mat = new THREE.SpriteMaterial({
    map: makeGlowTexture(), color: color, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  const s = new THREE.Sprite(mat);
  s.scale.set(scale, scale, 1);
  return s;
}

const Sky = (function buildSkyModule() {
  let ribbons = [];
  let ribbonMats = [];
  let rendererRef = null;
  let duskMode = false;

  // Curved ribbon: a plane bent into a long arc, vertex colours fading
  // green -> teal -> violet along its length and to black at the lower edge
  // (additive blending makes black transparent, so the ribbon has no edge).
  function buildRibbon(seed, x, y, z, rotY, len, hgt) {
    const geo = new THREE.PlaneGeometry(len, hgt, 48, 8);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const cGreen = new THREE.Color(0x39ff88);
    const cTeal = new THREE.Color(0x2ad4c4);
    const cViolet = new THREE.Color(0x7a4dff);
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i);
      const py = pos.getY(i);
      const u = (px / len) + 0.5;           // 0..1 along the ribbon
      const v = (py / hgt) + 0.5;           // 0..1 bottom..top
      // Bend the ribbon: a slow sine arc in height plus a bow in depth.
      pos.setY(i, py + Math.sin(u * Math.PI) * 90 + Math.sin(u * Math.PI * 2.3 + seed) * 34);
      pos.setZ(i, Math.sin(u * Math.PI * 1.6 + seed * 0.7) * 160);
      // Colour: green -> teal -> violet along the length, fading to black
      // at the bottom edge so the ribbon dissolves into the sky.
      if (u < 0.5) tmp.lerpColors(cGreen, cTeal, u * 2);
      else tmp.lerpColors(cTeal, cViolet, (u - 0.5) * 2);
      const edge = 0.15 + 0.85 * Math.pow(v, 1.4);
      // Ragged lower edge: the ribbon frays instead of ending in a line.
      const fray = 0.55 + 0.45 * Math.sin(u * 31 + seed * 3.0);
      // Curtain rays: brightness varies rapidly along the ribbon, so it
      // reads as a rippling curtain of light, not a flat band.
      const rays = 0.62 + 0.38 * Math.sin(u * 47 + seed * 1.3) * Math.sin(u * 13 + seed);
      // Dissolve both ends so no ribbon ends in a hard vertical edge.
      const endFade = smoothstep(0.0, 0.12, u) * (1 - smoothstep(0.88, 1.0, u));
      const a = edge * fray * rays * endFade;
      colors[i * 3] = tmp.r * a;
      colors[i * 3 + 1] = tmp.g * a;
      colors[i * 3 + 2] = tmp.b * a;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      depthWrite: false, fog: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    // Face the play area: ribbons hang in the northern sky, tilted so the
    // pilot under them sees their full face, not their edge.
    mesh.rotation.x = -0.18;
    ribbonMats.push(mat);
    return mesh;
  }

  function buildStars(scene) {
    const rng = makeRng(4242);
    const count = 900;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Upper hemisphere of the dome, biased away from the horizon so the
      // stars read over the aurora instead of behind the terrain.
      const theta = rng() * Math.PI * 2;
      const phi = Math.acos(1 - rng() * 0.82); // 0..~1.2 rad from zenith
      const r = 6600;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi) + 150;
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xdceaff, size: 2.2, sizeAttenuation: false,
      transparent: true, opacity: 0.9, fog: false,
    });
    const stars = new THREE.Points(geo, mat);
    scene.add(stars);
  }

  function buildSky(scene, renderer) {
    rendererRef = renderer;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = CONFIG.exposure;
    scene.fog = new THREE.Fog(CONFIG.fogColor, CONFIG.fogNear, CONFIG.fogFar);

    // Night gradient dome: deep indigo overhead, blue mid-sky, a faint
    // green band low on the horizon where the aurora lives.
    const domeGeo = new THREE.SphereGeometry(7000, 32, 16);
    const domeMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, fog: false, depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color(CONFIG.skyTop) },
        mid: { value: new THREE.Color(CONFIG.skyMid) },
        low: { value: new THREE.Color(CONFIG.skyLow) },
        green: { value: new THREE.Color(0x0f4a3a) },
      },
      vertexShader: 'varying vec3 vPos; void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: [
        'varying vec3 vPos;',
        'uniform vec3 top; uniform vec3 mid; uniform vec3 low; uniform vec3 green;',
        'void main() {',
        '  float h = normalize(vPos).y;',
        '  vec3 col = h > 0.22 ? mix(mid, top, smoothstep(0.22, 0.85, h)) : mix(low, mid, smoothstep(-0.05, 0.22, h));',
        '  col = mix(col, green, smoothstep(0.22, 0.02, h) * 0.35);',
        '  gl_FragColor = vec4(col, 1.0);',
        '}',
      ].join('\n'),
    });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    scene.add(dome);

    buildStars(scene);

    // Moon: a bright disc + a wide halo, high in the north-west, and the
    // directional light comes from exactly that direction.
    const moonDir = new THREE.Vector3(-0.42, 0.55, -0.72).normalize();
    const moonPos = moonDir.clone().multiplyScalar(6200);
    const moon = new THREE.Mesh(
      new THREE.CircleGeometry(110, 32),
      new THREE.MeshBasicMaterial({ color: 0xf4f0dc, fog: false }),
    );
    moon.position.copy(moonPos);
    moon.lookAt(0, 0, 0);
    scene.add(moon);
    const halo = makeGlowSprite(0xcfd8ff, 620);
    halo.position.copy(moonPos);
    scene.add(halo);

    // Aurora ribbons — four of them, TALL curtains (260-320 m) hung high
    // in the northern sky so the top half of every frame has structure.
    // They stay near-facing (small rotY) so the pilot sees their full
    // face, not their edge. All static: determinism beats a sway nobody
    // would notice at screenshot scale.
    const ribbonDefs = [
      { seed: 11, x: -900, y: 820, z: -2300, rotY: 0.2, len: 1500, hgt: 300 },
      { seed: 23, x: 350, y: 900, z: -2600, rotY: -0.12, len: 1700, hgt: 320 },
      { seed: 37, x: -1900, y: 760, z: -1800, rotY: 0.3, len: 1300, hgt: 260 },
      { seed: 51, x: 1400, y: 800, z: -2100, rotY: -0.25, len: 1400, hgt: 280 },
    ];
    ribbons = ribbonDefs.map((d) => {
      const r = buildRibbon(d.seed, d.x, d.y, d.z, d.rotY, d.len, d.hgt);
      scene.add(r);
      return r;
    });

    // Lights — no PointLights, no 2048 shadows. The moon casts (1024, as
    // v4); everything else is shadowless fill.
    const moonLight = new THREE.DirectionalLight(CONFIG.moonColor, CONFIG.moonIntensity);
    moonLight.position.copy(moonDir).multiplyScalar(3000);
    moonLight.castShadow = true;
    moonLight.shadow.mapSize.set(1024, 1024);
    moonLight.shadow.camera.left = -1800;
    moonLight.shadow.camera.right = 1800;
    moonLight.shadow.camera.top = 1800;
    moonLight.shadow.camera.bottom = -1800;
    moonLight.shadow.camera.near = 500;
    moonLight.shadow.camera.far = 7000;
    scene.add(moonLight);
    scene.add(moonLight.target);

    const hemiLight = new THREE.HemisphereLight(CONFIG.hemiSky, CONFIG.hemiGround, 0.85);
    scene.add(hemiLight);

    // Warm camera-side fill: the v4 lesson — without it the plane's camera
    // side crushes to a black silhouette at night.
    const fill = new THREE.DirectionalLight(CONFIG.fillColor, CONFIG.fillIntensity);
    fill.position.set(1800, 1200, 2200);
    scene.add(fill);

    // Green bounce from the aurora side: tints the snow and the plane's
    // upper surfaces so the night reads aurora-lit, not just moonlit.
    const bounce = new THREE.DirectionalLight(CONFIG.bounceColor, CONFIG.bounceIntensity);
    bounce.position.set(-1500, 1800, -2000);
    scene.add(bounce);
  }

  // Landing-approach mode (mission 3, dusk flag): dim the aurora a touch
  // so the runway lights own the frame, lift the exposure a notch.
  function setDusk(on) {
    duskMode = !!on;
    if (rendererRef) rendererRef.toneMappingExposure = duskMode ? 1.45 : CONFIG.exposure;
    ribbonMats.forEach((m) => { m.opacity = duskMode ? 0.42 : 0.55; });
  }

  // The night is static by design — ribbons, stars and moon do not move,
  // so every screenshot is reproducible. Kept because main.js calls it.
  function update(dt, clock) {}

  return { buildSky, update, setDusk };
})();
