// Tiny synthesised sound effects, built with the Web Audio API only — no
// audio files, so the game stays offline and self-contained. Everything is
// guarded: if audio is unavailable (or no gesture has happened yet) the calls
// silently do nothing and the game plays on mute.

export function makeSfx() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let muted = false;

  function ensure() {
    if (ctx || muted) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function tone(freq, dur, type = 'sine', vol = 0.12, slideTo = null, delay = 0) {
    const ac = ensure();
    if (!ac) return;
    try {
      const t0 = ac.currentTime + delay;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain).connect(ac.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch {
      // Sound is decoration; never let it break the game.
    }
  }

  return {
    unlock() {
      const ac = ensure();
      if (ac && ac.state === 'suspended') ac.resume().catch(() => {});
    },
    toggleMute() {
      muted = !muted;
      if (muted) this.engineOff();
      return muted;
    },
    get muted() {
      return muted;
    },
    click() {
      tone(660, 0.07, 'triangle', 0.08);
    },
    ring() {
      tone(880, 0.16, 'sine', 0.14);
      tone(1318, 0.28, 'sine', 0.12, null, 0.09);
    },
    crash() {
      tone(160, 0.5, 'sawtooth', 0.16, 45);
      tone(70, 0.6, 'square', 0.1, 30, 0.05);
    },
    win() {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'triangle', 0.12, null, i * 0.12));
    },
    engineOn() {
      const ac = ensure();
      if (!ac || engineOsc) return;
      try {
        engineOsc = ac.createOscillator();
        engineGain = ac.createGain();
        engineOsc.type = 'sawtooth';
        engineOsc.frequency.value = 52;
        engineGain.gain.value = 0.015;
        const filter = ac.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 320;
        engineOsc.connect(filter).connect(engineGain).connect(ac.destination);
        engineOsc.start();
      } catch {
        engineOsc = null;
      }
    },
    engineSet(throttle, speedNorm) {
      if (!engineOsc || !ctx) return;
      try {
        engineOsc.frequency.setTargetAtTime(48 + throttle * 55 + speedNorm * 20, ctx.currentTime, 0.1);
        engineGain.gain.setTargetAtTime(0.012 + throttle * 0.02, ctx.currentTime, 0.1);
      } catch {
        // ignore
      }
    },
    engineOff() {
      if (!engineOsc) return;
      try {
        engineOsc.stop();
      } catch {
        // already stopped
      }
      engineOsc = null;
      engineGain = null;
    },
  };
}
