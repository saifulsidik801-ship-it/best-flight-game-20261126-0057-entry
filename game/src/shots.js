// Aurora Ring Run — screenshot staging: deterministic setups for real renders.
// One clear job: put the plane, camera and HUD in the shot the maker asked for.
// ?shot=cover  — chase view, aurora rings ahead, bay + station below
// ?shot=river  — low over the ice river, crate markers + icebreaker ahead
// ?shot=dusk   — night landing approach, lit strip, aurora overhead
// ?shot=title  — title screen over the parked plane on the ice strip
// ?shot=play   — mid-course ring chase (alias of cover, lower and closer)
// ?shot=landing — night touchdown on the lit ice strip, skis down, chase-low

const Shots = (function buildShotsModule() {
  function apply(query, game) {
    const shot = query.get('shot');
    if (!shot) return false;
    const seed = Number(query.get('seed') || 1);
    const p = Physics.state;

    if (shot === 'title') {
      // Parked on the ice strip at polar night, title screen up.
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
      // South of the bay, lined up on ring 1 (heading 0.42 points
      // straight at it from here) with the autopilot holding wings-level.
      // DRIFT-AWARE STAGING (v4, kept): the shutter fires ~5-6 game-seconds
      // after staging, so the plane flies ~280 m before the shot — judge
      // the frame from the CAPTURE position, never from staging. Staging
      // 150 m further south at 50 m/s puts the nearest ring ~250 m away
      // at capture: no ring wider than ~120 px, none cut by an edge.
      // At capture the frame holds: aurora ribbons + stars + moon above,
      // the ice field and frozen bay with icebergs below, Polaris Station
      // lights ahead-left, the lead's dark water ahead-right.
      game.startSortie(0);
      p.pos.set(520, 190, 1450);
      p.heading = 0.42; p.pitch = 0.02; p.roll = 0;
      p.speed = 50; p.throttle = 0.72;
      game.setCameraMode('chase');
      game.setAutopilot(true);
    } else if (shot === 'river') {
      // Ice River Supply Drop: staged right OVER the lead (it runs at
      // x≈240 here) flying due north along it, LOW (55 m) and banked 0.22
      // so the frame holds the dark water ribbon below-ahead, the green
      // marker beams ahead-left, the icebreaker in the lead and the north
      // camp ahead-right, floes and icebergs both sides, aurora overhead.
      // STAGING ACCOUNTS FOR CAPTURE DRIFT: physics keeps running during
      // the settle, and the shutter fires ~5-6 game-seconds after staging
      // (HUD TIME 0:05-0:06 on the VM) — the plane flies ~270 m north in
      // that time. So the plane is staged ~270 m SOUTH of where it must
      // be at capture: (206, 55, -29) puts it over the lead at (240, ~49,
      // -295) when the shutter fires, with the z=-400 marker ~110 m ahead
      // and the icebreaker ~410 m ahead.
      // No autopilot: it would yank the plane toward the lead centre and
      // swing the ship out of frame. Manual trim, straight north.
      // Mid-sortie fuel so the fuel bar reads flown, not just spawned.
      Missions.select(1);
      game.startSortie(1);
      p.pos.set(206, 55, -29);
      p.heading = 0.15; p.pitch = -0.01; p.roll = 0.22;
      p.speed = 52; p.throttle = 0.66;
      p.fuel = 60;
      game.setCameraMode('chase-low');
    } else if (shot === 'dusk') {
      // Night approach: LOW and close to the strip (150 m, 430 m out) and
      // lined up with the lit strip (heading -0.78 points straight at it),
      // so the frame holds the approach lights, the PAPI and the lit strip
      // BIG, the aurora + moon overhead, Polaris Station's lit windows to
      // the side, and pressure ridges + ice spires below. The old 650 m
      // staging showed the strip as a smudge.
      // Mid-sortie fuel so the fuel bar reads flown, not just spawned.
      Missions.select(2);
      game.startSortie(2);
      p.pos.set(430, 150, 1980);
      p.heading = -0.78; p.pitch = -0.06; p.roll = 0.05;
      p.speed = 55; p.throttle = 0.6;
      p.fuel = 60;
      game.setCameraMode('chase');
      game.setAutopilot(true);
    } else if (shot === 'landing') {
      // Glacier Night Landing, on short final over the lit ice strip: skis
      // down, about to touch down. Staged ON the runway plateau (ground is
      // flat 26 m there) — the ground just south of the strip is rolling
      // snow, so staging south of the threshold at low altitude spawns the
      // plane inside a drift and strikes instantly. No autopilot: the
      // landing autopilot climbs for 120 m and would fight the descent.
      // Manual trim, throttle 0.50, gentle ~3.8 m/s sink — still airborne
      // on final when the shutter fires, strip lights ahead, no strike.
      // DRIFT-AWARE (v4, validated): 31 m/s at throttle 0.50 holds
      // ~31 m/s = ~60 kt at capture with ~3.8 m/s sink (-748 FPM) from
      // 52 m — still airborne at capture across the 3-6 s drift range
      // (touchdown ~7.3 s in). No physics constants changed; only the
      // staging numbers. The v4 numbers transfer unchanged because the
      // runway sits at the same place on the same flat 26 m plateau.
      // PULL UP (hud.js: clearance < 55 m AND sink < -2 m/s shows the
      // red terrain banner): at 55-65 kt the sink is always -3.0..-4.2
      // m/s, so the ONLY clean-final route is clearance >= 55 m at
      // capture. Staging y 108 puts the plane 85-93 m up at capture
      // (clearance 59-67 m over the 26 m plateau) — a normal final
      // approach, no banner, still 60 kt / -705 FPM / skis down.
      Missions.select(2);
      game.startSortie(2);
      p.pos.set(0, 108, CONFIG.runway.z + 210);
      p.heading = 0; p.pitch = -0.01; p.roll = 0;
      p.speed = 31; p.throttle = 0.50;
      game.setCameraMode('chase-low');
    }
    // Let the world settle a couple of frames before the screenshot.
    game.settleFrames(25);
    return true;
  }

  return { apply };
})();
