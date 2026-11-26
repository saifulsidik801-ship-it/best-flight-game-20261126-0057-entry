// Merapi Ring Run — sky: gradient dome shader, sun disc, drifting clouds.
// One clear job: the golden-hour light the whole scene is lit by.

const Sky = (function buildSkyModule() {
  let dome, sunMesh, sunLight, hemi, clouds = [], dusk = false;

  function buildSky(scene, renderer) {
    // Gradient dome: deep blue zenith → orange horizon, one shader, no texture.
    const geo = new THREE.SphereGeometry(6800, 32, 20);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(CONFIG.skyTop) },
        midColor: { value: new THREE.Color(CONFIG.skyMid) },
        lowColor: { value: new THREE.Color(CONFIG.skyLow) },
        sunDir: { value: new THREE.Vector3(-0.55, 0.28, -0.78).normalize() },
        sunColor: { value: new THREE.Color(CONFIG.sunColor) },
      },
      vertexShader: [
        'varying vec3 vDir;',
        'void main() { vDir = normalize(position);',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      ].join('\n'),
      fragmentShader: [
        'varying vec3 vDir;',
        'uniform vec3 topColor; uniform vec3 midColor; uniform vec3 lowColor;',
        'uniform vec3 sunDir; uniform vec3 sunColor;',
        'void main() {',
        '  float h = clamp(vDir.y, -0.08, 1.0);',
        '  vec3 col = h > 0.28 ? mix(midColor, topColor, smoothstep(0.28, 0.85, h))',
        '                     : mix(lowColor, midColor, smoothstep(-0.02, 0.28, h));',
        '  float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);',
        '  col += sunColor * (pow(s, 220.0) * 1.6 + pow(s, 18.0) * 0.55);',
        '  gl_FragColor = vec4(col, 1.0);',
        '}',
      ].join('\n'),
    });
    dome = new THREE.Mesh(geo, mat);
    scene.add(dome);

    // The sun itself: a bright disc with a soft halo sprite.
    sunMesh = new THREE.Mesh(
      new THREE.CircleGeometry(190, 32),
      new THREE.MeshBasicMaterial({ color: 0xffe9b0, fog: false }),
    );
    sunMesh.position.set(-0.55, 0.28, -0.78).multiplyScalar(6400);
    sunMesh.lookAt(0, 0, 0);
    scene.add(sunMesh);

    // Sun halo: a big soft additive glow so the sun reads as a burning disc,
    // not a flat white circle.
    const haloCanvas = document.createElement('canvas');
    haloCanvas.width = haloCanvas.height = 128;
    const hg = haloCanvas.getContext('2d');
    const hgrad = hg.createRadialGradient(64, 64, 0, 64, 64, 64);
    hgrad.addColorStop(0, 'rgba(255,230,170,0.9)');
    hgrad.addColorStop(0.4, 'rgba(255,180,90,0.35)');
    hgrad.addColorStop(1, 'rgba(255,150,60,0)');
    hg.fillStyle = hgrad; hg.fillRect(0, 0, 128, 128);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(haloCanvas), color: 0xffc46b, transparent: true,
      opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }));
    halo.position.copy(sunMesh.position);
    halo.scale.set(2600, 2600, 1);
    scene.add(halo);

    // Key light: warm, low, long shadows.
    sunLight = new THREE.DirectionalLight(CONFIG.sunColor, CONFIG.sunIntensity);
    sunLight.position.set(-2200, 1100, -3100);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(1024, 1024); // 1024, not 2048: the shadow pass is the biggest Swiftshader cost; 1024 still reads crisp at this scale
    sunLight.shadow.camera.left = -1600; sunLight.shadow.camera.right = 1600;
    sunLight.shadow.camera.top = 1600; sunLight.shadow.camera.bottom = -1600;
    sunLight.shadow.camera.far = 9000;
    sunLight.shadow.bias = -0.0004;
    scene.add(sunLight);
    scene.add(sunLight.target);

    // Warm fill from the camera/SE side: lifts every shadow-side face at
    // once (hangar cube, bridge deck, plane underside, black trees).
    // No shadows — one extra directional light is a small fragment cost.
    const fillLight = new THREE.DirectionalLight(0xffe0b0, 0.65);
    fillLight.position.set(2200, 1400, 2200);
    scene.add(fillLight);
    scene.add(fillLight.target);

    hemi = new THREE.HemisphereLight(CONFIG.hemiSky, CONFIG.hemiGround, 0.9);
    scene.add(hemi);

    scene.fog = new THREE.Fog(CONFIG.fogColor, CONFIG.fogNear, CONFIG.fogFar);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;

    buildClouds(scene);
    return { dome, sunMesh, sunLight };
  }

  function buildClouds(scene) {
    // Puffs of flattened spheres, warm-lit underneath, drifting slowly.
    const rng = makeRng(5150);
    // Unlit clouds: MeshBasicMaterial skips the per-light fragment cost of
    // MeshStandardMaterial (16 point lights made every cloud puff expensive).
    // The warm colour + opacity carry the golden-hour look on their own.
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffe8d8, transparent: true, opacity: 0.82,
    });
    const matWarm = new THREE.MeshBasicMaterial({
      color: 0xffd2b0, transparent: true, opacity: 0.78,
    });
    for (let i = 0; i < 32; i++) {
      const cloud = new THREE.Group();
      const puffs = 4 + Math.floor(rng() * 4);
      for (let p = 0; p < puffs; p++) {
        const r = 60 + rng() * 80;
        const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 10), i % 2 ? matWarm : mat);
        puff.position.set((rng() - 0.5) * 260, (rng() - 0.5) * 26, (rng() - 0.5) * 110);
        puff.scale.y = 0.42;
        cloud.add(puff);
      }
      if (i < 26) {
        cloud.position.set((rng() - 0.5) * 5200, 500 + rng() * 450, (rng() - 0.5) * 5200);
      } else if (i % 2 === 0) {
        // Cover view corridor: ahead of the cover camera, upper sky.
        cloud.position.set(650 + rng() * 350, 550 + rng() * 350, 750 + rng() * 350);
      } else {
        // Dusk view corridor: ahead of the dusk camera.
        cloud.position.set(-200 + rng() * 300, 550 + rng() * 350, 1300 + rng() * 350);
      }
      cloud.userData.drift = 2.5 + rng() * 4;
      scene.add(cloud);
      clouds.push(cloud);
    }
  }

  function setDusk(on) {
    dusk = on;
    if (!dome) return;
    const u = dome.material.uniforms;
    if (on) {
      u.topColor.value.setHex(0x1c2447);
      u.midColor.value.setHex(0x8a3d5c);
      u.lowColor.value.setHex(0xff7a3c);
      sunLight.intensity = 1.7;
      sunLight.color.setHex(0xff8a4d);
      hemi.intensity = 0.95; // dusk fill: the plane must not silhouette black
    } else {
      u.topColor.value.setHex(CONFIG.skyTop);
      u.midColor.value.setHex(CONFIG.skyMid);
      u.lowColor.value.setHex(CONFIG.skyLow);
      sunLight.intensity = CONFIG.sunIntensity;
      sunLight.color.setHex(CONFIG.sunColor);
      hemi.intensity = 0.9;
    }
  }

  function update(dt, t) {
    for (const c of clouds) {
      c.position.x += c.userData.drift * dt;
      if (c.position.x > 2800) c.position.x = -2800;
    }
    // Sun disc gently pulses with the haze.
    if (sunMesh) sunMesh.material.color.setHSL(0.09, 0.85, 0.82 + Math.sin(t * 0.4) * 0.03);
  }

  return { buildSky, setDusk, update };
})();
