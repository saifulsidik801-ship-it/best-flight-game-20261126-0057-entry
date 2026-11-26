// Merapi Ring Run — sound: everything synthesized with WebAudio, no assets.
// One clear job: engine hum, wind rush, ring chimes and landing thumps.

const AudioSys = (function buildAudioModule() {
  let ctx = null, master = null, engineOsc = null, engineGain = null, windGain = null, windSrc = null;
  let muted = false, started = false;

  function ensure() {
    if (ctx) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      // Engine: two detuned saws through a low-pass, pitch follows throttle.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 62;
      const engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'sawtooth';
      engineOsc2.frequency.value = 93;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 2;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0.0;
      engineOsc.connect(lp); engineOsc2.connect(lp);
      lp.connect(engineGain); engineGain.connect(master);
      engineOsc.start(); engineOsc2.start();
      // Wind: looped filtered noise, gain follows airspeed.
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      windSrc = ctx.createBufferSource();
      windSrc.buffer = buf; windSrc.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.6;
      windGain = ctx.createGain();
      windGain.gain.value = 0.0;
      windSrc.connect(bp); bp.connect(windGain); windGain.connect(master);
      windSrc.start();
      started = true;
    } catch (e) {
      ctx = null;
    }
  }

  function update(throttle, speed) {
    if (!ctx || muted) return;
    if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime;
    engineGain.gain.setTargetAtTime(0.05 + throttle * 0.11, t, 0.1);
    engineOsc.frequency.setTargetAtTime(58 + throttle * 70, t, 0.1);
    windGain.gain.setTargetAtTime(Math.min(0.22, Math.max(0, speed - 18) * 0.004), t, 0.2);
  }

  function blip(freq, dur, type, vol) {
    if (!ctx || muted) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.25, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(master);
    o.start(); o.stop(ctx.currentTime + dur);
  }

  function ringChime() {
    blip(880, 0.35, 'sine', 0.3);
    setTimeout(() => blip(1318, 0.5, 'sine', 0.22), 70);
  }

  function crateThud() {
    blip(180, 0.25, 'triangle', 0.35);
    setTimeout(() => blip(520, 0.3, 'sine', 0.2), 90);
  }

  function warning() { blip(440, 0.18, 'square', 0.12); }

  function thump() { blip(90, 0.4, 'sine', 0.4); }

  function toggleMute() {
    muted = !muted;
    if (master) master.gain.value = muted ? 0 : 0.5;
    return muted;
  }

  return { ensure, update, ringChime, crateThud, warning, thump, toggleMute };
})();
