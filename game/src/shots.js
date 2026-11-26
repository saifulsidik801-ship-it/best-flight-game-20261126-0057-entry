// Aurora Ring Run v6 — screenshot staging (?shot=...). Each case starts
// its sortie, then parks the Beaver at the exact spot the study staged:
// the shutter fires ~5-6 game-seconds later, so every position is chosen
// for where the plane WILL be at capture, not where it starts.

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
      // Sortie 1, flying north toward ring 1 with the station ahead-right.
      // Autopilot holds the line; at capture the plane is ~275 m further
      // north, ring 1 big ahead, station lights in the distance.
      // The harness playtest uses ?shot=play and drives the plane with the
      // keyboard (W, ArrowLeft) — the autopilot would swallow those keys
      // (main.js picks autopilotControls over Input when it is on), so the
      // play alias flies the SAME staging with the autopilot OFF. The cover
      // screenshot keeps it ON for the best framing.
      game.startSortie(0);
      stage([100, 190, 1700], 0.1, 0.02, 0, 50, 0.72, 60);
      game.setCameraMode('chase');
      if (shot === 'cover') game.setAutopilot(true);
      game.settleFrames(25);
      return true;
    }

    if (shot === 'river') {
      // Sortie 2, low over the lead (55 m), banking right, NO autopilot —
      // the pilot flies it. At capture the plane is ~285 m further north,
      // marker M1 dead ahead, the icebreaker and the station down the lead.
      game.startSortie(1);
      stage([-15, 55, 1400], 0.1, -0.01, 0.22, 52, 0.66, 60);
      game.setCameraMode('chase-low');
      game.settleFrames(25);
      return true;
    }

    if (shot === 'dusk') {
      // Sortie 3, dusk approach: from the south-east, heading for the lit
      // water lane. Autopilot turns the plane onto the lane; at capture the
      // lane is ~370 m ahead, the aurora fills the sky.
      game.startSortie(2);
      stage([300, 150, 2100], -0.35, -0.06, 0.05, 55, 0.6, 60);
      game.setCameraMode('chase');
      game.setAutopilot(true);
      game.settleFrames(25);
      return true;
    }

    if (shot === 'landing') {
      // Sortie 3, on final: 31 m/s (60 kt) over the water, descending
      // gently. At capture the plane is ~170 m further north, ~90 m over
      // the lit lane, buoys and the amber approach bar ahead.
      game.startSortie(2);
      stage([0, 108, 1660], 0, -0.01, 0, 31, 0.50, 60);
      game.setCameraMode('chase-low');
      game.settleFrames(25);
      return true;
    }

    return false;
  }

  return { apply };
})();
