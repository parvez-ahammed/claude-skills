// node build.mjs <project> [--from tts|plan|music|render|text|mix|check]
// Runs every step in order. --from skips the earlier steps (for example --from music after a visual-only change
// still needs render, so use --from render; after a script text change use the default).
import { spawnSync } from "node:child_process";
import path from "node:path";
import { ENGINE } from "./lib/project.mjs";

const dir = process.argv[2];
const i = process.argv.indexOf("--from");
const STEPS = [["tts"], ["plan"], ["music"], ["render", "video"], ["text", "render", "text"], ["mix"], ["check"]];
const from = i >= 0 ? STEPS.findIndex(([s]) => s === process.argv[i + 1]) : 0;
if (from < 0) { console.error(`--from must be one of ${STEPS.map(s => s[0]).join(", ")}`); process.exit(2); }

for (const [step, ...args] of STEPS.slice(from)) {
  console.log(`\n=== ${step} ===`);
  const [script, ...rest] = step === "text" ? args : [step, ...args];
  const r = spawnSync(process.execPath, [path.join(ENGINE, `${script}.mjs`), dir, ...rest], { stdio: "inherit" });
  if (r.status !== 0) { console.error(`\n${step} failed. Stopped.`); process.exit(r.status ?? 1); }
}
