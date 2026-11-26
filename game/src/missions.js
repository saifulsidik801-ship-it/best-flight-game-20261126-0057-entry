// Merapi Ring Run — sorties: what counts as progress, winning and losing.
// One clear job: the three missions' rules, scoring and end states.

const Missions = (function buildMissionsModule() {
  let mission = MISSIONS[0];
  let score = 0;
  let best = 0;
  let done = 0;          // rings threaded / crates dropped / landings
  let finished = false;  // sortie over (win or fail)
  let won = false;
  let startTime = 0;
  let elapsed = 0;
  let lastEvent = null;
  let lowFuelWarned = false;

  try { best = Number(localStorage.getItem('merapi-best') || 0); } catch (e) { best = 0; }

  function select(index) {
    mission = MISSIONS[index] || MISSIONS[0];
    return mission;
  }

  function start() {
    score = 0;
    done = 0;
    finished = false;
    won = false;
    elapsed = 0;
    startTime = performance.now();
    lowFuelWarned = false;
    lastEvent = null;
    Physics.reset(mission);
    Rings.reset();
    Rings.resetMarkers();
    Sky.setDusk(!!mission.dusk);
    Aircraft.setLandingLight(!!mission.dusk);
    return mission;
  }

  function fmtTime(sec) {
    sec = Math.max(0, sec);
    const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return m + ':' + String(s).padStart(2, '0');
  }

  function update(dt, stepInfo) {
    if (finished) return;
    elapsed += dt;
    const p = Physics.state;

    // Low-fuel warning once.
    if (p.fuel < 20 && !lowFuelWarned) {
      lowFuelWarned = true;
      lastEvent = { type: 'warn', text: 'LOW FUEL — HEAD FOR THE STRIP' };
    }

    if (mission.type === 'rings') {
      const hit = Rings.checkPass(p.pos);
      if (hit >= 0) {
        done++;
        score += CONFIG.ringScore + Math.max(0, 60 - Math.floor(elapsed)) ;
        AudioSys.ringChime();
        lastEvent = { type: 'ring', text: 'RING ' + done + ' / ' + mission.target + ' — +' + CONFIG.ringScore };
        if (done >= mission.target) endSortie(true, 'ALL 12 RINGS THREADED');
      }
    } else if (mission.type === 'crates') {
      const alt = p.pos.y - Terrain.heightAt(p.pos.x, p.pos.z);
      const hit = Rings.checkCrate(p.pos, alt);
      if (hit >= 0) {
        done++;
        score += CONFIG.crateScore;
        AudioSys.crateThud();
        lastEvent = { type: 'crate', text: 'SUPPLY DELIVERED ' + done + ' / ' + mission.target + ' — +' + CONFIG.crateScore };
        if (done >= mission.target) endSortie(true, 'ALL SUPPLIES DELIVERED');
      }
    } else if (mission.type === 'landing') {
      if (stepInfo && stepInfo.event && stepInfo.event.type === 'landed') {
        done = 1;
        const soft = Math.abs(p.pitch) < 0.12 ? 150 : 0;
        score += CONFIG.landingScore + soft;
        AudioSys.thump();
        endSortie(true, 'TOUCHDOWN — WELCOME HOME' + (soft ? ' · GREASED IT (+150)' : ''));
      }
    }

    // Crash / destroy ends the sortie.
    if (stepInfo && stepInfo.event) {
      const ev = stepInfo.event;
      if (ev.type === 'destroyed') {
        endSortie(false, 'AIRFRAME LOST — THE MOUNTAIN WINS THIS TIME');
      } else if (ev.type === 'crash') {
        AudioSys.thump();
        lastEvent = { type: 'crash', text: 'TERRAIN STRIKE — AIRFRAME ' + Math.max(0, Math.round(p.hull)) + '%' };
      }
    }
    // Fuel out over rough ground ends it too.
    if (p.fuel <= 0 && !p.onGround && !finished) {
      endSortie(false, 'OUT OF FUEL — FORCED LANDING IN THE VALLEY');
    }
    // Time bonus ticks while flying clean.
    if (!finished && p.speed > 30) score += dt * 1.5;
  }

  function endSortie(didWin, reason) {
    finished = true;
    won = didWin;
    if (didWin) {
      const bonus = Math.max(0, Math.floor(240 - elapsed)) * CONFIG.timeBonusPerSec;
      score += bonus;
      lastEvent = { type: 'win', text: reason + (bonus ? ' · TIME BONUS +' + bonus : '') };
    } else {
      lastEvent = { type: 'lose', text: reason };
    }
    score = Math.round(score);
    if (score > best) {
      best = score;
      try { localStorage.setItem('merapi-best', String(best)); } catch (e) {}
    }
  }

  function getState() {
    return {
      mission, score, best, done, finished, won, elapsed,
      lastEvent, target: mission.target,
    };
  }

  function clearEvent() { lastEvent = null; }

  return { select, start, update, getState, clearEvent, fmtTime };
})();
