import { clamp } from './config.js';

export function createAudio() {
  let context;
  let master;
  let engine;
  let harmonic;
  let engineGain;
  let windGain;
  let muted = false;
  function noiseBuffer() {
    const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const values = buffer.getChannelData(0);
    let last = 0;
    for (let index = 0; index < values.length; index += 1) {
      last = (last + (Math.random() * 2 - 1) * 0.12) / 1.12;
      values[index] = last * 2.7;
    }
    return buffer;
  }
  function unlock() {
    if (context) {
      if (context.state === 'suspended') context.resume().catch(() => {});
      return;
    }
    const AudioContextType = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextType) return;
    context = new AudioContextType();
    master = context.createGain();
    master.gain.value = muted ? 0 : 0.42;
    master.connect(context.destination);
    engineGain = context.createGain();
    engineGain.gain.value = 0;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 550;
    engine = context.createOscillator();
    engine.type = 'sawtooth';
    harmonic = context.createOscillator();
    harmonic.type = 'sine';
    engine.connect(filter);
    harmonic.connect(filter);
    filter.connect(engineGain).connect(master);
    engine.start();
    harmonic.start();
    const wind = context.createBufferSource();
    wind.buffer = noiseBuffer();
    wind.loop = true;
    const windFilter = context.createBiquadFilter();
    windFilter.type = 'highpass';
    windFilter.frequency.value = 650;
    windGain = context.createGain();
    windGain.gain.value = 0;
    wind.connect(windFilter).connect(windGain).connect(master);
    wind.start();
  }
  function tone(frequency, offset, duration, volume, type = 'sine') {
    if (!context) return;
    const start = context.currentTime + offset;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain).connect(master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }
  function effect(kind) {
    if (!context) return;
    if (kind === 'ring') {
      [660, 880, 1320].forEach((frequency, index) => tone(frequency, index * 0.07, 0.6, 0.24));
    } else if (kind === 'land') {
      tone(75, 0, 0.38, 0.7, 'triangle');
      [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => tone(frequency, 0.35 + index * 0.12, 0.8, 0.16));
    } else if (kind === 'crash') {
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = noiseBuffer();
      gain.gain.setValueAtTime(1, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 1.5);
      source.connect(gain).connect(master);
      source.start();
      source.stop(context.currentTime + 1.6);
      tone(47, 0, 1.2, 0.7, 'sawtooth');
    } else tone(400, 0, 0.1, 0.08);
  }
  return {
    unlock, effect,
    get muted() { return muted; },
    toggle() {
      muted = !muted;
      if (master) master.gain.setTargetAtTime(muted ? 0 : 0.42, context.currentTime, 0.08);
      return muted;
    },
    update(state, active) {
      if (!context) return;
      const now = context.currentTime;
      engine.frequency.setTargetAtTime(34 + state.throttle * 62 + state.speed * 0.15, now, 0.14);
      harmonic.frequency.setTargetAtTime(69 + state.throttle * 124, now, 0.14);
      engineGain.gain.setTargetAtTime(active && !state.crashed && state.fuel > 0 ? 0.045 + state.throttle * 0.075 : 0, now, 0.15);
      windGain.gain.setTargetAtTime(active ? clamp(state.speed / 240, 0, 0.4) : 0, now, 0.15);
    },
  };
}
