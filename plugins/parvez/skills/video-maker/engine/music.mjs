// node music.mjs <project>
// Creates the music bed and all sound effects from build/timeline.json, so the video has no licensed audio.
// Settings come from script.json "music" and "sfx" (see SKILL.md).
import fs from "node:fs";
import { loadProject } from "./lib/project.mjs";

const prj = loadProject(process.argv[2]);
const TL = prj.readJson("build/timeline.json");
const M = TL.music ?? {};
const DUR = TL.duration;
const SR = 48000;
const L = new Float32Array(Math.ceil(SR * DUR));
const R = new Float32Array(Math.ceil(SR * DUR));

let seed = 1;
const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
const midi = n => 440 * Math.pow(2, (n - 69) / 12);

function add(t0, len, fn, gain = 1, pan = 0) {
  const start = Math.floor(t0 * SR), n = Math.floor(len * SR);
  const gl = gain * Math.sqrt((1 - pan) / 2), gr = gain * Math.sqrt((1 + pan) / 2);
  for (let i = 0; i < n && start + i < L.length; i++) {
    if (start + i < 0) continue;
    const v = fn(i / SR);
    L[start + i] += v * gl;
    R[start + i] += v * gr;
  }
}
class Biquad {
  constructor(type, f, q = 0.707) { this.type = type; this.q = q; this.x1 = this.x2 = this.y1 = this.y2 = 0; this.set(f); }
  set(f) {
    const w = 2 * Math.PI * f / SR, a = Math.sin(w) / (2 * this.q), c = Math.cos(w);
    let b0, b1, b2;
    if (this.type === "lp") { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; }
    else if (this.type === "hp") { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; }
    else { b0 = a; b1 = 0; b2 = -a; }
    const a0 = 1 + a;
    this.b = [b0 / a0, b1 / a0, b2 / a0];
    this.a = [(-2 * c) / a0, (1 - a) / a0];
  }
  run(x) {
    const y = this.b[0] * x + this.b[1] * this.x1 + this.b[2] * this.x2 - this.a[0] * this.y1 - this.a[1] * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

// ---------- sound effects ----------
const FX = {
  whoosh: ({ t, len = .6, gain = .18 }) => {
    const bp = new Biquad("bp", 500, 1.2);
    add(t - len / 2, len, x => { const p = x / len; bp.set(400 + 2600 * Math.sin(Math.PI * p)); return bp.run(noise()) * Math.sin(Math.PI * p) ** 2; }, gain);
  },
  pop: ({ t, pitch = 0, gain = .14 }) => {
    const f0 = 500 * 2 ** (pitch / 12);
    add(t, .12, x => Math.sin(2 * Math.PI * (f0 * x + f0 * 4 * x * x)) * Math.exp(-x * 30), gain);
  },
  click: ({ t, gain = .2 }) => { const hp = new Biquad("hp", 3000); add(t, .03, x => hp.run(noise()) * Math.exp(-x * 200), gain); },
  typing: ({ t, until, gain = .07 }) => {
    for (let k = t; k < (until ?? t + 1); k += .055 + (Math.sin(k * 91) + 1) * .02) FX.click({ t: k, gain });
  },
  tick: ({ t, gain = .22, pan = 0 }) => {
    const bp = new Biquad("bp", 2000, 6);
    add(t, .06, x => (Math.sin(2 * Math.PI * 2000 * x) * .5 + bp.run(noise()) * 2) * Math.exp(-x * 90), gain, pan);
  },
  ticks: ({ t, until, every = .5, gain = .22 }) => {
    let k = 0;
    for (let x = t; x < (until ?? t + 4); x += every, k++) FX.tick({ t: x, gain, pan: k % 2 ? .3 : -.3 });
  },
  chime: ({ t, note = 79, gain = .09 }) => {
    for (const [n, d] of [[note, 0], [note + 7, .08]]) {
      const f = midi(n);
      add(t + d, 1, x => (Math.sin(2 * Math.PI * f * x) + .25 * Math.sin(2 * Math.PI * f * 2.76 * x) * Math.exp(-x * 8)) * Math.exp(-x * 4.5), gain);
    }
  },
  success: ({ t, gain = .09 }) => [84, 88, 91].forEach((n, i) => FX.chime({ t: t + i * .1, note: n, gain: gain * (1 - i * .15) })),
  error: ({ t, gain = .05 }) => add(t, .35, x => Math.sin(2 * Math.PI * 150 * x) * Math.sign(Math.sin(2 * Math.PI * 75 * x)) * Math.exp(-x * 8), gain),
  impact: ({ t, gain = .6 }) => {
    add(t, 1.4, x => Math.sin(2 * Math.PI * (60 * x - 12 * x * x)) * Math.exp(-x * 3), gain);
    const lp = new Biquad("lp", 2500);
    add(t, .5, x => lp.run(noise()) * Math.exp(-x * 9), gain * .7);
  },
  riser: ({ t, len = 1.5, gain = .3 }) => {
    const lp = new Biquad("lp", 300, 2);
    add(t - len, len, x => { const p = x / len; lp.set(300 + 6000 * p * p); return lp.run(noise()) * p * p; }, gain);
  },
};

// ---------- music ----------
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function chord(name) {
  const m = name.match(/^([A-G])([#b]?)(m(?!aj))?/);
  if (!m) throw new Error(`Chord "${name}" is not like C, Am, F#m, Bb`);
  let r = 36 + NOTE[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
  if (r > 43) r -= 12;
  const third = m[3] ? 3 : 4;
  return [r, r + 12, r + 19, r + 24, r + 24 + third, r + 31, r + 38];
}
const bpm = M.bpm ?? 110;
const BEAT = 60 / bpm, BAR = BEAT * 4;
const progression = (M.chords ?? ["C", "Am", "F", "G"]).map(chord);
const intro = M.intro ?? "calm";
const dropAt = M.dropAt ?? (intro === "tension" ? TL.scenes[TL.sceneOrder[0]].end : 0);
const endAt = M.endAt ?? TL.scenes[TL.sceneOrder.at(-1)].start + .5;
const layer = (k, def) => M.layers?.[k] ?? def;
const at = { pads: layer("pads", dropAt), bass: layer("bass", dropAt + BAR), arp: layer("arp", dropAt + BAR), kick: layer("kick", dropAt + 2 * BAR), hats: layer("hats", dropAt + 4 * BAR) };
const vol = M.volume ?? 1;

if (intro === "tension" && dropAt > 0) {
  add(0, dropAt + .1, x => {
    const env = Math.min(1, x / 2) * Math.min(1, (dropAt + .1 - x) / .4);
    return env * (Math.sin(2 * Math.PI * 55 * x) + .5 * Math.sin(2 * Math.PI * 82.4 * x + Math.sin(x * 2)) + .25 * Math.sin(2 * Math.PI * 110.5 * x));
  }, .12 * vol);
}
if (intro === "calm" && dropAt > 0) {
  const notes = progression[0].slice(1, 5);
  for (const n of notes) add(0, dropAt + .5, x => Math.min(1, x / 1.5) * Math.min(1, (dropAt + .5 - x) / .5) * Math.sin(2 * Math.PI * midi(n) * x), .03 * vol);
}
if (M.bed !== false) {
  for (let b = 0; dropAt + b * BAR < endAt; b++) {
    const t0 = dropAt + b * BAR;
    const notes = progression[b % progression.length];
    const len = Math.min(BAR, endAt - t0) + .4;
    if (t0 >= at.pads) for (const n of notes.slice(1, 6)) {
      const f = midi(n);
      add(t0, len, x => Math.min(1, x / .35) * Math.min(1, (len - x) / .4) * (Math.sin(2 * Math.PI * f * x) + .3 * Math.sin(2 * Math.PI * f * 2.003 * x) + .12 * Math.sin(2 * Math.PI * f * 3.01 * x)), .04 * vol, (n % 3 - 1) * .4);
    }
    for (let k = 0; k < 4; k++) {
      const t = t0 + k * BEAT;
      if (t >= endAt) break;
      if (t >= at.bass) add(t, .45, x => Math.sin(2 * Math.PI * midi(notes[0]) * x) * Math.exp(-x * 4), .24 * vol);
      if (t >= at.kick) add(t, .25, x => Math.sin(2 * Math.PI * (130 * x - 160 * x * x)) * Math.exp(-x * 16), .36 * vol);
      if (t + BEAT / 2 < endAt && t >= at.hats) { const hp = new Biquad("hp", 7000); add(t + BEAT / 2, .06, x => hp.run(noise()) * Math.exp(-x * 60), .08 * vol, .2); }
    }
    if (t0 >= at.arp) {
      const arp = [notes[3], notes[4], notes[5], notes[4] + 12, notes[5], notes[4], notes[3] + 12, notes[4]];
      arp.forEach((n, k) => {
        const t = t0 + k * BEAT / 2;
        if (t < endAt) add(t, .35, x => (Math.sin(2 * Math.PI * midi(n) * x) + .2 * Math.sin(4 * Math.PI * midi(n) * x)) * Math.exp(-x * 11), .05 * vol, k % 2 ? .45 : -.45);
      });
    }
  }
  if (M.outro !== false && endAt < DUR) {
    FX.impact({ t: endAt, gain: .45 * vol });
    const home = progression[0];
    for (const n of [home[0], ...home.slice(1)]) {
      const f = midi(n);
      add(endAt, DUR - endAt, x => Math.exp(-x * .7) * Math.min(1, x / .02) * (Math.sin(2 * Math.PI * f * x) + .35 * Math.sin(2 * Math.PI * f * 2 * x) * Math.exp(-x * 2)), (n < 50 ? .1 : .045) * vol, (n % 5 - 2) * .2);
    }
  }
}

for (const cue of TL.sfx ?? []) {
  const fx = FX[cue.type];
  if (!fx) throw new Error(`Unknown sound "${cue.type}". Known: ${Object.keys(FX).join(", ")}`);
  fx(cue);
}

// ---------- write 16-bit stereo WAV ----------
let peak = 1e-9;
for (let i = 0; i < L.length; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const norm = .89 / peak, fadeStart = (DUR - .5) * SR;
const buf = Buffer.alloc(44 + L.length * 4);
buf.write("RIFF", 0); buf.writeUInt32LE(36 + L.length * 4, 4); buf.write("WAVE", 8);
buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
buf.write("data", 36); buf.writeUInt32LE(L.length * 4, 40);
for (let i = 0; i < L.length; i++) {
  const fade = i > fadeStart ? 1 - (i - fadeStart) / (.5 * SR) : 1;
  buf.writeInt16LE(Math.round(Math.tanh(L[i] * norm) * fade * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(Math.tanh(R[i] * norm) * fade * 32767), 46 + i * 4);
}
fs.writeFileSync(prj.p("build/music.wav"), buf);
console.log(`music: ${bpm} BPM, ${M.chords?.join(" ") ?? "C Am F G"}, intro ${intro}, beat from ${dropAt.toFixed(2)} s, outro at ${endAt.toFixed(2)} s, ${TL.sfx?.length ?? 0} sound cues`);
