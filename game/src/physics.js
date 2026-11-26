// Merapi Ring Run — flight model: lift, stall, wind, terrain and landing.
// One clear job: move the plane like a plane, and say what happened when it stops.

const Physics = (function buildPhysicsModule() {
  const state = {
    pos: new THREE.Vector3(0, 260, 1750),
    vel: new THREE.Vector3(0, 0, 0),
    heading: 0,        // radians, 0 = north (-Z), grows clockwise
    pitch: 0,          // radians, + = nose up
    roll: 0,           // radians, + = right wing down
    throttle: 0.6,
    speed: 55,
    fuel: CONFIG.startFuel,
    hull: 100,
    onGround: false,
    crashed: false,
    landed: false,
    windDir: 0.9,      // radians the wind blows FROM
    windSpeed: 5,      // m/s base
    gust: 0,
    time: 0,
  };

  function reset(mission) {
    const s = mission.start;
    state.pos.set(s.x, s.y, s.z);
    state.heading = s.heading;
    state.pitch = 0;
    state.roll = 0;
    state.throttle = 0.55;
    state.speed = s.speed;
    state.fuel = CONFIG.startFuel;
    state.hull = 100;
    state.onGround = false;
    state.crashed = false;
    state.landed = false;
    state.time = 0;
    state.gust = 0;
    // Fresh wind each sortie: direction from the north-west, 4–9 m/s.
    const rng = makeRng(Date.now() % 100000);
    state.windDir = 0.6 + rng() * 0.7;
    state.windSpeed = 4 + rng() * 5;
  }

  function windAt(t) {
    // Slow gusts: a 7-second swell plus a faster ripple.
    const g = Math.sin(t * 0.9) * 0.6 + Math.sin(t * 2.7 + 1.7) * 0.4;
    state.gust = g;
    const speed = Math.max(0, state.windSpeed + g * 3.5);
    return {
      x: Math.sin(state.windDir) * speed,
      z: Math.cos(state.windDir) * speed,
      speed,
    };
  }

  // Forward unit vector from heading/pitch/roll (roll does not change direction).
  function forward() {
    const cp = Math.cos(state.pitch), sp = Math.sin(state.pitch);
    return new THREE.Vector3(
      Math.sin(state.heading) * cp,
      sp,
      -Math.cos(state.heading) * cp,
    );
  }

  function step(dt, ctrl) {
    if (state.crashed || state.landed) return { event: null };
    state.time += dt;
    const wind = windAt(state.time);

    // --- Throttle and speed ---
    state.throttle = Math.max(0, Math.min(1, state.throttle + Input.throttleDelta(dt)));
    const target = state.throttle * CONFIG.cruiseSpeed;
    const drag = CONFIG.dragBase + (ctrl.brake ? CONFIG.airbrakeDrag : 0);
    // Lift bleeds speed in a climb, adds it in a dive — throttle discipline matters.
    const climbFactor = 1 - Math.sin(state.pitch) * 0.55;
    state.speed += (target * climbFactor - state.speed) * Math.min(1, (0.35 + drag * 8) * dt);
    state.speed = Math.max(0, Math.min(CONFIG.maxSpeed, state.speed));

    // --- Attitude ---
    const rollTarget = ctrl.roll * 0.95;
    state.roll += (rollTarget - state.roll) * Math.min(1, 3.2 * dt);
    const pitchTarget = ctrl.pitch * 0.42;
    state.pitch += (pitchTarget - state.pitch) * Math.min(1, 2.6 * dt);
    // Banked turn: heading follows roll, tighter when fast.
    // Positive roll = right wing down = right turn = heading grows.
    const turnRate = Math.sin(state.roll) * CONFIG.rollRate * (0.5 + state.speed / 120);
    state.heading += turnRate * dt + ctrl.yaw * CONFIG.yawRate * dt;
    // Stall: below stall speed the nose drops and the wings stop answering.
    const stalled = state.speed < CONFIG.stallSpeed && !state.onGround;
    if (stalled) {
      state.pitch += (-0.35 - state.pitch) * Math.min(1, 1.5 * dt);
      state.roll *= (1 - 0.4 * dt);
    }

    // --- Position ---
    const fwd = forward();
    const lift = Math.max(0, state.speed * CONFIG.liftFactor);
    // Level flight balances at cruise speed: slow flight sinks, fast flight climbs.
    const vy = Math.sin(state.pitch) * state.speed + (lift - 3.41) * 4.0;
    state.vel.set(
      fwd.x * state.speed + wind.x,
      vy,
      fwd.z * state.speed + wind.z,
    );
    // Volcano thermal: rising air on the sunny shoulder lifts the plane.
    const dx = state.pos.x - CONFIG.volcano.x, dz = state.pos.z - CONFIG.volcano.z;
    const vd = Math.sqrt(dx * dx + dz * dz);
    if (vd < CONFIG.volcano.radius && state.pos.y < 700) {
      state.vel.y += 3.2 * (1 - vd / CONFIG.volcano.radius);
    }
    state.pos.addScaledVector(state.vel, dt);

    // --- Fuel ---
    const burn = CONFIG.fuelBurnIdle + (CONFIG.fuelBurnCruise - CONFIG.fuelBurnIdle) * state.throttle;
    state.fuel = Math.max(0, state.fuel - burn * dt);
    if (state.fuel <= 0 && state.throttle > 0) state.throttle = 0;

    // --- Ground ---
    const ground = Terrain.heightAt(state.pos.x, state.pos.z);
    const clearance = state.pos.y - ground;
    let event = null;
    const rw = CONFIG.runway;
    const onStrip = Math.abs(state.pos.x - rw.x) < rw.width / 2 + 4 &&
                    Math.abs(state.pos.z - rw.z) < rw.length / 2;
    if (clearance <= 2.5) {
      if (onStrip && Math.abs(state.pitch) < 0.22 && Math.abs(state.roll) < 0.3 &&
          state.speed < 48 && state.speed > 12) {
        // Touchdown: gentle enough to count as a landing.
        state.onGround = true;
        state.pos.y = ground + 2.5;
        state.speed = Math.max(0, state.speed - 26 * dt);
        if (state.speed < 6) { state.landed = true; event = { type: 'landed' }; }
      } else if (state.speed > 4) {
        // Terrain strike.
        state.hull -= CONFIG.terrainHitDamage;
        state.pos.y = ground + 2.5;
        state.speed *= 0.35;
        event = { type: 'crash', hull: state.hull };
        if (state.hull <= 0) { state.crashed = true; event.type = 'destroyed'; }
        else { state.pitch = 0.25; }
      } else {
        state.onGround = true;
        state.pos.y = ground + 2.5;
      }
    } else {
      state.onGround = false;
    }

    // --- Bounds: turn back at the map edge ---
    const half = CONFIG.worldSize / 2 - 60;
    if (Math.abs(state.pos.x) > half || Math.abs(state.pos.z) > half) {
      state.heading += Math.PI * dt * 0.4;
    }
    if (state.pos.y > 1400) state.pos.y = 1400;

    return { event, clearance, stalled, wind, onStrip };
  }

  function applyToPlane(plane) {
    plane.position.copy(state.pos);
    plane.rotation.order = 'YXZ';
    plane.rotation.y = state.heading;
    plane.rotation.x = -state.pitch;
    plane.rotation.z = -state.roll;
  }

  function headingDeg() {
    // Heading in degrees, 0 = north, growing clockwise (east = 90).
    let d = (state.heading * 180) / Math.PI % 360;
    if (d < 0) d += 360;
    return d;
  }

  function windDesc() {
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const deg = ((state.windDir * 180) / Math.PI % 360 + 360) % 360;
    const idx = Math.round(deg / 45) % 8;
    const kt = Math.round(state.windSpeed * 1.94);
    return { text: kt + ' kt ' + dirs[idx], gust: state.gust > 0.55 ? 'STRONG' : state.gust > 0.15 ? 'MODERATE' : 'CALM' };
  }

  return { state, reset, step, applyToPlane, headingDeg, windDesc, forward };
})();
