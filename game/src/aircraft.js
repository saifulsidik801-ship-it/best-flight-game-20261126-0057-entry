// Aurora Ring Run v6 — the DHC-2 Beaver floatplane, from Sidik's reference.
// Cream/beige fuselage, bold red stripe, high wing on struts, dark-tinted
// windows, radial nose, grey floats (NOT skis). Built from primitives at
// real scale (~9 m fuselage, 14.6 m span). Origin at the fuselage centre,
// nose toward -Z, floats' bottoms at y = -2.6 so the physics ground
// offset (pos.y = ground + 2.5) puts the floats on the water.

const Aircraft = (function buildAircraftModule() {
  let prop = null;          // spinning blade group
  let tailStrobe = null;    // white tail light (blinks)
  let tailStrobeGlow = null;
  let landingLight = null;  // nose light + beam + ground pool
  let landingBeam = null;
  let landingPool = null;
  let planeGroup = null;

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
  const glowTex = glowTexture();

  function glowSprite(color, scale, opacity) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color, transparent: true, opacity,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    s.scale.set(scale, scale, 1);
    return s;
  }

  function box(w, h, d, mat, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    return m;
  }

  function buildAircraft(scene) {
    const cream = new THREE.MeshStandardMaterial({ color: 0xf0e6d2, roughness: 0.5, metalness: 0.25 });
    const wingWhite = new THREE.MeshStandardMaterial({ color: 0xf5f2ea, roughness: 0.45, metalness: 0.25 });
    const red = new THREE.MeshStandardMaterial({ color: 0xc8352c, roughness: 0.45, metalness: 0.2 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.6, metalness: 0.4 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x16222e, roughness: 0.15, metalness: 0.6 });
    const floatGrey = new THREE.MeshStandardMaterial({ color: 0x9aa4ad, roughness: 0.5, metalness: 0.15 });
    const strutMat = new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 0.55, metalness: 0.5 });
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x8a94a0, roughness: 0.4, metalness: 0.5 });

    const g = new THREE.Group();
    planeGroup = g;

    // --- Fuselage: tall boxy cabin, blunt radial nose, tapering tail. ---
    g.add(box(1.7, 1.9, 6.5, cream, 0, 0, 0));                 // cabin
    g.add(box(1.5, 1.6, 1.3, cream, 0, -0.1, -3.6));           // nose block
    g.add(box(1.3, 1.4, 2.8, cream, 0, 0.25, 4.4));            // tail cone
    g.add(box(1.5, 0.3, 5.5, new THREE.MeshStandardMaterial({ color: 0xd8cbb2, roughness: 0.55, metalness: 0.25 }), 0, -1.0, 0)); // belly
    // Radial engine cowl (dark) + prop hub.
    const cowl = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.85, 1.0, 16), dark);
    cowl.rotation.x = Math.PI / 2;
    cowl.position.set(0, 0.05, -4.5);
    cowl.castShadow = true;
    g.add(cowl);

    // --- Red cheatline, full length both sides + tail stripe. ---
    g.add(box(0.06, 0.22, 6.2, red, -0.86, -0.15, -0.2));
    g.add(box(0.06, 0.22, 6.2, red, 0.86, -0.15, -0.2));
    g.add(box(0.06, 0.2, 2.6, red, -0.66, 0.05, 4.4));
    g.add(box(0.06, 0.2, 2.6, red, 0.66, 0.05, 4.4));

    // --- Dark-tinted windows: windshield (2 angled panes), side windows. ---
    const winL = box(0.62, 0.7, 0.06, glass, -0.42, 0.45, -3.0);
    winL.rotation.y = 0.28; winL.rotation.x = -0.15;
    const winR = box(0.62, 0.7, 0.06, glass, 0.42, 0.45, -3.0);
    winR.rotation.y = -0.28; winR.rotation.x = -0.15;
    g.add(winL); g.add(winR);
    [[-0.86, -1.6], [0.86, -1.6], [-0.86, -0.2], [0.86, -0.2]].forEach(([x, z]) => {
      g.add(box(0.06, 0.65, 1.1, glass, x, 0.35, z));
    });
    g.add(box(0.06, 0.5, 0.7, glass, -0.86, 0.3, 1.2));
    g.add(box(0.06, 0.5, 0.7, glass, 0.86, 0.3, 1.2));

    // --- High wing: two halves with a touch of dihedral, dark leading
    // edge, red tip stripes underneath. ---
    [-1, 1].forEach((side) => {
      const half = box(7.3, 0.28, 1.9, wingWhite, side * 3.65, 1.35, -0.3);
      half.rotation.z = -side * 0.045;
      g.add(half);
      const le = box(7.3, 0.1, 0.18, dark, side * 3.65, 1.36, -1.25);
      le.rotation.z = -side * 0.045;
      g.add(le);
      const tip = box(0.9, 0.06, 1.9, red, side * 6.9, 1.19, -0.3);
      tip.rotation.z = -side * 0.045;
      g.add(tip);
    });
    // Wing struts: two per side, front + rear, down to the lower fuselage.
    [[-1, -0.9], [1, -0.9], [-1, 0.5], [1, 0.5]].forEach(([side, z]) => {
      const s = box(0.12, 4.3, 0.18, strutMat, side * 2.7, 0.25, z);
      s.rotation.z = -side * 1.1;
      g.add(s);
    });

    // --- Tail: vertical fin (swept, red flash) + horizontal stabilizer. ---
    const fin = box(0.14, 2.3, 1.6, cream, 0, 1.3, 5.4);
    fin.rotation.x = -0.12;
    g.add(fin);
    const flash = box(0.16, 1.0, 0.9, red, 0, 1.5, 5.45);
    flash.rotation.x = -0.12;
    g.add(flash);
    g.add(box(4.4, 0.16, 1.2, wingWhite, 0, 0.55, 5.2));
    g.add(box(0.5, 0.18, 1.2, red, -2.0, 0.55, 5.2));
    g.add(box(0.5, 0.18, 1.2, red, 2.0, 0.55, 5.2));

    // --- Floats: long silver-grey stepped hulls on struts, spreader bars.
    // Profile drawn in the length/height plane, extruded across the width.
    const shape = new THREE.Shape();
    shape.moveTo(-4.25, 0.45);
    shape.lineTo(-3.6, 0.05);
    shape.lineTo(0.8, 0.0);
    shape.lineTo(1.2, 0.12);
    shape.lineTo(4.25, 0.12);
    shape.lineTo(4.25, 0.55);
    shape.lineTo(-3.4, 0.75);
    shape.closePath();
    const floatGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.7, bevelEnabled: false });
    floatGeo.rotateY(-Math.PI / 2);
    floatGeo.translate(-0.35, 0, 0);
    [-0.95, 0.95].forEach((x) => {
      const f = new THREE.Mesh(floatGeo, floatGrey);
      f.position.set(x, -2.6, 0.2);
      f.castShadow = true;
      g.add(f);
      // Float struts: front angled + rear vertical, per float.
      const fs = box(0.12, 1.3, 0.14, strutMat, x * 0.82, -1.75, -1.6);
      fs.rotation.z = -Math.sign(x) * 0.35;
      g.add(fs);
      g.add(box(0.12, 1.1, 0.14, strutMat, x * 0.85, -1.8, 2.4));
    });
    // Spreader bars between the floats.
    g.add(box(2.6, 0.12, 0.14, strutMat, 0, -2.0, -1.5));
    g.add(box(2.6, 0.12, 0.14, strutMat, 0, -2.0, 2.0));

    // --- Prop: light-grey thin blades + red spinner + a PALE translucent
    // disc (never a dark X — the disc is a light blur, the blades thin
    // and light). The disc is static; only the blades spin. ---
    prop = new THREE.Group();
    prop.position.set(0, 0.05, -5.15);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.7, 0.08), bladeMat);
    prop.add(blade);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.4, 10), dark);
    hub.rotation.x = Math.PI / 2;
    prop.add(hub);
    const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.5, 10), red);
    spinner.rotation.x = -Math.PI / 2;
    spinner.position.z = -0.4;
    prop.add(spinner);
    g.add(prop);
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(1.45, 32),
      new THREE.MeshBasicMaterial({
        color: 0xdfe8f2, transparent: true, opacity: 0.2,
        side: THREE.DoubleSide, depthWrite: false,
      }),
    );
    disc.position.set(0, 0.05, -5.2);
    g.add(disc);

    // --- Nav lights: red left / green right wingtips, white tail strobe. ---
    const navL = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
    navL.position.set(-7.3, 1.35, -0.3);
    g.add(navL);
    // v7: wingtip nav glows bigger and hotter so the Beaver reads lit
    // from behind in the landing shot (was scale 6 / opacity 0.8).
    const gl = glowSprite(0xff2a2a, 9, 0.95);
    gl.position.copy(navL.position);
    g.add(gl);
    const navR = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0x2aff66 }));
    navR.position.set(7.3, 1.35, -0.3);
    g.add(navR);
    const gr = glowSprite(0x2aff66, 9, 0.95);
    gr.position.copy(navR.position);
    g.add(gr);
    tailStrobe = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff }));
    tailStrobe.position.set(0, 0.95, 5.95);
    g.add(tailStrobe);
    tailStrobeGlow = glowSprite(0xffffff, 8, 0.9);
    tailStrobeGlow.position.copy(tailStrobe.position);
    g.add(tailStrobeGlow);

    // --- Landing light: nose lamp + forward-down beam cone + ground pool.
    // Switched on by missions.js for the dusk (water-landing) sortie. ---
    landingLight = new THREE.Group();
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xfff2cc }));
    lamp.position.set(0, -0.9, -3.9);
    landingLight.add(lamp);
    const lampGlow = glowSprite(0xfff2cc, 7, 0.9);
    lampGlow.position.copy(lamp.position);
    landingLight.add(lampGlow);
    landingBeam = new THREE.Mesh(
      new THREE.ConeGeometry(2.4, 10, 12, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xfff2cc, transparent: true, opacity: 0.1,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      }),
    );
    landingBeam.position.set(0, -1.6, -8.5);
    landingBeam.rotation.x = -Math.PI / 2 + 0.22;
    landingLight.add(landingBeam);
    // v7 round 5: smaller pool — round 4 blew the Beaver's tail to pure
    // white in the landing shot.
    landingPool = glowSprite(0xfff2cc, 10, 0.5);
    landingLight.add(landingPool);
    landingLight.visible = false;
    g.add(landingLight);

    scene.add(g);
    return g;
  }

  function setLandingLight(on) {
    if (landingLight) landingLight.visible = !!on;
  }

  function update(dt, _throttle, speed, clock) {
    if (prop) prop.rotation.z += dt * (4 + speed * 1.8);
    // Tail strobe: short double blink, driven by game clock.
    const blink = (clock % 1.2) < 0.12;
    if (tailStrobe) tailStrobe.visible = blink;
    if (tailStrobeGlow) tailStrobeGlow.visible = blink;
    // Landing-light pool: on the ground ~14 m ahead of the plane. The pool
    // is a child of the plane, so express it in plane-local space: forward
    // is -Z, and with the small pitch/roll of a final approach the local
    // height is just (ground ahead) minus (plane altitude). A soft glow
    // tolerates the small-angle error.
    if (landingLight && landingLight.visible && planeGroup) {
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(planeGroup.quaternion);
      const px = planeGroup.position.x + fwd.x * 14;
      const pz = planeGroup.position.z + fwd.z * 14;
      const localY = Terrain.heightAt(px, pz) - planeGroup.position.y;
      landingPool.position.set(0, localY + 0.8, -14);
    }
  }

  return { buildAircraft, update, setLandingLight };
})();
