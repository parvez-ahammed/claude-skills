// node new.mjs <folder> [--name my-video] [--size 1920x1080]
// Copies the starter project (script.json, brand.css, index.html, assets/) into <folder>.
import fs from "node:fs";
import path from "node:path";
import { ENGINE } from "./lib/project.mjs";

const [dir, ...args] = process.argv.slice(2);
if (!dir) { console.error("Usage: node new.mjs <folder> [--name my-video] [--size 1920x1080]"); process.exit(2); }
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const root = path.resolve(dir);
if (fs.existsSync(path.join(root, "script.json"))) { console.error(`${root} already has a script.json. Not overwriting.`); process.exit(1); }

fs.mkdirSync(root, { recursive: true });
fs.cpSync(path.join(ENGINE, "template"), root, { recursive: true });
const scriptFile = path.join(root, "script.json");
const script = JSON.parse(fs.readFileSync(scriptFile, "utf8"));
script.name = opt("--name") ?? path.basename(root);
if (opt("--size")) script.size = opt("--size").split("x").map(Number);
fs.writeFileSync(scriptFile, JSON.stringify(script, null, 2) + "\n");
fs.writeFileSync(path.join(root, ".gitignore"), "build/\n");

console.log(`Created ${root}
Next:
  1. Edit brand.css (real brand colours and font) and put the logo in assets/
  2. Write script.json (scenes and spoken lines) and claims.md (every claim and product fact, with its source)
  3. node "${path.join(ENGINE, "tts.mjs")}" "${root}"  then  plan.mjs
  4. Build the scenes in index.html, check them with render.mjs stills
  5. node "${path.join(ENGINE, "build.mjs")}" "${root}" --from music`);
