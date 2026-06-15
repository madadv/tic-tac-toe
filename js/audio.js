/*
 * audio.js — tiny Web Audio sound effects. No asset files; everything is
 * synthesized, so it adds zero network weight.
 */
(function (TTT) {
  'use strict';

  let ctx = null;
  let enabled = true;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) { try { ctx = new AC(); } catch (e) { ctx = null; } }
    }
    return ctx;
  }

  function setEnabled(v) {
    enabled = !!v;
    if (enabled) ensure(); // create on a user gesture so it's allowed to play
  }

  function tone(freq, dur, type, vol, when) {
    if (!enabled) return;
    const c = ensure();
    if (!c) return;
    if (c.state === 'suspended') c.resume();
    const t0 = c.currentTime + (when || 0);
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol || 0.15, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + (dur || 0.15));
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + (dur || 0.15) + 0.03);
  }

  function chord(freqs, step, dur, type, vol) {
    freqs.forEach((f, i) => tone(f, dur, type, vol, i * step));
  }

  const sounds = {
    place() { tone(320, 0.09, 'triangle', 0.12); },
    win() { chord([523, 659, 784, 1047], 0.09, 0.2, 'triangle', 0.16); },
    lose() { chord([392, 330, 262], 0.12, 0.24, 'sine', 0.16); },
    draw() { chord([440, 440], 0.14, 0.16, 'sine', 0.12); },
    small() { tone(660, 0.12, 'triangle', 0.14); }
  };

  TTT.audio = { setEnabled, sounds };
})(globalThis.TTT = globalThis.TTT || {});
