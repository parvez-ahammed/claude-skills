import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import ffmpegPath from "ffmpeg-static";

export const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export { ffmpegPath };

export function loadProject(dir) {
  if (!dir) {
    console.error("Give the project folder as the first argument, e.g. node tts.mjs ./my-video");
    process.exit(2);
  }
  const root = path.resolve(dir);
  const scriptFile = path.join(root, "script.json");
  if (!fs.existsSync(scriptFile)) {
    console.error(`No script.json in ${root}. Create a project with: node ${path.join(ENGINE, "new.mjs")} <folder>`);
    process.exit(2);
  }
  const script = JSON.parse(fs.readFileSync(scriptFile, "utf8"));
  const p = (...parts) => path.join(root, ...parts);
  fs.mkdirSync(p("build", "vo"), { recursive: true });
  fs.mkdirSync(p("dist"), { recursive: true });
  const readJson = f => JSON.parse(fs.readFileSync(p(f), "utf8"));
  const [width, height] = script.size ?? [1920, 1080];
  const name = script.name ?? path.basename(root);
  return { root, script, p, readJson, width, height, fps: script.fps ?? 30, name };
}

export const allLines = script => script.scenes.flatMap(s => (s.lines ?? []).map(l => ({ ...l, scene: s.id })));

export function runFfmpeg(args, { quiet = true } = {}) {
  const r = spawnSync(ffmpegPath, ["-hide_banner", ...args], { stdio: ["ignore", quiet ? "ignore" : "inherit", "pipe"], maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) {
    console.error(r.stderr.toString().slice(-3000));
    throw new Error("ffmpeg failed: " + args.join(" ").slice(0, 200));
  }
  return r.stderr.toString();
}

export const outputName = prj => `${prj.name}-${prj.width}x${prj.height}.mp4`;

// ffmpeg drawtext needs a real font file; returns a filter-escaped path, or null to draw no labels.
export function labelFont() {
  const candidates = ["C:/Windows/Fonts/arial.ttf", "/System/Library/Fonts/Supplemental/Arial.ttf", "/Library/Fonts/Arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/dejavu/DejaVuSans.ttf"];
  const f = candidates.find(c => fs.existsSync(c));
  return f ? f.replace(/:/g, "\\:") : null;
}
export const label = (text, size) => {
  const font = labelFont();
  return font ? `,drawtext=fontfile='${font}':text='${text}':x=12:y=12:fontsize=${size}:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=6` : "";
};
