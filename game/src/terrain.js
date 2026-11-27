// Ashwing — valley terrain. One job: the ground the game flies over.
// A pine-forest valley at golden-hour dusk: a lake basin, a flat town
// bench, fire-line clearings, and a ring of dark ridges. Exposes
// AshTerrain.heightAt(x, z) so physics, fires and the camera all agree
// on where the ground is.
(function (global) {
  'use strict';
  var R = global.AshRng;

  var WORLD = 2400;                 // world is WORLD x WORLD metres
  var LAKE = { x: -520, z: -260, rx: 480, rz: 380 };
  var TOWN = { x: 480, z: 300, r: 170 };
  var WATER_Y = 0;

  var noise = R.makeNoise(1337);

  function lakeFactor(x, z) {
    var dx = (x - LAKE.x) / LAKE.rx, dz = (z - LAKE.z) / LAKE.rz;
    var d = Math.sqrt(dx * dx + dz * dz);
    return R.smoothstep(1.0, 0.55, d); // 1 deep inside the lake
  }

  function townFactor(x, z) {
    var dx = x - TOWN.x, dz = z - TOWN.z;
    var d = Math.sqrt(dx * dx + dz * dz);
    return R.smoothstep(TOWN.r, TOWN.r * 0.45, d); // 1 on the town bench
  }

  function heightAt(x, z) {
    var h = 14 + noise(x, z) * 26;
    var edge = Math.max(Math.abs(x), Math.abs(z)) / (WORLD / 2);
    h += R.smoothstep(0.72, 1.0, edge) * 150;      // rim ridges
    h -= lakeFactor(x, z) * 26;                     // lake basin dips below 0
    h = R.lerp(h, 12, townFactor(x, z));            // flat town bench
    return h;
  }

  function isOverLake(x, z) { return lakeFactor(x, z) > 0.45; }

  function buildTerrainMesh() {
    var seg = 96;
    var geo = new THREE.PlaneGeometry(WORLD, WORLD, seg, seg);
    geo.rotateX(-Math.PI / 2);
    var pos = geo.attributes.position;
    var colors = new Float32Array(pos.count * 3);
    var cValley = [0.18, 0.38, 0.13];
    var cSlope = [0.15, 0.32, 0.11];
    var cRock = [0.42, 0.34, 0.32];
    var cScorch = [0.12, 0.10, 0.09];
    var cSand = [0.52, 0.44, 0.30];
    var c = [0, 0, 0];
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i), z = pos.getZ(i);
      var h = heightAt(x, z);
      pos.setY(i, h);
      var n = (noise(x * 1.7 + 5, z * 1.7 + 9) + 1) * 0.5; // 0..1 patchiness
      var t = R.clamp(h / 90, 0, 1);
      c[0] = R.lerp(R.lerp(cValley[0], cSlope[0], n), cRock[0], t);
      c[1] = R.lerp(R.lerp(cValley[1], cSlope[1], n), cRock[1], t);
      c[2] = R.lerp(R.lerp(cValley[2], cSlope[2], n), cRock[2], t);
      // scorched band along the fire line, between lake and town
      var fx = x - 120, fz = z - 220;
      var fd = Math.sqrt(fx * fx + fz * fz);
      if (fd < 200 && h > 2) {
        var s = R.smoothstep(200, 70, fd) * 0.6;
        c[0] = R.lerp(c[0], cScorch[0], s); c[1] = R.lerp(c[1], cScorch[1], s); c[2] = R.lerp(c[2], cScorch[2], s);
      }
      // sandy shore ring around the lake
      var lf = lakeFactor(x, z);
      if (lf > 0.02 && lf < 0.55 && h > -1) {
        var sh = R.smoothstep(0.55, 0.3, lf) * R.smoothstep(0.02, 0.2, lf);
        c[0] = R.lerp(c[0], cSand[0], sh * 0.7); c[1] = R.lerp(c[1], cSand[1], sh * 0.7); c[2] = R.lerp(c[2], cSand[2], sh * 0.7);
      }
      colors[i * 3] = c[0]; colors[i * 3 + 1] = c[1]; colors[i * 3 + 2] = c[2];
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    var mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    return new THREE.Mesh(geo, mat);
  }

  function buildLakeMesh() {
    var geo = new THREE.CircleGeometry(1, 48);
    geo.rotateX(-Math.PI / 2);
    var mat = new THREE.MeshPhongMaterial({
      color: 0x2e4a44, specular: 0xff9a4a, shininess: 140,
      transparent: true, opacity: 0.94
    });
    var m = new THREE.Mesh(geo, mat);
    m.scale.set(LAKE.rx, 1, LAKE.rz);
    m.position.set(LAKE.x, WATER_Y, LAKE.z);
    return m;
  }

  // Sun glint: a long bright streak on the water toward the low sun.
  function buildGlintMesh() {
    var geo = new THREE.PlaneGeometry(700, 46);
    geo.rotateX(-Math.PI / 2);
    var mat = new THREE.MeshBasicMaterial({
      color: 0xffb36b, transparent: true, opacity: 0.28,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    var m = new THREE.Mesh(geo, mat);
    m.position.set(LAKE.x + 60, WATER_Y + 0.4, LAKE.z);
    m.rotation.y = 0.5;
    return m;
  }

  function buildSkyDome() {
    var geo = new THREE.SphereGeometry(3200, 24, 14);
    var mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        top: { value: new THREE.Color(0x2a2140) },
        mid: { value: new THREE.Color(0x7a4a52) },
        low: { value: new THREE.Color(0xff7a2a) }
      },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 low;' +
        'void main(){ float h = normalize(vP).y;' +
        ' vec3 c = h > 0.25 ? mix(mid, top, smoothstep(0.25, 0.85, h)) : mix(low, mid, smoothstep(-0.05, 0.25, h));' +
        ' gl_FragColor = vec4(c, 1.0); }'
    });
    return new THREE.Mesh(geo, mat);
  }

  function buildSunDisc() {
    var cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
    var g = cv.getContext('2d');
    var grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,240,200,1)');
    grad.addColorStop(0.25, 'rgba(255,190,90,0.95)');
    grad.addColorStop(0.6, 'rgba(255,110,30,0.35)');
    grad.addColorStop(1, 'rgba(255,110,30,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
    var tex = new THREE.CanvasTexture(cv);
    var mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false });
    var s = new THREE.Sprite(mat);
    s.scale.set(520, 520, 1);
    s.position.set(1500, 170, 1300);
    return s;
  }

  function buildRidgeRing(rng) {
    var group = new THREE.Group();
    var mat = new THREE.MeshLambertMaterial({ color: 0x2f2536, flatShading: true });
    var mat2 = new THREE.MeshLambertMaterial({ color: 0x3d2f45, flatShading: true });
    for (var i = 0; i < 12; i++) {
      var a = (i / 12) * Math.PI * 2 + R.range(rng, -0.15, 0.15);
      var r = R.range(rng, 1500, 1850);
      var h = R.range(rng, 260, 520);
      var w = R.range(rng, 420, 700);
      var cone = new THREE.Mesh(new THREE.ConeGeometry(w, h, 5), i % 2 ? mat : mat2);
      cone.position.set(Math.cos(a) * r, h * 0.28, Math.sin(a) * r);
      cone.rotation.y = R.range(rng, 0, Math.PI);
      group.add(cone);
    }
    return group;
  }

  function buildLights() {
    var group = new THREE.Group();
    var sun = new THREE.DirectionalLight(0xffb36b, 1.35);
    sun.position.set(900, 240, 900);
    group.add(sun);
    group.add(new THREE.AmbientLight(0x8a76a0, 1.0));
    var fireGlow = new THREE.PointLight(0xff6a1e, 2.2, 900, 1.6);
    fireGlow.position.set(120, 60, 220);
    group.add(fireGlow);
    group.userData.fireGlow = fireGlow;
    return group;
  }

  global.AshTerrain = {
    WORLD: WORLD, LAKE: LAKE, TOWN: TOWN, WATER_Y: WATER_Y,
    heightAt: heightAt, isOverLake: isOverLake,
    buildTerrainMesh: buildTerrainMesh, buildLakeMesh: buildLakeMesh,
    buildGlintMesh: buildGlintMesh, buildSkyDome: buildSkyDome,
    buildSunDisc: buildSunDisc, buildRidgeRing: buildRidgeRing,
    buildLights: buildLights
  };
})(typeof window !== 'undefined' ? window : globalThis);
