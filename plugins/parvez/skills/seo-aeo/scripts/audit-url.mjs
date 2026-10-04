// Shows what search and answer-engine crawlers get from a URL, before any JavaScript runs.
// Usage: node audit-url.mjs <url> [--expect expect.json] [--json out.json]
// expect.json (all optional): { "phrases": ["..."], "title": "...", "canonical": "https://...",
//   "jsonLdTypes": ["Organization"], "indexable": true }
// Exit code 1 when an expectation fails or the page is not reachable.
import fs from "node:fs";

const args = process.argv.slice(2);
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const target = args.find((a, i) => !a.startsWith("--") && !["--expect", "--json"].includes(args[i - 1]));
if (!target) {
  console.error("usage: node audit-url.mjs <url> [--expect expect.json] [--json out.json]");
  process.exit(1);
}
const expect = option("--expect") ? JSON.parse(fs.readFileSync(option("--expect"), "utf8")) : {};
const pageUrl = new URL(target);
const origin = pageUrl.origin;

const agents = {
  browser: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
  Googlebot: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  GPTBot: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot",
  "OAI-SearchBot": "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot",
  PerplexityBot: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot",
  ClaudeBot: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ClaudeBot/1.0; +claudebot@anthropic.com",
};

async function get(url, userAgent = agents.browser) {
  try {
    const response = await fetch(url, { headers: { "User-Agent": userAgent }, redirect: "manual" });
    return { status: response.status, type: response.headers.get("content-type") ?? "", location: response.headers.get("location"), body: await response.text() };
  } catch (error) {
    return { status: 0, type: "", body: "", error: error.message };
  }
}

const decode = (s) => s.replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
const textOf = (html) => decode(html.replace(/<(script|style|svg|noscript)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const attr = (tag, name) => tag.match(new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`, "i"))?.[1] ?? tag.match(new RegExp(`\\s${name}\\s*=\\s*'([^']*)'`, "i"))?.[1];
const metaTags = (html) => [...html.matchAll(/<meta\b[^>]*>/gi)].map((m) => m[0]);
function meta(html, key) {
  const tag = metaTags(html).find((t) => (attr(t, "name") ?? attr(t, "property"))?.toLowerCase() === key.toLowerCase());
  return tag ? decode(attr(tag, "content") ?? "") : undefined;
}

const failures = [];
const warnings = [];
const check = (ok, message) => { if (!ok) failures.push(message); };
const warn = (ok, message) => { if (!ok) warnings.push(message); };

const perAgent = {};
for (const [name, ua] of Object.entries(agents)) perAgent[name] = await get(pageUrl.href, ua);
const page = perAgent.browser;
if (page.status === 0) {
  console.error(`cannot reach ${pageUrl.href}: ${page.error}`);
  process.exit(1);
}
if (page.status >= 300 && page.status < 400) console.log(`note: ${pageUrl.href} redirects (${page.status}) to ${page.location}; audit that URL instead`);

const html = page.body;
const body = html.match(/<body[\s\S]*<\/body>/i)?.[0] ?? html;
const text = textOf(body);
const head = {
  lang: html.match(/<html\b[^>]*\blang="([^"]*)"/i)?.[1],
  title: decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? ""),
  description: meta(html, "description"),
  canonical: [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]).filter((t) => attr(t, "rel") === "canonical").map((t) => attr(t, "href")),
  robots: metaTags(html).filter((t) => /^(robots|googlebot)$/i.test(attr(t, "name") ?? "")).map((t) => attr(t, "content")),
  charsetByte: html.search(/<meta\s+charset/i),
};
const social = Object.fromEntries(
  ["og:title", "og:description", "og:url", "og:type", "og:image", "og:image:alt", "twitter:card", "twitter:title", "twitter:description", "twitter:image"].map((k) => [k, meta(html, k)]),
);

const jsonLd = [];
for (const [, json] of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
  try {
    const data = JSON.parse(json);
    for (const item of [data].flat().flatMap((d) => d["@graph"] ?? [d])) jsonLd.push(item);
  } catch (error) {
    failures.push(`JSON-LD is not valid JSON: ${error.message}`);
  }
}
const jsonLdTypes = jsonLd.flatMap((i) => [i["@type"]].flat()).filter(Boolean);

const headings = [...body.matchAll(/<(h[1-4])\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((m) => `${m[1].toLowerCase()}  ${textOf(m[2])}`);
const h1Count = headings.filter((h) => h.startsWith("h1")).length;
const paragraphs = [...body.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => textOf(m[1])).filter((p) => p.split(" ").length >= 20);
const firstAnswer = paragraphs[0];
// "What is X?" counts; "What it takes to use X" and "Ready to start?" do not.
const questionHeadings = headings.filter((h) => /^h\d\s+(what|how|why|who|when|which|where|can|does|do|is|are|should)\b.*\?\s*$/i.test(h));

const robotsTxt = await get(`${origin}/robots.txt`);
const sitemapUrls = [...robotsTxt.body.matchAll(/^sitemap:\s*(\S+)/gim)].map((m) => m[1]);
// A local build lists the production sitemap URL; read the local copy instead.
const sitemapUrl = sitemapUrls[0] ? `${origin}${new URL(sitemapUrls[0]).pathname}` : `${origin}/sitemap.xml`;
const sitemap = await get(sitemapUrl);
const llms = await get(`${origin}/llms.txt`);
const missing = await get(`${origin}/this-page-should-not-exist-${Date.now()}`);

function robotsBlocks(robots, bot) {
  const groups = robots.split(/\n(?=\s*user-agent:)/i);
  const match = (g, name) => new RegExp(`^\\s*user-agent:\\s*${name}\\s*$`, "im").test(g);
  const group = groups.find((g) => match(g, bot.replace(/[-]/g, "\\-"))) ?? groups.find((g) => match(g, "\\*"));
  return group ? /^\s*disallow:\s*\/\s*$/im.test(group) : false;
}
const aiBots = ["Googlebot", "Bingbot", "GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "PerplexityBot", "Google-Extended", "CCBot"];
const blockedBots = robotsTxt.status === 200 ? aiBots.filter((b) => robotsBlocks(robotsTxt.body, b)) : [];

const indexable = !head.robots.some((r) => /noindex/i.test(r ?? "")) && !blockedBots.includes("Googlebot");
check(head.title, "no <title>");
check(head.description, "no meta description");
warn(!head.description || (head.description.length >= 70 && head.description.length <= 170), `meta description is ${head.description?.length} characters (aim for about 150-160)`);
check(head.canonical.length === 1, `expected one canonical link, found ${head.canonical.length}`);
warn(head.canonical.every((c) => /^https?:\/\//.test(c ?? "")), "canonical is not an absolute URL");
warn(head.robots.length <= 1, `found ${head.robots.length} robots meta tags`);
warn(head.charsetByte >= 0 && head.charsetByte < 1024, "<meta charset> is missing or not in the first 1024 bytes");
warn(head.lang, "<html> has no lang attribute");
check(h1Count === 1, `expected one <h1>, found ${h1Count}`);
check(text.length >= 500, `only ${text.length} characters of visible text before JavaScript runs - crawlers that do not run JavaScript see an empty page`);
warn(!/enable javascript/i.test(html), 'page contains an "enable JavaScript" message that crawlers will read');
for (const k of ["og:title", "og:description", "og:url", "og:image", "twitter:card"]) warn(social[k], `no ${k}`);
warn(!social["og:image"] || /^https:\/\//.test(social["og:image"]), "og:image is not an absolute https URL");
warn(jsonLdTypes.includes("Organization"), "no Organization JSON-LD");
warn(jsonLd.some((i) => i["@type"] === "Organization" && i.sameAs), "Organization JSON-LD has no sameAs links");
warn(questionHeadings.length > 0, "no question-style headings (What is ...? / How does ...?)");
warn(firstAnswer && firstAnswer.split(" ").length <= 70, `first long paragraph is ${firstAnswer?.split(" ").length ?? 0} words; a direct answer of 40-60 words is easier for answer engines to quote`);
check(robotsTxt.status === 200, `robots.txt returned ${robotsTxt.status}`);
warn(sitemapUrls.length > 0, "robots.txt does not link a sitemap");
check(!indexable || sitemap.status === 200, `sitemap returned ${sitemap.status}`);
warn(!indexable || llms.status === 200, `llms.txt returned ${llms.status}`);
check(missing.status === 404 || missing.status === 410, `a URL that does not exist returned ${missing.status}, not 404 (soft 404)`);
const browserSize = page.body.length;
for (const [name, r] of Object.entries(perAgent)) {
  check(r.status === page.status, `${name} got status ${r.status}, browser got ${page.status}`);
  warn(Math.abs(r.body.length - browserSize) <= Math.max(200, browserSize * 0.02), `${name} got ${r.body.length} bytes, browser got ${browserSize}`);
}

for (const phrase of expect.phrases ?? []) check(text.toLowerCase().includes(phrase.toLowerCase()), `visible text does not contain "${phrase}"`);
if (expect.title) check(head.title === expect.title, `title is "${head.title}", expected "${expect.title}"`);
if (expect.canonical) check(head.canonical[0] === expect.canonical, `canonical is ${head.canonical[0]}, expected ${expect.canonical}`);
for (const t of expect.jsonLdTypes ?? []) check(jsonLdTypes.includes(t), `no ${t} JSON-LD`);
if (expect.indexable !== undefined) check(indexable === expect.indexable, `page is ${indexable ? "" : "not "}indexable, expected ${expect.indexable ? "" : "not "}indexable`);

const line = (label, value) => console.log(`${label.padEnd(20)} ${value ?? "(missing)"}`);
console.log(`== ${pageUrl.href} (status ${page.status}) ==`);
line("title", `${head.title} [${head.title.length} chars]`);
line("description", head.description && `${head.description} [${head.description.length} chars]`);
line("canonical", head.canonical.join(", ") || undefined);
line("robots meta", head.robots.join(" | ") || "(none = index)");
line("lang", head.lang);
line("indexable", indexable);
for (const [k, v] of Object.entries(social)) line(k, v);
line("JSON-LD types", jsonLdTypes.join(", ") || undefined);
console.log(`\n== Content before JavaScript ==`);
line("visible text", `${text.length} characters, ${text ? text.split(" ").length : 0} words`);
line("first answer", firstAnswer && `${firstAnswer.split(" ").length} words: ${firstAnswer.slice(0, 220)}${firstAnswer.length > 220 ? "..." : ""}`);
console.log("headings:\n" + (headings.map((h) => `  ${h}`).join("\n") || "  (none)"));
console.log(`\n== Site files ==`);
line("robots.txt", `${robotsTxt.status} ${robotsTxt.type}`);
line("blocked bots", blockedBots.join(", ") || "(none)");
line("sitemap", `${sitemap.status} ${sitemapUrl} (${(sitemap.body.match(/<loc>/g) ?? []).length} URLs)`);
line("llms.txt", `${llms.status} ${llms.type}`);
line("unknown URL", missing.status);
console.log(`\n== Per user agent ==`);
for (const [name, r] of Object.entries(perAgent)) line(name, `${r.status}  ${r.body.length} bytes`);

if (warnings.length) console.log(`\nWARNINGS (${warnings.length})\n` + warnings.map((w) => `  - ${w}`).join("\n"));
if (failures.length) console.log(`\nFAILURES (${failures.length})\n` + failures.map((f) => `  - ${f}`).join("\n"));
if (option("--json")) {
  fs.writeFileSync(option("--json"), JSON.stringify({ url: pageUrl.href, status: page.status, head, social, jsonLd, headings, firstAnswer, textLength: text.length, blockedBots, robots: robotsTxt.status, sitemap: sitemap.status, llms: llms.status, unknownUrlStatus: missing.status, perAgent: Object.fromEntries(Object.entries(perAgent).map(([k, r]) => [k, { status: r.status, bytes: r.body.length }])), warnings, failures }, null, 2));
}
process.exit(failures.length ? 1 : 0);
