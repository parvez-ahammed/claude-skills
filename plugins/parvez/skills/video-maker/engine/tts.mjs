// node tts.mjs <project> [--force]
// Speaks every line in script.json with Kokoro and writes build/vo/<lineId>.wav + build/vo/durations.json.
// Lines whose text, voice and speed did not change are skipped, so re-running after a script edit is fast.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { env } from "@huggingface/transformers";
import { KokoroTTS } from "kokoro-js";
import { loadProject, allLines } from "./lib/project.mjs";

const prj = loadProject(process.argv[2]);
const force = process.argv.includes("--force");
const voice = prj.script.voice ?? {};
const voiceName = voice.name ?? "af_heart";
const speed = voice.speed ?? 1.05;
const pronounce = voice.pronounce ?? {};

// One model download shared by every project on this machine.
env.cacheDir = path.join(os.homedir(), ".cache", "video-maker", "models");

const durFile = prj.p("build", "vo", "durations.json");
const old = fs.existsSync(durFile) ? JSON.parse(fs.readFileSync(durFile, "utf8")) : {};
const spoken = text => Object.entries(pronounce).reduce((s, [word, sayAs]) => s.replaceAll(word, sayAs), text);

const lines = allLines(prj.script);
const ids = new Set();
for (const l of lines) {
  if (ids.has(l.id)) throw new Error(`Line id "${l.id}" is used twice in script.json`);
  ids.add(l.id);
}

let tts;
const out = {};
for (const line of lines) {
  const text = spoken(line.say);
  const wav = prj.p("build", "vo", `${line.id}.wav`);
  const prev = old[line.id];
  if (!force && prev && prev.text === text && prev.voice === voiceName && prev.speed === speed && fs.existsSync(wav)) {
    out[line.id] = prev;
    continue;
  }
  tts ??= await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", { dtype: "q8", device: "cpu" });
  const audio = await tts.generate(text, { voice: voiceName, speed });
  audio.save(wav);
  const samples = audio.audio, sr = audio.sampling_rate;
  let first = 0, last = samples.length - 1;
  while (first < samples.length && Math.abs(samples[first]) < 0.01) first++;
  while (last > first && Math.abs(samples[last]) < 0.01) last--;
  out[line.id] = {
    text, voice: voiceName, speed,
    duration: +(samples.length / sr).toFixed(3),
    onset: +(first / sr).toFixed(3),
    offset: +(last / sr).toFixed(3),
  };
  console.log(`${line.id.padEnd(16)} ${out[line.id].duration.toFixed(2)} s  "${line.say}"`);
}
fs.writeFileSync(durFile, JSON.stringify(out, null, 2));
const speech = Object.values(out).reduce((a, d) => a + d.offset - d.onset, 0);
console.log(`\n${lines.length} lines, ${speech.toFixed(1)} s of speech (voice ${voiceName}, speed ${speed}).`);
const unhinted = [...new Set(lines.flatMap(l => l.say.match(/\b(?:[A-Z]{2,}\w*|[A-Z]\d\w*|[A-Z][a-z]+[A-Z]\w*)\b/g) ?? []))].filter(w => !(w in pronounce));
if (unhinted.length) console.log(`No pronounce entry for: ${unhinted.join(", ")}. Add one if the voice may say it wrong; the user must listen to these.`);
