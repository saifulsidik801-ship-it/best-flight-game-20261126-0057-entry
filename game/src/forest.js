// Ashwing — forest and town. One job: fill the valley so no shot is
// ever empty. ~2,200 instanced pines on the slopes, a scorched stand
// along the fire line, and the lit town of Cedar Falls with houses,
// glowing windows, fire trucks and a water tower.
(function (global) {
  'use strict';
  var R = global.AshRng;
  var T = global.AshTerrain;

  // Deterministic 0..1 hash of a ground position — variety without
  // consuming the shared rng, so town / fire placement never moves.
  function hash01(x, z) {
    var s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
    return s - Math.floor(s);
  }

  function scatterPositions(rng, count, accept) {
    var out = [];
    var guard = 0;
    while (out.length < count && guard < count * 40) {
      guard++;
      var x = R.range(rng, -1150, 1150), z = R.range(rng, -1150, 1150);
      if (accept(x, z)) out.push([x, z]);
    }
    return out;
  }

  function buildForest(rng) {
    var group = new THREE.Group();
    var dummy = new THREE.Object3D();
    var col = new THREE.Color();

    // Live pines: trunk + foliage as two InstancedMeshes.
    var spots = scatterPositions(rng, 3200, function (x, z) {
      if (T.isOverLake(x, z)) return false;
      var dx = x - T.TOWN.x, dz = z - T.TOWN.z;
      if (dx * dx + dz * dz < T.TOWN.r * T.TOWN.r * 1.15) return false;
      var h = T.heightAt(x, z);
      return h > 2 && h < 120;
    });
    var trunkGeo = new THREE.CylinderGeometry(0.5, 0.8, 5, 5);
    var trunkMat = new THREE.MeshLambertMaterial({ color: 0x4a3220 });
    var trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
    var folGeo = new THREE.ConeGeometry(4.0, 14, 6);
    var folMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    var fols = new THREE.InstancedMesh(folGeo, folMat, spots.length);
    for (var i = 0; i < spots.length; i++) {
      var x = spots[i][0], z = spots[i][1];
      var h = T.heightAt(x, z);
      var s = R.range(rng, 0.8, 1.7);
      dummy.position.set(x, h + 2.2 * s, z);
      dummy.scale.setScalar(s); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x, h + (5 + 6.5) * s * 0.5 + 2.5 * s, z);
      // varied silhouettes: some tall and thin, some short and wide —
      // no more rows of identical cones.
      var hh = hash01(x, z), hh2 = hash01(z, x);
      dummy.scale.set(s * (0.75 + 0.5 * hh), s * (0.85 + 0.6 * hh2), s * (0.75 + 0.5 * hh));
      dummy.rotation.set(0, R.range(rng, 0, 6.28), 0); dummy.updateMatrix();
      fols.setMatrixAt(i, dummy.matrix);
      var g = R.range(rng, 0.9, 1.35);
      if (hh < 0.16) col.setRGB(0.48 * g, 0.30 * g, 0.09 * g);       // autumn orange
      else if (hh < 0.30) col.setRGB(0.38 * g, 0.40 * g, 0.10 * g);  // yellow-green
      else col.setRGB(0.13 * g, 0.32 * g, 0.11 * g);
      fols.setColorAt(i, col);
    }
    trunks.instanceMatrix.needsUpdate = true;
    fols.instanceMatrix.needsUpdate = true;
    if (fols.instanceColor) fols.instanceColor.needsUpdate = true;
    group.add(trunks); group.add(fols);

    // Scorched stand along the fire line: black skeletons.
    var scorch = scatterPositions(rng, 170, function (x, z) {
      var fx = x - 120, fz = z - 220;
      return (fx * fx + fz * fz) < 260 * 260 && T.heightAt(x, z) > 2;
    });
    var scGeo = new THREE.ConeGeometry(2.2, 11, 5);
    var scMat = new THREE.MeshLambertMaterial({ color: 0x14100e });
    var sc = new THREE.InstancedMesh(scGeo, scMat, Math.max(scorch.length, 1));
    for (var j = 0; j < scorch.length; j++) {
      var sx = scorch[j][0], sz = scorch[j][1];
      var sh = T.heightAt(sx, sz);
      var ss = R.range(rng, 0.8, 1.5);
      dummy.position.set(sx, sh + 5 * ss, sz);
      dummy.scale.setScalar(ss); dummy.rotation.set(0, R.range(rng, 0, 6.28), R.range(rng, -0.08, 0.08));
      dummy.updateMatrix();
      sc.setMatrixAt(j, dummy.matrix);
    }
    sc.instanceMatrix.needsUpdate = true;
    group.add(sc);
    return group;
  }

  function buildTown(rng) {
    var group = new THREE.Group();
    var cx = T.TOWN.x, cz = T.TOWN.z;
    var wallCols = [0xd8c9a8, 0xc9a17a, 0xb8b0a0, 0xa87f6a, 0xd0b890];
    var roofCols = [0x7a3a2a, 0x4a4a52, 0x5d3a2e, 0x37424e];
    var winGeo = new THREE.PlaneGeometry(1.6, 1.2);
    var winMat = new THREE.MeshBasicMaterial({ color: 0xffc46b });
    var windows = [];
    var n = 24;
    for (var i = 0; i < n; i++) {
      var a = rng() * Math.PI * 2;
      var r = Math.sqrt(rng()) * (T.TOWN.r * 0.82);
      var x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      var h = T.heightAt(x, z);
      var w = R.range(rng, 7, 11), d = R.range(rng, 6, 9), ht = R.range(rng, 4, 6.5);
      var house = new THREE.Group();
      house.position.set(x, h, z);
      house.rotation.y = R.range(rng, 0, Math.PI);
      var walls = new THREE.Mesh(
        new THREE.BoxGeometry(w, ht, d),
        new THREE.MeshLambertMaterial({ color: R.pick(rng, wallCols) })
      );
      walls.position.set(0, ht / 2, 0);
      house.add(walls);
      var roof = new THREE.Mesh(
        new THREE.ConeGeometry(Math.max(w, d) * 0.78, R.range(rng, 2.2, 3.4), 4),
        new THREE.MeshLambertMaterial({ color: R.pick(rng, roofCols) })
      );
      roof.position.set(0, ht + 1.2, 0);
      roof.rotation.y = Math.PI / 4;
      house.add(roof);
      // two lit windows on the street-facing side
      for (var k = 0; k < 2; k++) {
        var win = new THREE.Mesh(winGeo, winMat);
        win.position.set((k === 0 ? -1 : 1) * w * 0.22, ht * 0.55, d / 2 + 0.06);
        windows.push(win);
        house.add(win);
      }
      group.add(house);
    }
    // Church with steeple at the town green.
    var ch = new THREE.Mesh(new THREE.BoxGeometry(12, 8, 9), new THREE.MeshLambertMaterial({ color: 0xe8e0cc }));
    ch.position.set(cx - 20, T.heightAt(cx - 20, cz + 30) + 4, cz + 30);
    group.add(ch);
    var st = new THREE.Mesh(new THREE.ConeGeometry(3.4, 9, 4), new THREE.MeshLambertMaterial({ color: 0x5d3a2e }));
    st.position.set(cx - 20, T.heightAt(cx - 20, cz + 30) + 12, cz + 30);
    st.rotation.y = Math.PI / 4;
    group.add(st);

    // Water tower.
    var tw = new THREE.Group();
    var legMat = new THREE.MeshLambertMaterial({ color: 0x5a5a60 });
    for (var l = 0; l < 4; l++) {
      var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 12, 5), legMat);
      leg.position.set((l % 2 ? 2.4 : -2.4), 6, (l < 2 ? 2.4 : -2.4));
      tw.add(leg);
    }
    var tank = new THREE.Mesh(new THREE.SphereGeometry(4.2, 10, 8), new THREE.MeshLambertMaterial({ color: 0xc8ccd0 }));
    tank.scale.y = 0.85; tank.position.y = 13.5;
    tw.add(tank);
    tw.position.set(cx + 60, T.heightAt(cx + 60, cz - 70), cz - 70);
    group.add(tw);

    // Roads: dark strips crossing the bench.
    var roadMat = new THREE.MeshLambertMaterial({ color: 0x2e2a28 });
    var r1 = new THREE.Mesh(new THREE.PlaneGeometry(T.TOWN.r * 2, 9), roadMat);
    r1.rotation.x = -Math.PI / 2; r1.rotation.z = 0.3;
    r1.position.set(cx, 12.35, cz);
    group.add(r1);
    var r2 = new THREE.Mesh(new THREE.PlaneGeometry(9, T.TOWN.r * 2), roadMat);
    r2.rotation.x = -Math.PI / 2; r2.rotation.z = 0.3;
    r2.position.set(cx, 12.35, cz);
    group.add(r2);

    // Fire trucks: red body + cab + blinking light bar.
    var trucks = [];
    for (var t = 0; t < 3; t++) {
      var truck = new THREE.Group();
      var body = new THREE.Mesh(new THREE.BoxGeometry(6.5, 2.6, 2.6), new THREE.MeshLambertMaterial({ color: 0xc1272d }));
      body.position.y = 1.6; truck.add(body);
      var cab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 2.5), new THREE.MeshLambertMaterial({ color: 0xa02025 }));
      cab.position.set(4.2, 1.4, 0); truck.add(cab);
      var barMat = new THREE.MeshBasicMaterial({ color: 0xff2a1e });
      var bar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.9), barMat);
      bar.position.set(4.2, 2.8, 0); truck.add(bar);
      truck.userData.barMat = barMat;
      var tx = cx + R.range(rng, -90, 90), tz = cz + R.range(rng, -90, 90);
      truck.position.set(tx, T.heightAt(tx, tz) + 0.3, tz);
      truck.rotation.y = R.range(rng, 0, Math.PI * 2);
      group.add(truck);
      trucks.push(truck);
    }
    group.userData.trucks = trucks;
    group.userData.windows = windows;
    return group;
  }

  global.AshForest = { buildForest: buildForest, buildTown: buildTown };
})(typeof window !== 'undefined' ? window : globalThis);
