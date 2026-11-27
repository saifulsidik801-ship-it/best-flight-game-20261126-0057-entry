// Ashwing — flight physics. One job: how the airtanker flies.
// Arcade model: throttle sets speed, banking turns, pitch climbs and
// dives, the ground is a soft floor. Scooping happens low over the
// lake; dropping happens on SPACE. Exposes window.Physics with the
// state the playtest harness reads.
(function (global) {
  'use strict';
  var R = global.AshRng;
  var T = global.AshTerrain;

  function Physics(fireField) {
    this.fires = fireField;
    this.pos = new THREE.Vector3(-520, 26, -560);
    this.heading = Math.PI * 0.5; // flying east, along the lake
    this.speed = 34;
    this.throttle = 0.55;
    this.roll = 0;
    this.pitch = 0;
    this.fuel = 100;
    this.water = 0;
    this.scooping = false;
    this.dropping = false;
    this.dropTimer = 0;
    this.keys = {};
    this.auto = null; // autopilot target {x, z, alt} or null
  }

  Physics.prototype.reset = function (x, z, y, heading, water) {
    this.pos.set(x, y, z);
    this.heading = heading;
    this.speed = 34;
    this.throttle = 0.55;
    this.roll = 0; this.pitch = 0;
    this.fuel = 100;
    this.water = water;
    this.scooping = false; this.dropping = false;
    this.auto = null;
  };

  Physics.prototype.groundBelow = function () {
    return T.isOverLake(this.pos.x, this.pos.z) ? T.WATER_Y : T.heightAt(this.pos.x, this.pos.z);
  };

  Physics.prototype.step = function (dt) {
    var k = this.keys;
    // --- input ---
    var throttleIn = 0;
    if (k['KeyW']) throttleIn += 1;
    if (k['KeyS']) throttleIn -= 1;
    var rollIn = 0;
    if (k['ArrowLeft']) rollIn -= 1;
    if (k['ArrowRight']) rollIn += 1;
    var pitchIn = 0;
    if (k['ArrowUp']) pitchIn -= 1;
    if (k['ArrowDown']) pitchIn += 1;

    // --- autopilot overrides input when set ---
    if (this.auto) {
      var dx = this.auto.x - this.pos.x, dz = this.auto.z - this.pos.z;
      var want = Math.atan2(dx, dz);
      var diff = want - this.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      rollIn = R.clamp(-diff * 1.6, -1, 1); // bank toward the target: heading rises when rolling left
      var altErr = this.auto.alt - this.pos.y;
      pitchIn = R.clamp(-altErr * 0.03, -1, 1);
      throttleIn = this.auto.slow ? -0.15 : 0.3;
    }

    // --- throttle / speed ---
    this.throttle = R.clamp(this.throttle + throttleIn * 0.5 * dt, 0, 1);
    if (this.fuel <= 0) this.throttle = 0;
    var targetSpeed = 16 + this.throttle * 46;
    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * 0.9);

    // --- bank -> turn, pitch -> climb ---
    var targetRoll = rollIn * 0.85;
    this.roll += (targetRoll - this.roll) * Math.min(1, dt * 2.2);
    this.heading += -this.roll * 0.55 * dt * (this.speed / 40);
    var targetPitch = R.clamp(pitchIn * 0.32, -0.32, 0.32);
    this.pitch += (targetPitch - this.pitch) * Math.min(1, dt * 2.0);

    // --- integrate ---
    var fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    this.pos.x += fx * this.speed * dt;
    this.pos.z += fz * this.speed * dt;
    this.pos.y += Math.sin(-this.pitch) * this.speed * dt;

    // --- world bounds: steer back inside ---
    var bx = R.clamp(this.pos.x, -1150, 1150), bz = R.clamp(this.pos.z, -1150, 1150);
    if (bx !== this.pos.x || bz !== this.pos.z) {
      this.pos.x = bx; this.pos.z = bz;
      this.heading += Math.PI * 0.9 * dt;
    }

    // --- soft ground floor ---
    var ground = this.groundBelow();
    var minAlt = ground + 4;
    if (this.pos.y < minAlt) this.pos.y = minAlt;
    if (this.pos.y > 420) this.pos.y = 420;

    // --- scoop: low + fast over the lake ---
    this.scooping = false;
    if (T.isOverLake(this.pos.x, this.pos.z) && this.pos.y < 8 && this.speed > 22 && this.water < 100) {
      this.scooping = true;
      this.water = Math.min(100, this.water + 30 * dt);
    }

    // --- drop: SPACE (or click) while tanked ---
    var wantDrop = !!k['Space'] || !!k['MouseDrop'];
    if (wantDrop && this.water > 0 && !this.dropping) this.dropping = true;
    if (this.dropping) {
      this.dropTimer += dt;
      this.water = Math.max(0, this.water - 55 * dt);
      if (this.dropTimer >= 0.12) {
        this.dropTimer = 0;
        this.fires.dropWater(this.pos.x, this.pos.z, 0.34);
      }
      if (this.water <= 0 || !wantDrop) this.dropping = false;
    }

    this.fuel = Math.max(0, this.fuel - 0.12 * dt);
  };

  // Forward vector (unit) in world space.
  Physics.prototype.forward = function () {
    return { x: Math.sin(this.heading), z: Math.cos(this.heading) };
  };

  // The harness reads window.Physics.state — keep these exact fields.
  Physics.prototype.expose = function () {
    var self = this;
    global.Physics = {
      state: {
        get speed() { return self.speed; },
        get throttle() { return self.throttle; },
        get pos() { return self.pos; },
        get roll() { return self.roll; },
        get heading() { return self.heading; },
        get fuel() { return self.fuel; },
        get water() { return self.water; }
      }
    };
  };

  global.AshPhysics = { Physics: Physics };
})(typeof window !== 'undefined' ? window : globalThis);
