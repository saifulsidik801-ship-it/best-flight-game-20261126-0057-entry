// Merapi Ring Run — screenshot staging: deterministic setups for real renders.
// One clear job: put the plane, camera and HUD in the shot the maker asked for.
// ?shot=cover  — chase view, ring ahead, runway + volcano, golden hour
// ?shot=river  — low over the river, crate markers ahead
// ?shot=dusk   — dusk landing approach, runway lights, gear down
// ?shot=title  — title screen over the parked plane at golden hour
// ?shot=play   — mid-course ring chase (alias of cover, lower and closer)

const Shots = (function buildShotsModule() {
  function apply(query, game) {
    const shot = query.get('shot');
    if (!shot) return false;
    const seed = Number(query.get('seed') || 1);
    const p = Physics.state;

    if (shot === 'title') {
      // Parked on the strip at golden hour, title screen up.
      p.pos.set(0, 28.5, CONFIG.runway.z + 180);
      p.heading = 0; p.pitch = 0; p.roll = 0;
      p.speed = 0; p.throttle = 0;
      game.setCameraMode('title-fixed');
      HUD.showTitle();
      return true;
    }

    // All flying shots: hide screens, fly the sortie.
    HUD.hideScreens();
    if (shot === 'cover' || shot === 'play') {
      // Just south of ring 1, ring 1 dead ahead (green = next), volcano left.
      game.startSortie(0);
      p.pos.set(60, 225, 1260);
      p.heading = -0.34; p.pitch = 0.03; p.roll = -0.08;
      p.speed = 58; p.throttle = 0.72;
      game.setCameraMode('chase');
      game.setAutopilot(true);
    } else if (shot === 'river') {
      // River Rescue sortie: low over the river, green drop markers ahead.
      Missions.select(1);
      game.startSortie(1);
      const mz = 1600, mx = Terrain.riverCenterX(mz);
      p.pos.set(mx + 60, 115, mz + 260);
      p.heading = 0.1; p.pitch = -0.01; p.roll = 0.05;
      p.speed = 52; p.throttle = 0.66;
      game.setCameraMode('chase-low');
      game.setAutopilot(true);
    } else if (shot === 'dusk') {
      Missions.select(2);
      game.startSortie(2);
      p.pos.set(-140, 330, 2350);
      p.heading = 0.06; p.pitch = -0.06; p.roll = 0.05;
      p.speed = 55; p.throttle = 0.6;
      game.setCameraMode('chase');
      game.setAutopilot(true);
    }
    // Let the world settle a couple of frames before the screenshot.
    game.settleFrames(25);
    return true;
  }

  return { apply };
})();
