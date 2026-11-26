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

    // Key light: warm, low, long shadows.
    sunLight = new THREE.DirectionalLight(CONFIG.sunColor, CONFIG.sunIntensity);
    sunLight.position.set(-2200, 1100, -3100);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.left = -1600; sunLight.shadow.camera.right = 1600;
    sunLight.shadow.camera.top = 1600; sunLight.shadow.camera.bottom = -1600;
    sunLight.shadow.camera.far = 9000;
    sunLight.shadow.bias = -0.0004;
    scene.add(sunLight);
    scene.add(sunLight.target);

    hemi = new THREE.HemisphereLight(CONFIG.hemiSky, CONFIG.hemiGround, 0.75);
    scene.add(hemi);

    scene.fog = new THREE.Fog(CONFIG.fogColor, CONFIG.fogNear, CONFIG.fogFar);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;

    buildClouds(scene);
    return { dome, sunMesh, sunLight };
  }

  function buildClouds(scene) {
    // Puffs of flattened spheres, warm-lit underneath, drifting slowly.
    const rng = makeRng(5150);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffe8d8, transparent: true, opacity: 0.82, roughness: 1,
      emissive: 0xff9a50, emissiveIntensity: 0.28,
    });
    for (let i = 0; i < 26; i++) {
      const cloud = new THREE.Group();
      const puffs = 4 + Math.floor(rng() * 4);
      for (let p = 0; p < puffs; p++) {
        const r = 34 + rng() * 46;
        const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 10), mat);
        puff.position.set((rng() - 0.5) * 220, (rng() - 0.5) * 22, (rng() - 0.5) * 90);
        puff.scale.y = 0.42;
        cloud.add(puff);
      }
      cloud.position.set((rng() - 0.5) * 5200, 520 + rng() * 320, (rng() - 0.5) * 5200);
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
      sunLight.intensity = 1.5;
      sunLight.color.setHex(0xff8a4d);
      hemi.intensity = 0.45;
    } else {
      u.topColor.value.setHex(CONFIG.skyTop);
      u.midColor.value.setHex(CONFIG.skyMid);
      u.lowColor.value.setHex(CONFIG.skyLow);
      sunLight.intensity = CONFIG.sunIntensity;
      sunLight.color.setHex(CONFIG.sunColor);
      hemi.intensity = 0.75;
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
