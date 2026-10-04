// node plan.mjs <project>
// Fits the scenes around the real voice durations and writes:
//   build/timeline.json + build/timeline.js (window.TIMELINE for the page), dist/captions.srt
import fs from "node:fs";
import { loadProject, allLines } from "./lib/project.mjs";

const prj = loadProject(process.argv[2]);
const { script } = prj;
const durations = fs.existsSync(prj.p("build/vo/durations.json")) ? prj.readJson("build/vo/durations.json") : {};

const r2 = x => Math.round(x * 100) / 100;
const speechOf = id => {
  const d = durations[id];
  if (!d) throw new Error(`No voice for line "${id}". Run tts.mjs first.`);
  return d.offset - d.onset;
};

// 1. Natural length of each scene: lead-in, spoken lines with gaps, reading time after the last line.
const plans = script.scenes.map(s => {
  const lines = s.lines ?? [];
  const lead = s.lead ?? (lines.length ? 0.5 : 0);
  const gap = s.gap ?? 0.35;
  const hold = s.hold ?? 0.8;
  const speech = lines.reduce((a, l) => a + speechOf(l.id), 0) + gap * Math.max(0, lines.length - 1);
  const natural = Math.max(s.min ?? (lines.length ? 0 : 3), lead + speech + hold);
  return { s, lines, lead, gap, natural, weight: s.weight ?? 1 };
});
const natural = plans.reduce((a, p) => a + p.natural, 0);
const target = script.target ?? natural;
const extra = target - natural;
if (extra < -0.05) {
  const words = script.scenes.flatMap(s => s.lines ?? []).reduce((a, l) => a + l.say.split(/\s+/).length, 0);
  console.warn(`\nWARNING: the script needs ${natural.toFixed(1)} s but the target is ${target} s (${(-extra).toFixed(1)} s over).`);
  console.warn(`Cut about ${Math.ceil(-extra * 2.1)} of the ${words} words, lower "hold" values, or raise voice.speed. Using ${natural.toFixed(1)} s for now.\n`);
}
const totalWeight = plans.reduce((a, p) => a + p.weight, 0) || 1;
const duration = r2(Math.max(natural, target));

// 2. Place scenes and lines. Extra time becomes reading time at the end of each scene, by weight.
const scenes = {}, lines = {}, captions = [];
let t = 0;
for (const p of plans) {
  const len = p.natural + Math.max(0, extra) * p.weight / totalWeight;
  const start = t;
  let at = start + p.lead;
  for (const l of p.lines) {
    const d = durations[l.id];
    const speech = d.offset - d.onset;
    lines[l.id] = { scene: p.s.id, at: r2(at), end: r2(at + speech), start: r2(at - d.onset), text: l.say, words: wordTimes(l.say, at, speech) };
    captions.push({ id: l.id, text: l.caption ?? l.say, start: r2(at), end: r2(at + speech) });
    at += speech + p.gap;
  }
  t += len;
  scenes[p.s.id] = { start: r2(start), end: r2(t) };
}
scenes[plans.at(-1).s.id].end = duration;

// Word times are estimated from word length and punctuation, which is close enough to cue a visual to a spoken word.
function wordTimes(text, at, speech) {
  const words = text.split(/\s+/).filter(Boolean);
  const weight = w => w.replace(/[^\p{L}\p{N}]/gu, "").length + 2 + (/[,;:]$/.test(w) ? 3 : 0) + (/[.!?]$/.test(w) ? 6 : 0);
  const total = words.reduce((a, w) => a + weight(w), 0);
  let acc = 0;
  return words.map(w => { const time = at + speech * acc / total; acc += weight(w); return [w.replace(/[^\p{L}\p{N}'-]/gu, ""), r2(time)]; });
}

// 3. Resolve cue anchors: 12.5 | "scene:id+0.3" | "sceneEnd:id-0.5" | "line:id" | "lineEnd:id" | "word:lineId:Word#2+0.1"
export function resolveAnchor(a) {
  if (typeof a === "number") return a;
  const m = String(a).match(/^(.*?)([+-]\d*\.?\d+)?$/);
  const [kind, id, word] = m[1].split(":");
  const off = m[2] ? parseFloat(m[2]) : 0;
  const need = (o, what) => { if (!o) throw new Error(`Unknown ${what} in anchor "${a}"`); return o; };
  switch (kind) {
    case "scene": return need(scenes[id], "scene").start + off;
    case "sceneEnd": return need(scenes[id], "scene").end + off;
    case "line": return need(lines[id], "line").at + off;
    case "lineEnd": return need(lines[id], "line").end + off;
    case "word": {
      const [w, nth] = word.split("#");
      const hits = need(lines[id], "line").words.filter(([x]) => x.toLowerCase().startsWith(w.toLowerCase()));
      return need(hits[(+nth || 1) - 1], `word "${w}"`)[1] + off;
    }
    default: throw new Error(`Bad anchor "${a}"`);
  }
}
const sfx = (script.sfx ?? []).map(s => ({ ...s, t: r2(resolveAnchor(s.at)), ...(s.until ? { until: r2(resolveAnchor(s.until)) } : {}) }));
const music = { ...(script.music ?? {}) };
for (const k of ["dropAt", "endAt"]) if (music[k] !== undefined) music[k] = r2(resolveAnchor(music[k]));
for (const [k, v] of Object.entries(music.layers ?? {})) music.layers[k] = r2(resolveAnchor(v));

const timeline = { name: prj.name, size: [prj.width, prj.height], fps: prj.fps, duration, scenes, sceneOrder: plans.map(p => p.s.id), lines, captions, sfx, music };
fs.writeFileSync(prj.p("build/timeline.json"), JSON.stringify(timeline, null, 1));
fs.writeFileSync(prj.p("build/timeline.js"), `window.TIMELINE = ${JSON.stringify(timeline)};\n`);

const stamp = s => new Date(s * 1000).toISOString().slice(11, 23).replace(".", ",");
fs.writeFileSync(prj.p("dist/captions.srt"), captions.map((c, i) => `${i + 1}\n${stamp(c.start)} --> ${stamp(c.end + 0.3)}\n${c.text}\n`).join("\n"));

console.log(`scene            start    end   length`);
for (const id of timeline.sceneOrder) {
  const s = scenes[id];
  console.log(`${id.padEnd(15)} ${s.start.toFixed(2).padStart(6)} ${s.end.toFixed(2).padStart(6)} ${(s.end - s.start).toFixed(2).padStart(7)}`);
}
const spoken = Object.values(lines).reduce((a, l) => a + l.end - l.at, 0);
console.log(`\ntotal ${duration} s, speech ${spoken.toFixed(1)} s (${Math.round(100 * spoken / duration)}%), ${sfx.length} sound cues`);
// Lines that make sense one by one can still read badly in sequence (a line inserted between two that belonged together).
console.log(`\nNarration, read it as one paragraph:\n${allLines(script).map(l => l.say).join(" ")}`);
