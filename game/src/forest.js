// Ashwing — peatland forest and town. One job: fill the valley so no
// shot is ever empty, and make it read as a real Indonesian peatland
// forest (karhutla country), not a toy cone plantation. Four tree
// archetypes on four InstancedMeshes, all seeded and deterministic:
// broadleaf canopy trees (trunk + 3 canopy blobs), tiered pines,
// palms with drooping fronds, and undergrowth bushes + grass tufts.
// A scorched stand of bare black trunks lines the fire line, and the
// lit town of Rimba Jaya sits on its bench with a mosque, houses,
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

    // --- shared accept rules ---
    function inValley(x, z, maxH) {
      if (T.isOverLake(x, z)) return false;
      var dx = x - T.TOWN.x, dz = z - T.TOWN.z;
      if (dx * dx + dz * dz < T.TOWN.r * T.TOWN.r * 1.15) return false;
      var h = T.heightAt(x, z);
      return h > 2 && h < maxH;
    }

    // --- instance buffers (filled below, then baked into meshes) ---
    var blobMat = [];   // {x,y,z,sx,sy,sz,ry,r,g,b}
    var trunkMat = [];  // {x,y,z,sx,sy,sz,ry,lean,r,g,b}
    var coneMat = [];   // {x,y,z,sx,sy,sz,ry,r,g,b}
    var frondMat = [];  // {x,y,z,sx,sy,sz,ry,rz,r,g,b}

    // Peat greens: deep, dark, mossy — never lime, never flat.
    var greens = [
      [0.06, 0.17, 0.05], [0.08, 0.21, 0.06], [0.11, 0.26, 0.08],
      [0.15, 0.28, 0.09], [0.09, 0.19, 0.10], [0.13, 0.24, 0.07]
    ];
    function greenColor(x, z, warm) {
      var hh = hash01(x, z), hh2 = hash01(z * 1.7, x * 1.3);
      var g = greens[Math.floor(hh2 * greens.length) % greens.length];
      var m = 0.8 + hh * 0.45;
      if (warm && hh < 0.14) return [0.30 * m, 0.24 * m, 0.08 * m]; // dusk-lit edge
      return [g[0] * m, g[1] * m, g[2] * m];
    }
    function trunkColor(x, z) {
      var hh = hash01(x * 2.1, z * 1.9);
      var m = 0.75 + hh * 0.5;
      return [0.22 * m, 0.14 * m, 0.08 * m];
    }

    // --- 1. Broadleaf canopy trees: trunk + 3 overlapping blobs ---
    var canopy = scatterPositions(rng, 1150, function (x, z) { return inValley(x, z, 120); });
    for (var i = 0; i < canopy.length; i++) {
      var cx = canopy[i][0], cz = canopy[i][1];
      var ch = T.heightAt(cx, cz);
      var s = R.range(rng, 0.9, 1.8);
      var trunkH = R.range(rng, 6, 10) * s;
      var tc = trunkColor(cx, cz);
      trunkMat.push({ x: cx, y: ch + trunkH * 0.5, z: cz, sx: 0.9 * s, sy: trunkH, sz: 0.9 * s, ry: R.range(rng, 0, 6.28), lean: 0, r: tc[0], g: tc[1], b: tc[2] });
      // main crown blob + two side blobs — a lumpy canopy, not a cone
      var topY = ch + trunkH + 1.5 * s;
      var blobs = [
        { dx: 0, dy: 0, dz: 0, r: R.range(rng, 4.6, 6.8) },
        { dx: R.range(rng, -3.4, -1.8), dy: -1.6, dz: R.range(rng, -2, 2), r: R.range(rng, 3.0, 4.4) },
        { dx: R.range(rng, 1.8, 3.4), dy: -1.2, dz: R.range(rng, -2, 2), r: R.range(rng, 3.0, 4.4) }
      ];
      for (var b = 0; b < blobs.length; b++) {
        var bl = blobs[b];
        var bc = greenColor(cx + bl.dx * 7, cz + bl.dz * 7, true);
        blobMat.push({
          x: cx + bl.dx * s, y: topY + bl.dy * s, z: cz + bl.dz * s,
          sx: bl.r * s, sy: bl.r * s * R.range(rng, 0.55, 0.72), sz: bl.r * s,
          ry: R.range(rng, 0, 6.28), r: bc[0], g: bc[1], b: bc[2]
        });
      }
    }

    // --- 2. Tiered pines: trunk + two stacked cones (slopes + far field) ---
    var pines = scatterPositions(rng, 600, function (x, z) { return inValley(x, z, 170); });
    for (var p = 0; p < pines.length; p++) {
      var px = pines[p][0], pz = pines[p][1];
      var ph = T.heightAt(px, pz);
      var ps = R.range(rng, 0.8, 1.6);
      var pc = trunkColor(px, pz);
      trunkMat.push({ x: px, y: ph + 2.4 * ps, z: pz, sx: 0.6 * ps, sy: 4.8 * ps, sz: 0.6 * ps, ry: 0, lean: 0, r: pc[0], g: pc[1], b: pc[2] });
      var pg = greenColor(px, pz, false);
      var pm = 0.85 + hash01(px, pz) * 0.3;
      coneMat.push({ x: px, y: ph + 8.5 * ps, z: pz, sx: 4.6 * ps, sy: 11 * ps, sz: 4.6 * ps, ry: R.range(rng, 0, 6.28), r: pg[0] * pm, g: pg[1] * pm, b: pg[2] * pm });
      coneMat.push({ x: px, y: ph + 14.5 * ps, z: pz, sx: 3.0 * ps, sy: 8.5 * ps, sz: 3.0 * ps, ry: R.range(rng, 0, 6.28), r: pg[0] * pm * 1.15, g: pg[1] * pm * 1.15, b: pg[2] * pm * 1.15 });
    }

    // --- 3. Palms: tall thin trunk + 4 drooping fronds (peatland flavor) ---
    var palms = scatterPositions(rng, 110, function (x, z) {
      if (T.isOverLake(x, z)) return false;
      var dx = x - T.TOWN.x, dz = z - T.TOWN.z;
      if (dx * dx + dz * dz < T.TOWN.r * T.TOWN.r * 1.3) return false;
      var h = T.heightAt(x, z);
      return h > 2 && h < 45;
    });
    for (var q = 0; q < palms.length; q++) {
      var qx = palms[q][0], qz = palms[q][1];
      var qh = T.heightAt(qx, qz);
      var qs = R.range(rng, 0.9, 1.4);
      var qth = R.range(rng, 11, 15) * qs;
      trunkMat.push({ x: qx, y: qh + qth * 0.5, z: qz, sx: 0.55 * qs, sy: qth, sz: 0.55 * qs, ry: 0, lean: R.range(rng, -0.06, 0.06), r: 0.32, g: 0.27, b: 0.21 });
      for (var f = 0; f < 4; f++) {
        var fa = (f / 4) * Math.PI * 2 + R.range(rng, -0.3, 0.3);
        var fc = greenColor(qx + f * 13, qz + f * 7, false);
        frondMat.push({
          x: qx + Math.cos(fa) * 2.6 * qs, y: qh + qth + 0.4 * qs, z: qz + Math.sin(fa) * 2.6 * qs,
          sx: 5.2 * qs, sy: 0.55 * qs, sz: 1.4 * qs,
          ry: -fa, rz: R.range(rng, 0.55, 0.85), r: fc[0] * 1.25, g: fc[1] * 1.25, b: fc[2] * 1.25
        });
      }
    }

    // --- 4. Undergrowth: bushes (canopy blobs at ground level) ---
    var bushes = scatterPositions(rng, 1400, function (x, z) { return inValley(x, z, 120); });
    for (var u = 0; u < bushes.length; u++) {
      var ux = bushes[u][0], uz = bushes[u][1];
      var uh = T.heightAt(ux, uz);
      var us = R.range(rng, 1.4, 3.2);
      var uc = greenColor(ux, uz, false);
      blobMat.push({
        x: ux, y: uh + 0.9 * us, z: uz,
        sx: us, sy: us * R.range(rng, 0.5, 0.7), sz: us,
        ry: R.range(rng, 0, 6.28), r: uc[0] * 0.85, g: uc[1] * 0.85, b: uc[2] * 0.85
      });
    }

    // --- 5. Grass tufts: tiny cones scattered through the valley floor ---
    var tufts = scatterPositions(rng, 1200, function (x, z) { return inValley(x, z, 90); });
    for (var v = 0; v < tufts.length; v++) {
      var vx = tufts[v][0], vz = tufts[v][1];
      var vh = T.heightAt(vx, vz);
      var vs = R.range(rng, 0.7, 1.6);
      var vc = greenColor(vx, vz, true);
      coneMat.push({ x: vx, y: vh + 0.8 * vs, z: vz, sx: 0.9 * vs, sy: 1.6 * vs, sz: 0.9 * vs, ry: R.range(rng, 0, 6.28), r: vc[0] * 1.2, g: vc[1] * 1.2, b: vc[2] * 1.2 });
    }

    // --- 6. Scorched stand: bare black trunks + a few dead branch stubs ---
    var scorch = scatterPositions(rng, 170, function (x, z) {
      var fx = x - 120, fz = z - 220;
      return (fx * fx + fz * fz) < 260 * 260 && T.heightAt(x, z) > 2;
    });
    for (var j = 0; j < scorch.length; j++) {
      var sx = scorch[j][0], sz = scorch[j][1];
      var sh = T.heightAt(sx, sz);
      var ss = R.range(rng, 0.9, 1.7);
      var sth = R.range(rng, 9, 14) * ss;
      trunkMat.push({ x: sx, y: sh + sth * 0.5, z: sz, sx: 0.5 * ss, sy: sth, sz: 0.5 * ss, ry: 0, lean: R.range(rng, -0.1, 0.1), r: 0.04, g: 0.035, b: 0.03 });
      // one small dead stub cone — bare, dark, barely there
      coneMat.push({ x: sx, y: sh + sth * 0.85, z: sz, sx: 1.3 * ss, sy: 2.8 * ss, sz: 1.3 * ss, ry: R.range(rng, 0, 6.28), r: 0.04, g: 0.035, b: 0.03 });
    }

    // --- 7. Charred bushes in the burn zone: burnt stumps that break up
    // the flat scorched ground without pretending it is alive.
    var charred = scatterPositions(rng, 70, function (x, z) {
      var fx = x - 120, fz = z - 220;
      return (fx * fx + fz * fz) < 260 * 260 && T.heightAt(x, z) > 2;
    });
    for (var cb = 0; cb < charred.length; cb++) {
      var bx = charred[cb][0], bz = charred[cb][1];
      var bh = T.heightAt(bx, bz);
      var bs = R.range(rng, 1.5, 3.0);
      blobMat.push({
        x: bx, y: bh + 0.7 * bs, z: bz,
        sx: bs, sy: bs * R.range(rng, 0.45, 0.6), sz: bs,
        ry: R.range(rng, 0, 6.28), r: 0.05, g: 0.045, b: 0.04
      });
    }

    // --- 8. Town green belt: canopy trees in a ring around Rimba Jaya +
    // yard bushes inside the bench, so the town foreground is never bare.
    var belt = scatterPositions(rng, 50, function (x, z) {
      var dx = x - T.TOWN.x, dz = z - T.TOWN.z;
      var d = Math.sqrt(dx * dx + dz * dz);
      return d > T.TOWN.r * 0.85 && d < T.TOWN.r * 1.15 && T.heightAt(x, z) > 2;
    });
    for (var bt = 0; bt < belt.length; bt++) {
      var tx = belt[bt][0], tz = belt[bt][1];
      var th = T.heightAt(tx, tz);
      var ts = R.range(rng, 0.8, 1.4);
      var tth = R.range(rng, 6, 9) * ts;
      var ttc = trunkColor(tx, tz);
      trunkMat.push({ x: tx, y: th + tth * 0.5, z: tz, sx: 0.9 * ts, sy: tth, sz: 0.9 * ts, ry: R.range(rng, 0, 6.28), lean: 0, r: ttc[0], g: ttc[1], b: ttc[2] });
      var topY2 = th + tth + 1.5 * ts;
      var bl2 = [
        { dx: 0, dy: 0, dz: 0, r: R.range(rng, 4.2, 6.0) },
        { dx: R.range(rng, -3.0, -1.6), dy: -1.4, dz: R.range(rng, -2, 2), r: R.range(rng, 2.8, 4.0) },
        { dx: R.range(rng, 1.6, 3.0), dy: -1.0, dz: R.range(rng, -2, 2), r: R.range(rng, 2.8, 4.0) }
      ];
      for (var b2 = 0; b2 < bl2.length; b2++) {
        var brec = bl2[b2];
        var bc2 = greenColor(tx + brec.dx * 7, tz + brec.dz * 7, true);
        blobMat.push({
          x: tx + brec.dx * ts, y: topY2 + brec.dy * ts, z: tz + brec.dz * ts,
          sx: brec.r * ts, sy: brec.r * ts * R.range(rng, 0.55, 0.72), sz: brec.r * ts,
          ry: R.range(rng, 0, 6.28), r: bc2[0], g: bc2[1], b: bc2[2]
        });
      }
    }
    var yard = scatterPositions(rng, 150, function (x, z) {
      var dx = x - T.TOWN.x, dz = z - T.TOWN.z;
      var d = Math.sqrt(dx * dx + dz * dz);
      return d < T.TOWN.r * 0.95 && T.heightAt(x, z) > 2;
    });
    for (var yb = 0; yb < yard.length; yb++) {
      var yx = yard[yb][0], yz = yard[yb][1];
      var yh = T.heightAt(yx, yz);
      var ys = R.range(rng, 1.2, 2.6);
      var yc = greenColor(yx, yz, false);
      blobMat.push({
        x: yx, y: yh + 0.8 * ys, z: yz,
        sx: ys, sy: ys * R.range(rng, 0.5, 0.7), sz: ys,
        ry: R.range(rng, 0, 6.28), r: yc[0] * 0.9, g: yc[1] * 0.9, b: yc[2] * 0.9
      });
    }

    // --- bake the four InstancedMeshes ---
    function bake(records, geo, mat, withLean, withRoll) {
      var mesh = new THREE.InstancedMesh(geo, mat, Math.max(records.length, 1));
      for (var k = 0; k < records.length; k++) {
        var rec = records[k];
        dummy.position.set(rec.x, rec.y, rec.z);
        dummy.scale.set(rec.sx, rec.sy, rec.sz);
        dummy.rotation.set(withLean ? rec.lean : 0, rec.ry || 0, withRoll ? rec.rz || 0 : 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(k, dummy.matrix);
        col.setRGB(rec.r, rec.g, rec.b);
        mesh.setColorAt(k, col);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      return mesh;
    }
    group.add(bake(blobMat,
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), false, false));
    group.add(bake(trunkMat,
      new THREE.CylinderGeometry(0.5, 0.8, 1, 5),
      new THREE.MeshLambertMaterial({ color: 0xffffff }), true, false));
    group.add(bake(coneMat,
      new THREE.ConeGeometry(1, 1, 6),
      new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), false, false));
    group.add(bake(frondMat,
      new THREE.ConeGeometry(1, 1, 4),
      new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), false, true));
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
    // Mosque with green dome and minaret at the town green.
    var mq = new THREE.Group();
    var mBase = new THREE.Mesh(new THREE.BoxGeometry(12, 8, 9), new THREE.MeshLambertMaterial({ color: 0xe8e0cc }));
    mBase.position.y = 4;
    mq.add(mBase);
    var dome = new THREE.Mesh(
      new THREE.SphereGeometry(3.4, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: 0x2e6b4f })
    );
    dome.position.y = 8;
    mq.add(dome);
    var fin = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 2.2, 5), new THREE.MeshLambertMaterial({ color: 0xd8b13a }));
    fin.position.y = 12.4;
    mq.add(fin);
    var min = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.0, 15, 6), new THREE.MeshLambertMaterial({ color: 0xe8e0cc }));
    min.position.set(8.5, 7.5, 0);
    mq.add(min);
    var minCap = new THREE.Mesh(new THREE.ConeGeometry(1.4, 3.2, 6), new THREE.MeshLambertMaterial({ color: 0x2e6b4f }));
    minCap.position.set(8.5, 16.6, 0);
    mq.add(minCap);
    mq.position.set(cx - 20, T.heightAt(cx - 20, cz + 30), cz + 30);
    group.add(mq);

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
