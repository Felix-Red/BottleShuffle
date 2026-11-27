import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const AUDIO_ROOT = path.join(ROOT_DIR, 'public', 'assets', 'audio');
const SFX_DIR = path.join(AUDIO_ROOT, 'sfx');
const MUSIC_DIR = path.join(AUDIO_ROOT, 'music');

const SAMPLE_RATE = 44100;
const TWO_PI = Math.PI * 2;

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function createPrng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function writeWavFile(filePath, channels, sampleRate = SAMPLE_RATE) {
  const numChannels = channels.length;
  const numFrames = channels[0].length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numFrames * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // PCM chunk size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let i = 0; i < numFrames; i += 1) {
    for (let ch = 0; ch < numChannels; ch += 1) {
      const clamped = Math.max(-1, Math.min(1, channels[ch][i]));
      const int16 = clamped < 0 ? Math.round(clamped * 32768) : Math.round(clamped * 32767);
      buffer.writeInt16LE(int16, offset);
      offset += 2;
    }
  }

  fs.writeFileSync(filePath, buffer);
}

function normalize(channels, peakTarget = 0.72) {
  let maxAbs = 0;
  for (const ch of channels) {
    for (const sample of ch) {
      const a = Math.abs(sample);
      if (a > maxAbs) maxAbs = a;
    }
  }
  if (maxAbs < 1e-6) return;
  const gain = peakTarget / maxAbs;
  for (const ch of channels) {
    for (let i = 0; i < ch.length; i += 1) {
      ch[i] *= gain;
    }
  }
}

function applyEdgeFades(channels, fadeInSec = 0.004, fadeOutSec = 0.012) {
  const fadeInSamples = Math.min(Math.floor(fadeInSec * SAMPLE_RATE), channels[0].length);
  const fadeOutSamples = Math.min(Math.floor(fadeOutSec * SAMPLE_RATE), channels[0].length);
  for (const ch of channels) {
    for (let i = 0; i < fadeInSamples; i += 1) {
      const w = 0.5 - 0.5 * Math.cos((Math.PI * i) / fadeInSamples);
      ch[i] *= w;
    }
    const len = ch.length;
    for (let i = 0; i < fadeOutSamples; i += 1) {
      const w = 0.5 - 0.5 * Math.cos((Math.PI * i) / fadeOutSamples);
      ch[len - 1 - i] *= w;
    }
  }
}

function addGlassNote(buf, startSec, freq, durationSec, amp, wrapLoop = false) {
  const len = buf.length;
  const startIdx = Math.floor(startSec * SAMPLE_RATE);
  const totalSamples = Math.floor(durationSec * SAMPLE_RATE);
  const attackSamples = Math.max(1, Math.floor(0.0045 * SAMPLE_RATE));

  for (let i = 0; i < totalSamples; i += 1) {
    const idx = wrapLoop ? (startIdx + i) % len : startIdx + i;
    if (!wrapLoop && (idx < 0 || idx >= len)) continue;
    const t = i / SAMPLE_RATE;
    const attack = i < attackSamples ? i / attackSamples : 1;
    const envMain = attack * Math.exp(-t * (6.8 / durationSec));
    const envOvertone = attack * Math.exp(-t * (13.5 / durationSec));
    const envSparkle = attack * Math.exp(-t * (22.0 / durationSec));

    const s =
      Math.sin(TWO_PI * freq * t) * envMain * 0.72 +
      Math.sin(TWO_PI * freq * 2.0 * t) * envOvertone * 0.2 +
      Math.sin(TWO_PI * freq * 2.756 * t) * envSparkle * 0.08;
    buf[idx] += s * amp;
  }
}

function addMarimbaNote(buf, startSec, freq, durationSec, amp, wrapLoop = false) {
  const len = buf.length;
  const startIdx = Math.floor(startSec * SAMPLE_RATE);
  const totalSamples = Math.floor(durationSec * SAMPLE_RATE);
  const attackSamples = Math.max(1, Math.floor(0.003 * SAMPLE_RATE));

  for (let i = 0; i < totalSamples; i += 1) {
    const idx = wrapLoop ? (startIdx + i) % len : startIdx + i;
    if (!wrapLoop && (idx < 0 || idx >= len)) continue;
    const t = i / SAMPLE_RATE;
    const attack = i < attackSamples ? i / attackSamples : 1;
    const env1 = attack * Math.exp(-t * (5.2 / durationSec));
    const env2 = attack * Math.exp(-t * (14.0 / durationSec));

    const s =
      Math.sin(TWO_PI * freq * t) * env1 * 0.78 +
      Math.sin(TWO_PI * freq * 3.98 * t) * env2 * 0.16 +
      Math.sin(TWO_PI * freq * 2.0 * t) * env2 * 0.06;
    buf[idx] += s * amp;
  }
}

function addWarmPadChord(left, right, startSec, freqs, durationSec, amp, wrapLoop = true) {
  const len = left.length;
  const startIdx = Math.floor(startSec * SAMPLE_RATE);
  const totalSamples = Math.floor(durationSec * SAMPLE_RATE);

  for (let i = 0; i < totalSamples; i += 1) {
    const idx = wrapLoop ? (startIdx + i) % len : startIdx + i;
    if (!wrapLoop && (idx < 0 || idx >= len)) continue;
    const u = i / totalSamples;
    const t = i / SAMPLE_RATE;
    // Smooth cosine window envelope with gentle sustain
    const env = Math.sin(Math.PI * u) * (0.85 + 0.15 * Math.sin(TWO_PI * 0.5 * t));

    let sampleL = 0;
    let sampleR = 0;
    for (let fIdx = 0; fIdx < freqs.length; fIdx += 1) {
      const f = freqs[fIdx];
      const detune = (fIdx % 2 === 0 ? 1 : -1) * 0.0018;
      const v1 = Math.sin(TWO_PI * f * (1 + detune) * t);
      const v2 = Math.sin(TWO_PI * f * (1 - detune) * t);
      const sub = Math.sin(TWO_PI * f * 2 * t) * 0.12;
      sampleL += v1 + sub;
      sampleR += v2 + sub;
    }
    const scale = (amp / freqs.length) * env;
    left[idx] += sampleL * scale;
    right[idx] += sampleR * scale;
  }
}

// ============================================================================
// 13 Original Sound Effects
// ============================================================================

function synthUiClick() {
  const dur = 0.075;
  const buf = new Float32Array(Math.floor(dur * SAMPLE_RATE));
  addMarimbaNote(buf, 0.0, 1080, 0.055, 0.65);
  addGlassNote(buf, 0.002, 1620, 0.045, 0.25);
  applyEdgeFades([buf], 0.002, 0.015);
  normalize([buf], 0.65);
  return [buf];
}

function synthUiBack() {
  const dur = 0.09;
  const buf = new Float32Array(Math.floor(dur * SAMPLE_RATE));
  addMarimbaNote(buf, 0.0, 820, 0.055, 0.55);
  addMarimbaNote(buf, 0.018, 610, 0.065, 0.45);
  applyEdgeFades([buf], 0.002, 0.018);
  normalize([buf], 0.6);
  return [buf];
}

function synthBottleSelect() {
  const dur = 0.11;
  const buf = new Float32Array(Math.floor(dur * SAMPLE_RATE));
  // Soft tactile glass tap (A5 + bright glass harmonic + faint warm body)
  addGlassNote(buf, 0.0, 880, 0.095, 0.72);
  addMarimbaNote(buf, 0.0, 440, 0.045, 0.26);
  applyEdgeFades([buf], 0.002, 0.016);
  normalize([buf], 0.68);
  return [buf];
}

function synthBottleDeselect() {
  const dur = 0.095;
  const buf = new Float32Array(Math.floor(dur * SAMPLE_RATE));
  const len = buf.length;
  for (let i = 0; i < len; i += 1) {
    const t = i / SAMPLE_RATE;
    // Gentle downward frequency settle (680 Hz -> 520 Hz)
    const freq = 680 - 160 * Math.min(1, t / 0.06);
    const attack = Math.min(1, t / 0.004);
    const env = attack * Math.exp(-t * 48);
    buf[i] = (Math.sin(TWO_PI * freq * t) * 0.75 + Math.sin(TWO_PI * freq * 2.1 * t) * 0.18) * env;
  }
  applyEdgeFades([buf], 0.002, 0.016);
  normalize([buf], 0.55);
  return [buf];
}

function synthBottleSwap() {
  const dur = 0.22;
  const len = Math.floor(dur * SAMPLE_RATE);
  const buf = new Float32Array(len);
  const rand = createPrng(14005);

  // Soft air-whoosh using simple two-pole resonant band-pass on deterministic noise
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < len; i += 1) {
    const t = i / SAMPLE_RATE;
    const u = t / dur;
    const env = Math.sin(Math.PI * u) * Math.pow(Math.sin(Math.PI * u), 0.7);
    const white = rand() * 2 - 1;

    // Sweep center frequency gently from 520 Hz -> 1450 Hz -> 680 Hz
    const centerHz = 520 + 930 * Math.sin(Math.PI * u);
    const omega = (TWO_PI * centerHz) / SAMPLE_RATE;
    const r = 0.94;
    const x = white * 0.28;
    const y = x + 2 * r * Math.cos(omega) * y1 - r * r * y2;
    y2 = y1;
    y1 = y;

    // Very subtle harmonic motion glide underneath
    const glideFreq = 310 + 210 * Math.sin(Math.PI * u);
    const tone = Math.sin(TWO_PI * glideFreq * t) * 0.14;
    buf[i] = (y * 0.18 + tone) * env;
  }
  applyEdgeFades([buf], 0.012, 0.024);
  normalize([buf], 0.58);
  return [buf];
}

function synthBottleLand() {
  const dur = 0.125;
  const len = Math.floor(dur * SAMPLE_RATE);
  const buf = new Float32Array(len);
  // Warm wooden shelf contact thud (165 -> 86 Hz) + delicate glass settle clink
  for (let i = 0; i < len; i += 1) {
    const t = i / SAMPLE_RATE;
    const attack = Math.min(1, t / 0.0025);
    const thudFreq = 86 + 79 * Math.exp(-t * 55);
    const thudEnv = attack * Math.exp(-t * 36);
    buf[i] += Math.sin(TWO_PI * thudFreq * t) * thudEnv * 0.72;
  }
  addGlassNote(buf, 0.004, 1046.5, 0.08, 0.34);
  addMarimbaNote(buf, 0.002, 261.63, 0.06, 0.25);
  applyEdgeFades([buf], 0.002, 0.018);
  normalize([buf], 0.72);
  return [buf];
}

function synthMatchIncrease() {
  const dur = 0.32;
  const buf = new Float32Array(Math.floor(dur * SAMPLE_RATE));
  // Bright, encouraging ascending C6 -> E6 -> G6 chime
  addGlassNote(buf, 0.0, midiToFreq(72), 0.18, 0.55); // C5
  addGlassNote(buf, 0.055, midiToFreq(76), 0.2, 0.65); // E5
  addGlassNote(buf, 0.11, midiToFreq(79), 0.21, 0.75); // G5
  applyEdgeFades([buf], 0.003, 0.025);
  normalize([buf], 0.72);
  return [buf];
}

function synthMatchDecrease() {
  const dur = 0.25;
  const buf = new Float32Array(Math.floor(dur * SAMPLE_RATE));
  // Restrained, soft woody descending third (E5 -> C5) — informative, never harsh
  addMarimbaNote(buf, 0.0, midiToFreq(76), 0.13, 0.52);
  addMarimbaNote(buf, 0.075, midiToFreq(72), 0.16, 0.44);
  applyEdgeFades([buf], 0.003, 0.024);
  normalize([buf], 0.56);
  return [buf];
}

function synthMatchUnchanged() {
  const dur = 0.085;
  const buf = new Float32Array(Math.floor(dur * SAMPLE_RATE));
  // Ultra-subtle damped wooden click (neutral, non-fatiguing)
  addMarimbaNote(buf, 0.0, midiToFreq(74), 0.06, 0.45);
  applyEdgeFades([buf], 0.002, 0.016);
  normalize([buf], 0.42);
  return [buf];
}

function synthLevelUnlock() {
  const dur = 0.42;
  const buf = new Float32Array(Math.floor(dur * SAMPLE_RATE));
  const notes = [79, 83, 86, 91]; // G5, B5, D6, G6
  notes.forEach((midi, idx) => {
    addGlassNote(buf, idx * 0.062, midiToFreq(midi), 0.24, 0.5 + idx * 0.08);
  });
  applyEdgeFades([buf], 0.003, 0.035);
  normalize([buf], 0.72);
  return [buf];
}

function synthStarReveal() {
  const dur = 0.28;
  const buf = new Float32Array(Math.floor(dur * SAMPLE_RATE));
  // Crystalline bell chime (C6 + gentle octave sparkle) that scales cleanly across pitch rates
  addGlassNote(buf, 0.0, midiToFreq(84), 0.25, 0.78);
  addGlassNote(buf, 0.012, midiToFreq(91), 0.18, 0.3);
  applyEdgeFades([buf], 0.002, 0.03);
  normalize([buf], 0.72);
  return [buf];
}

function synthVictory() {
  const dur = 0.96;
  const buf = new Float32Array(Math.floor(dur * SAMPLE_RATE));
  // Uplifting warm celebratory Cmaj9 arpeggio + soft chord shimmer
  const arp = [
    { t: 0.0, midi: 72, d: 0.34, a: 0.48 }, // C5
    { t: 0.065, midi: 76, d: 0.36, a: 0.52 }, // E5
    { t: 0.13, midi: 79, d: 0.38, a: 0.58 }, // G5
    { t: 0.195, midi: 83, d: 0.42, a: 0.62 }, // B5
    { t: 0.26, midi: 84, d: 0.62, a: 0.72 }, // C6
    { t: 0.32, midi: 88, d: 0.6, a: 0.55 }, // E6
    { t: 0.38, midi: 91, d: 0.56, a: 0.48 }, // G6
  ];
  for (const n of arp) {
    addGlassNote(buf, n.t, midiToFreq(n.midi), n.d, n.a);
    addMarimbaNote(buf, n.t, midiToFreq(n.midi - 12), Math.min(0.28, n.d), n.a * 0.32);
  }
  applyEdgeFades([buf], 0.004, 0.06);
  normalize([buf], 0.76);
  return [buf];
}

function synthTutorialComplete() {
  const dur = 0.68;
  const buf = new Float32Array(Math.floor(dur * SAMPLE_RATE));
  const notes = [
    { t: 0.0, midi: 72, d: 0.26, a: 0.5 }, // C5
    { t: 0.08, midi: 79, d: 0.28, a: 0.56 }, // G5
    { t: 0.16, midi: 81, d: 0.3, a: 0.58 }, // A5
    { t: 0.24, midi: 84, d: 0.42, a: 0.7 }, // C6
  ];
  for (const n of notes) {
    addGlassNote(buf, n.t, midiToFreq(n.midi), n.d, n.a);
    addMarimbaNote(buf, n.t, midiToFreq(n.midi - 12), 0.22, n.a * 0.28);
  }
  applyEdgeFades([buf], 0.004, 0.045);
  normalize([buf], 0.72);
  return [buf];
}

// ============================================================================
// 2 Seamless Looping Background Music Tracks (Stereo)
// ============================================================================

function synthMenuTheme() {
  const bpm = 92;
  const beatSec = 60 / bpm;
  const bars = 4;
  const totalSec = bars * 4 * beatSec; // ~10.4348s
  const totalSamples = Math.round(totalSec * SAMPLE_RATE);
  const left = new Float32Array(totalSamples);
  const right = new Float32Array(totalSamples);

  // Warm inviting chord progression: Cmaj9 -> Am9 -> Fmaj9 -> G6
  const chords = [
    [48, 55, 60, 64, 67, 71], // Cmaj7
    [45, 52, 57, 60, 64, 67], // Am7
    [41, 48, 53, 57, 60, 64], // Fmaj7
    [43, 50, 55, 59, 62, 64], // G6
  ];

  // Gentle marimba + glass melody pattern (16 eighth-notes per 2 bars)
  const melody = [
    // Bar 1 (Cmaj)
    { step: 0, midi: 72, pan: -0.25 },
    { step: 2, midi: 76, pan: 0.2 },
    { step: 3, midi: 79, pan: -0.15 },
    { step: 5, midi: 76, pan: 0.25 },
    { step: 6, midi: 74, pan: -0.2 },
    // Bar 2 (Am)
    { step: 8, midi: 72, pan: 0.18 },
    { step: 10, midi: 76, pan: -0.22 },
    { step: 12, midi: 79, pan: 0.2 },
    { step: 14, midi: 81, pan: -0.15 },
    // Bar 3 (Fmaj)
    { step: 16, midi: 77, pan: -0.25 },
    { step: 18, midi: 76, pan: 0.2 },
    { step: 20, midi: 72, pan: -0.18 },
    { step: 22, midi: 74, pan: 0.22 },
    // Bar 4 (G6 -> resolves cleanly into bar 1)
    { step: 24, midi: 74, pan: 0.15 },
    { step: 26, midi: 76, pan: -0.2 },
    { step: 28, midi: 79, pan: 0.25 },
    { step: 30, midi: 74, pan: -0.15 },
  ];

  for (let bar = 0; bar < bars; bar += 1) {
    const barStart = bar * 4 * beatSec;
    const chordFreqs = chords[bar].map(midiToFreq);
    addWarmPadChord(left, right, barStart, chordFreqs, 4 * beatSec * 1.12, 0.24, true);

    // Subtle soft warm bass pulse on beats 1 and 3
    const bassFreq = midiToFreq(chords[bar][0]);
    addMarimbaNote(left, barStart, bassFreq, beatSec * 1.5, 0.18, true);
    addMarimbaNote(right, barStart, bassFreq, beatSec * 1.5, 0.18, true);
    addMarimbaNote(left, barStart + 2 * beatSec, bassFreq * 1.5, beatSec * 1.2, 0.11, true);
    addMarimbaNote(right, barStart + 2 * beatSec, bassFreq * 1.5, beatSec * 1.2, 0.11, true);
  }

  for (const n of melody) {
    const t = n.step * (beatSec / 2);
    const freq = midiToFreq(n.midi);
    const lGain = 0.5 - n.pan * 0.5;
    const rGain = 0.5 + n.pan * 0.5;
    addMarimbaNote(left, t, freq, beatSec * 0.95, 0.22 * lGain, true);
    addMarimbaNote(right, t, freq, beatSec * 0.95, 0.22 * rGain, true);
    addGlassNote(left, t, freq, beatSec * 0.85, 0.13 * lGain, true);
    addGlassNote(right, t, freq, beatSec * 0.85, 0.13 * rGain, true);
  }

  normalize([left, right], 0.62);
  return [left, right];
}

function synthGameplayTheme() {
  const bpm = 84;
  const beatSec = 60 / bpm;
  const bars = 4;
  const totalSec = bars * 4 * beatSec; // ~11.4286s
  const totalSamples = Math.round(totalSec * SAMPLE_RATE);
  const left = new Float32Array(totalSamples);
  const right = new Float32Array(totalSamples);

  // Calm, thoughtful progression: Cmaj7 -> G6 -> Am7 -> Fmaj7 (low harmonic tension)
  const chords = [
    [48, 55, 60, 64, 67],
    [47, 55, 59, 62, 64],
    [45, 52, 57, 60, 64],
    [41, 48, 53, 57, 60],
  ];

  // Sparse, meditative kalimba/marimba pulse leaving plenty of sonic space for gameplay SFX
  const pulse = [
    { step: 0, midi: 67, pan: -0.3 },
    { step: 3, midi: 72, pan: 0.25 },
    { step: 6, midi: 64, pan: -0.2 },
    { step: 8, midi: 67, pan: 0.3 },
    { step: 11, midi: 71, pan: -0.25 },
    { step: 14, midi: 67, pan: 0.2 },
    { step: 16, midi: 69, pan: -0.28 },
    { step: 19, midi: 72, pan: 0.22 },
    { step: 22, midi: 64, pan: -0.18 },
    { step: 24, midi: 65, pan: 0.26 },
    { step: 27, midi: 69, pan: -0.22 },
    { step: 30, midi: 72, pan: 0.18 },
  ];

  for (let bar = 0; bar < bars; bar += 1) {
    const barStart = bar * 4 * beatSec;
    const chordFreqs = chords[bar].map(midiToFreq);
    addWarmPadChord(left, right, barStart, chordFreqs, 4 * beatSec * 1.15, 0.26, true);

    // Soft anchored root note once per bar
    const rootFreq = midiToFreq(chords[bar][0]);
    addMarimbaNote(left, barStart, rootFreq, beatSec * 2.1, 0.15, true);
    addMarimbaNote(right, barStart, rootFreq, beatSec * 2.1, 0.15, true);
  }

  for (const n of pulse) {
    const t = n.step * (beatSec / 2);
    const freq = midiToFreq(n.midi);
    const lGain = 0.5 - n.pan * 0.5;
    const rGain = 0.5 + n.pan * 0.5;
    addMarimbaNote(left, t, freq, beatSec * 1.1, 0.2 * lGain, true);
    addMarimbaNote(right, t, freq, beatSec * 1.1, 0.2 * rGain, true);
    addGlassNote(left, t, freq * 2, beatSec * 0.55, 0.05 * lGain, true);
    addGlassNote(right, t, freq * 2, beatSec * 0.55, 0.05 * rGain, true);
  }

  normalize([left, right], 0.54);
  return [left, right];
}

function encodeToM4a(wavPath, m4aPath, bitrate) {
  execFileSync(
    '/usr/bin/afconvert',
    ['-f', 'm4af', '-d', 'aac', '-b', String(bitrate), wavPath, m4aPath],
    { stdio: 'pipe' },
  );
}

function main() {
  ensureDir(SFX_DIR);
  ensureDir(MUSIC_DIR);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bottle-shuffle-audio-'));

  const jobs = [
    { name: 'ui-click', dir: SFX_DIR, bitrate: 96000, synth: synthUiClick },
    { name: 'ui-back', dir: SFX_DIR, bitrate: 96000, synth: synthUiBack },
    { name: 'bottle-select', dir: SFX_DIR, bitrate: 96000, synth: synthBottleSelect },
    { name: 'bottle-deselect', dir: SFX_DIR, bitrate: 96000, synth: synthBottleDeselect },
    { name: 'bottle-swap', dir: SFX_DIR, bitrate: 96000, synth: synthBottleSwap },
    { name: 'bottle-land', dir: SFX_DIR, bitrate: 96000, synth: synthBottleLand },
    { name: 'match-increase', dir: SFX_DIR, bitrate: 96000, synth: synthMatchIncrease },
    { name: 'match-decrease', dir: SFX_DIR, bitrate: 96000, synth: synthMatchDecrease },
    { name: 'match-unchanged', dir: SFX_DIR, bitrate: 96000, synth: synthMatchUnchanged },
    { name: 'level-unlock', dir: SFX_DIR, bitrate: 96000, synth: synthLevelUnlock },
    { name: 'star-reveal', dir: SFX_DIR, bitrate: 96000, synth: synthStarReveal },
    { name: 'victory', dir: SFX_DIR, bitrate: 96000, synth: synthVictory },
    { name: 'tutorial-complete', dir: SFX_DIR, bitrate: 96000, synth: synthTutorialComplete },
    { name: 'menu-theme', dir: MUSIC_DIR, bitrate: 112000, synth: synthMenuTheme },
    { name: 'gameplay-theme', dir: MUSIC_DIR, bitrate: 112000, synth: synthGameplayTheme },
  ];

  let sfxBytes = 0;
  let musicBytes = 0;

  try {
    for (const job of jobs) {
      const channels = job.synth();
      const wavPath = path.join(tmpDir, `${job.name}.wav`);
      const outPath = path.join(job.dir, `${job.name}.m4a`);
      writeWavFile(wavPath, channels);
      encodeToM4a(wavPath, outPath, job.bitrate);
      const stat = fs.statSync(outPath);
      const isMusic = job.dir === MUSIC_DIR;
      if (isMusic) {
        musicBytes += stat.size;
      } else {
        sfxBytes += stat.size;
      }
      const durationSec = (channels[0].length / SAMPLE_RATE).toFixed(3);
      console.log(
        `${isMusic ? 'MUSIC' : 'SFX  '} ${job.name}.m4a  ${durationSec}s  ${String(stat.size).padStart(7)} bytes`,
      );
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  const totalBytes = sfxBytes + musicBytes;
  console.log('---');
  console.log(`Total SFX:   ${sfxBytes} bytes (${(sfxBytes / 1024).toFixed(1)} KB)`);
  console.log(`Total Music: ${musicBytes} bytes (${(musicBytes / 1024).toFixed(1)} KB)`);
  console.log(`Combined:    ${totalBytes} bytes (${(totalBytes / 1024).toFixed(1)} KB)`);
}

main();
