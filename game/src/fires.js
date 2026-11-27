// Ashwing — wildfire. One job: the enemy. Fires burn, glow, smoke,
// spread toward town when ignored, and die under a water drop.
// Every drop, every acre saved and every fire put out is scored here.
(function (global) {
  'use strict';
  var R = global.AshRng;
  var T = global.AshTerrain;

  function flameTexture() {
    var cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
    var g = cv.getContext('2d');
    var grad = g.createRadialGradient(32, 40, 2, 32, 36, 30);
    grad.addColorStop(0, 'rgba(255,240,160,1)');
    grad.addColorStop(0.35, 'rgba(255,160,40,0.9)');
    grad.addColorStop(0.7, 'rgba(230,70,10,0.55)');
    grad.addColorStop(1, 'rgba(120,10,0,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(cv);
  }

  function puffTexture() {
    var cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
    var g = cv.getContext('2d');
    var grad = g.createRadialGradient(32, 32, 4, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255,255,255,0.85)');
    grad.addColorStop(0.6, 'rgba(255,255,255,0.35)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(cv);
  }

  function FireField(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.fires = [];
    this.acresSaved = 0;
    this.firesOut = 0;
    this.score = 0;
    this.spreadTimer = 0;
    this.flameTex = flameTexture();
    this.puffTex = puffTexture();
    this.group = new THREE.Group();
    scene.add(this.group);
    // embers: one shared Points cloud
    var N = 240;
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    var mat = new THREE.PointsMaterial({
      size: 1.6, color: 0xffa030, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    this.embers = new THREE.Points(geo, mat);
    this.embers.frustumCulled = false;
    this.emberParts = [];
    for (var i = 0; i < N; i++) this.emberParts.push({ x: 0, y: -100, z: 0, vy: 0, life: 0, fx: 0, fz: 0 });
    scene.add(this.embers);
    // water-drop burst particles (reused pool)
    var M = 160;
    var bgeo = new THREE.BufferGeometry();
    bgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(M * 3), 3));
    var bmat = new THREE.PointsMaterial({
      size: 3.4, color: 0xbfe6ff, transparent: true, opacity: 0.95, depthWrite: false
    });
    this.burst = new THREE.Points(bgeo, bmat);
    this.burst.frustumCulled = false;
    this.burstParts = [];
    for (var j = 0; j < M; j++) this.burstParts.push({ x: 0, y: -100, z: 0, vx: 0, vy: 0, vz: 0, life: 0 });
    scene.add(this.burst);
    // steam puffs after a drop
    this.steams = [];
  }

  FireField.prototype.clear = function () {
    for (var i = 0; i < this.fires.length; i++) this.group.remove(this.fires[i].group);
    this.fires = [];
  };

  FireField.prototype.addFire = function (x, z, intensity) {
    var ground = T.heightAt(x, z);
    var g = new THREE.Group();
    g.position.set(x, ground, z);
    var flameMat = new THREE.SpriteMaterial({
      map: this.flameTex, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, fog: false
    });
    var flame = new THREE.Sprite(flameMat);
    flame.scale.set(16, 20, 1);
    flame.position.y = 7;
    g.add(flame);
    var glowMat = new THREE.SpriteMaterial({
      map: this.puffTex, color: 0xff5a10, transparent: true, opacity: 0.5,
      depthWrite: false, blending: THREE.AdditiveBlending, fog: false
    });
    var glow = new THREE.Sprite(glowMat);
    glow.scale.set(42, 16, 1);
    glow.position.y = 3;
    g.add(glow);
    // smoke column: 5 stacked puffs
    var smokes = [];
    var smokeMat = new THREE.SpriteMaterial({
      map: this.puffTex, color: 0x453832, transparent: true, opacity: 0.5, depthWrite: false
    });
    for (var s = 0; s < 5; s++) {
      var sm = new THREE.Sprite(smokeMat);
      sm.scale.set(14 + s * 7, 14 + s * 7, 1);
      sm.position.set((this.rng() - 0.5) * 4, 16 + s * 13, (this.rng() - 0.5) * 4);
      g.add(sm);
      smokes.push(sm);
    }
    this.group.add(g);
    var fire = { x: x, z: z, intensity: intensity, radius: 14 + intensity * 10, group: g, flame: flame, glow: glow, smokes: smokes, seed: this.rng() * 10 };
    this.fires.push(fire);
    return fire;
  };

  FireField.prototype.burningCount = function () {
    var n = 0;
    for (var i = 0; i < this.fires.length; i++) if (this.fires[i].intensity > 0.02) n++;
    return n;
  };

  // A water drop lands at (x, z): fires nearby lose intensity, burst + steam.
  FireField.prototype.dropWater = function (x, z, amount) {
    var hit = false;
    for (var i = 0; i < this.fires.length; i++) {
      var f = this.fires[i];
      if (f.intensity <= 0.02) continue;
      var dx = f.x - x, dz = f.z - z;
      var d = Math.sqrt(dx * dx + dz * dz);
      if (d < 55) {
        var was = f.intensity;
        f.intensity = Math.max(0, f.intensity - amount * (1 - d / 70));
        if (was > 0.02 && f.intensity <= 0.02) {
          this.firesOut++;
          var acres = 3 + this.rng() * 4;
          this.acresSaved += acres;
          this.score += 100 + Math.round(acres * 10);
        }
        hit = true;
      }
    }
    // burst particles
    for (var j = 0; j < this.burstParts.length; j++) {
      var p = this.burstParts[j];
      if (p.life <= 0) {
        p.x = x + (Math.random() - 0.5) * 30;
        p.y = T.heightAt(x, z) + 26 + Math.random() * 10;
        p.z = z + (Math.random() - 0.5) * 30;
        p.vx = (Math.random() - 0.5) * 14;
        p.vy = -18 - Math.random() * 14;
        p.vz = (Math.random() - 0.5) * 14;
        p.life = 0.7 + Math.random() * 0.5;
      }
    }
    // steam
    for (var s = 0; s < 6; s++) {
      var mat = new THREE.SpriteMaterial({
        map: this.puffTex, color: 0xdde8ee, transparent: true, opacity: 0.38, depthWrite: false
      });
      var sm = new THREE.Sprite(mat);
      sm.position.set(x + (Math.random() - 0.5) * 24, T.heightAt(x, z) + 6, z + (Math.random() - 0.5) * 24);
      sm.scale.set(8, 8, 1);
      sm.userData.life = 1.6;
      this.scene.add(sm);
      this.steams.push(sm);
    }
    return hit;
  };

  FireField.prototype.update = function (dt, t, town) {
    // spread: every second, hot fires may ignite a neighbour toward town
    this.spreadTimer += dt;
    if (this.spreadTimer >= 1) {
      this.spreadTimer = 0;
      var burning = this.burningCount();
      if (burning > 0 && this.fires.length < 36) {
        for (var i = 0; i < this.fires.length; i++) {
          var f = this.fires[i];
          if (f.intensity > 0.55 && this.rng() < 0.02) {
            var a = Math.atan2(town.z - f.z, town.x - f.x) + (this.rng() - 0.5) * 1.1;
            var d = 34 + this.rng() * 36;
            var nx = f.x + Math.cos(a) * d, nz = f.z + Math.sin(a) * d;
            if (!T.isOverLake(nx, nz) && T.heightAt(nx, nz) > 2) {
              var near = false;
              for (var k = 0; k < this.fires.length; k++) {
                var of = this.fires[k];
                var odx = of.x - nx, odz = of.z - nz;
                if (odx * odx + odz * odz < 30 * 30) { near = true; break; }
              }
              if (!near) this.addFire(nx, nz, 0.45 + this.rng() * 0.3);
            }
          }
        }
      }
      // town damage from close fires
      if (town) {
        for (var m = 0; m < this.fires.length; m++) {
          var ff = this.fires[m];
          if (ff.intensity > 0.3) {
            var tdx = ff.x - town.x, tdz = ff.z - town.z;
            if (tdx * tdx + tdz * tdz < 150 * 150) town.health = Math.max(0, town.health - 0.35);
          }
        }
      }
    }
    // visuals: flicker, smoke drift, embers, burst, steam
    for (var q = 0; q < this.fires.length; q++) {
      var fire = this.fires[q];
      var fl = 0.75 + 0.25 * Math.sin(t * 7 + fire.seed * 9) * Math.sin(t * 3.1 + fire.seed);
      var sc = (18 + fire.intensity * 22) * fl;
      fire.flame.scale.set(sc, sc * 1.3, 1);
      fire.flame.material.opacity = 0.25 + fire.intensity * 0.75;
      fire.glow.material.opacity = 0.12 + fire.intensity * 0.45;
      fire.glow.scale.set(30 + fire.intensity * 22, 12 + fire.intensity * 8, 1);
      for (var s2 = 0; s2 < fire.smokes.length; s2++) {
        var sm2 = fire.smokes[s2];
        sm2.position.y += dt * 2.2;
        sm2.position.x += dt * 3.5; // wind drift
        sm2.material.opacity = 0.16 + fire.intensity * 0.3;
        if (sm2.position.y > 16 + s2 * 13 + 26) sm2.position.y = 16 + s2 * 13;
      }
      fire.group.visible = fire.intensity > 0.02;
    }
    // embers rising from burning fires
    var epos = this.embers.geometry.attributes.position;
    for (var e = 0; e < this.emberParts.length; e++) {
      var ep = this.emberParts[e];
      if (ep.life <= 0) {
        var bf = this.fires[Math.floor(Math.random() * this.fires.length)];
        if (bf && bf.intensity > 0.3 && Math.random() < 0.5) {
          ep.x = bf.x + (Math.random() - 0.5) * 12;
          ep.y = T.heightAt(bf.x, bf.z) + 4;
          ep.z = bf.z + (Math.random() - 0.5) * 12;
          ep.vy = 6 + Math.random() * 9;
          ep.life = 1.2 + Math.random();
        } else { ep.y = -100; }
      } else {
        ep.life -= dt;
        ep.y += ep.vy * dt;
        ep.x += dt * 4;
      }
      epos.setXYZ(e, ep.x, ep.y, ep.z);
    }
    epos.needsUpdate = true;
    // burst particles fall
    var bpos = this.burst.geometry.attributes.position;
    for (var b = 0; b < this.burstParts.length; b++) {
      var bp = this.burstParts[b];
      if (bp.life > 0) {
        bp.life -= dt;
        bp.x += bp.vx * dt; bp.y += bp.vy * dt; bp.z += bp.vz * dt;
        bp.vy -= 30 * dt;
        if (bp.y < T.heightAt(bp.x, bp.z)) { bp.y = T.heightAt(bp.x, bp.z); bp.life = 0; }
      } else { bp.y = -100; }
      bpos.setXYZ(b, bp.x, bp.y, bp.z);
    }
    bpos.needsUpdate = true;
    // steam rises and fades
    for (var st = this.steams.length - 1; st >= 0; st--) {
      var stm = this.steams[st];
      stm.userData.life -= dt;
      stm.position.y += dt * 6;
      var ls = Math.min(24, stm.scale.x + dt * 6);
      stm.scale.set(ls, ls, 1);
      stm.material.opacity = Math.max(0, stm.userData.life * 0.22);
      if (stm.userData.life <= 0) { this.scene.remove(stm); this.steams.splice(st, 1); }
    }
  };

  global.AshFires = { FireField: FireField };
})(typeof window !== 'undefined' ? window : globalThis);
