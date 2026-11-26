// Merapi Ring Run — input: keyboard and mouse.
// One clear job: turn keys and mouse into a single control state.

const Input = (function buildInputModule() {
  const keys = {};
  let mouseX = 0, mouseActive = false;
  let onKey = null; // callback for single-press actions (set by main.js)

  function init() {
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      if (!keys[e.code]) {
        keys[e.code] = true;
        if (onKey) onKey(e.code, e.key);
      }
    });
    window.addEventListener('keyup', (e) => { keys[e.code] = false; });
    window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
    window.addEventListener('mousemove', (e) => {
      mouseX = (e.clientX / window.innerWidth) * 2 - 1;
      mouseActive = true;
    });
    window.addEventListener('mousedown', () => { mouseActive = true; });
  }

  function isDown(code) { return !!keys[code]; }

  // Continuous control axes, -1..1.
  function controls() {
    const pitch = (isDown('ArrowDown') ? 1 : 0) - (isDown('ArrowUp') ? 1 : 0);
    let roll = (isDown('ArrowRight') ? 1 : 0) - (isDown('ArrowLeft') ? 1 : 0);
    // Mouse steers gently when moved — desktop mouse play, as the brief asks.
    if (mouseActive && Math.abs(mouseX) > 0.08) roll += mouseX * 0.45;
    const yaw = (isDown('KeyD') ? 1 : 0) - (isDown('KeyA') ? 1 : 0);
    const brake = isDown('Space') ? 1 : 0;
    return {
      pitch: Math.max(-1, Math.min(1, pitch)),
      roll: Math.max(-1, Math.min(1, roll)),
      yaw: Math.max(-1, Math.min(1, yaw)),
      brake,
    };
  }

  function throttleDelta(dt) {
    let d = 0;
    if (isDown('KeyW')) d += CONFIG.throttleRate * dt;
    if (isDown('KeyS')) d -= CONFIG.throttleRate * dt;
    return d;
  }

  function setKeyHandler(fn) { onKey = fn; }

  return { init, isDown, controls, throttleDelta, setKeyHandler };
})();
