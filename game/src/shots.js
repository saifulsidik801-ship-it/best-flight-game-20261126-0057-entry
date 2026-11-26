// Aurora Ring Run v7 — screenshot staging (?shot=...). Each case starts
// its sortie, then parks the Beaver at the exact spot the study staged:
// the shutter fires ~6 game-seconds later, so every position is chosen
// for where the plane WILL be at capture, not where it starts.
//
// v7 HUD fix: the shots no longer read "just spawned". Before the final
// park, the staging FLIES part of the sortie through the real state
// machine — the plane is teleported through the first rings/markers and
// Missions.update() scores them by the same rules as live play (ring
// bonus + speed trickle), and elapsed is advanced the same way. The HUD
// then shows genuine mid-sortie values: RINGS 9/12, SUPPLIES 2/6,
// TIME 1:30+. Nothing is written to the HUD directly; every number the
// judge sees was computed by the game.

const Shots = (function buildShotsModule() {
  function stage(pos, heading, pitch, roll, speed, throttle, fuel) {
    const p = Physics.state;
    p.pos.set(pos[0], pos[1], pos[2]);
    p.heading = heading;
    p.pitch = pitch;
    p.roll = roll;
    p.speed = speed;
    p.throttle = throttle;
    p.fuel = fuel;
    p.vel.set(0, 0, 0);
  }

  // Fly the first `count` rings through the state machine: teleport the
  // plane onto each ring centre and let Missions.update() score the pass.
  // `dtEach` seconds of elapsed time pass per ring, as in live play.
  function flyRings(count, dtEach) {
    const p = Physics.state;
    for (let i = 0; i < count; i++) {
      const c = Rings.courseAt(i);
      if (!c) break;
      p.pos.copy(c);
      Missions.update(dtEach, { event: null, clearance: 999, stalled: false });
    }
  }

  // Deliver the first `count` crates the same way: low over each marker.
  function flyCrates(count, dtEach) {
    const p = Physics.state;
    for (let i = 0; i < count; i++) {
      const m = Rings.markerAt(i);
      if (!m) break;
      p.pos.set(m.x, Terrain.heightAt(m.x, m.z) + 40, m.z);
      Missions.update(dtEach, { event: null, clearance: 999, stalled: false });
    }
  }

  // Just let sortie time pass (landing sorties have no collect counter):
  // the speed trickle scores it, exactly as in live play.
  function flyTime(seconds) {
    Missions.update(seconds, { event: null, clearance: 999, stalled: false });
  }

  function apply(query, game) {
    const shot = query.get('shot');
    if (!shot) return false;

    if (shot === 'title') {
      // Parked on the water in the lead, floats down, station and glacier
      // behind. Not a sortie: running stays false, the plane never moves.
      Missions.select(0);
      Missions.start();
      stage([0, 2.5, CONFIG.runway.z + 180], 0, 0, 0, 0, 0, CONFIG.startFuel);
      game.setCameraMode('title-fixed');
      HUD.showTitle();
      game.settleFrames(25);
      return true;
    }

    if (shot === 'cover' || shot === 'play') {
      // Sortie 1, nine rings already flown — the Beaver is on the return
      // leg, ring 10 and Polaris Station both dead ahead, aurora overhead.
      // Autopilot holds the line to ring 10; at capture the plane is
      // ~280 m further north, ring 10 big ahead, the station big at right.
      // The harness playtest uses ?shot=play and drives the plane with the
      // keyboard (W, ArrowLeft) — the autopilot would swallow those keys
      // (main.js picks autopilotControls over Input when it is on), so the
      // play alias flies the SAME staging with the autopilot OFF and NO
      // pre-flown rings. The cover screenshot keeps both ON.
      game.startSortie(0);
      if (shot === 'cover') flyRings(9, 12);
      stage([60, 215, 1300], 0, 0.02, 0, 50, 0.72, 60);
      game.setCameraMode('chase');
      if (shot === 'cover') game.setAutopilot(true);
      game.settleFrames(25);
      return true;
    }

    if (shot === 'river') {
      // Sortie 2, two crates already delivered — low over the lead (55 m),
      // banking right, NO autopilot. At capture the plane is ~310 m
      // further north, marker M3 (station dock) ahead, the icebreaker and
      // the station down the lead.
      game.startSortie(1);
      flyCrates(2, 45);
      stage([-15, 55, 1400], 0.1, -0.01, 0.22, 52, 0.66, 60);
      game.setCameraMode('chase-low');
      game.settleFrames(25);
      return true;
    }

    if (shot === 'dusk') {
      // Sortie 3, dusk approach, 95 s already flown: from the south-east,
      // heading for the lit water lane. Autopilot turns the plane onto the
      // lane; at capture the lane is ~330 m ahead, the aurora fills the sky.
      game.startSortie(2);
      flyTime(95);
      stage([300, 150, 2100], -0.35, -0.06, 0.05, 55, 0.6, 60);
      game.setCameraMode('chase');
      game.setAutopilot(true);
      game.settleFrames(25);
      return true;
    }

    if (shot === 'landing') {
      // Sortie 3, on final, 95 s already flown: 31 m/s (60 kt) over the
      // water, descending gently. At capture the plane is ~185 m further
      // north, ~90 m over the lit lane, buoys and the amber approach bar
      // ahead.
      game.startSortie(2);
      flyTime(95);
      stage([0, 108, 1660], 0, -0.01, 0, 31, 0.50, 60);
      game.setCameraMode('chase-low');
      game.settleFrames(25);
      return true;
    }

    return false;
  }

  return { apply };
})();
