# show-usage

A local "WakaTime for Claude Code". It reads the session transcripts Claude Code already
writes on your machine and tells you how much **time**, how many **sessions**, and how many
**tokens / dollars** you have spent on a coding project, broken down however you like and
rendered as clean tables.

No account, no network, no telemetry, no dependencies. It only reads files under
`~/.claude/projects/` and prints to your terminal.

```
show-usage  ·  my-project  ·  all time  ·  idle 5m  ·  tz local

SUMMARY
┌──────────────────────┬──────────────────────────────────────┐
│ Metric               │                                Value │
├──────────────────────┼──────────────────────────────────────┤
│ Active time          │                     50h 2m  (50.0 h) │
│ Sessions             │              44  (avg 1h 8m/session) │
│ Tool calls           │       34414  (main 5919 + 28495 sub) │
│ Est. cost (USD)      │                               ~$7715 │
└──────────────────────┴──────────────────────────────────────┘
```

## Install

It is a single Node script with zero dependencies. Pick one:

**As a Claude Code skill (recommended)** so you can just ask Claude "show my usage":

```bash
# copy the folder into your personal skills dir
cp -r show-usage ~/.claude/skills/show-usage      # macOS / Linux
# Windows PowerShell:
# Copy-Item -Recurse show-usage $HOME\.claude\skills\show-usage
```

Then in any Claude Code session say "show usage" or "how much time have I spent on this
project" and the skill runs the script for the current project.

**As a plain CLI**, from anywhere:

```bash
node /path/to/show-usage/scripts/session-time.mjs
```

Requires Node 16+ (uses only `node:fs`, `node:os`, `node:path`).

## Usage

```bash
node scripts/session-time.mjs [options]
```

With no `--project`, it measures the project for your current working directory.

| Option | Default | Meaning |
|---|---|---|
| `--project <name\|path>` | cwd | Encoded dir name, a project-dir path, or a cwd to encode |
| `--idle <minutes>` | 5 | Gaps longer than this count as a break, not active time |
| `--since <YYYY-MM-DD>` | - | Only count activity on/after this date |
| `--until <YYYY-MM-DD>` | - | Only count activity on/before this date |
| `--by <dim>` | day | `day`, `week`, `dow`, `hour`, `session`, `model`, `tool` |
| `--top <N>` | 15 | Rows for the `session` breakdown |
| `--tz <utc\|local>` | local | Bucket days/hours in UTC or local time |
| `--no-subagents` | - | Exclude subagent transcripts from token/cost/tool totals |
| `--list-projects` | - | List every project with totals, then exit |
| `--json` | - | Machine-readable JSON instead of the tables |
| `--help` | - | Print built-in help with examples |

## How the numbers are computed

**Active time** is the WakaTime-style heuristic. There is no keystroke heartbeat in a Claude
session, so active time is inferred from the gaps between message timestamps: sum every gap,
but drop any gap longer than the idle cutoff (default 5 min) as a break. A long single tool run
(a slow build or test) reads as a break, so your true wall-clock is a little higher than the
active number. The report also shows session-span-sum (first to last message per session,
includes idle) and calendar span for context.

**Tokens and cost** come from the `usage` block each assistant message records. Cost is an
**estimate** from a small static price table at the top of `scripts/session-time.mjs`
(Anthropic 2026 rates: Opus $5/$25, Sonnet $3/$15, Haiku $1/$5 per million tokens; cache-read
90% off input, cache-write 1.25x input). It does not know about batch or tier discounts. Edit
the `PRICING` array when rates change or to match your plan.

**Subagents.** Claude Code writes subagent transcripts under
`~/.claude/projects/<project>/<session>/subagents/*.jsonl`. Those are real usage, so by default
they are folded into the token / cost / tool-call totals (this is why the tool counts line up
with other usage dashboards). They are **never** counted toward time, because subagents run
concurrently inside a parent session and would otherwise inflate wall-clock. Pass
`--no-subagents` to count only your direct usage.

## How project transcripts are located

Claude Code stores one JSONL transcript per session under
`~/.claude/projects/<encoded-cwd>/`, where `<encoded-cwd>` is the absolute working directory
with every non-alphanumeric character replaced by `-` (for example `K:\code\my-app` becomes
`K--code-my-app`). The script derives this from your current directory, or you can point it
anywhere with `--project`.

## Privacy

Everything is local and read-only. The script never opens a network connection and never
writes to your transcripts. `--json` is there if you want to feed the numbers into your own
tooling.

## License

MIT.
