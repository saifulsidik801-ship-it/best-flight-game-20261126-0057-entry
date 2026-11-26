// Aurora Ring Run v6 — sortie state machine. Three sortie types share one
// flow: score for goals, a small trickle for flying fast, a time bonus on
// a win, and a hard end on a wreck or an empty tank.

const Missions = (function buildMissionsModule() {
  let mission = MISSIONS[0];
  let score = 0;
  let best = 0;
  let done = 0;
  let finished = false;
  let won = false;
  let elapsed = 0;
  let lastEvent = null;
  let lastAirSpeed = 0; // speed just before the floats touched — the softness test

  function select(i) { mission = MISSIONS[i]; }

  function start() {
    Physics.reset(mission);
    Rings.reset();
    Rings.resetMarkers();
    Rings.setGoalsVisible(mission.type);
    Sky.setDusk(!!mission.dusk);
    Aircraft.setLandingLight(!!mission.dusk);
    score = 0;
    done = 0;
    finished = false;
    won = false;
    elapsed = 0;
    lastEvent = null;
    lastAirSpeed = 0;
  }

  function endSortie(w, reason) {
    if (finished) return;
    finished = true;
    won = w;
    if (w) score += Math.max(0, Math.floor(240 - elapsed)) * CONFIG.timeBonusPerSec;
    score = Math.round(score);
    if (score > best) best = score;
    if (reason) lastEvent = { type: w ? 'won' : 'lost', text: reason };
  }

  function update(dt, stepInfo) {
    if (finished) return;
    elapsed += dt;
    const p = Physics.state;
    if (!p.onGround) lastAirSpeed = p.speed;

    if (mission.type === 'rings') {
      if (Rings.checkPass(p.pos)) {
        done++;
        score += CONFIG.ringScore + Math.max(0, 60 - Math.floor(elapsed));
        lastEvent = { type: 'ring', text: 'RING ' + done + ' / ' + mission.target };
        if (done >= mission.target) {
          endSortie(true, 'ALL ' + mission.target + ' RINGS — SORTIE CLEAR');
          return;
        }
      }
    } else if (mission.type === 'crates') {
      const alt = p.pos.y - Terrain.heightAt(p.pos.x, p.pos.z);
      if (Rings.checkCrate(p.pos, alt)) {
        done++;
        score += CONFIG.crateScore;
        lastEvent = { type: 'crate', text: 'SUPPLY DROP ' + done + ' / ' + mission.target };
        if (done >= mission.target) {
          endSortie(true, 'ALL ' + mission.target + ' DROPS DELIVERED');
          return;
        }
      }
    } else if (mission.type === 'landing') {
      if (stepInfo.event && stepInfo.event.type === 'landed') {
        done = 1;
        // Gentle touchdown pays: the slower the floats met the water, the
        // bigger the bonus (touchdown is legal up to 48 m/s).
        const soft = Math.max(0, Math.round((48 - lastAirSpeed) * 4));
        score += CONFIG.landingScore + soft;
        endSortie(true, 'LANDED ON THE LIT LANE — BEAVER DOWN SAFE');
        return;
      }
    }

    if (stepInfo.event) {
      if (stepInfo.event.type === 'destroyed') {
        lastEvent = { type: 'destroyed', text: 'WRECKED — HULL GONE' };
        endSortie(false);
        return;
      }
      if (stepInfo.event.type === 'crash') {
        lastEvent = {
          type: 'crash',
          text: 'TERRAIN STRIKE — HULL ' + Math.max(0, Math.round(p.hull)) + '%',
        };
        // A strike that did not destroy the plane does not end the sortie;
        // the pilot flies on, damaged.
      }
    }

    if (p.fuel <= 0) {
      lastEvent = { type: 'lost', text: 'OUT OF FUEL — GLIDE IT DOWN' };
      endSortie(false);
      return;
    }

    // Flying fast pays a little, every second — this is the score that
    // shows in the screenshots mid-sortie.
    if (p.speed > 30) score += dt * 1.5;
  }

  function getState() {
    return {
      mission, score: Math.round(score), best, done, finished, won,
      elapsed, lastEvent, target: mission.target,
    };
  }

  function clearEvent() { lastEvent = null; }

  function fmtTime(s) {
    const m = Math.floor(s / 60);
    const ss = Math.floor(s % 60);
    return m + ':' + String(ss).padStart(2, '0');
  }

  return { select, start, update, getState, clearEvent, fmtTime };
})();
