// Local stand-in for a production host, for SEO tests of a static or prerendered build.
// Usage: node serve-build.mjs <build-dir> [port=4180] [--app-routes "<regex on the path without the leading />"]
//   "/"            -> index.html
//   real file      -> the file
//   app route      -> app.html if it exists, else index.html
//   anything else  -> 404.html with status 404 (index.html with status 404 when there is no 404.html)
//   "/nojs"        -> index.html with its module scripts removed
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const args = process.argv.slice(2);
const appRoutesIndex = args.indexOf("--app-routes");
const appRoutes = appRoutesIndex >= 0 ? new RegExp(args[appRoutesIndex + 1]) : null;
// Guard the index: with no --app-routes, appRoutesIndex + 1 === 0 would drop the build dir.
const positional = appRoutesIndex >= 0 ? args.filter((_, i) => i !== appRoutesIndex && i !== appRoutesIndex + 1) : args;
const buildDir = path.resolve(positional[0] ?? "build");
const port = Number(positional[1] ?? 4180);

if (!fs.existsSync(path.join(buildDir, "index.html"))) {
  console.error(`serve-build: ${buildDir} has no index.html`);
  process.exit(1);
}

const types = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".xml": "application/xml", ".txt": "text/plain; charset=utf-8", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".avif": "image/avif", ".gif": "image/gif", ".svg": "image/svg+xml",
  ".ico": "image/x-icon", ".woff2": "font/woff2", ".woff": "font/woff", ".mp4": "video/mp4", ".webm": "video/webm",
};
const inBuild = (name) => path.join(buildDir, name);
const exists = (file) => fs.existsSync(file) && fs.statSync(file).isFile();

function send(req, res, status, file, transform) {
  let body = fs.readFileSync(file);
  if (transform) body = Buffer.from(transform(body.toString()));
  const type = types[path.extname(file).toLowerCase()] ?? "application/octet-stream";
  const headers = { "Content-Type": type };
  // Production hosts compress text; without it Lighthouse numbers are far worse than production.
  if (/text|javascript|json|xml|svg/.test(type) && /gzip/.test(req.headers["accept-encoding"] ?? "")) {
    body = zlib.gzipSync(body);
    headers["Content-Encoding"] = "gzip";
  }
  res.writeHead(status, headers);
  res.end(req.method === "HEAD" ? undefined : body);
}

http
  .createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    let rel;
    try {
      rel = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    } catch {
      rel = null; // malformed %-escape: answer 404 instead of crashing the server
    }
    const file = rel === null ? null : path.resolve(buildDir, rel);
    if (file === null || (file !== buildDir && !file.startsWith(buildDir + path.sep))) {
      return send(req, res, 404, exists(inBuild("404.html")) ? inBuild("404.html") : inBuild("index.html"));
    }
    if (rel === "nojs") {
      return send(req, res, 200, inBuild("index.html"), (html) =>
        html.replace(/<script type="module"[^>]*>[\s\S]*?<\/script>/g, "").replace(/<link rel="modulepreload"[^>]*>/g, ""),
      );
    }
    if (rel === "") return send(req, res, 200, inBuild("index.html"));
    if (exists(file)) return send(req, res, 200, file);
    if (exists(path.join(file, "index.html"))) return send(req, res, 200, path.join(file, "index.html"));
    if (appRoutes?.test(rel)) return send(req, res, 200, exists(inBuild("app.html")) ? inBuild("app.html") : inBuild("index.html"));
    return send(req, res, 404, exists(inBuild("404.html")) ? inBuild("404.html") : inBuild("index.html"));
  })
  .listen(port, () => console.log(`serve-build: ${buildDir} on http://localhost:${port}`));
