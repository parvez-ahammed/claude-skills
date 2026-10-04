# Build check

A script that runs after the build (`"build": "vite build && node scripts/prerender.mjs && node
scripts/check-seo-build.mjs"`) and exits 1 with a list of every failed check. Collect all failures before
exiting, so one run shows everything.

## Checks to include

Pick the ones that apply. Each line is one `check(condition, message)`; the message says what is wrong in
words a developer understands without reading the script.

Landing page (`build/index.html`):
- prerendered content block exists and is not empty
- required phrases are in the visible text (product name, the "What is" definition, main features,
  supported systems). Keep this list short: it guards meaning, not wording
- exactly one `<h1>`
- no "enable JavaScript" message
- `<meta charset>` in the first 1024 bytes
- exact `<title>`; meta description starts with the expected words
- canonical link equals the canonical URL
- every Open Graph and Twitter tag present; `og:url` equals canonical; image URLs start with `https://`
- exactly one robots meta tag; `noindex` present if and only if the production flag is off
- every JSON-LD block parses; required `@type`s present
- no app stylesheet link; entry script under its byte budget; app start chunk not preloaded

App shell (`build/app.html`): has `noindex`, no canonical, no prerendered copy, links the app CSS and JS.

404 page (`build/404.html`): has `noindex`, an `<h1>`, no scripts.

robots / sitemap / llms.txt:
- production flag on: `robots.txt` does not `Disallow: /`, links the sitemap; `sitemap.xml` has the XML
  declaration, the sitemap namespace and the home URL; `llms.txt` starts with `# Name`
- production flag off: `robots.txt` is `Disallow: /`

Brand: wrong spellings of the product name do not appear in any HTML or the manifest.

Host routes: every first path segment in the router appears in the host's app-route rule.

Safety: if the build's sign-in or API origin is the production origin but the indexing flag is off, fail -
deploying that build removes the site from search engines. If indexing is on but the origin is not
production, print a warning - that build must not go to a test site.

## Starting script

Adapt names, paths and expected values. Plain Node, no dependencies.

```js
import fs from "node:fs/promises";
import path from "node:path";

const buildDir = path.resolve("build");
const canonicalUrl = "https://product.example/";
const allowIndexing = process.env.ALLOW_SEARCH_INDEXING === "true";
const noindexTag = '<meta name="robots" content="noindex" />';
const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };
const read = (name) => fs.readFile(path.join(buildDir, name), "utf8");
const meta = (html, attr, name) =>
  html.match(new RegExp(`<meta\\s+${attr}="${name}"\\s+content="([^"]*)"`))?.[1];

const html = await read("index.html");
check((html.match(/<h1[\s>]/g) ?? []).length === 1, "index.html must have exactly one <h1>");
check(html.includes(`<link rel="canonical" href="${canonicalUrl}"`), "index.html has no canonical link");
check(html.includes(noindexTag) === !allowIndexing, "index.html noindex does not match ALLOW_SEARCH_INDEXING");
for (const p of ["og:title", "og:description", "og:url", "og:type", "og:image"])
  check(meta(html, "property", p), `index.html has no ${p}`);
for (const [, json] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
  try { JSON.parse(json); } catch (e) { failures.push(`JSON-LD is not valid JSON: ${e.message}`); }
}

const robots = await read("robots.txt");
const blocksAll = /^Disallow:\s*\/\s*$/m.test(robots);
check(allowIndexing ? !blocksAll : blocksAll, "robots.txt does not match ALLOW_SEARCH_INDEXING");

if (failures.length) {
  console.error(`check-seo-build: ${failures.length} check(s) failed`);
  failures.forEach((f) => console.error(`  - ${f}`));
  process.exit(1);
}
console.log(`check-seo-build: all checks passed (indexing ${allowIndexing ? "allowed" : "blocked"})`);
```

## Prove it can fail

After adding it, change one thing at a time in the build output or source and run the check:
remove the canonical, add a second `<h1>`, break the JSON-LD, turn the flag off, add a route without a host
rule. Each must fail with its own message. Record this in the test report as a case.
