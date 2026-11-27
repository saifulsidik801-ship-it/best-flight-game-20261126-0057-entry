// Ashwing — missions. One job: the three sorties and what winning
// means. Score = acres saved and fires put out; the town takes damage
// while fires burn close to it. Exposes window.Missions with the
// state the playtest harness reads.
(function (global) {
  'use strict';
  var T = global.AshTerrain;

  var MISSIONS = [
    { id: 1, name: 'FIRE ATTACK', goal: 'Put out every fire on the line' },
    { id: 2, name: 'RIVER SCOOP RUN', goal: 'Fill the tank from the lake' },
    { id: 3, name: 'TOWN DEFENSE', goal: 'Hold the line — the town is close' }
  ];

  function Missions(physics, fireField, rng) {
    this.physics = physics;
    this.fires = fireField;
    this.rng = rng;
    this.mission = MISSIONS[0];
    this.done = false;
    this.won = false;
    this.score = 0;
    this.town = { x: T.TOWN.x, z: T.TOWN.z, health: 100 };
    this.message = '';
    this.messageTimer = 0;
  }

  Missions.prototype.say = function (text, seconds) {
    this.message = text;
    this.messageTimer = seconds || 3;
  };

  Missions.prototype.setupMission = function (id) {
    var m = MISSIONS[id - 1] || MISSIONS[0];
    this.mission = m;
    this.done = false;
    this.won = false;
    var p = this.physics;
    if (id === 1) {
      this.fires.clear();
      this.seedFireLine(6);
      this.town.health = 100;
      p.reset(-520, -560, 26, Math.PI * 0.5, 50);
      this.say('FIRE ATTACK — scoop the lake, drop on the peat line');
    } else if (id === 2) {
      this.town.health = Math.max(this.town.health, 80);
      p.reset(-820, -260, 6, Math.PI * 0.5, 0);
      this.say('RIVER SCOOP RUN — stay low over the lake to fill the tank');
    } else {
      this.fires.clear();
      this.seedFireLine(5);
      // three fires already close to town
      this.fires.addFire(T.TOWN.x - 190, T.TOWN.z + 60, 0.9);
      this.fires.addFire(T.TOWN.x - 120, T.TOWN.z + 150, 0.85);
      this.fires.addFire(T.TOWN.x - 60, T.TOWN.z - 170, 0.8);
      this.town.health = 55;
      p.reset(180, 60, 60, Math.PI * 0.9, 100);
      this.say('TOWN DEFENSE — the peat fire is at the edge of Rimba Jaya!');
    }
  };

  // The fire line: a ragged row of fires in the forest between lake and town.
  Missions.prototype.seedFireLine = function (count) {
    for (var i = 0; i < count; i++) {
      var t = count === 1 ? 0.5 : i / (count - 1);
      var x = -60 + t * 420 + (this.rng() - 0.5) * 90;
      var z = 60 + t * 320 + (this.rng() - 0.5) * 90;
      if (T.isOverLake(x, z)) { x += 160; }
      this.fires.addFire(x, z, 0.7 + this.rng() * 0.3);
    }
  };

  Missions.prototype.update = function (dt) {
    if (this.messageTimer > 0) this.messageTimer -= dt;
    this.score = this.fires.score;
    if (this.done) return;
    var burning = this.fires.burningCount();
    if (this.mission.id === 2) {
      if (this.physics.water >= 98) {
        this.done = true; this.won = true;
        this.fires.score += 500;
        this.score = this.fires.score;
        this.say('TANK FULL — take it to the fire line!');
      }
    } else if (burning === 0 && this.fires.fires.length > 0) {
      this.done = true; this.won = true;
      var bonus = Math.round(this.town.health * 5);
      this.fires.score += bonus;
      this.score = this.fires.score;
      this.say('ALL FIRES OUT');
    }
    if (this.town.health <= 0 && !this.done) {
      this.done = true; this.won = false;
      this.say('THE TOWN IS LOST');
    }
    if (this.physics.scooping && this.mission.id !== 2) {
      this.say('SCOOPING…');
    } else if (this.physics.dropping) {
      this.say('WATER AWAY — ON THE FIRE!');
    } else if (this.physics.water >= 98 && this.mission.id !== 2 && burning > 0) {
      this.say('TANK FULL — HIT THE FIRE LINE (SPACE to drop)');
    }
  };

  // The harness reads window.Missions.getState() — keep these exact fields.
  Missions.prototype.expose = function () {
    var self = this;
    global.Missions = {
      getState: function () {
        return {
          mission: { id: self.mission.id, name: self.mission.name },
          done: self.done,
          score: self.score
        };
      }
    };
  };

  global.AshMissions = { Missions: Missions, LIST: MISSIONS };
})(typeof window !== 'undefined' ? window : globalThis);
