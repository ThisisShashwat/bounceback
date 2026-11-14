let audioCtx = null;
const soundBuffers = new Map();
let currentLoopSource = null;
let currentLoopGain = null;
let sharedNoiseBuffer = null;
let sharedDistortionCurve = null;

let masterGain = null;
let masterCompressor = null;
let sfxBus = null;
let musicBus = null;

const LEVEL_BPMS = [112, 124, 138, 152];
const PROGRESSION_ROOTS = [82.41, 97.99, 110.00, 130.81];

let musicPlaying = false;
let musicSchedulerTimer = null;
let musicProceduralGain = null;
let musicNextNoteTime = 0;
let musicStep = 0;
let currentMusicLevel = 0;
let targetMusicLevel = 0;
let currentBpm = LEVEL_BPMS[0];

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
      initGraph(audioCtx);
    }
  }
  return audioCtx;
}

function initGraph(ctx) {
  if (masterGain) return;
  masterCompressor = ctx.createDynamicsCompressor();
  masterCompressor.threshold.setValueAtTime(-14, ctx.currentTime);
  masterCompressor.knee.setValueAtTime(12, ctx.currentTime);
  masterCompressor.ratio.setValueAtTime(8, ctx.currentTime);
  masterCompressor.attack.setValueAtTime(0.003, ctx.currentTime);
  masterCompressor.release.setValueAtTime(0.15, ctx.currentTime);

  masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.8, ctx.currentTime);

  sfxBus = ctx.createGain();
  sfxBus.gain.setValueAtTime(1.0, ctx.currentTime);

  musicBus = ctx.createGain();
  musicBus.gain.setValueAtTime(0.35, ctx.currentTime);

  sfxBus.connect(masterGain);
  musicBus.connect(masterGain);
  masterGain.connect(masterCompressor);
  masterCompressor.connect(ctx.destination);
}

function getNoiseBuffer(ctx) {
  if (!sharedNoiseBuffer || sharedNoiseBuffer.sampleRate !== ctx.sampleRate) {
    const length = ctx.sampleRate * 2;
    sharedNoiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = sharedNoiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }
  return sharedNoiseBuffer;
}

function getDistortionCurve() {
  if (!sharedDistortionCurve) {
    const samples = 1024;
    const curve = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = Math.tanh(3.5 * x);
    }
    sharedDistortionCurve = curve;
  }
  return sharedDistortionCurve;
}

function playSynthBoing(ctx, volume, rate) {
  const now = ctx.currentTime;
  const dur = 0.2 / Math.max(0.1, rate);

  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(520 * rate, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, 160 * rate), now + dur);

  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.setValueAtTime(20 * rate, now);
  lfoGain.gain.setValueAtTime(15 * rate, now);
  lfo.connect(osc.frequency);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume * 0.9, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

  osc.connect(gain);
  gain.connect(sfxBus);

  lfo.start(now);
  osc.start(now);
  lfo.stop(now + dur);
  osc.stop(now + dur);
}

function playSynthBigBoing(ctx, volume, rate) {
  const now = ctx.currentTime;
  const dur = 0.38 / Math.max(0.1, rate);

  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(240 * rate, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, 65 * rate), now + dur);

  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.setValueAtTime(14 * rate, now);
  lfoGain.gain.setValueAtTime(12 * rate, now);
  lfo.connect(osc.frequency);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume * 0.9, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

  osc.connect(gain);
  gain.connect(sfxBus);

  const subDur = 0.15 / Math.max(0.1, rate);
  const subOsc = ctx.createOscillator();
  subOsc.type = "sine";
  subOsc.frequency.setValueAtTime(110 * rate, now);
  subOsc.frequency.exponentialRampToValueAtTime(Math.max(20, 35 * rate), now + subDur);

  const subGain = ctx.createGain();
  subGain.gain.setValueAtTime(volume * 0.95, now);
  subGain.gain.exponentialRampToValueAtTime(0.001, now + subDur);

  subOsc.connect(subGain);
  subGain.connect(sfxBus);

  lfo.start(now);
  osc.start(now);
  subOsc.start(now);
  lfo.stop(now + dur);
  osc.stop(now + dur);
  subOsc.stop(now + subDur);
}

function playSynthSplat(ctx, volume, rate) {
  const now = ctx.currentTime;
  const dur = 0.22 / Math.max(0.1, rate);

  const noise = ctx.createBufferSource();
  noise.buffer = getNoiseBuffer(ctx);
  noise.playbackRate.value = rate;

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1000 * rate, now);
  filter.frequency.exponentialRampToValueAtTime(Math.max(30, 120 * rate), now + dur);
  filter.Q.value = 2.0;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume * 0.85, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(sfxBus);

  const thudDur = 0.15 / Math.max(0.1, rate);
  const thudOsc = ctx.createOscillator();
  thudOsc.type = "sine";
  thudOsc.frequency.setValueAtTime(80 * rate, now);
  thudOsc.frequency.exponentialRampToValueAtTime(Math.max(20, 40 * rate), now + thudDur);

  const thudGain = ctx.createGain();
  thudGain.gain.setValueAtTime(volume * 0.9, now);
  thudGain.gain.exponentialRampToValueAtTime(0.001, now + thudDur);

  thudOsc.connect(thudGain);
  thudGain.connect(sfxBus);

  noise.start(now);
  thudOsc.start(now);
  noise.stop(now + dur);
  thudOsc.stop(now + thudDur);
}

function playSynthSmash(ctx, volume, rate) {
  const now = ctx.currentTime;
  const dur = 0.32 / Math.max(0.1, rate);

  const noise = ctx.createBufferSource();
  noise.buffer = getNoiseBuffer(ctx);
  noise.playbackRate.value = rate;

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(1200 * rate, now);
  filter.Q.value = 1.5;

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(volume * 0.8, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(sfxBus);

  const clankDur = 0.09 / Math.max(0.1, rate);
  const sq1 = ctx.createOscillator();
  const sq2 = ctx.createOscillator();
  sq1.type = "square";
  sq2.type = "square";
  sq1.frequency.setValueAtTime(840 * rate, now);
  sq2.frequency.setValueAtTime(1190 * rate, now);

  const clankGain = ctx.createGain();
  clankGain.gain.setValueAtTime(volume * 0.35, now);
  clankGain.gain.exponentialRampToValueAtTime(0.001, now + clankDur);

  sq1.connect(clankGain);
  sq2.connect(clankGain);
  clankGain.connect(sfxBus);

  const thudDur = 0.18 / Math.max(0.1, rate);
  const thudOsc = ctx.createOscillator();
  thudOsc.type = "sine";
  thudOsc.frequency.setValueAtTime(130 * rate, now);
  thudOsc.frequency.exponentialRampToValueAtTime(Math.max(20, 35 * rate), now + thudDur);

  const thudGain = ctx.createGain();
  thudGain.gain.setValueAtTime(volume * 0.85, now);
  thudGain.gain.exponentialRampToValueAtTime(0.001, now + thudDur);

  thudOsc.connect(thudGain);
  thudGain.connect(sfxBus);

  noise.start(now);
  sq1.start(now);
  sq2.start(now);
  thudOsc.start(now);
  noise.stop(now + dur);
  sq1.stop(now + clankDur);
  sq2.stop(now + clankDur);
  thudOsc.stop(now + thudDur);
}

function playSynthCheer(ctx, volume, rate) {
  const now = ctx.currentTime;
  const dur = 1.5 / Math.max(0.1, rate);

  const masterGainNode = ctx.createGain();
  masterGainNode.gain.setValueAtTime(0.001, now);
  masterGainNode.gain.linearRampToValueAtTime(volume * 0.85, now + 0.45 * dur);
  masterGainNode.gain.exponentialRampToValueAtTime(0.001, now + dur);
  masterGainNode.connect(sfxBus);

  const formants = [520, 900, 1450];
  const wobbleSpeeds = [5.5, 7.3, 9.1];

  formants.forEach((freq, idx) => {
    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer(ctx);
    noise.playbackRate.value = rate * (0.95 + idx * 0.05);

    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(freq * rate, now);
    bp.Q.value = 2.5;

    const layerGain = ctx.createGain();
    layerGain.gain.setValueAtTime(0.35, now);

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.setValueAtTime(wobbleSpeeds[idx] * rate, now);
    lfoGain.gain.setValueAtTime(0.2, now);
    lfo.connect(lfoGain);
    lfoGain.connect(layerGain.gain);

    noise.connect(bp);
    bp.connect(layerGain);
    layerGain.connect(masterGainNode);

    lfo.start(now);
    noise.start(now);
    lfo.stop(now + dur);
    noise.stop(now + dur);
  });
}

function playSynthBoo(ctx, volume, rate) {
  const now = ctx.currentTime;
  const dur = 1.0 / Math.max(0.1, rate);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(450 * rate, now);
  filter.frequency.exponentialRampToValueAtTime(Math.max(40, 240 * rate), now + dur);
  filter.Q.value = 2.2;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(volume * 0.75, now + 0.08 * dur);
  gain.gain.setValueAtTime(volume * 0.75, now + 0.6 * dur);
  gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

  filter.connect(gain);
  gain.connect(sfxBus);

  const detunes = [-3, 0, 4];
  detunes.forEach((cents) => {
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    const baseFreq = 110 * rate * Math.pow(2, cents / 1200);
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, baseFreq * 0.68), now + dur);
    osc.connect(filter);
    osc.start(now);
    osc.stop(now + dur);
  });
}

function playSynthRiff(ctx, volume, rate) {
  const now = ctx.currentTime;
  const root = 82.41 * rate;
  const step = 0.12 / Math.max(0.1, rate);

  const oscRoot = ctx.createOscillator();
  const oscFifth = ctx.createOscillator();
  const oscOct = ctx.createOscillator();
  oscRoot.type = "sawtooth";
  oscFifth.type = "sawtooth";
  oscOct.type = "sawtooth";
  oscRoot.frequency.setValueAtTime(root, now);
  oscFifth.frequency.setValueAtTime(root * 1.4983, now);
  oscOct.frequency.setValueAtTime(root * 2, now);

  const preGain = ctx.createGain();
  preGain.gain.setValueAtTime(0.4, now);

  const shaper = ctx.createWaveShaper();
  shaper.curve = getDistortionCurve();

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";

  const envGain = ctx.createGain();

  oscRoot.connect(preGain);
  oscFifth.connect(preGain);
  oscOct.connect(preGain);
  preGain.connect(shaper);
  shaper.connect(filter);
  filter.connect(envGain);
  envGain.connect(sfxBus);

  for (let i = 0; i < 4; i++) {
    const t = now + i * step;
    envGain.gain.setValueAtTime(0.001, t);
    envGain.gain.linearRampToValueAtTime(volume * 0.85, t + 0.005);
    envGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08 / Math.max(0.1, rate));
    filter.frequency.setValueAtTime(1400 * rate, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, 600 * rate), t + 0.08 / Math.max(0.1, rate));
  }

  const tR = now + 4 * step;
  const ringDur = 0.85 / Math.max(0.1, rate);
  envGain.gain.setValueAtTime(0.001, tR);
  envGain.gain.linearRampToValueAtTime(volume * 1.0, tR + 0.005);
  envGain.gain.exponentialRampToValueAtTime(0.001, tR + ringDur);
  filter.frequency.setValueAtTime(3200 * rate, tR);
  filter.frequency.exponentialRampToValueAtTime(Math.max(40, 1100 * rate), tR + ringDur);

  const totalDur = 4 * step + ringDur;
  oscRoot.start(now);
  oscFifth.start(now);
  oscOct.start(now);
  oscRoot.stop(now + totalDur);
  oscFifth.stop(now + totalDur);
  oscOct.stop(now + totalDur);
}

function playSynthVenue(venueKey, ctx, volume, rate) {
  const configs = {
    venue_divebar: { root: 82.41, chugs: 2, ring: 0.55, mult: 1.0 },
    venue_stadium: { root: 97.99, chugs: 3, ring: 0.7, mult: 1.15 },
    venue_clouds: { root: 110.00, chugs: 3, ring: 0.85, mult: 1.3 },
    venue_moon: { root: 73.42, chugs: 4, ring: 1.1, mult: 1.5 },
  };
  const cfg = configs[venueKey] || configs.venue_divebar;
  const now = ctx.currentTime;
  const root = cfg.root * rate;
  const step = 0.11 / Math.max(0.1, rate);

  const oscRoot = ctx.createOscillator();
  const oscFifth = ctx.createOscillator();
  const oscOct = ctx.createOscillator();
  oscRoot.type = "sawtooth";
  oscFifth.type = "sawtooth";
  oscOct.type = "sawtooth";
  oscRoot.frequency.setValueAtTime(root, now);
  oscFifth.frequency.setValueAtTime(root * 1.4983, now);
  oscOct.frequency.setValueAtTime(root * 2, now);

  const preGain = ctx.createGain();
  preGain.gain.setValueAtTime(0.35 * cfg.mult, now);

  const shaper = ctx.createWaveShaper();
  shaper.curve = getDistortionCurve();

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";

  const envGain = ctx.createGain();

  oscRoot.connect(preGain);
  oscFifth.connect(preGain);
  oscOct.connect(preGain);
  preGain.connect(shaper);
  shaper.connect(filter);
  filter.connect(envGain);
  envGain.connect(sfxBus);

  for (let i = 0; i < cfg.chugs; i++) {
    const t = now + i * step;
    envGain.gain.setValueAtTime(0.001, t);
    envGain.gain.linearRampToValueAtTime(volume * 0.85, t + 0.005);
    envGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08 / Math.max(0.1, rate));
    filter.frequency.setValueAtTime(1400 * rate, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, 600 * rate), t + 0.08 / Math.max(0.1, rate));
  }

  const tR = now + cfg.chugs * step;
  const ringDur = cfg.ring / Math.max(0.1, rate);
  envGain.gain.setValueAtTime(0.001, tR);
  envGain.gain.linearRampToValueAtTime(volume * Math.min(1.0, 0.9 * cfg.mult), tR + 0.005);
  envGain.gain.exponentialRampToValueAtTime(0.001, tR + ringDur);
  filter.frequency.setValueAtTime((2800 + cfg.chugs * 200) * rate, tR);
  filter.frequency.exponentialRampToValueAtTime(Math.max(40, 900 * rate), tR + ringDur);

  const totalDur = cfg.chugs * step + ringDur;
  oscRoot.start(now);
  oscFifth.start(now);
  oscOct.start(now);
  oscRoot.stop(now + totalDur);
  oscFifth.stop(now + totalDur);
  oscOct.stop(now + totalDur);

  if (venueKey === "venue_moon") {
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = "sine";
    sub.frequency.setValueAtTime(root, tR);
    sub.frequency.exponentialRampToValueAtTime(Math.max(20, 36 * rate), tR + ringDur * 0.6);
    subGain.gain.setValueAtTime(volume * 0.8, tR);
    subGain.gain.exponentialRampToValueAtTime(0.001, tR + ringDur * 0.6);
    sub.connect(subGain);
    subGain.connect(sfxBus);
    sub.start(tR);
    sub.stop(tR + ringDur * 0.6);
  }
}

function playSynthPianoWarning(ctx, volume, rate) {
  const now = ctx.currentTime;
  const hits = [
    { time: now, freq: 55 * rate, dur: 0.22 / Math.max(0.1, rate), vol: 0.75 },
    { time: now + 0.26 / Math.max(0.1, rate), freq: 55 * rate, dur: 0.22 / Math.max(0.1, rate), vol: 0.8 },
    { time: now + 0.52 / Math.max(0.1, rate), freq: 41.2 * rate, dur: 0.55 / Math.max(0.1, rate), vol: 1.0 },
  ];

  hits.forEach((hit) => {
    const tri = ctx.createOscillator();
    const sine = ctx.createOscillator();
    tri.type = "triangle";
    sine.type = "sine";
    tri.frequency.setValueAtTime(hit.freq, hit.time);
    sine.frequency.setValueAtTime(hit.freq, hit.time);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1100 * rate, hit.time);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, hit.time);
    gain.gain.linearRampToValueAtTime(volume * hit.vol, hit.time + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.001, hit.time + hit.dur);

    tri.connect(filter);
    sine.connect(filter);
    filter.connect(gain);
    gain.connect(sfxBus);

    tri.start(hit.time);
    sine.start(hit.time);
    tri.stop(hit.time + hit.dur);
    sine.stop(hit.time + hit.dur);
  });
}

function playSynthWin(ctx, volume, rate) {
  const now = ctx.currentTime;
  const chords = [82.41, 97.99, 110.00, 164.81];
  const step = 0.22 / Math.max(0.1, rate);

  chords.forEach((baseRoot, idx) => {
    const t = now + idx * step;
    const isLast = idx === chords.length - 1;
    const dur = isLast ? 1.2 / Math.max(0.1, rate) : 0.2 / Math.max(0.1, rate);
    const root = baseRoot * rate;

    const oscRoot = ctx.createOscillator();
    const oscFifth = ctx.createOscillator();
    const oscOct = ctx.createOscillator();
    oscRoot.type = "sawtooth";
    oscFifth.type = "sawtooth";
    oscOct.type = "sawtooth";
    oscRoot.frequency.setValueAtTime(root, t);
    oscFifth.frequency.setValueAtTime(root * 1.4983, t);
    oscOct.frequency.setValueAtTime(root * 2, t);

    const preGain = ctx.createGain();
    preGain.gain.setValueAtTime(0.35, t);

    const shaper = ctx.createWaveShaper();
    shaper.curve = getDistortionCurve();

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(3200 * rate, t);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(volume * 0.9, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    oscRoot.connect(preGain);
    oscFifth.connect(preGain);
    oscOct.connect(preGain);
    preGain.connect(shaper);
    shaper.connect(filter);
    filter.connect(gain);
    gain.connect(sfxBus);

    oscRoot.start(t);
    oscFifth.start(t);
    oscOct.start(t);
    oscRoot.stop(t + dur);
    oscFifth.stop(t + dur);
    oscOct.stop(t + dur);
  });

  playSynthCheer(ctx, volume * 0.85, rate);
}

function playSynthLose(ctx, volume, rate) {
  const now = ctx.currentTime;
  const notes = [
    { freq: 146.83 * rate, dur: 0.24 / Math.max(0.1, rate), at: 0 },
    { freq: 138.59 * rate, dur: 0.24 / Math.max(0.1, rate), at: 0.26 / Math.max(0.1, rate) },
    { freq: 130.81 * rate, dur: 0.24 / Math.max(0.1, rate), at: 0.52 / Math.max(0.1, rate) },
    { freq: 123.47 * rate, dur: 0.95 / Math.max(0.1, rate), at: 0.78 / Math.max(0.1, rate), last: true },
  ];

  notes.forEach((note) => {
    const t = now + note.at;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(note.freq, t);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(750 * rate, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, 380 * rate), t + note.dur);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(volume * 0.8, t + 0.02);
    gain.gain.setValueAtTime(volume * 0.8, t + note.dur * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.001, t + note.dur);

    if (note.last) {
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.setValueAtTime(5.5 * rate, t);
      lfoGain.gain.setValueAtTime(8 * rate, t);
      lfo.connect(osc.frequency);
      lfo.start(t + 0.2);
      lfo.stop(t + note.dur);

      osc.frequency.setValueAtTime(note.freq, t + 0.4);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, note.freq * 0.82), t + note.dur);
    }

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(sfxBus);

    osc.start(t);
    osc.stop(t + note.dur);
  });
}

function playSynthDraw(ctx, volume, rate) {
  const now = ctx.currentTime;
  const dur = 1.1 / Math.max(0.1, rate);

  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  osc1.type = "sawtooth";
  osc2.type = "sawtooth";
  osc1.frequency.setValueAtTime(82.41 * rate, now);
  osc2.frequency.setValueAtTime(116.54 * rate, now);

  const preGain = ctx.createGain();
  preGain.gain.setValueAtTime(0.35, now);

  const shaper = ctx.createWaveShaper();
  shaper.curve = getDistortionCurve();

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(2200 * rate, now);
  filter.frequency.exponentialRampToValueAtTime(Math.max(40, 600 * rate), now + dur);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(volume * 0.85, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

  osc1.connect(preGain);
  osc2.connect(preGain);
  preGain.connect(shaper);
  shaper.connect(filter);
  filter.connect(gain);
  gain.connect(sfxBus);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + dur);
  osc2.stop(now + dur);
}

function playSynthWhoosh(ctx, volume, rate) {
  const now = ctx.currentTime;
  const dur = 0.4 / Math.max(0.1, rate);

  const noise = ctx.createBufferSource();
  noise.buffer = getNoiseBuffer(ctx);
  noise.playbackRate.value = rate;

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(250 * rate, now);
  filter.frequency.exponentialRampToValueAtTime(3200 * rate, now + dur);
  filter.Q.value = 1.8;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(volume * 0.8, now + dur * 0.65);
  gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(sfxBus);

  noise.start(now);
  noise.stop(now + dur);
}

function playSynthIncoming(ctx, volume, rate) {
  const now = ctx.currentTime;
  const beeps = [
    { freq: 850 * rate, at: 0, dur: 0.05 / Math.max(0.1, rate) },
    { freq: 1250 * rate, at: 0.06 / Math.max(0.1, rate), dur: 0.06 / Math.max(0.1, rate) },
    { freq: 850 * rate, at: 0.18 / Math.max(0.1, rate), dur: 0.05 / Math.max(0.1, rate) },
    { freq: 1250 * rate, at: 0.24 / Math.max(0.1, rate), dur: 0.09 / Math.max(0.1, rate) },
  ];

  beeps.forEach((b) => {
    const t = now + b.at;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(b.freq, t);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(volume * 0.7, t + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.001, t + b.dur);

    osc.connect(gain);
    gain.connect(sfxBus);

    osc.start(t);
    osc.stop(t + b.dur);
  });
}

function playSynthHeckle(ctx, volume, rate) {
  const now = ctx.currentTime;
  const dur = 0.14 / Math.max(0.1, rate);

  const noise = ctx.createBufferSource();
  noise.buffer = getNoiseBuffer(ctx);
  noise.playbackRate.value = rate;

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(850 * rate, now);
  filter.Q.value = 2.0;

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(volume * 0.6, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05 / Math.max(0.1, rate));

  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(sfxBus);

  const plopDur = 0.08 / Math.max(0.1, rate);
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(650 * rate, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, 130 * rate), now + plopDur);

  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(volume * 0.85, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + plopDur);

  osc.connect(oscGain);
  oscGain.connect(sfxBus);

  noise.start(now);
  osc.start(now);
  noise.stop(now + dur);
  osc.stop(now + plopDur);
}

function playSynthTick(ctx, volume, rate) {
  const now = ctx.currentTime;
  const dur = 0.035 / Math.max(0.1, rate);

  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(950 * rate, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, 450 * rate), now + dur);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(volume * 0.8, now + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

  osc.connect(gain);
  gain.connect(sfxBus);

  const noise = ctx.createBufferSource();
  noise.buffer = getNoiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.setValueAtTime(2800 * rate, now);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(volume * 0.4, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.008);

  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(sfxBus);

  osc.start(now);
  noise.start(now);
  osc.stop(now + dur);
  noise.stop(now + 0.008);
}

function playSynthGo(ctx, volume, rate) {
  const now = ctx.currentTime;
  const root = 82.41 * rate;
  const dur = 0.85 / Math.max(0.1, rate);

  const oscRoot = ctx.createOscillator();
  const oscFifth = ctx.createOscillator();
  const oscOct = ctx.createOscillator();
  oscRoot.type = "sawtooth";
  oscFifth.type = "sawtooth";
  oscOct.type = "sawtooth";
  oscRoot.frequency.setValueAtTime(root, now);
  oscFifth.frequency.setValueAtTime(root * 1.4983, now);
  oscOct.frequency.setValueAtTime(root * 2, now);

  const preGain = ctx.createGain();
  preGain.gain.setValueAtTime(0.4, now);

  const shaper = ctx.createWaveShaper();
  shaper.curve = getDistortionCurve();

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(3200 * rate, now);
  filter.frequency.exponentialRampToValueAtTime(Math.max(40, 900 * rate), now + dur);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(volume * 1.0, now + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

  oscRoot.connect(preGain);
  oscFifth.connect(preGain);
  oscOct.connect(preGain);
  preGain.connect(shaper);
  shaper.connect(filter);
  filter.connect(gain);
  gain.connect(sfxBus);

  const subDur = 0.1 / Math.max(0.1, rate);
  const sub = ctx.createOscillator();
  sub.type = "sine";
  sub.frequency.setValueAtTime(140 * rate, now);
  sub.frequency.exponentialRampToValueAtTime(Math.max(20, 45 * rate), now + subDur);

  const subGain = ctx.createGain();
  subGain.gain.setValueAtTime(volume * 0.9, now);
  subGain.gain.exponentialRampToValueAtTime(0.001, now + subDur);

  sub.connect(subGain);
  subGain.connect(sfxBus);

  oscRoot.start(now);
  oscFifth.start(now);
  oscOct.start(now);
  sub.start(now);
  oscRoot.stop(now + dur);
  oscFifth.stop(now + dur);
  oscOct.stop(now + dur);
  sub.stop(now + subDur);
}

function playSynth(key, ctx, volume, rate) {
  switch (key) {
    case "boing":
      playSynthBoing(ctx, volume, rate);
      break;
    case "big_boing":
      playSynthBigBoing(ctx, volume, rate);
      break;
    case "splat":
      playSynthSplat(ctx, volume, rate);
      break;
    case "smash":
      playSynthSmash(ctx, volume, rate);
      break;
    case "cheer":
      playSynthCheer(ctx, volume, rate);
      break;
    case "boo":
      playSynthBoo(ctx, volume, rate);
      break;
    case "riff":
      playSynthRiff(ctx, volume, rate);
      break;
    case "venue_divebar":
    case "venue_stadium":
    case "venue_clouds":
    case "venue_moon":
      playSynthVenue(key, ctx, volume, rate);
      break;
    case "piano_warning":
      playSynthPianoWarning(ctx, volume, rate);
      break;
    case "tour_complete":
    case "win":
      playSynthWin(ctx, volume, rate);
      break;
    case "lose":
      playSynthLose(ctx, volume, rate);
      break;
    case "draw":
      playSynthDraw(ctx, volume, rate);
      break;
    case "whoosh":
      playSynthWhoosh(ctx, volume, rate);
      break;
    case "incoming":
      playSynthIncoming(ctx, volume, rate);
      break;
    case "heckle":
      playSynthHeckle(ctx, volume, rate);
      break;
    case "tick":
      playSynthTick(ctx, volume, rate);
      break;
    case "go":
      playSynthGo(ctx, volume, rate);
      break;
    default:
      break;
  }
}

function scheduleKick(time) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.frequency.setValueAtTime(150, time);
  osc.frequency.exponentialRampToValueAtTime(50, time + 0.07);
  gain.gain.setValueAtTime(0.85, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
  osc.connect(gain);
  gain.connect(musicProceduralGain);
  osc.start(time);
  osc.stop(time + 0.12);
}

function scheduleSnare(time) {
  const noise = audioCtx.createBufferSource();
  noise.buffer = getNoiseBuffer(audioCtx);
  const filter = audioCtx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(1200, time);
  filter.Q.value = 1.2;

  const noiseGain = audioCtx.createGain();
  noiseGain.gain.setValueAtTime(0.65, time);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);

  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(musicProceduralGain);

  const osc = audioCtx.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(180, time);
  osc.frequency.exponentialRampToValueAtTime(80, time + 0.06);

  const oscGain = audioCtx.createGain();
  oscGain.gain.setValueAtTime(0.55, time);
  oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.07);

  osc.connect(oscGain);
  oscGain.connect(musicProceduralGain);

  noise.start(time);
  osc.start(time);
  noise.stop(time + 0.14);
  osc.stop(time + 0.07);
}

function scheduleHat(time, isSixteenth) {
  const noise = audioCtx.createBufferSource();
  noise.buffer = getNoiseBuffer(audioCtx);

  const filter = audioCtx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.setValueAtTime(7500, time);

  const gain = audioCtx.createGain();
  const vol = isSixteenth ? 0.1 : 0.2;
  gain.gain.setValueAtTime(vol, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.035);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(musicProceduralGain);

  noise.start(time);
  noise.stop(time + 0.035);
}

function scheduleCrash(time) {
  const noise = audioCtx.createBufferSource();
  noise.buffer = getNoiseBuffer(audioCtx);

  const filter = audioCtx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(4500, time);
  filter.Q.value = 0.8;

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.45, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.7);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(musicProceduralGain);

  noise.start(time);
  noise.stop(time + 0.7);
}

function scheduleBass(time, freq, dur) {
  const osc = audioCtx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(freq, time);

  const filter = audioCtx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(600, time);
  filter.frequency.exponentialRampToValueAtTime(320, time + dur);

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.001, time);
  gain.gain.linearRampToValueAtTime(0.45, time + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(musicProceduralGain);

  osc.start(time);
  osc.stop(time + dur);
}

function scheduleGuitarChug(time, freq, dur) {
  const oscRoot = audioCtx.createOscillator();
  const oscFifth = audioCtx.createOscillator();
  const oscOct = audioCtx.createOscillator();

  oscRoot.type = "sawtooth";
  oscFifth.type = "sawtooth";
  oscOct.type = "sawtooth";

  oscRoot.frequency.setValueAtTime(freq, time);
  oscFifth.frequency.setValueAtTime(freq * 1.4983, time);
  oscOct.frequency.setValueAtTime(freq * 2, time);

  const preGain = audioCtx.createGain();
  preGain.gain.setValueAtTime(0.3, time);

  const shaper = audioCtx.createWaveShaper();
  shaper.curve = getDistortionCurve();

  const filter = audioCtx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(2600, time);
  filter.frequency.exponentialRampToValueAtTime(1400, time + dur);

  const envGain = audioCtx.createGain();
  envGain.gain.setValueAtTime(0.001, time);
  envGain.gain.linearRampToValueAtTime(0.35, time + 0.005);
  envGain.gain.exponentialRampToValueAtTime(0.001, time + dur);

  oscRoot.connect(preGain);
  oscFifth.connect(preGain);
  oscOct.connect(preGain);
  preGain.connect(shaper);
  shaper.connect(filter);
  filter.connect(envGain);
  envGain.connect(musicProceduralGain);

  oscRoot.start(time);
  oscFifth.start(time);
  oscOct.start(time);
  oscRoot.stop(time + dur);
  oscFifth.stop(time + dur);
  oscOct.stop(time + dur);
}

function scheduleMusicStep(step, time) {
  const barIndex = Math.floor(step / 16) % 4;
  const s = step % 16;
  const root = PROGRESSION_ROOTS[barIndex];
  const stepDur = 15 / currentBpm;
  const eighthDur = stepDur * 2;

  if (s === 0 || s === 8) {
    scheduleKick(time);
  }

  if (currentMusicLevel >= 1 && (s === 4 || s === 12)) {
    scheduleSnare(time);
  }

  if (currentMusicLevel === 3) {
    scheduleHat(time, s % 2 !== 0);
  } else if (s % 2 === 0) {
    scheduleHat(time, false);
  }

  if (currentMusicLevel === 3 && s === 0) {
    scheduleCrash(time);
  }

  if (s % 2 === 0) {
    scheduleBass(time, root, eighthDur * 0.85);
  }

  if (currentMusicLevel >= 2 && s % 2 === 0) {
    scheduleGuitarChug(time, root, eighthDur * 0.8);
  }
}

function tickScheduler() {
  if (!audioCtx || !musicPlaying) return;
  const lookahead = 0.1;
  const now = audioCtx.currentTime;
  if (musicNextNoteTime < now) {
    musicNextNoteTime = now + 0.01;
  }
  while (musicNextNoteTime < now + lookahead) {
    if (musicStep % 16 === 0 && currentMusicLevel !== targetMusicLevel) {
      currentMusicLevel = targetMusicLevel;
      currentBpm = LEVEL_BPMS[currentMusicLevel];
    }
    scheduleMusicStep(musicStep, musicNextNoteTime);
    const stepDuration = 15 / currentBpm;
    musicNextNoteTime += stepDuration;
    musicStep = (musicStep + 1) % 64;
  }
}

function startProceduralMusic(volume) {
  stopProceduralMusic();
  const ctx = getAudioContext();
  if (!ctx) return;

  musicProceduralGain = ctx.createGain();
  musicProceduralGain.gain.setValueAtTime(volume, ctx.currentTime);
  musicProceduralGain.connect(musicBus);

  musicPlaying = true;
  musicStep = 0;
  currentBpm = LEVEL_BPMS[currentMusicLevel];
  musicNextNoteTime = ctx.currentTime + 0.05;

  musicSchedulerTimer = setInterval(tickScheduler, 25);
}

function stopProceduralMusic() {
  musicPlaying = false;
  if (musicSchedulerTimer !== null) {
    clearInterval(musicSchedulerTimer);
    musicSchedulerTimer = null;
  }
  if (musicProceduralGain) {
    try {
      musicProceduralGain.disconnect();
    } catch (e) {}
    musicProceduralGain = null;
  }
}

async function loadSoundFile(ctx, basePath) {
  const exts = [".mp3", ".wav", ".ogg"];
  for (const ext of exts) {
    try {
      const response = await fetch(basePath + ext);
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        const decoded = await ctx.decodeAudioData(buffer);
        return decoded;
      }
    } catch (e) {}
  }
  return null;
}

export function unlockAudio() {
  try {
    const ctx = getAudioContext();
    if (ctx && ctx.state === "suspended") {
      ctx.resume();
    }
  } catch (e) {}
}

export async function loadSounds(manifest) {
  const ctx = getAudioContext();
  if (!ctx || !manifest) return;

  const entries = Object.entries(manifest);
  await Promise.all(
    entries.map(async ([key, basePath]) => {
      const buffer = await loadSoundFile(ctx, basePath);
      if (buffer) {
        soundBuffers.set(key, buffer);
      }
    })
  );
}

export function play(key, opts = {}) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const volume = typeof opts.volume === "number" ? opts.volume : 1;
    const rate = typeof opts.rate === "number" && opts.rate > 0 ? opts.rate : 1;

    const buffer = soundBuffers.get(key);
    if (buffer) {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = rate;

      const gain = ctx.createGain();
      gain.gain.value = volume;

      source.connect(gain);
      gain.connect(sfxBus || ctx.destination);

      source.start(0);
      return;
    }

    playSynth(key, ctx, volume, rate);
  } catch (e) {}
}

export function stopLoop() {
  if (currentLoopSource) {
    try {
      currentLoopSource.stop(0);
      currentLoopSource.disconnect();
    } catch (e) {}
    currentLoopSource = null;
    currentLoopGain = null;
  }
  stopProceduralMusic();
}

export function playLoop(key, volume = 1) {
  stopLoop();
  const ctx = getAudioContext();
  if (!ctx) return;

  const buffer = soundBuffers.get(key);
  if (buffer) {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const gain = ctx.createGain();
    gain.gain.value = volume;

    source.connect(gain);
    gain.connect(musicBus || ctx.destination);

    source.start(0);
    currentLoopSource = source;
    currentLoopGain = gain;
    return;
  }

  if (key === "music") {
    startProceduralMusic(volume);
  }
}

export function setMusicLevel(level) {
  const parsed = typeof level === "number" && !isNaN(level) ? Math.floor(level) : 0;
  const clamped = Math.max(0, Math.min(3, parsed));
  targetMusicLevel = clamped;
  if (!musicPlaying) {
    currentMusicLevel = clamped;
    currentBpm = LEVEL_BPMS[clamped];
  }
}
