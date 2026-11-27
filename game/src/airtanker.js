// Ashwing — the airtanker. One job: build the aircraft the player
// flies, a yellow/red CL-215-style amphibious airtanker: boat hull,
// high wing, twin turboprops with spinning props, T-tail, wingtip
// floats, red cheatline. No Beaver, no Kestrel — this silhouette is
// the whole point of v8.
(function (global) {
  'use strict';

  var YELLOW = 0xf7b500;
  var YELLOW_DARK = 0xd18f00;
  var RED = 0xc1272d;
  var DARK = 0x22303a;
  var GLASS = 0x18242e;

  function lam(color, extra) {
    var m = new THREE.MeshLambertMaterial({ color: color });
    if (extra) for (var k in extra) m[k] = extra[k];
    return m;
  }
  function phong(color, shininess) {
    return new THREE.MeshPhongMaterial({ color: color, shininess: shininess || 60 });
  }

  function buildAirtanker() {
    var plane = new THREE.Group();
    var yellow = phong(YELLOW, 70);
    var yellowDark = lam(YELLOW_DARK);
    var red = lam(RED);
    var dark = lam(DARK);
    var glass = phong(GLASS, 140);

    // Boat hull: nose + body + tapered tail, lying along -Z (nose -Z).
    var nose = new THREE.Mesh(new THREE.SphereGeometry(1.7, 12, 10), yellow);
    nose.scale.set(1, 0.92, 1.5);
    nose.position.set(0, 0, -4.6);
    plane.add(nose);
    var body = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.45, 7.5, 12), yellow);
    body.rotation.x = Math.PI / 2;
    body.position.set(0, 0, -0.8);
    plane.add(body);
    var tail = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 0.35, 4.5, 10), yellow);
    tail.rotation.x = Math.PI / 2;
    tail.position.set(0, 0.35, 4.6);
    plane.add(tail);
    // Hull step underneath (the boat bottom).
    var step = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 4.6), yellowDark);
    step.position.set(0, -1.25, -1.6);
    plane.add(step);
    // Red cheatline along both flanks.
    var stripeL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 8.6), red);
    stripeL.position.set(-1.62, -0.1, -1.2);
    plane.add(stripeL);
    var stripeR = stripeL.clone();
    stripeR.position.x = 1.62;
    plane.add(stripeR);
    // Red tail band.
    var band = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.85, 0.7, 10), red);
    band.rotation.x = Math.PI / 2;
    band.position.set(0, 0.35, 5.6);
    plane.add(band);

    // Cockpit windows: dark tinted wedge on the nose top.
    var cockpit = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 1.6), glass);
    cockpit.position.set(0, 0.95, -4.4);
    cockpit.rotation.x = -0.35;
    plane.add(cockpit);
    var brow = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.25, 1.2), yellowDark);
    brow.position.set(0, 1.45, -4.3);
    brow.rotation.x = -0.35;
    plane.add(brow);

    // High wing on top of the fuselage.
    var wing = new THREE.Mesh(new THREE.BoxGeometry(13.5, 0.32, 2.4), yellow);
    wing.position.set(0, 1.55, -0.6);
    plane.add(wing);
    var wingTipL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 2.2), red);
    wingTipL.position.set(-6.6, 1.55, -0.6);
    plane.add(wingTipL);
    var wingTipR = wingTipL.clone();
    wingTipR.position.x = 6.6;
    plane.add(wingTipR);

    // Twin turboprop nacelles on the wing leading edge + spinning props.
    var props = [];
    [-2.9, 2.9].forEach(function (ex) {
      var nac = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.7, 3.0, 10), yellow);
      nac.rotation.x = Math.PI / 2;
      nac.position.set(ex, 1.35, -1.4);
      plane.add(nac);
      var intake = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.3, 10), dark);
      intake.rotation.x = Math.PI / 2;
      intake.position.set(ex, 1.35, -2.95);
      plane.add(intake);
      var prop = new THREE.Group();
      prop.position.set(ex, 1.35, -3.15);
      var hub = new THREE.Mesh(new THREE.SphereGeometry(0.34, 8, 6), dark);
      prop.add(hub);
      for (var b = 0; b < 3; b++) {
        var blade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 2.6, 0.08), dark);
        var holder = new THREE.Group();
        holder.rotation.z = (b / 3) * Math.PI * 2;
        holder.add(blade);
        blade.position.y = 1.3;
        prop.add(holder);
      }
      // faint prop disc for the blur at speed
      var disc = new THREE.Mesh(
        new THREE.CircleGeometry(1.55, 20),
        new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false })
      );
      prop.add(disc);
      plane.add(prop);
      props.push(prop);
      // exhaust stub
      var exh = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.9, 6), dark);
      exh.rotation.z = Math.PI / 2;
      exh.position.set(ex + (ex > 0 ? 0.9 : -0.9), 1.0, -0.6);
      plane.add(exh);
    });

    // T-tail: tall fin + stabilizer on top.
    var fin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.4, 2.2), yellow);
    fin.position.set(0, 2.3, 6.4);
    fin.rotation.x = 0.18;
    plane.add(fin);
    var finTip = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.7, 2.0), red);
    finTip.position.set(0, 3.9, 6.75);
    finTip.rotation.x = 0.18;
    plane.add(finTip);
    var stab = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.25, 1.5), yellow);
    stab.position.set(0, 3.95, 6.6);
    plane.add(stab);

    // Wingtip floats on short struts.
    [-1, 1].forEach(function (s) {
      var strut = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.1, 6), yellowDark);
      strut.position.set(s * 6.4, 1.0, -0.6);
      plane.add(strut);
      var fl = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 1.4, 4, 8), red);
      fl.rotation.x = Math.PI / 2;
      fl.position.set(s * 6.4, 0.35, -0.6);
      plane.add(fl);
    });

    // Belly scoops (the water intakes under the hull).
    [-0.7, 0.7].forEach(function (sx) {
      var scoop = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 1.1), dark);
      scoop.position.set(sx, -1.7, -1.2);
      plane.add(scoop);
    });

    // Nav lights.
    var navL = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 5), new THREE.MeshBasicMaterial({ color: 0xff2a1e }));
    navL.position.set(-6.85, 1.55, -0.6); plane.add(navL);
    var navR = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 5), new THREE.MeshBasicMaterial({ color: 0x2aff5e }));
    navR.position.set(6.85, 1.55, -0.6); plane.add(navR);

    plane.userData.props = props;
    plane.traverse(function (o) { if (o.isMesh) o.castShadow = false; });
    return plane;
  }

  // White spray plume behind the hull while scooping.
  function buildSpray() {
    var cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
    var g = cv.getContext('2d');
    var grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    var tex = new THREE.CanvasTexture(cv);
    var geo = new THREE.BufferGeometry();
    var N = 140;
    var pos = new Float32Array(N * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var mat = new THREE.PointsMaterial({
      size: 4.5, map: tex, transparent: true, opacity: 0.9,
      depthWrite: false, sizeAttenuation: true, color: 0xf2fbff
    });
    var points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    points.userData.parts = [];
    for (var i = 0; i < N; i++) {
      points.userData.parts.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0 });
    }
    return points;
  }

  function updateSpray(spray, origin, forward, dt, active, t) {
    var parts = spray.userData.parts;
    var pos = spray.geometry.attributes.position;
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (active && p.life <= 0 && (i % 3 === 0 || Math.random() < 0.4)) {
        p.x = origin.x + (Math.random() - 0.5) * 2.5;
        p.y = origin.y + Math.random() * 0.8;
        p.z = origin.z + (Math.random() - 0.5) * 2.5;
        p.vx = -forward.x * 6 + (Math.random() - 0.5) * 7;
        p.vy = 2 + Math.random() * 5;
        p.vz = -forward.z * 6 + (Math.random() - 0.5) * 7;
        p.life = 0.5 + Math.random() * 0.5;
      }
      if (p.life > 0) {
        p.life -= dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        p.vy -= 6 * dt;
        if (p.y < 0.2) { p.y = 0.2; p.vy = Math.abs(p.vy) * 0.3; }
      }
      pos.setXYZ(i, p.x, p.y, p.z);
    }
    pos.needsUpdate = true;
    spray.visible = active || parts.some(function (p) { return p.life > 0; });
    spray.material.opacity = active ? 0.85 : 0.5;
    void t;
  }

  global.AshAirtanker = { buildAirtanker: buildAirtanker, buildSpray: buildSpray, updateSpray: updateSpray };
})(typeof window !== 'undefined' ? window : globalThis);
