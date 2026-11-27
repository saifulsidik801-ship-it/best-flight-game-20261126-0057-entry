// Ashwing — HUD. One job: the instruments. Every number on screen
// is read live from the sim, never staged: speed, altitude, heading,
// throttle, fuel, water, town health, fires, acres, score.
(function (global) {
  'use strict';

  function Hud() {
    this.el = {};
    var ids = ['missionName', 'fireCount', 'acreCount', 'scoreCount', 'townFill', 'waterFill',
      'gSpd', 'gAlt', 'gHdg', 'gThr', 'gFuel', 'msg', 'title', 'end', 'endTitle', 'endNums'];
    for (var i = 0; i < ids.length; i++) this.el[ids[i]] = document.getElementById(ids[i]);
  }

  function fmtHdg(h) {
    var d = Math.round(((h % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) * 180 / Math.PI);
    return ('00' + d).slice(-3);
  }

  Hud.prototype.update = function (physics, missions, fires) {
    var p = physics, m = missions;
    this.el.missionName.textContent = m.mission.name + ' — ' + m.mission.goal;
    this.el.fireCount.textContent = String(fires.burningCount());
    this.el.acreCount.textContent = String(Math.round(fires.acresSaved));
    this.el.scoreCount.textContent = String(m.score);
    this.el.townFill.style.width = Math.max(0, Math.round(m.town.health)) + '%';
    this.el.townFill.style.background = m.town.health > 50
      ? 'linear-gradient(90deg,#37d67a,#9be15d)'
      : (m.town.health > 25 ? 'linear-gradient(90deg,#ffb62e,#ff7a2a)' : 'linear-gradient(90deg,#ff5a3c,#c1272d)');
    this.el.waterFill.style.width = Math.round(p.water) + '%';
    this.el.gSpd.textContent = String(Math.round(p.speed * 1.94));
    this.el.gAlt.textContent = String(Math.round(p.pos.y * 3.28));
    this.el.gHdg.textContent = fmtHdg(p.heading);
    this.el.gThr.textContent = String(Math.round(p.throttle * 100));
    var fuelEl = this.el.gFuel;
    fuelEl.textContent = String(Math.round(p.fuel));
    fuelEl.className = p.fuel < 20 ? 'warn' : '';
    if (m.messageTimer > 0 && m.message && !m.done) {
      this.el.msg.textContent = m.message;
      this.el.msg.classList.remove('hidden');
    } else {
      this.el.msg.classList.add('hidden');
    }
  };

  Hud.prototype.showTitle = function (show) {
    this.el.title.classList.toggle('hidden', !show);
  };

  Hud.prototype.showEnd = function (show, won, fires, missions) {
    this.el.end.classList.toggle('hidden', !show);
    if (!show) return;
    this.el.msg.classList.add('hidden'); // no stale callout over the results
    this.el.endTitle.textContent = won ? 'TOWN SAVED' : 'TOWN LOST';
    this.el.endTitle.classList.toggle('lost', !won);
    this.el.endNums.innerHTML =
      'ACRES SAVED <b>' + Math.round(fires.acresSaved) + '</b><br>' +
      'FIRES PUT OUT <b>' + fires.firesOut + '</b><br>' +
      'TOWN HEALTH <b>' + Math.round(missions.town.health) + '%</b><br>' +
      'FINAL SCORE <b>' + missions.score + '</b>';
  };

  global.AshHud = { Hud: Hud };
})(typeof window !== 'undefined' ? window : globalThis);
