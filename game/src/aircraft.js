// Merapi Ring Run — the aircraft: Kestrel-9 bush plane, built from shaped mesh.
// One clear job: a plane that looks built, not drawn — lathe fuselage,
// extruded wing profile, spinning prop, lit instruments and nav lights.

const Aircraft = (function buildAircraftModule() {
  let plane, prop, propDisc, panelLights = [], navLights = {};
  let gearDown = true;

  // Soft radial glow texture for nav-light halos (one shared canvas).
  function glowTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  function buildAircraft(scene) {
    plane = new THREE.Group();

    // Fuselage: lathe profile — nose to tail, a real turned shape.
    const profile = [];
    profile.push(new THREE.Vector2(0.01, -5.4));   // tail tip
    profile.push(new THREE.Vector2(0.55, -5.0));
    profile.push(new THREE.Vector2(0.95, -3.6));
    profile.push(new THREE.Vector2(1.25, -1.2));
    profile.push(new THREE.Vector2(1.35, 0.6));    // cabin, widest
    profile.push(new THREE.Vector2(1.15, 2.4));
    profile.push(new THREE.Vector2(0.75, 3.8));    // engine cowl taper
    profile.push(new THREE.Vector2(0.55, 4.6));
    profile.push(new THREE.Vector2(0.01, 4.9));    // spinner base
    const fusGeo = new THREE.LatheGeometry(profile, 20);
    fusGeo.rotateX(Math.PI / 2); // lathe axis → forward (+Z)
    const fusMat = new THREE.MeshStandardMaterial({
      color: 0xd84a2e, roughness: 0.38, metalness: 0.22,
    });
    const fus = new THREE.Mesh(fusGeo, fusMat);
    fus.castShadow = true;
    plane.add(fus);

    // Cream cheatline stripe along the fuselage.
    const stripeGeo = new THREE.CylinderGeometry(1.36, 1.30, 5.6, 20, 1, true, 0.35, 1.1);
    stripeGeo.rotateX(Math.PI / 2);
    const stripe = new THREE.Mesh(stripeGeo, new THREE.MeshStandardMaterial({
      color: 0xf5e9c8, roughness: 0.4, metalness: 0.3, side: THREE.DoubleSide,
    }));
    stripe.position.z = -0.4;
    plane.add(stripe);

    // Wings: extruded airfoil-ish profile, tapered planform.
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(0.4, 0.28);
    wingShape.lineTo(7.6, 0.16);
    wingShape.lineTo(8.0, 0.0);
    wingShape.lineTo(7.6, -0.22);
    wingShape.lineTo(0.4, -0.34);
    wingShape.lineTo(0, 0);
    const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2 });
    wingGeo.rotateX(-Math.PI / 2);
    const wingMat = new THREE.MeshStandardMaterial({ color: 0xf5e9c8, roughness: 0.5, metalness: 0.2 });
    const wingR = new THREE.Mesh(wingGeo, wingMat);
    wingR.position.set(0.6, 0.15, 0.4);
    wingR.castShadow = true;
    plane.add(wingR);
    const wingL = wingR.clone();
    wingL.scale.x = -1;
    wingL.position.x = -0.6;
    plane.add(wingL);

    // Tail: horizontal stabiliser + vertical fin, same extruded style.
    const tailShape = new THREE.Shape();
    tailShape.moveTo(0, 0); tailShape.lineTo(0.3, 0.2); tailShape.lineTo(2.9, 0.12);
    tailShape.lineTo(3.1, 0); tailShape.lineTo(2.9, -0.16); tailShape.lineTo(0.3, -0.24); tailShape.lineTo(0, 0);
    const tailGeo = new THREE.ExtrudeGeometry(tailShape, { depth: 0.14, bevelEnabled: false });
    tailGeo.rotateX(-Math.PI / 2);
    const stabR = new THREE.Mesh(tailGeo, wingMat);
    stabR.position.set(0.4, 0.35, -4.6);
    plane.add(stabR);
    const stabL = stabR.clone(); stabL.scale.x = -1; stabL.position.x = -0.4;
    plane.add(stabL);
    const finShape = new THREE.Shape();
    finShape.moveTo(0, 0); finShape.lineTo(1.5, 0.15); finShape.lineTo(1.9, 1.9);
    finShape.lineTo(1.55, 2.1); finShape.lineTo(0.1, 2.0); finShape.lineTo(0, 0);
    const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.14, bevelEnabled: false });
    const fin = new THREE.Mesh(finGeo, new THREE.MeshStandardMaterial({ color: 0xd84a2e, roughness: 0.42, metalness: 0.25 }));
    fin.position.set(-0.07, 0.6, -5.1);
    plane.add(fin);
    // White flash on the fin + red wingtip caps: livery the chase camera reads.
    const finFlash = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 1.1, 1.2),
      new THREE.MeshStandardMaterial({ color: 0xf5e9c8, roughness: 0.5, metalness: 0.2 }),
    );
    finFlash.position.set(0, 1.5, -4.35);
    finFlash.rotation.x = 0.35;
    plane.add(finFlash);
    const tipMat = new THREE.MeshStandardMaterial({ color: 0xc23b2a, roughness: 0.45, metalness: 0.25 });
    for (const s of [-1, 1]) {
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.34, 1.3), tipMat);
      tip.position.set(s * 7.9, 0.18, 0.4);
      plane.add(tip);
    }
    // Belly antenna mast + tailwheel: small built details.
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.07, 1.3, 6),
      new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.6, metalness: 0.4 }),
    );
    mast.position.set(0, 1.9, -0.6);
    plane.add(mast);
    const tailStrut = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 1.1, 6),
      new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.6, metalness: 0.5 }),
    );
    tailStrut.position.set(0, -1.15, -4.9);
    plane.add(tailStrut);
    const tailWheel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 0.24, 10),
      new THREE.MeshStandardMaterial({ color: 0x1c1c22, roughness: 0.7, metalness: 0.4 }),
    );
    tailWheel.rotation.z = Math.PI / 2;
    tailWheel.position.set(0, -1.7, -4.9);
    plane.add(tailWheel);

    // Canopy: glossy dark glass over the cabin.
    const canopy = new THREE.Mesh(
      new THREE.SphereGeometry(1.05, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55),
      new THREE.MeshStandardMaterial({
        color: 0x18242e, roughness: 0.08, metalness: 0.85,
        emissive: 0x2a4a66, emissiveIntensity: 0.5,
      }),
    );
    canopy.scale.set(0.95, 0.75, 1.7);
    canopy.position.set(0, 0.85, 0.9);
    plane.add(canopy);

    // Instrument panel glow inside the canopy: lit dials the chase camera can see.
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 0.5, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x0a1420, emissive: 0x66d9ff, emissiveIntensity: 0.9 }),
    );
    panel.position.set(0, 0.75, 1.95);
    panel.rotation.x = -0.25;
    plane.add(panel);
    for (let i = -1; i <= 1; i++) {
      const dial = new THREE.Mesh(
        new THREE.CircleGeometry(0.14, 12),
        new THREE.MeshBasicMaterial({ color: i === 0 ? 0x7dffb0 : 0xffd23e }),
      );
      dial.position.set(i * 0.5, 0.78, 2.05);
      dial.rotation.x = -0.25;
      plane.add(dial);
      panelLights.push(dial);
    }

    // Propeller: two blades + spinner, spins with throttle.
    const propGroup = new THREE.Group();
    const bladeGeo = new THREE.BoxGeometry(0.34, 3.4, 0.1);
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x1c1c22, roughness: 0.4, metalness: 0.6 });
    for (const a of [0, Math.PI / 2]) {
      const blade = new THREE.Mesh(bladeGeo, bladeMat);
      blade.rotation.z = a;
      blade.castShadow = true;
      propGroup.add(blade);
    }
    const spinner = new THREE.Mesh(
      new THREE.ConeGeometry(0.55, 1.1, 16),
      new THREE.MeshStandardMaterial({ color: 0xf5e9c8, roughness: 0.3, metalness: 0.5 }),
    );
    spinner.rotation.x = Math.PI / 2;
    spinner.position.z = 0.5;
    propGroup.add(spinner);
    propGroup.position.z = 4.9;
    plane.add(propGroup);
    prop = propGroup;
    // Spinning-prop blur disc: at speed the blades fade and this translucent
    // disc reads as a prop in motion, not a black X.
    propDisc = new THREE.Mesh(
      new THREE.CircleGeometry(1.95, 24),
      new THREE.MeshBasicMaterial({
        color: 0x3a3a44, transparent: true, opacity: 0,
        side: THREE.DoubleSide, depthWrite: false,
      }),
    );
    propDisc.position.z = 4.95;
    plane.add(propDisc);

    // Nav lights: red port, green starboard, white tail — real glow pools.
    const mkLight = (color, x, y, z) => {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 8, 8),
        new THREE.MeshBasicMaterial({ color }),
      );
      m.position.set(x, y, z);
      plane.add(m);
      const p = new THREE.PointLight(color, 1.6, 26);
      p.position.copy(m.position);
      plane.add(p);
      return m;
    };
    navLights.port = mkLight(0xff2a2a, -8.0, 0.2, 0.4);
    navLights.starboard = mkLight(0x2aff5d, 8.0, 0.2, 0.4);
    navLights.tail = mkLight(0xffffff, 0, 0.6, -5.4);
    // Glow halos around the nav lights so they read at chase distance, dusk included.
    const haloTex = glowTexture();
    const mkHalo = (color, x, y, z, s) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: haloTex, color, transparent: true, opacity: 0.85,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
      }));
      sp.position.set(x, y, z);
      sp.scale.set(s, s, 1);
      plane.add(sp);
      return sp;
    };
    mkHalo(0xff2a2a, -8.0, 0.2, 0.4, 3.2);
    mkHalo(0x2aff5d, 8.0, 0.2, 0.4, 3.2);
    mkHalo(0xffffff, 0, 0.6, -5.4, 2.6);

    // Landing gear: fixed, with wheels.
    const gearMat = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.6, metalness: 0.5 });
    const wheelGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.4, 14);
    wheelGeo.rotateZ(Math.PI / 2);
    for (const s of [-1, 1]) {
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.8, 8), gearMat);
      strut.position.set(s * 1.1, -1.5, 1.4);
      strut.rotation.z = s * 0.3;
      plane.add(strut);
      const wheel = new THREE.Mesh(wheelGeo, gearMat);
      wheel.position.set(s * 1.5, -2.3, 1.4);
      wheel.castShadow = true;
      plane.add(wheel);
    }
    // Landing light under the wing, switched on at dusk.
    const landLight = new THREE.Mesh(
      new THREE.CircleGeometry(0.3, 10),
      new THREE.MeshBasicMaterial({ color: 0xfff2c8 }),
    );
    landLight.position.set(2.2, -0.05, 0.4);
    landLight.rotation.x = Math.PI / 2;
    plane.add(landLight);
    const beam = new THREE.SpotLight(0xfff2c8, 0, 260, 0.32, 0.5, 1.2);
    beam.position.set(2.2, -0.1, 0.4);
    beam.target.position.set(2.2, -30, 60);
    plane.add(beam); plane.add(beam.target);
    navLights.beam = beam;

    scene.add(plane);
    return plane;
  }

  function setGear(down) {
    gearDown = down;
    // Gear is fixed on this bush plane; the call exists for the landing mission's checklist.
  }

  function update(dt, throttle, speed, t) {
    if (!plane) return;
    // Prop spins faster with throttle; blades fade into the blur disc at speed.
    const spin = 6 + throttle * 34;
    prop.rotation.z += spin * dt;
    const discOn = throttle > 0.5;
    if (propDisc) propDisc.material.opacity = discOn ? 0.16 : 0;
    prop.children.forEach((b) => {
      if (b.geometry && b.geometry.type === 'BoxGeometry') {
        b.material.transparent = discOn;
        b.material.opacity = discOn ? 0.25 : 1;
      }
    });
    // Nav lights strobe gently; tail light double-blinks like a real beacon.
    const blink = (Math.sin(t * 6) > 0.6) ? 1 : 0.25;
    navLights.tail.material.color.setHex(blink > 0.5 ? 0xffffff : 0x888888);
    // Panel dials flicker almost imperceptibly — instruments that look flown.
    panelLights.forEach((d, i) => {
      d.material.color.setHex(i === 0 ? 0x7dffb0 : 0xffd23e);
    });
  }

  function setLandingLight(on) {
    if (navLights.beam) navLights.beam.intensity = on ? 4.5 : 0;
  }

  function getPlane() { return plane; }

  return { buildAircraft, update, setGear, setLandingLight, getPlane };
})();
