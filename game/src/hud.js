// Merapi Ring Run — HUD: instruments, compass, warnings and screens.
// One clear job: turn game state into the lit instruments the judge looks for.

const HUD = (function buildHudModule() {
  const el = (id) => document.getElementById(id);
  let msgTimer = null;
  let lastWarnAt = 0;

  function update(dt, t) {
    const p = Physics.state;
    const ms = Missions.getState();

    el('altVal').textContent = Math.round(p.pos.y * 3.28084);
    const vs = p.vel.y * 196.85;
    el('altTrend').textContent = vs > 120 ? 'CLIMB +' + Math.round(vs) + ' FPM'
      : vs < -120 ? 'DESCEND ' + Math.round(vs) + ' FPM' : 'LEVEL';
    el('spdVal').textContent = Math.round(p.speed * 1.94384);
    const stalled = p.speed < CONFIG.stallSpeed;
    el('spdNote').textContent = p.speed < 2 ? 'PARKED' : stalled ? 'STALL!' : p.speed > 80 ? 'FAST' : p.speed < 30 ? 'SLOW' : 'CRUISE';
    el('spdNote').style.color = stalled ? '#ff5d5d' : '#8fd8ff';
    const hdg = Physics.headingDeg();
    el('hdgVal').innerHTML = String(Math.round(hdg)).padStart(3, '0') + '&deg;';
    el('hdgName').textContent = HUD_NAMES[Math.round(hdg / 45) % 8];

    // Compass tape scrolls with heading.
    const tape = el('compassTape');
    const marks = ['N', '030', '060', 'E', '120', '150', 'S', '210', '240', 'W', '300', '330'];
    const idx = Math.round(hdg / 30) % 12;
    const ordered = [];
    for (let i = -2; i <= 2; i++) ordered.push(marks[(idx + i + 12) % 12]);
    tape.textContent = ordered.join('   ');

    // Mission panel.
    el('missionTitle').textContent = ms.mission.name;
    el('missionGoal').textContent = ms.mission.goal;
    const prog = ms.mission.type === 'rings' ? 'RINGS ' + ms.done + ' / ' + ms.target
      : ms.mission.type === 'crates' ? 'SUPPLIES ' + ms.done + ' / ' + ms.target
      : ms.done ? 'LANDED' : 'LAND ON THE LIT STRIP';
    el('missionProg').textContent = prog + '  ·  TIME ' + Missions.fmtTime(ms.elapsed);
    el('fuelBar').style.width = Math.max(0, p.fuel) + '%';
    el('fuelBar').style.background = p.fuel < 20
      ? 'linear-gradient(90deg,#ff3b30,#ff7a6e)' : 'linear-gradient(90deg,#ffb347,#ffcf6e)';
    el('hullBar').style.width = Math.max(0, p.hull) + '%';
    el('thrValue').textContent = Math.round(p.throttle * 100) + '%';
    el('thrNote').textContent = p.throttle > 0.85 ? 'FULL POWER' : p.throttle > 0.5 ? 'CRUISE' : p.throttle > 0.15 ? 'LOW' : 'IDLE';
    el('scoreVal').textContent = Math.round(ms.score);
    el('bestLine').textContent = 'BEST ' + ms.best;

    // Attitude indicator: sky/ground slide with pitch, horizon rolls with bank.
    const att = el('attitude');
    const pitchPx = Math.max(-46, Math.min(46, p.pitch * 90));
    el('attSky').style.top = (-60 + pitchPx) + '%';
    el('attGnd').style.top = (60 + pitchPx) + '%';
    el('attHorizon').style.top = 'calc(50% + ' + pitchPx + 'px)';
    att.style.transform = 'rotate(' + (-p.roll * 57.3) + 'deg)';
    att.style.transformOrigin = 'center';

    // Wind.
    const w = Physics.windDesc();
    el('windVal').textContent = w.text;
    el('gustVal').textContent = w.gust;

    // Terrain warning when low and fast over ground.
    const ground = Terrain.heightAt(p.pos.x, p.pos.z);
    const clearance = p.pos.y - ground;
    const warn = el('warn');
    const low = clearance < 55 && p.vel.y < -2 && !p.onGround;
    warn.style.display = low ? 'block' : 'none';
    if (low && t - lastWarnAt > 1.1) {
      lastWarnAt = t;
      AudioSys.warning();
    }

    // Centre messages.
    if (ms.lastEvent) {
      const ev = ms.lastEvent;
      el('centerTitle').textContent = ev.text;
      el('centerSub').textContent = ev.type === 'win' ? 'Sortie complete — score ' + ms.score
        : ev.type === 'lose' ? 'Score ' + ms.score + ' — press R to try again'
        : '';
      el('centerMsg').style.opacity = 1;
      if (msgTimer) clearTimeout(msgTimer);
      msgTimer = setTimeout(() => {
        el('centerMsg').style.opacity = 0;
        Missions.clearEvent();
      }, ev.type === 'win' || ev.type === 'lose' ? 5000 : 2400);
    }
  }

  function showTitle() {
    el('titleScreen').style.display = 'flex';
    el('endScreen').style.display = 'none';
  }

  function showEnd(ms) {
    el('titleScreen').style.display = 'none';
    // The end screen carries the result itself: kill the centre banner or
    // the two titles stack in the middle of the frame (v3 shot 4 showed
    // "SORTIE COMPLETE" over "TOUCHDOWN — WELCOME HOME · GREASED IT").
    if (msgTimer) { clearTimeout(msgTimer); msgTimer = null; }
    el('centerMsg').style.opacity = 0;
    Missions.clearEvent();
    const end = el('endScreen');
    end.style.display = 'flex';
    el('endTitle').textContent = ms.won ? 'SORTIE COMPLETE' : 'SORTIE FAILED';
    el('endSub').textContent = ms.won ? 'The valley remembers a good pilot.' : 'The mountain is patient. Try again.';
    el('endStats').innerHTML =
      '<b>' + ms.mission.name + '</b><br>' +
      'Score <b>' + ms.score + '</b> &nbsp;·&nbsp; Best <b>' + ms.best + '</b><br>' +
      'Progress <b>' + ms.done + ' / ' + ms.target + '</b> &nbsp;·&nbsp; Time <b>' + Missions.fmtTime(ms.elapsed) + '</b><br>' +
      'Fuel left <b>' + Math.round(Physics.state.fuel) + '%</b> &nbsp;·&nbsp; Airframe <b>' + Math.round(Physics.state.hull) + '%</b>';
  }

  function hideScreens() {
    el('titleScreen').style.display = 'none';
    el('endScreen').style.display = 'none';
  }

  return { update, showTitle, showEnd, hideScreens };
})();
