// node check.mjs <project>
// Measures the finished video and writes dist/report.json + build/contact.png (one frame at every whole second).
// Fails (exit 1) when any item in "problems" is set. Look at contact.png before you tell the user the video is done.
import fs from "node:fs";
import path from "node:path";
import { loadProject, runFfmpeg, outputName, labelFont, allLines } from "./lib/project.mjs";

const prj = loadProject(process.argv[2]);
const TL = prj.readJson("build/timeline.json");
const file = prj.p("dist", outputName(prj));
if (!fs.existsSync(file)) { console.error(`Missing ${file}. Run mix.mjs first.`); process.exit(1); }
const opts = prj.script.check ?? {};
const [W, H] = TL.size;
const U = Math.min(W, H) / 1080;
const landscape = W > H;

const info = runFfmpeg(["-stats", "-i", file, "-map", "0:v", "-f", "null", "-"]);
const dur = info.match(/Duration: (\d+):(\d+):([\d.]+)/);
const seconds = +dur[1] * 3600 + +dur[2] * 60 + +dur[3];
const frames = +[...info.matchAll(/frame=\s*(\d+)/g)].at(-1)?.[1];
const size = info.match(/Video: .*?, (\d+)x(\d+)/);
const loud = runFfmpeg(["-i", file, "-af", "ebur128=peak=true", "-f", "null", "-"]);
const lufs = +loud.match(/I:\s+(-?[\d.]+) LUFS/g).at(-1).match(/-?[\d.]+/)[0];
const peak = +loud.match(/Peak:\s+(-?[\d.]+) dBFS/g)?.at(-1).match(/-?[\d.]+/)[0];

const problems = [];
const warnings = [];
const norm = s => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const ranges = (ts, step) => ts.reduce((out, t) => {
  const last = out.at(-1);
  if (last && t - last[1] <= step + 1e-6) last[1] = t; else out.push([t, t]);
  return out;
}, []);

// 1. Contact sheet: the frame at every whole second, labelled with its exact time.
const font = labelFont();
const cols = landscape ? 6 : 10, tileW = landscape ? 320 : 216;
const rows = Math.ceil((Math.floor(seconds) + 1) / cols);
const stamp = font ? `,drawtext=fontfile='${font}':text='%{pts\\:hms}':x=4:y=h-th-4:fontsize=12:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=3` : "";
runFfmpeg(["-y", "-i", file, "-vf", `select='not(mod(n\\,${TL.fps}))',scale=${tileW}:-2${stamp},tile=${cols}x${rows}:padding=4:color=white`,
  "-frames:v", "1", "-fps_mode", "vfr", prj.p("build", "contact.png")]);

// 2. Empty frames: edge detail per frame (10 per second). Text, cards and logos have edges; a bare background has almost none.
const edges = runFfmpeg(["-i", file, "-vf", "fps=10,scale=480:-2,format=gray,edgedetect=low=0.08:high=0.2,signalstats,metadata=print:key=lavfi.signalstats.YAVG", "-f", "null", "-"]);
const detail = [...edges.matchAll(/pts_time:([\d.]+)[\s\S]*?YAVG=([\d.]+)/g)].map(m => [+m[1], +m[2]]);
const median = [...detail.map(d => d[1])].sort((a, b) => a - b)[Math.floor(detail.length / 2)] ?? 0;
const maxEmpty = opts.emptyFrameMaxSeconds ?? 0.3;
const emptyRuns = ranges(detail.filter(([, y]) => y < 0.15 * median).map(([t]) => t), 0.1).filter(([a, b]) => b - a + 0.1 > maxEmpty);
for (const [a, b] of emptyRuns) problems.push(`almost empty frame from ${a.toFixed(1)} to ${(b + 0.1).toFixed(1)} s (start the next scene's content earlier or shorten the fade)`);

// 3. On-screen text and its size, from render.mjs text.
const onscreenFile = prj.p("build", "onscreen.json");
const onscreen = fs.existsSync(onscreenFile) ? prj.readJson("build/onscreen.json") : null;
if (!onscreen) problems.push("build/onscreen.json is missing: run render.mjs <project> text");
const blocks = new Map();
for (const s of onscreen?.samples ?? []) for (const x of s.texts) {
  const b = blocks.get(x.text) ?? { text: x.text, px: x.px, t: s.t };
  if (x.px < b.px) Object.assign(b, { px: x.px, t: s.t });
  blocks.set(x.text, b);
}
const minPx = opts.minTextPx ?? (landscape ? 16 : 24) * U;
// Labels of 4 letters or fewer ("XLSX" on a file icon) are part of an icon, not text a viewer reads.
const small = [...blocks.values()].filter(b => b.px < minPx && b.text.replace(/[^\p{L}]/gu, "").length > 4).sort((a, b) => a.px - b.px);
if (small.length) {
  const list = small.slice(0, 8).map(b => `"${b.text.slice(0, 40)}" ${b.px} px at ${b.t} s`).join("; ");
  (landscape ? warnings : problems).push(`${small.length} text block(s) smaller than ${minPx.toFixed(0)} px${landscape ? "" : " (too small on a phone)"}: ${list}`);
}
// 4. Claims: every spoken line and every on-screen text of 4 or more words needs a row in claims.md with its source.
const claimsFile = prj.p("claims.md");
const claimRows = fs.existsSync(claimsFile)
  ? fs.readFileSync(claimsFile, "utf8").split("\n").filter(l => /^\|/.test(l) && !/^\|\s*-/.test(l))
    .map(l => l.split("|").slice(1, -1).map(c => c.trim())).filter(c => c.length >= 2 && c[0] && !/^claim$/i.test(c[0]))
  : null;
const unsourced = [];
if (!claimRows) problems.push("claims.md is missing: list every spoken line and every on-screen claim with its source (template: engine/template/claims.md)");
else {
  const covered = text => claimRows.some(([claim, source]) => source && norm(claim).includes(norm(text)));
  for (const l of allLines(prj.script)) if (!covered(l.say)) unsourced.push(`spoken "${l.say}"`);
  for (const b of blocks.values()) if (norm(b.text).split(" ").length >= 4 && !covered(b.text)) unsourced.push(`on screen at ${b.t} s "${b.text}"`);
  if (unsourced.length) problems.push(`${unsourced.length} text(s) without a sourced row in claims.md: ${unsourced.slice(0, 6).join("; ")}${unsourced.length > 6 ? " ..." : ""}`);
}

// 5. Words a person must listen to: names, acronyms and codes the voice may say wrong.
const pronounce = prj.script.voice?.pronounce ?? {};
const listenFor = [...new Set(allLines(prj.script).flatMap(l => l.say.match(/\b(?:[A-Z]{2,}\w*|[A-Z]\d\w*|[A-Z][a-z]+[A-Z]\w*)\b/g) ?? []))];
for (const w of Object.keys(pronounce)) if (!listenFor.includes(w)) listenFor.push(w);

// 6. Other videos in dist/, so an old or renamed file is not shared by mistake.
const others = fs.readdirSync(prj.p("dist")).filter(f => /\.(mp4|mov|webm)$/i.test(f) && f !== path.basename(file)).map(f => {
  const m = runFfmpeg(["-i", prj.p("dist", f), "-f", "null", "-t", "0", "-"]);
  const d = m.match(/Duration: (\d+):(\d+):([\d.]+)/), s = m.match(/Video: .*?, (\d+)x(\d+)/);
  return `${f} (${s ? `${s[1]}x${s[2]}` : "?"}, ${d ? (+d[2] * 60 + +d[3]).toFixed(1) : "?"} s)`;
});
if (others.length) warnings.push(`dist/ also holds older videos: ${others.join("; ")}. Move them to dist/old/ or delete them before you hand over.`);

const report = {
  file, bytes: fs.statSync(file).size, seconds, expectedSeconds: TL.duration, frames, expectedFrames: Math.round(TL.duration * TL.fps),
  size: `${size[1]}x${size[2]}`, loudnessLUFS: lufs, truePeakDBFS: peak,
  speechSeconds: +Object.values(TL.lines).reduce((a, l) => a + l.end - l.at, 0).toFixed(1), scenes: TL.sceneOrder.length, captions: TL.captions.length,
  emptyFrameRuns: emptyRuns.map(([a, b]) => [a, +(b + 0.1).toFixed(1)]), smallestTextPx: small[0]?.px ?? null, listenFor,
};
if (Math.abs(seconds - TL.duration) > 0.05) problems.push(`length is ${seconds} s, planned ${TL.duration} s`);
if (frames && Math.abs(frames - report.expectedFrames) > 1) problems.push(`${frames} frames, planned ${report.expectedFrames}`);
if (Math.abs(lufs + 14) > 1) problems.push(`loudness ${lufs} LUFS, target -14`);
if (peak > -1) problems.push(`true peak ${peak} dBFS is above -1`);
Object.assign(report, { problems, warnings });
fs.writeFileSync(prj.p("dist", "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log(`\ncontact sheet (one frame per second): ${prj.p("build", "contact.png")}`);
if (listenFor.length) console.log(`Ask the user to listen to: ${listenFor.join(", ")}`);
if (problems.length) process.exitCode = 1;
