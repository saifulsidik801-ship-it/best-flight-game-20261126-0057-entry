// Aurora Ring Run — the aircraft: Ptarmigan, a ski-equipped bush plane.
// One clear job: a plane that looks built, not drawn — lathe fuselage,
// extruded wing profile, spinning prop, skis, and lights that read at night.

const Aircraft = (function buildAircraftModule() {
  let plane, prop, propDisc, landingGroup, landingPool, strobeSprite;
  let gearDown = true;

  function buildAircraft(scene) {
    plane = new THREE.Group();

    // Fuselage: lathe profile — nose to tail, a real turned shape.
    // Ptarmigan is a high-wing bush plane, so the cabin sits tall and the
    // nose is short and blunt compared with a low-wing tourer.
    const profile = [];
    profile.push(new THREE.Vector2(0.01, -5.2));   // tail tip
    profile.push(new THREE.Vector2(0.5, -4.9));
    profile.push(new THREE.Vector2(0.9, -3.8));
    profile.push(new THREE.Vector2(1.2, -1.6));
    profile.push(new THREE.Vector2(1.3, 0.2));    // cabin, widest
    profile.push(new THREE.Vector2(1.25, 1.8));
    profile.push(new THREE.Vector2(1.0, 3.2));    // engine cowl
    profile.push(new THREE.Vector2(0.6, 4.3));
    profile.push(new THREE.Vector2(0.01, 4.7));   // spinner base
    const fusGeo = new THREE.LatheGeometry(profile, 20);
    fusGeo.rotateX(Math.PI / 2); // lathe axis -> forward (+Z)
    const fusMat = new THREE.MeshStandardMaterial({
      color: 0xf2f4f6, roughness: 0.4, metalness: 0.1,
    });
    const fus = new THREE.Mesh(fusGeo, fusMat);
    fus.castShadow = true;
    plane.add(fus);

    // Red cheatline: a thin band around the fuselage at cabin height.
    const stripeGeo = new THREE.CylinderGeometry(1.32, 1.28, 5.4, 20, 1, true, 0.3, 1.25);
    stripeGeo.rotateX(Math.PI / 2);
    const stripe = new THREE.Mesh(stripeGeo, new THREE.MeshStandardMaterial({
      color: 0xc23b2a, roughness: 0.4, metalness: 0.3, side: THREE.DoubleSide,
    }));
    stripe.position.z = -0.5;
    plane.add(stripe);

    // Canopy: dark glass bubble on top of the cabin.
    const canopy = new THREE.Mesh(
      new THREE.SphereGeometry(1.05, 16, 12),
      new THREE.MeshStandardMaterial({
        color: 0x1a2a3a, roughness: 0.15, metalness: 0.8,
      }),
    );
    canopy.scale.set(0.85, 0.62, 1.5);
    canopy.position.set(0, 1.05, 0.9);
    plane.add(canopy);

    // High wing: the shape is the airfoil SECTION (chord along X,
    // thickness along Y); the extrusion IS the half-span. rotateY(PI/2)
    // turns the extrusion axis into +X, so the wing extends sideways.
    // (v5 first pass drew the span in the shape and the chord in the
    // extrusion — the wings ran fore-aft and the tip caps floated in air.)
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(0.25, 0.16);
    wingShape.lineTo(1.5, 0.12);
    wingShape.lineTo(1.9, 0.0);
    wingShape.lineTo(1.5, -0.14);
    wingShape.lineTo(0.25, -0.18);
    wingShape.closePath();
    const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
      depth: 7.8, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 1,
    });
    wingGeo.rotateY(Math.PI / 2);
    wingGeo.translate(0, 0, 0.95); // centre the chord on the fuselage
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0xf2f4f6, roughness: 0.4, metalness: 0.1,
    });
    const wingR = new THREE.Mesh(wingGeo, wingMat);
    wingR.position.set(0, 1.35, 0.4);
    wingR.castShadow = true;
    plane.add(wingR);
    // Left wing: the same geometry, rotated PI about Y so the span goes
    // the other way (a proper rotation — no mirrored normals).
    const wingL = new THREE.Mesh(wingGeo, wingMat);
    wingL.rotation.y = Math.PI;
    wingL.position.set(0, 1.35, 0.4);
    wingL.castShadow = true;
    plane.add(wingL);
    // Red wingtip caps.
    const capGeo = new THREE.BoxGeometry(0.5, 0.5, 1.9);
    const capMat = new THREE.MeshStandardMaterial({ color: 0xc23b2a, roughness: 0.4, metalness: 0.3 });
    [-7.9, 7.9].forEach((x) => {
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.set(x, 1.35, 0.4);
      plane.add(cap);
    });
    // Wing struts.
    const strutGeo = new THREE.CylinderGeometry(0.09, 0.09, 2.2, 6);
    const strutMat = new THREE.MeshStandardMaterial({ color: 0xd8dce0, roughness: 0.5, metalness: 0.4 });
    [[-3.4, 0.5], [3.4, 0.5], [-3.4, -0.5], [3.4, -0.5]].forEach(([x, dz]) => {
      const s = new THREE.Mesh(strutGeo, strutMat);
      s.position.set(x, 0.35, 0.4 + dz);
      s.rotation.z = x > 0 ? -0.5 : 0.5;
      plane.add(s);
    });

    // Tail: horizontal stabiliser + vertical fin with the aurora-green flash.
    const stabGeo = new THREE.BoxGeometry(5.4, 0.22, 1.5);
    const stab = new THREE.Mesh(stabGeo, wingMat);
    stab.position.set(0, 0.35, -4.4);
    plane.add(stab);
    const finShape = new THREE.Shape();
    finShape.moveTo(0, 0);
    finShape.lineTo(0, 2.4);
    finShape.lineTo(1.1, 0.5);
    finShape.lineTo(1.3, 0);
    finShape.closePath();
    const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.18, bevelEnabled: false });
    finGeo.translate(0, 0, -0.09);
    const finMat = new THREE.MeshStandardMaterial({
      color: 0x2ad4c4, roughness: 0.4, metalness: 0.1,
      emissive: 0x0d5a4a, emissiveIntensity: 0.5,
    });
    const fin = new THREE.Mesh(finGeo, finMat);
    fin.position.set(0, 0.4, -5.0);
    plane.add(fin);

    // Skis: long flat runners under the gear, fronts kicked up.
    const skiMat = new THREE.MeshStandardMaterial({ color: 0x4a5058, roughness: 0.6, metalness: 0.3 });
    [-1.05, 1.05].forEach((x) => {
      const ski = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.26, 3.4), skiMat);
      ski.position.set(x, -1.55, 0.6);
      plane.add(ski);
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 1.1), skiMat);
      tip.position.set(x, -1.35, 2.5);
      tip.rotation.x = -0.5;
      plane.add(tip);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 6), strutMat);
      leg.position.set(x, -1.0, 0.6);
      plane.add(leg);
    });
    // Tail ski.
    const tailSki = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 2.0), skiMat);
    tailSki.position.set(0, -1.35, -4.6);
    plane.add(tailSki);

    // Prop: hub + two blades + a LIGHT blur disc. (v4's disc read as a
    // dark X in the landing shot — this one is pale and translucent, so
    // it reads as motion, not as a cross over the fuselage.)
    prop = new THREE.Group();
    const hub = new THREE.Mesh(
      new THREE.ConeGeometry(0.45, 1.0, 10),
      new THREE.MeshStandardMaterial({ color: 0xc23b2a, roughness: 0.4, metalness: 0.3 }),
    );
    hub.rotation.x = Math.PI / 2;
    hub.position.z = 4.9;
    prop.add(hub);
    const bladeGeo = new THREE.BoxGeometry(0.26, 3.4, 0.12);
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x565c63, roughness: 0.5 });
    [0, Math.PI].forEach((a) => {
      const b = new THREE.Mesh(bladeGeo, bladeMat);
      b.rotation.z = a;
      b.position.z = 4.75;
      prop.add(b);
    });
    prop.position.z = 0;
    plane.add(prop);
    propDisc = new THREE.Mesh(
      new THREE.CircleGeometry(1.85, 24),
      new THREE.MeshBasicMaterial({
        color: 0xdfe8f2, transparent: true, opacity: 0.22,
        side: THREE.DoubleSide, depthWrite: false,
      }),
    );
    propDisc.position.z = 4.78;
    plane.add(propDisc);

    // Nav lights: red left, green right, white tail strobe — each an
    // emissive bead plus a glow halo so they read at 200 m in the dark.
    function navLight(color, x, y, z, haloScale) {
      const bead = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 8, 8),
        new THREE.MeshBasicMaterial({ color: color }),
      );
      bead.position.set(x, y, z);
      plane.add(bead);
      const glow = makeGlowSprite(color, haloScale);
      glow.position.set(x, y, z);
      plane.add(glow);
      return glow;
    }
    navLight(0xff3b30, -8.1, 1.35, 0.4, 3);
    navLight(0x39ff88, 8.1, 1.35, 0.4, 3);
    strobeSprite = navLight(0xffffff, 0, 0.4, -5.3, 3);

    // Landing light: nose lamp + beam cone + ground pool. Off unless a
    // dusk sortie switches it on (missions.js calls setLandingLight).
    landingGroup = new THREE.Group();
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xfff2c8 }),
    );
    lamp.position.set(0, -0.9, 4.2);
    landingGroup.add(lamp);
    const lampGlow = makeGlowSprite(0xfff2c8, 9);
    lampGlow.position.set(0, -0.9, 4.2);
    landingGroup.add(lampGlow);
    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(7, 55, 12, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xfff2c8, transparent: true, opacity: 0.13,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      }),
    );
    beam.rotation.x = -Math.PI / 2 - 0.12; // forward and slightly down
    beam.position.set(0, -2.2, 30);
    landingGroup.add(beam);
    landingGroup.visible = false;
    plane.add(landingGroup);
    landingPool = makeGlowSprite(0xfff2c8, 26);
    landingPool.visible = false;
    scene.add(landingPool);

    // Belly antenna.
    const antenna = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.08, 0.9, 6),
      new THREE.MeshStandardMaterial({ color: 0x2a2e33, roughness: 0.6 }),
    );
    antenna.position.set(0, -1.35, -1.6);
    plane.add(antenna);

    scene.add(plane);
    return plane;
  }

  function setLandingLight(on) {
    if (landingGroup) landingGroup.visible = !!on;
    if (landingPool) landingPool.visible = !!on;
  }

  function update(dt, throttle, speed, clock) {
    if (!plane) return;
    // Prop spins with speed; the blur disc fades in with throttle.
    if (prop) prop.rotation.z += dt * (4 + speed * 1.1);
    if (propDisc) propDisc.material.opacity = 0.16 + 0.16 * Math.min(1, throttle + 0.2);
    // Tail strobe: double-blink by sim time.
    if (strobeSprite) {
      const ph = clock % 1.4;
      strobeSprite.material.opacity = (ph < 0.08 || (ph > 0.18 && ph < 0.26)) ? 1 : 0.12;
    }
    // Landing-light ground pool sits on the snow directly below the plane.
    if (landingPool && landingPool.visible) {
      landingPool.position.set(
        plane.position.x,
        Terrain.heightAt(plane.position.x, plane.position.z) + 1.2,
        plane.position.z,
      );
    }
  }

  return { buildAircraft, update, setLandingLight };
})();
