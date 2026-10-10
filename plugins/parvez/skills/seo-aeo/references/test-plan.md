# Local test plan

Write the plan first (for example `notes/<ticket>/test-plan.md`, or wherever the user keeps notes), then run it,
then write the report. Every case has evidence: a command output file, a screenshot, or a JSON result.

## Setup

1. Build the change in production mode (indexing flag on) and in non-production mode. Keep both outputs.
2. Build the base branch the same way: `git worktree add ../base <base-branch>` (or `git archive
   <base> | tar -x -C base-src`), install, build.
3. Serve each build on its own port with the bundled server:
   `node "${CLAUDE_SKILL_DIR}/scripts/serve-build.mjs" <build-dir> 4180 --app-routes "<regex>"`
   (base on 4181). It is not the real host - say so in the report.
4. Browser: Playwright (Chromium). For no-JavaScript cases use a context with `javaScriptEnabled: false`,
   or open `/nojs` on the bundled server.

## Cases

| ID | What | How |
|----|------|-----|
| T01 | Content in initial HTML | `audit-url.mjs <url> --expect phrases.json`; all phrases found, text size > a few hundred characters |
| T02 | Page readable without JavaScript | Playwright, JS off, desktop 1440 px and mobile 390 px full-page screenshots; nav links work |
| T03 | Title, description, canonical | `audit-url.mjs`; view-source screenshot |
| T04 | Brand spelled one way | grep source and build output for wrong spellings |
| T05 | JSON-LD valid | JSON parse (build check) + validator.schema.org with the head pasted as a code snippet (recipe below); screenshot of 0 errors |
| T06 | robots.txt | `curl -i`: 200, text/plain, sitemap line; non-production build: `Disallow: /` |
| T07 | sitemap.xml | `curl -i`: 200, XML content type; parse with an XML parser |
| T08 | llms.txt | 200, text/plain, starts with `# Name` |
| T09 | Real 404 | status of an unknown URL, an old removed path, a missing static file = 404; screenshot of the 404 page |
| T10 | Same content for every bot | `audit-url.mjs` per-agent table: same status and size |
| T11 | Private routes not indexable | fetch an app route: `noindex`, no canonical |
| T12 | Social preview | Open Graph and Twitter tags complete, image URLs absolute and reachable |
| T13 | Less code on the landing page | Playwright: list the JS/CSS files the browser downloads on `/`, base vs change, with sizes |
| T14 | Speed | Lighthouse 3 runs mobile + 1 desktop, base vs change, median; report performance, accessibility, SEO, best practices, LCP, TBT, CLS |
| T15 | App takes over cleanly | JS on: static copy removed, one `h1` in the DOM, no console errors, no layout jump |
| T16 | App pages unchanged | screenshots of main app pages, base vs change; CSS rule order compare if routes became lazy |
| T17 | Deep links | every app route prefix returns the app shell, not 404 |
| T18 | Stale chunk after deploy | move a chunk file away, click a lazy link: one reload, then an error page, not a blank screen |
| T19 | Build check can fail | break one item at a time, each fails with its own message |
| T20 | Analytics / forms still work | tracking script present if there was one; contact or sign-up form opens |

Not local - list them with the reason: real host headers, compression and 404 handling; http/www
redirects; Core Web Vitals field data; Search Console / Bing; Rich Results Test by URL; asking ChatGPT or
Perplexity about the product; real sign-in on the deployed origin.

## Recipes

Fetch as a bot:

```bash
curl -s -A "Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)" http://localhost:4180/ -o gptbot.html
```

Files the browser loads on the landing page (Playwright):

```js
const files = [];
page.on("response", async (r) => {
  if (/\.(js|css)$/.test(new URL(r.url()).pathname)) files.push({ url: r.url(), bytes: (await r.body()).length });
});
await page.goto("http://localhost:4180/", { waitUntil: "networkidle" });
```

Schema.org validator for a local page (the "Fetch URL" option needs a public address, so paste the head):

```js
const html = await (await page.request.get("http://localhost:4180/")).text();
const snippet = "<html><head>" + html.match(/<title>[\s\S]*?<\/title>/)[0]
  + [...html.matchAll(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g)].map((m) => m[0]).join("")
  + "</head><body></body></html>";
await page.goto("https://validator.schema.org/", { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Close" }).click({ force: true });
await page.evaluate((code) => document.querySelectorAll(".CodeMirror").forEach((e) => e.CodeMirror.setValue(code)), snippet);
await page.locator("button", { hasText: "play_arrow" }).first().click({ force: true });
await page.waitForTimeout(12000);
await page.screenshot({ path: "schema-validator.png" });
```

Lighthouse against the local server:

```bash
npx --yes lighthouse@12 http://localhost:4180/ --throttling-method=devtools --output=json --output=html --output-path=lh/change-mobile-1 --chrome-flags="--headless=new" --quiet
npx --yes lighthouse@12 http://localhost:4180/ --preset=desktop --output=json --output=html --output-path=lh/change-desktop-1 --chrome-flags="--headless=new" --quiet
```

Run the whole set from one script (`run-all-evidence.sh`) so it can be repeated after every fix.
