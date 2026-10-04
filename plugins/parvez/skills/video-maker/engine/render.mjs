// node render.mjs <project> stills 1.5 8 20   -> build/stills/t-<t>.png + build/stills/sheet.png
// node render.mjs <project> stills --every 5   -> one still every 5 s
// node render.mjs <project> video [--workers 4] -> build/video-silent.mp4 (or WORKERS=2 in the environment)
// node render.mjs <project> text               -> build/onscreen.json (visible text and its size, every 0.5 s)
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import { loadProject, ENGINE, ffmpegPath, runFfmpeg, label } from "./lib/project.mjs";

const [dir, mode = "video", ...args] = process.argv.slice(2);
const prj = loadProject(dir);
const TL = prj.readJson("build/timeline.json");
const { fps, duration } = TL;
const [width, height] = TL.size;
const flag = (name, def) => { const i = args.indexOf(name); return i >= 0 ? +args[i + 1] : def; };
// Each worker is one Chromium page at full size, about 700 MB at 1080p. Too many workers on a busy machine get the
// render killed part way, so the default also looks at free memory.
const byMemory = Math.floor(os.freemem() / (700 * 1024 * 1024));
const WORKERS = flag("--workers", +process.env.WORKERS || Math.max(1, Math.min(4, Math.floor(os.cpus().length / 2), byMemory)));

const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf" };
// /engine/... serves the engine (stage.js, fonts in node_modules); everything else serves the project folder.
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = url.startsWith("/engine/") ? path.join(ENGINE, url.slice(8)) : path.join(prj.root, url);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, r));
const url = `http://localhost:${server.address().port}/index.html`;
const browser = await chromium.launch();
let problems = 0;

async function openPage() {
  const page = await browser.newPage({ viewport: { width, height } });
  page.on("pageerror", e => { problems++; console.error("page error:", e.message); });
  page.on("console", m => { if (m.type() === "error") { problems++; console.error("console error:", m.text()); } });
  page.on("requestfailed", r => { problems++; console.error("failed to load:", r.url()); });
  page.on("response", r => { if (r.status() >= 400) { problems++; console.error(`HTTP ${r.status()}:`, r.url()); } });
  await page.goto(url);
  await page.waitForFunction(() => window.ready, null, { timeout: 30000 });
  await page.evaluate(() => window.ready);
  return page;
}

async function renderPart(part, first, last) {
  const page = await openPage();
  const out = prj.p("build", `part-${part}.mp4`);
  const ff = spawn(ffmpegPath, ["-y", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "png", "-i", "-",
    "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", "-r", String(fps), out], { stdio: ["pipe", "ignore", "ignore"] });
  for (let f = first; f < last; f++) {
    await page.evaluate(t => window.seek(t), f / fps);
    const png = await page.screenshot({ type: "png" });
    if (!ff.stdin.write(png)) await new Promise(r => ff.stdin.once("drain", r));
    if ((f - first) % (fps * 5) === 0) console.log(`part ${part}: ${((f - first) / fps).toFixed(0)}/${((last - first) / fps).toFixed(0)} s`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on("close", r));
  await page.close();
  return out;
}

try {
  if (mode === "stills") {
    const every = flag("--every", 0);
    const times = every ? Array.from({ length: Math.floor(duration / every) }, (_, i) => +(i * every + every / 2).toFixed(2)) : args.filter(a => !a.startsWith("--")).map(Number);
    if (!times.length) throw new Error("Give times, e.g. stills 1 5.5 12, or --every 4");
    const outDir = prj.p("build", "stills");
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });
    const page = await openPage();
    const files = [];
    for (const t of times) {
      await page.evaluate(t => window.seek(t), t);
      const f = path.join(outDir, `t-${t}.png`);
      await page.screenshot({ path: f });
      files.push(f);
    }
    contactSheet(files, times, path.join(outDir, "sheet.png"));
    console.log(`${files.length} stills + sheet.png in ${outDir}`);
  } else if (mode === "text") {
    const page = await openPage();
    const times = [...Array.from({ length: Math.floor(duration * 2) }, (_, i) => i / 2), +(duration - 1 / fps).toFixed(3)];
    const samples = [];
    for (const t of times) {
      await page.evaluate(t => window.seek(t), t);
      samples.push({ t, ...await page.evaluate(readVisibleText) });
    }
    fs.writeFileSync(prj.p("build", "onscreen.json"), JSON.stringify({ size: [width, height], samples }, null, 1));
    const unique = new Set(samples.flatMap(s => s.texts.map(x => x.text)));
    console.log(`${samples.length} samples, ${unique.size} different text blocks -> build/onscreen.json`);
  } else {
    const frames = Math.round(fps * duration);
    const per = Math.ceil(frames / WORKERS);
    const started = Date.now();
    const parts = await Promise.all(Array.from({ length: WORKERS }, (_, i) => renderPart(i, i * per, Math.min(frames, (i + 1) * per))));
    fs.writeFileSync(prj.p("build", "parts.txt"), parts.map(p => `file '${path.basename(p)}'`).join("\n"));
    runFfmpeg(["-y", "-f", "concat", "-safe", "0", "-i", prj.p("build", "parts.txt"), "-c", "copy", prj.p("build", "video-silent.mp4")]);
    parts.forEach(p => fs.rmSync(p));
    console.log(`${frames} frames in ${((Date.now() - started) / 1000).toFixed(0)} s with ${WORKERS} workers -> build/video-silent.mp4`);
  }
} finally {
  await browser.close();
  server.close();
}
if (problems) { console.error(`\n${problems} page problem(s) above. Fix them before you trust the output.`); process.exitCode = 1; }

// Runs inside the page. Returns each visible text block (captions excluded: they are the spoken lines) and the size it
// is drawn at after transforms, for check.mjs.
function readVisibleText() {
  const stage = document.getElementById("stage");
  const W = stage.offsetWidth, H = stage.offsetHeight;
  const opacity = e => { let o = 1; for (let x = e; x && x !== document.body; x = x.parentElement) o *= +getComputedStyle(x).opacity; return o; };
  const shown = e => e.checkVisibility({ opacityProperty: true, visibilityProperty: true }) && opacity(e) > 0.6;
  const blockOf = e => { let x = e; while (x.parentElement && x.parentElement !== stage && /^inline/.test(getComputedStyle(x).display)) x = x.parentElement; return x; };
  // Words drawn as separate inline-block spans have no space between them in innerText ("Stillemailing").
  const wordsOf = e => { const out = []; const w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT); while (w.nextNode()) out.push(w.currentNode.textContent); return out.join(" ").replace(/\s+/g, " ").trim(); };
  const texts = new Map();
  for (const e of stage.querySelectorAll("*")) {
    if (e.closest(".vm-caption") || !shown(e)) continue;
    const r = e.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || r.width * r.height > 0.8 * W * H) continue;
    if (![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    const text = wordsOf(blockOf(e));
    const scale = e.offsetHeight ? r.height / e.offsetHeight : 1;
    const px = Math.round(parseFloat(getComputedStyle(e).fontSize) * scale * 10) / 10;
    if (text && (!texts.has(text) || texts.get(text) > px)) texts.set(text, px);
  }
  return { texts: [...texts].map(([text, px]) => ({ text, px })) };
}

// A labelled grid of frames, so the whole video can be reviewed from one image.
export function contactSheet(files, labels, out) {
  const cols = files.length <= 4 ? 2 : files.length <= 9 ? 3 : 4;
  const w = 640, h = Math.round(640 * height / width);
  const inputs = files.flatMap(f => ["-i", f]);
  const scaled = files.map((_, i) => `[${i}]scale=${w}:${h}${label(`${labels[i]} s`, 26)}[s${i}]`);
  const layout = files.map((_, i) => `${(i % cols) * w}_${Math.floor(i / cols) * h}`).join("|");
  const grid = files.length === 1 ? `[s0]copy[out]` : `${files.map((_, i) => `[s${i}]`).join("")}xstack=inputs=${files.length}:layout=${layout}:fill=white[out]`;
  runFfmpeg(["-y", ...inputs, "-filter_complex", [...scaled, grid].join(";"), "-map", "[out]", out]);
}
