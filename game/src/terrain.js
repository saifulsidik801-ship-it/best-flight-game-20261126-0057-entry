// Ashwing — valley terrain. One job: the ground the game flies over.
// An Indonesian peatland forest valley at golden-hour dusk: dark peat
// soil, moss and dry-soil patches, a lake basin, a flat town bench,
// burnt peat along the fire line, and a ring of dark ridges. Exposes
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
    // Peat mottle texture: a deterministic canvas of dark/light blotches
    // tiled 4x4 over the valley so the ground reads as textured peat at
    // every distance, not a flat colour wash. Vertex colours still ride
    // on top for the large-scale zones (burn band, shore, town dirt).
    var tc = document.createElement('canvas'); tc.width = 512; tc.height = 512;
    var tg = tc.getContext('2d');
    tg.fillStyle = '#c9c9c2'; tg.fillRect(0, 0, 512, 512);
    var trng = R.makeRng(99);
    var blotches = ['#5a6b42', '#3d4a2e', '#6b5a38', '#2e3a22', '#7a6a45', '#4a3a26', '#55663a', '#33291c'];
    for (var bi = 0; bi < 900; bi++) {
      var bx = trng() * 512, bz = trng() * 512, br = 4 + trng() * 26;
      tg.fillStyle = blotches[Math.floor(trng() * blotches.length) % blotches.length];
      tg.globalAlpha = 0.25 + trng() * 0.45;
      tg.beginPath(); tg.ellipse(bx, bz, br, br * (0.5 + trng() * 0.7), trng() * Math.PI, 0, Math.PI * 2); tg.fill();
    }
    tg.globalAlpha = 1;
    var groundTex = new THREE.CanvasTexture(tc);
    groundTex.wrapS = THREE.RepeatWrapping; groundTex.wrapT = THREE.RepeatWrapping;
    groundTex.repeat.set(4, 4);
    var pos = geo.attributes.position;
    var colors = new Float32Array(pos.count * 3);
    var cValley = [0.13, 0.20, 0.09];   // dark peat floor
    var cSlope = [0.11, 0.24, 0.10];    // mossy slope
    var cRock = [0.38, 0.32, 0.30];
    var cScorch = [0.07, 0.06, 0.05];   // burnt peat, near-black
    var cSand = [0.52, 0.44, 0.30];
    var cDry = [0.34, 0.22, 0.10];      // dry soil patches
    var cMoss = [0.05, 0.12, 0.05];     // deep moss patches
    var cDirt = [0.32, 0.26, 0.17];     // packed dirt on the town bench
    var c = [0, 0, 0];
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i), z = pos.getZ(i);
      var h = heightAt(x, z);
      pos.setY(i, h);
      var n = (noise(x * 1.7 + 5, z * 1.7 + 9) + 1) * 0.5; // 0..1 patchiness
      var n2 = (noise(x * 4.3 + 11, z * 4.3 + 7) + 1) * 0.5; // finer patchiness
      var t = R.clamp(h / 90, 0, 1);
      c[0] = R.lerp(R.lerp(cValley[0], cSlope[0], n), cRock[0], t);
      c[1] = R.lerp(R.lerp(cValley[1], cSlope[1], n), cRock[1], t);
      c[2] = R.lerp(R.lerp(cValley[2], cSlope[2], n), cRock[2], t);
      // dry-soil and deep-moss patches break the floor into peat texture
      if (n2 > 0.62) {
        var pd = R.smoothstep(0.62, 0.85, n2) * 0.85;
        c[0] = R.lerp(c[0], cDry[0], pd); c[1] = R.lerp(c[1], cDry[1], pd); c[2] = R.lerp(c[2], cDry[2], pd);
      } else if (n2 < 0.30) {
        var pm = R.smoothstep(0.30, 0.12, n2) * 0.75;
        c[0] = R.lerp(c[0], cMoss[0], pm); c[1] = R.lerp(c[1], cMoss[1], pm); c[2] = R.lerp(c[2], cMoss[2], pm);
      }
      // packed dirt on the town bench so it is not flat olive
      var tf = townFactor(x, z);
      if (tf > 0.05) {
        c[0] = R.lerp(c[0], cDirt[0], tf * 0.55); c[1] = R.lerp(c[1], cDirt[1], tf * 0.55); c[2] = R.lerp(c[2], cDirt[2], tf * 0.55);
      }
      // scorched band along the fire line, between lake and town
      var fx = x - 120, fz = z - 220;
      var fd = Math.sqrt(fx * fx + fz * fz);
      if (fd < 240 && h > 2) {
        var s = R.smoothstep(240, 80, fd) * 0.7;
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
    var mat = new THREE.MeshLambertMaterial({ vertexColors: true, map: groundTex });
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

  // Shoreline dressing: reeds and boulders ringing the lake's edge so
  // the waterline reads as a place, not a flat disc. Uses its own
  // local rng stream — the shared rng (forest / town / fires) is
  // untouched, so no other staging moves.
  function buildShore() {
    var group = new THREE.Group();
    var srng = R.makeRng(4242);
    var dummy = new THREE.Object3D();
    var reedGeo = new THREE.CylinderGeometry(0.06, 0.16, 4.2, 4);
    var reedMat = new THREE.MeshLambertMaterial({ color: 0x8a7a3a });
    var reeds = new THREE.InstancedMesh(reedGeo, reedMat, 150);
    for (var i = 0; i < 150; i++) {
      var a = srng() * Math.PI * 2;
      var rr = 0.97 + srng() * 0.08;
      var x = LAKE.x + Math.cos(a) * LAKE.rx * rr;
      var z = LAKE.z + Math.sin(a) * LAKE.rz * rr;
      var h = heightAt(x, z);
      var s = 0.7 + srng() * 0.9;
      dummy.position.set(x, Math.max(0.5, h) + 1.6 * s, z);
      dummy.scale.set(1, s, 1);
      dummy.rotation.set((srng() - 0.5) * 0.25, 0, (srng() - 0.5) * 0.25);
      dummy.updateMatrix();
      reeds.setMatrixAt(i, dummy.matrix);
    }
    reeds.instanceMatrix.needsUpdate = true;
    group.add(reeds);
    var rockGeo = new THREE.DodecahedronGeometry(1.6, 0);
    var rockMat = new THREE.MeshLambertMaterial({ color: 0x6a655e, flatShading: true });
    var rocks = new THREE.InstancedMesh(rockGeo, rockMat, 46);
    for (var j = 0; j < 46; j++) {
      var b = srng() * Math.PI * 2;
      var r2 = 0.99 + srng() * 0.07;
      var rx2 = LAKE.x + Math.cos(b) * LAKE.rx * r2;
      var rz2 = LAKE.z + Math.sin(b) * LAKE.rz * r2;
      var h2 = heightAt(rx2, rz2);
      var s2 = 0.6 + srng() * 1.6;
      dummy.position.set(rx2, Math.max(0.4, h2) + 0.4 * s2, rz2);
      dummy.scale.setScalar(s2);
      dummy.rotation.set(0, srng() * Math.PI, 0);
      dummy.updateMatrix();
      rocks.setMatrixAt(j, dummy.matrix);
    }
    rocks.instanceMatrix.needsUpdate = true;
    group.add(rocks);
    return group;
  }

  // Dusk clouds: big soft sprites high over the valley so the upper
  // frame is never flat empty sky. Own rng stream; nothing else moves.
  function buildClouds() {
    var cv = document.createElement('canvas'); cv.width = 128; cv.height = 64;
    var g = cv.getContext('2d');
    var grad = g.createRadialGradient(64, 32, 4, 64, 32, 62);
    grad.addColorStop(0, 'rgba(255,220,200,0.55)');
    grad.addColorStop(0.6, 'rgba(220,170,160,0.28)');
    grad.addColorStop(1, 'rgba(220,170,160,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 128, 64);
    var tex = new THREE.CanvasTexture(cv);
    var crng = R.makeRng(777);
    var group = new THREE.Group();
    for (var i = 0; i < 14; i++) {
      var mat = new THREE.SpriteMaterial({
        map: tex, transparent: true, opacity: 0.5 + crng() * 0.25,
        depthWrite: false, fog: false
      });
      var s = new THREE.Sprite(mat);
      var a = crng() * Math.PI * 2;
      var r = 900 + crng() * 800;
      s.position.set(Math.cos(a) * r, 260 + crng() * 160, Math.sin(a) * r);
      s.scale.set(320 + crng() * 260, 90 + crng() * 70, 1);
      group.add(s);
    }
    return group;
  }

  // Kabut asap: a few low grey-brown haze sheets far out on the horizon
  // so the far forest fades into smoke instead of ending in a hard line.
  // Kept far (900 m+) and high so they never drift into the foreground
  // as blobs. Own rng stream; nothing else moves.
  function buildHaze() {
    var cv = document.createElement('canvas'); cv.width = 128; cv.height = 64;
    var g = cv.getContext('2d');
    var grad = g.createRadialGradient(64, 32, 4, 64, 32, 62);
    grad.addColorStop(0, 'rgba(168,132,108,0.30)');
    grad.addColorStop(0.6, 'rgba(150,116,96,0.15)');
    grad.addColorStop(1, 'rgba(150,116,96,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 128, 64);
    var tex = new THREE.CanvasTexture(cv);
    var hrng = R.makeRng(31337);
    var group = new THREE.Group();
    for (var i = 0; i < 6; i++) {
      var mat = new THREE.SpriteMaterial({
        map: tex, transparent: true, opacity: 0.35 + hrng() * 0.2,
        depthWrite: false, fog: false
      });
      var s = new THREE.Sprite(mat);
      var a = hrng() * Math.PI * 2;
      var r = 900 + hrng() * 700;
      s.position.set(Math.cos(a) * r, 120 + hrng() * 80, Math.sin(a) * r);
      s.scale.set(300 + hrng() * 200, 50 + hrng() * 30, 1);
      group.add(s);
    }
    return group;
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
    buildTerrainMesh: buildTerrainMesh, buildLakeMesh: buildLakeMesh, buildShore: buildShore,
    buildGlintMesh: buildGlintMesh, buildClouds: buildClouds, buildHaze: buildHaze, buildSkyDome: buildSkyDome,
    buildSunDisc: buildSunDisc, buildRidgeRing: buildRidgeRing,
    buildLights: buildLights
  };
})(typeof window !== 'undefined' ? window : globalThis);
