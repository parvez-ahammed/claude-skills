// node mix.mjs <project>
// Places each voice line at its planned time, lowers the music under the voice, sets loudness to -14 LUFS
// (the level YouTube, LinkedIn, Instagram and TikTok normalise to) and writes dist/<name>-<W>x<H>.mp4 + thumbnail.
import fs from "node:fs";
import { loadProject, runFfmpeg, outputName } from "./lib/project.mjs";

const prj = loadProject(process.argv[2]);
const TL = prj.readJson("build/timeline.json");
const D = TL.duration;
const lines = Object.entries(TL.lines);
const musicVolume = prj.script.music?.mix ?? 0.5;

const voiceChain = lines.length
  ? [
    ...lines.map(([id, l], i) => {
      const ms = Math.max(0, Math.round(l.start * 1000));
      return `[${i + 1}:a]aresample=48000,pan=stereo|c0=c0|c1=c0,adelay=${ms}|${ms}[v${i}]`;
    }),
    `${lines.map((_, i) => `[v${i}]`).join("")}amix=inputs=${lines.length}:normalize=0,highpass=f=80,acompressor=threshold=-20dB:ratio=3:attack=5:release=120,volume=2.2,asplit[vo][key]`,
    `[0:a]volume=${musicVolume}[mus]`,
    `[mus][key]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=350[duck]`,
    `[duck][vo]amix=inputs=2:normalize=0[mix]`,
  ]
  : [`[0:a]anull[mix]`];
const filter = [...voiceChain, `[mix]atrim=0:${D}[out]`].join(";");
runFfmpeg(["-y", "-i", prj.p("build/music.wav"), ...lines.flatMap(([id]) => ["-i", prj.p("build/vo", `${id}.wav`)]),
  "-filter_complex", filter, "-map", "[out]", "-c:a", "pcm_f32le", prj.p("build/soundtrack-raw.wav")]);

// Two-pass loudnorm: one pass lands 1-2 LU short on short videos with little speech.
const TARGET = "I=-14:TP=-1.5:LRA=11";
const measured = JSON.parse(runFfmpeg(["-i", prj.p("build/soundtrack-raw.wav"), "-af", `loudnorm=${TARGET}:print_format=json`, "-f", "null", "-"]).match(/\{[\s\S]*?\}/g).at(-1));
const second = `loudnorm=${TARGET}:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}:linear=true`;
// apad + atrim: loudnorm drops the last few hundred ms, which would make the file shorter than the video.
runFfmpeg(["-y", "-i", prj.p("build/soundtrack-raw.wav"), "-af", `${second},aresample=48000,apad,atrim=0:${D}`, "-c:a", "pcm_s16le", prj.p("build/soundtrack.wav")]);

const out = prj.p("dist", outputName(prj));
runFfmpeg(["-y", "-i", prj.p("build/video-silent.mp4"), "-i", prj.p("build/soundtrack.wav"), "-map", "0:v", "-map", "1:a",
  "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-t", String(D), out]);
runFfmpeg(["-y", "-sseof", "-0.1", "-i", out, "-frames:v", "1", prj.p("dist", "thumbnail.png")]);
console.log(`wrote ${out}\nwrote ${prj.p("dist", "thumbnail.png")} (last frame)`);
if (!fs.existsSync(prj.p("dist/captions.srt"))) console.warn("no dist/captions.srt; run plan.mjs");
