#!/usr/bin/env node
// session-time.mjs (skill: show-usage) - WakaTime-style time + token usage from
// Claude Code session transcripts.
//
// Claude Code writes one JSONL transcript per session under
//   ~/.claude/projects/<encoded-cwd>/<session-uuid>.jsonl
// where <encoded-cwd> is the absolute working dir with every non-alphanumeric
// char replaced by "-" (e.g. C:\code\my-app -> C--code-my-app).
//
// Each line is a JSON record with a `timestamp` (ISO). "Active time" is the
// WakaTime heuristic: sum the gaps between consecutive records, but treat any
// gap longer than --idle minutes as a break and drop it. That approximates
// real time-at-keyboard, since a long quiet gap means you walked away.
//
// Usage:
//   node session-time.mjs [options]
//
// Options:
//   --project <name|path>   Project to measure. Either the encoded dir name
//                           (C--code-my-app), a full path to a project
//                           dir, or an absolute cwd to encode. Default: derive
//                           from the current working directory.
//   --idle <minutes>        Idle-gap cutoff. Gaps > this count as a break and
//                           are excluded from active time. Default: 5.
//   --since <YYYY-MM-DD>    Only count activity on/after this date.
//   --until <YYYY-MM-DD>    Only count activity on/before this date.
//   --by <dim>              Breakdown dimension: day | week | dow | hour |
//                           session | model | tool. Default: day.
//   --top <N>               Rows to show for session/day breakdowns. Default: 15.
//   --tz <utc|local>        Bucket days/hours in UTC or local time. Default: local.
//   --list-projects         List every project dir with totals, then exit.
//   --no-subagents          Exclude subagent transcripts from token/cost/tool
//                           totals. By default they ARE included (they are real
//                           usage), but TIME is always main-transcript-only since
//                           subagents run concurrently inside a parent session.
//   --json                  Emit machine-readable JSON instead of a report.
//   --help                  Show this help.
//
// Examples:
//   node session-time.mjs                         # current project, default view
//   node session-time.mjs --by hour               # when in the day you work
//   node session-time.mjs --by tool               # full tool-call breakdown
//   node session-time.mjs --by session --top 10   # heaviest sessions
//   node session-time.mjs --since 2026-06-01 --idle 10
//   node session-time.mjs --list-projects         # rank all projects
//   node session-time.mjs --json                  # raw numbers for piping

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// ---------- arg parsing ----------
const argv = process.argv.slice(2);
const opt = {
  project: null,
  idle: 5,
  since: null,
  until: null,
  by: 'day',
  top: 15,
  tz: 'local',
  listProjects: false,
  json: false,
  subagents: true,
};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  const next = () => argv[++i];
  switch (a) {
    case '--project': opt.project = next(); break;
    case '--idle': opt.idle = Number(next()); break;
    case '--since': opt.since = next(); break;
    case '--until': opt.until = next(); break;
    case '--by': opt.by = next(); break;
    case '--top': opt.top = Number(next()); break;
    case '--tz': opt.tz = next(); break;
    case '--list-projects': opt.listProjects = true; break;
    case '--no-subagents': opt.subagents = false; break;
    case '--json': opt.json = true; break;
    case '--help': case '-h': printHelp(); process.exit(0);
    default: console.error(`unknown option: ${a}`); process.exit(2);
  }
}

const PROJECTS_ROOT = path.join(os.homedir(), '.claude', 'projects');
const IDLE_MS = opt.idle * 60 * 1000;

// ---------- pricing (USD per 1M tokens), edit when Anthropic changes rates ----------
// Source: Anthropic API pricing, 2026. cacheRead = 90% off input; cacheWrite = 1.25x input
// (5-min cache). Cost is an ESTIMATE: it does not know batch/tier discounts and treats every
// opus-*/sonnet-*/haiku-* as the current tier rate. Matched by name prefix, longest first.
const PRICING = [
  // [model-prefix, input, output, cacheRead, cacheWrite]
  ['claude-opus', 5.0, 25.0, 0.50, 6.25],
  ['claude-sonnet', 3.0, 15.0, 0.30, 3.75],
  ['claude-haiku', 1.0, 5.0, 0.10, 1.25],
];
function rateFor(model) {
  const m = String(model || '');
  for (const r of PRICING) if (m.startsWith(r[0])) return r;
  return null; // unknown / <synthetic> -> not priced
}
function costOf(model, t) {
  const r = rateFor(model);
  if (!r) return 0;
  return (t.in * r[1] + t.out * r[2] + t.cacheRead * r[3] + t.cacheCreate * r[4]) / 1e6;
}
function usd(n) { return n >= 100 ? `$${n.toFixed(0)}` : `$${n.toFixed(2)}`; }

function printHelp() {
  const txt = fs.readFileSync(new URL(import.meta.url)).toString();
  console.log(txt.split('\n').filter(l => l.startsWith('//')).map(l => l.slice(3)).join('\n'));
}

// ---------- helpers ----------
function encodeCwd(p) {
  // Claude Code replaces every char that is not [A-Za-z0-9] with "-".
  return p.replace(/[^A-Za-z0-9]/g, '-');
}

function resolveProjectDir(project) {
  if (!project) return path.join(PROJECTS_ROOT, encodeCwd(process.cwd()));
  // already an existing dir?
  if (fs.existsSync(project) && fs.statSync(project).isDirectory()) return project;
  // a bare encoded name under the projects root?
  const asName = path.join(PROJECTS_ROOT, project);
  if (fs.existsSync(asName)) return asName;
  // treat as a cwd to encode
  return path.join(PROJECTS_ROOT, encodeCwd(project));
}

function fmt(ms) {
  if (!ms || ms < 0) ms = 0;
  const h = Math.floor(ms / 3600000);
  const m = Math.round((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function tk(n) {
  if (!n) return '0';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return String(n);
}

function bar(frac, width = 24) {
  const n = Math.round(frac * width);
  return '█'.repeat(n) + '░'.repeat(width - n);
}

// Render a ccusage-style bordered table. cols: [{header, align}], rows: string[][].
// An optional `title` prints centered above. Use null as a row to draw a divider.
function table(title, cols, rows) {
  const widths = cols.map((c, i) =>
    Math.max(c.header.length, ...rows.filter(r => r).map(r => String(r[i] ?? '').length)));
  const pad = (s, w, align) => {
    s = String(s ?? '');
    return align === 'r' ? s.padStart(w) : s.padEnd(w);
  };
  const seg = (l, m, r) => l + widths.map(w => '─'.repeat(w + 2)).join(m) + r;
  const row = cells => '│' + cells.map((c, i) => ' ' + pad(c, widths[i], cols[i].align) + ' ').join('│') + '│';
  const totalW = widths.reduce((a, w) => a + w + 3, 0) + 1;
  if (title) console.log('\n' + title);
  console.log(seg('┌', '┬', '┐'));
  console.log(row(cols.map(c => c.header)));
  console.log(seg('├', '┼', '┤'));
  for (const r of rows) console.log(r ? row(r) : seg('├', '┼', '┤'));
  console.log(seg('└', '┴', '┘'));
  return totalW;
}

function dayKey(ms) {
  const d = new Date(ms);
  if (opt.tz === 'utc') return d.toISOString().slice(0, 10);
  // local YYYY-MM-DD
  const y = d.getFullYear(), mo = String(d.getMonth() + 1).padStart(2, '0'), da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}
function hourOf(ms) { const d = new Date(ms); return opt.tz === 'utc' ? d.getUTCHours() : d.getHours(); }
function dowOf(ms) { const d = new Date(ms); return opt.tz === 'utc' ? d.getUTCDay() : d.getDay(); }
function isoWeek(ms) {
  // ISO week key YYYY-Www
  const d = new Date(ms);
  const t = opt.tz === 'utc' ? new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())) : new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - day + 3);
  const firstThu = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((t - firstThu) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function inRange(ms) {
  if (opt.since && dayKey(ms) < opt.since) return false;
  if (opt.until && dayKey(ms) > opt.until) return false;
  return true;
}

// ---------- read one session file ----------
function readSession(file) {
  const recs = [];
  let lines;
  try { lines = fs.readFileSync(file, 'utf8').split('\n'); } catch { return null; }
  for (const ln of lines) {
    if (!ln) continue;
    let o; try { o = JSON.parse(ln); } catch { continue; }
    if (!o.timestamp) continue;
    const ts = Date.parse(o.timestamp);
    if (Number.isNaN(ts)) continue;
    const role = o.type || o.message?.role || 'other';
    // count tool_use blocks inside assistant messages, by tool name
    let toolUses = 0;
    const toolNames = [];
    const content = o.message?.content;
    if (Array.isArray(content)) for (const c of content) if (c && c.type === 'tool_use') { toolUses++; toolNames.push(c.name || 'unknown'); }
    const model = o.message?.model || null;
    const u = o.message?.usage;
    const tok = u ? {
      in: u.input_tokens || 0,
      out: u.output_tokens || 0,
      cacheRead: u.cache_read_input_tokens || 0,
      cacheCreate: u.cache_creation_input_tokens || 0,
    } : null;
    recs.push({ ts, role, toolUses, toolNames, model, tok });
  }
  return recs;
}

// ---------- list-projects mode ----------
if (opt.listProjects) {
  const dirs = fs.readdirSync(PROJECTS_ROOT).filter(d => {
    try { return fs.statSync(path.join(PROJECTS_ROOT, d)).isDirectory(); } catch { return false; }
  });
  const rows = [];
  for (const d of dirs) {
    const dir = path.join(PROJECTS_ROOT, d);
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsonl'));
    let active = 0, msgs = 0, first = Infinity, last = -Infinity;
    for (const f of files) {
      const recs = readSession(path.join(dir, f));
      if (!recs || recs.length < 2) continue;
      recs.sort((a, b) => a.ts - b.ts);
      for (let i = 1; i < recs.length; i++) { const g = recs[i].ts - recs[i - 1].ts; if (g <= IDLE_MS) active += g; }
      msgs += recs.length; first = Math.min(first, recs[0].ts); last = Math.max(last, recs[recs.length - 1].ts);
    }
    if (msgs) rows.push({ project: d, active, sessions: files.length, msgs, last });
  }
  rows.sort((a, b) => b.active - a.active);
  if (opt.json) { console.log(JSON.stringify(rows, null, 2)); process.exit(0); }
  table('PROJECTS (by active time)', [
    { header: 'Project (encoded dir)', align: 'l' }, { header: 'Active', align: 'r' },
    { header: 'Sessions', align: 'r' }, { header: 'Msgs', align: 'r' }, { header: 'Last', align: 'r' },
  ], rows.map(r => [r.project.slice(0, 44), fmt(r.active), String(r.sessions), String(r.msgs), new Date(r.last).toISOString().slice(0, 10)]));
  process.exit(0);
}

// ---------- main aggregation ----------
const projectDir = resolveProjectDir(opt.project);
if (!fs.existsSync(projectDir)) {
  console.error(`project dir not found: ${projectDir}`);
  console.error(`tip: run with --list-projects to see available projects`);
  process.exit(1);
}

const files = fs.readdirSync(projectDir).filter(f => f.endsWith('.jsonl'));

let totalActive = 0, totalSpan = 0, totalMsgs = 0, userMsgs = 0, asstMsgs = 0, toolUses = 0;
let firstTs = Infinity, lastTs = -Infinity;
let longestStreak = 0;          // longest continuous active run (no gap > idle)
let breaks = 0;                 // count of idle gaps within sessions
const buckets = {};             // dimension -> active ms
const bucketMeta = {};          // dimension -> {msgs}
const sessions = [];
const hourHist = new Array(24).fill(0);
const dowActive = new Array(7).fill(0);
const models = {};
const tokTotals = { in: 0, out: 0, cacheRead: 0, cacheCreate: 0 };
const tokByModel = {};           // model -> {in,out,cacheRead,cacheCreate}
const toolByName = {};           // tool name -> count

for (const f of files) {
  const recs = readSession(path.join(projectDir, f));
  if (!recs || recs.length < 2) continue;
  recs.sort((a, b) => a.ts - b.ts);

  // session-level, honoring date filter at record granularity
  let sActive = 0, sMsgs = 0, sFirst = Infinity, sLast = -Infinity, streak = 0;
  for (let i = 0; i < recs.length; i++) {
    const r = recs[i];
    if (!inRange(r.ts)) continue;
    sMsgs++; totalMsgs++;
    if (r.role === 'user') userMsgs++; else if (r.role === 'assistant') asstMsgs++;
    toolUses += r.toolUses;
    if (r.toolNames) for (const tn of r.toolNames) toolByName[tn] = (toolByName[tn] || 0) + 1;
    if (r.model) models[r.model] = (models[r.model] || 0) + 1;
    if (r.tok) {
      tokTotals.in += r.tok.in; tokTotals.out += r.tok.out;
      tokTotals.cacheRead += r.tok.cacheRead; tokTotals.cacheCreate += r.tok.cacheCreate;
      const m = r.model || 'unknown';
      const t = tokByModel[m] || (tokByModel[m] = { in: 0, out: 0, cacheRead: 0, cacheCreate: 0 });
      t.in += r.tok.in; t.out += r.tok.out; t.cacheRead += r.tok.cacheRead; t.cacheCreate += r.tok.cacheCreate;
    }
    sFirst = Math.min(sFirst, r.ts); sLast = Math.max(sLast, r.ts);

    if (i > 0) {
      const gap = r.ts - recs[i - 1].ts;
      if (inRange(recs[i - 1].ts) && inRange(r.ts)) {
        if (gap <= IDLE_MS) {
          sActive += gap; streak += gap;
          const key = bucketKey(recs[i - 1].ts);
          buckets[key] = (buckets[key] || 0) + gap;
          hourHist[hourOf(recs[i - 1].ts)] += gap;
          dowActive[dowOf(recs[i - 1].ts)] += gap;
          if (streak > longestStreak) longestStreak = streak;
        } else {
          breaks++; streak = 0;
        }
      }
    }
  }
  if (sMsgs < 1 || sFirst === Infinity) continue;
  totalActive += sActive;
  totalSpan += (sLast - sFirst);
  firstTs = Math.min(firstTs, sFirst); lastTs = Math.max(lastTs, sLast);
  sessions.push({ id: f.slice(0, 8), active: sActive, span: sLast - sFirst, msgs: sMsgs, start: sFirst });
}

// ---------- subagent pass: token/cost/tool totals only (NOT time) ----------
// Subagents write transcripts under <project>/<session>/subagents/*.jsonl. They run
// concurrently inside a parent session, so they would corrupt wall-clock if folded into
// the time math, but their tokens and tool calls are real project usage worth counting.
let subMsgs = 0, subToolUses = 0, subFiles = 0;
if (opt.subagents) {
  const stack = fs.readdirSync(projectDir, { withFileTypes: true })
    .filter(d => d.isDirectory()).map(d => path.join(projectDir, d.name));
  while (stack.length) {
    const dir = stack.pop();
    let entries; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { stack.push(full); continue; }
      if (!e.name.endsWith('.jsonl')) continue;
      const recs = readSession(full);
      if (!recs) continue;
      subFiles++;
      for (const r of recs) {
        if (!inRange(r.ts)) continue;
        subMsgs++;
        subToolUses += r.toolUses;
        if (r.toolNames) for (const tn of r.toolNames) toolByName[tn] = (toolByName[tn] || 0) + 1;
        if (r.tok) {
          tokTotals.in += r.tok.in; tokTotals.out += r.tok.out;
          tokTotals.cacheRead += r.tok.cacheRead; tokTotals.cacheCreate += r.tok.cacheCreate;
          const m = r.model || 'unknown';
          const t = tokByModel[m] || (tokByModel[m] = { in: 0, out: 0, cacheRead: 0, cacheCreate: 0 });
          t.in += r.tok.in; t.out += r.tok.out; t.cacheRead += r.tok.cacheRead; t.cacheCreate += r.tok.cacheCreate;
        }
        if (r.model) models[r.model] = (models[r.model] || 0) + 1;
      }
    }
  }
  toolUses += subToolUses;
}

function bucketKey(ms) {
  switch (opt.by) {
    case 'day': return dayKey(ms);
    case 'week': return isoWeek(ms);
    case 'dow': return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dowOf(ms)];
    case 'hour': return String(hourOf(ms)).padStart(2, '0') + ':00';
    case 'model': return 'n/a'; // handled separately
    case 'session': return 'n/a';
    default: return dayKey(ms);
  }
}

// distinct active days, computed independently of --by so the header is stable
const nActiveDays = (() => {
  const set = new Set();
  for (const f of files) {
    const recs = readSession(path.join(projectDir, f));
    if (!recs || recs.length < 2) continue;
    recs.sort((a, b) => a.ts - b.ts);
    for (let i = 1; i < recs.length; i++) {
      const g = recs[i].ts - recs[i - 1].ts;
      if (g <= IDLE_MS && inRange(recs[i - 1].ts)) set.add(dayKey(recs[i - 1].ts));
    }
  }
  return set.size;
})();

sessions.sort((a, b) => b.active - a.active);

// cost (estimate) + cache hit rate
const costByModel = {};
let totalCost = 0;
for (const [m, t] of Object.entries(tokByModel)) { const c = costOf(m, t); costByModel[m] = c; totalCost += c; }
const cacheDenom = tokTotals.in + tokTotals.cacheRead + tokTotals.cacheCreate;
const cacheHitRate = cacheDenom ? tokTotals.cacheRead / cacheDenom : 0;

// ---------- output ----------
if (opt.json) {
  console.log(JSON.stringify({
    project: path.basename(projectDir),
    projectDir,
    idleMinutes: opt.idle,
    since: opt.since, until: opt.until, tz: opt.tz,
    totals: {
      activeMs: totalActive, activeHours: +(totalActive / 3600000).toFixed(2),
      spanSumMs: totalSpan,
      calendarSpanMs: lastTs - firstTs,
      sessions: sessions.length, messages: totalMsgs, userMessages: userMsgs,
      assistantMessages: asstMsgs, toolUses, breaks,
      subagentsIncluded: opt.subagents,
      subagentFiles: subFiles, subagentMessages: subMsgs, subagentToolCalls: subToolUses,
      activeDays: nActiveDays,
      avgPerActiveDayMs: nActiveDays ? Math.round(totalActive / nActiveDays) : 0,
      avgPerSessionMs: sessions.length ? Math.round(totalActive / sessions.length) : 0,
      longestStreakMs: longestStreak,
      firstActivity: firstTs === Infinity ? null : new Date(firstTs).toISOString(),
      lastActivity: lastTs === -Infinity ? null : new Date(lastTs).toISOString(),
    },
    tokens: {
      ...tokTotals,
      total: tokTotals.in + tokTotals.out + tokTotals.cacheRead + tokTotals.cacheCreate,
      cacheHitRate: +(cacheHitRate * 100).toFixed(1),
    },
    tokensByModel: tokByModel,
    estimatedCostUSD: +totalCost.toFixed(2),
    estimatedCostByModel: Object.fromEntries(Object.entries(costByModel).map(([m, c]) => [m, +c.toFixed(2)])),
    toolsByName: Object.fromEntries(Object.entries(toolByName).sort((a, b) => b[1] - a[1])),
    breakdownBy: opt.by,
    breakdown: buckets,
    topSessions: sessions.slice(0, opt.top),
    models,
  }, null, 2));
  process.exit(0);
}

const tokTotal = tokTotals.in + tokTotals.out + tokTotals.cacheRead + tokTotals.cacheCreate;
const range = opt.since || opt.until ? `${opt.since || '...'} -> ${opt.until || '...'}` : 'all time';
console.log(`\nshow-usage  ·  ${path.basename(projectDir)}  ·  ${range}  ·  idle ${opt.idle}m  ·  tz ${opt.tz}`);

// --- summary ---
table('SUMMARY', [{ header: 'Metric', align: 'l' }, { header: 'Value', align: 'r' }], [
  ['Active time', `${fmt(totalActive)}  (${(totalActive / 3600000).toFixed(1)} h)`],
  ['Session span sum', fmt(totalSpan)],
  ['Calendar span', `${fmt(lastTs - firstTs)}  (${firstTs === Infinity ? '-' : new Date(firstTs).toISOString().slice(0, 10)} -> ${lastTs === -Infinity ? '-' : new Date(lastTs).toISOString().slice(0, 10)})`],
  ['Active days', `${nActiveDays}  (avg ${fmt(nActiveDays ? totalActive / nActiveDays : 0)}/day)`],
  ['Sessions', `${sessions.length}  (avg ${fmt(sessions.length ? totalActive / sessions.length : 0)}/session)`],
  ['Longest focus streak', fmt(longestStreak)],
  [`Breaks (>${opt.idle}m gaps)`, String(breaks)],
  null,
  ['Messages', `${totalMsgs}  (you ${userMsgs} / claude ${asstMsgs})`],
  ['Tool calls', opt.subagents && subToolUses ? `${toolUses}  (main ${toolUses - subToolUses} + ${subToolUses} sub)` : String(toolUses)],
  ['Subagents', opt.subagents ? `${subFiles} transcripts, ${subMsgs} msgs` : 'excluded'],
  ['Est. cost (USD)', `~${usd(totalCost)}`],
]);

// --- tokens by model (+ cost) ---
if (tokTotal) {
  const rows = Object.entries(tokByModel)
    .map(([m, t]) => ({ m, total: t.in + t.out + t.cacheRead + t.cacheCreate, t, c: costByModel[m] || 0 }))
    .filter(x => x.total).sort((a, b) => b.total - a.total)
    .map(x => [x.m.replace(/^claude-/, ''), tk(x.t.in), tk(x.t.out), tk(x.t.cacheRead), tk(x.t.cacheCreate), tk(x.total), x.c ? `~${usd(x.c)}` : '-']);
  rows.push(null);
  rows.push(['TOTAL', tk(tokTotals.in), tk(tokTotals.out), tk(tokTotals.cacheRead), tk(tokTotals.cacheCreate), tk(tokTotal), `~${usd(totalCost)}`]);
  table(`TOKENS  (cache hit ${(cacheHitRate * 100).toFixed(1)}%)`, [
    { header: 'Model', align: 'l' }, { header: 'Input', align: 'r' }, { header: 'Output', align: 'r' },
    { header: 'Cache rd', align: 'r' }, { header: 'Cache wr', align: 'r' }, { header: 'Total', align: 'r' }, { header: 'Est cost', align: 'r' },
  ], rows);
}

// --- tool calls by tool ---
const toolEntries = Object.entries(toolByName).sort((a, b) => b[1] - a[1]);
if (toolEntries.length) {
  const shown = opt.by === 'tool' ? toolEntries : toolEntries.slice(0, 10);
  const max = toolEntries[0][1] || 1;
  table(`TOOL CALLS  (${opt.by === 'tool' ? 'all ' + toolEntries.length : 'top ' + shown.length + ' of ' + toolEntries.length})`, [
    { header: 'Tool', align: 'l' }, { header: 'Calls', align: 'r' }, { header: 'Share', align: 'l' },
  ], shown.map(([t, n]) => [t.replace(/^mcp__/, 'mcp:').slice(0, 28), String(n), bar(n / max, 16)]));
}

// --- breakdown ---
if (opt.by === 'session') {
  const max = sessions[0]?.active || 1;
  table(`TOP ${opt.top} SESSIONS`, [
    { header: 'Session', align: 'l' }, { header: 'Active', align: 'r' }, { header: 'Span', align: 'r' }, { header: 'Msgs', align: 'r' }, { header: 'Share', align: 'l' },
  ], sessions.slice(0, opt.top).map(s => [s.id, fmt(s.active), fmt(s.span), String(s.msgs), bar(s.active / max, 16)]));
} else if (opt.by === 'model') {
  const tot = Object.values(models).reduce((a, b) => a + b, 0) || 1;
  table('MESSAGES BY MODEL', [{ header: 'Model', align: 'l' }, { header: 'Msgs', align: 'r' }, { header: 'Share', align: 'l' }],
    Object.entries(models).sort((a, b) => b[1] - a[1]).map(([m, n]) => [m, String(n), bar(n / tot, 16)]));
} else if (opt.by === 'hour') {
  const max = Math.max(...hourHist, 1);
  const rows = [];
  for (let h = 0; h < 24; h++) if (hourHist[h]) rows.push([`${String(h).padStart(2, '0')}:00`, fmt(hourHist[h]), bar(hourHist[h] / max, 20)]);
  table('ACTIVE TIME BY HOUR', [{ header: 'Hour', align: 'l' }, { header: 'Active', align: 'r' }, { header: 'Share', align: 'l' }], rows);
} else if (opt.by === 'dow') {
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const max = Math.max(...dowActive, 1);
  table('ACTIVE TIME BY DAY OF WEEK', [{ header: 'Day', align: 'l' }, { header: 'Active', align: 'r' }, { header: 'Share', align: 'l' }],
    names.map((nm, d) => [nm, fmt(dowActive[d]), bar(dowActive[d] / max, 20)]));
} else if (opt.by !== 'tool') {
  const keys = Object.keys(buckets).sort();
  const max = Math.max(...Object.values(buckets), 1);
  table(`ACTIVE TIME BY ${opt.by.toUpperCase()}`, [{ header: opt.by, align: 'l' }, { header: 'Active', align: 'r' }, { header: 'Share', align: 'l' }],
    keys.map(k => [k, fmt(buckets[k]), bar(buckets[k] / max, 20)]));
}

console.log('\nnote: active time = sum of message gaps <= idle cutoff; long tool runs (>cutoff)');
console.log('read as breaks, so true wall-clock is a bit higher. Cost is an ESTIMATE from a');
console.log('static price table (no batch/tier discounts) - edit PRICING in the script when');
console.log('Anthropic rates change. Subagent transcripts count toward tokens/cost/tools but');
console.log('never toward time. Run with --json for raw numbers.');
