---
name: show-usage
description: Use when someone wants to see how much time, how many sessions, or how many tokens and dollars they have spent on a coding project locally. Triggers on "show usage", "how long have I worked on this", "how much time did I spend", "my claude time", "wakatime for claude", "session stats", "token usage", "cost per project", "how many hours on this project". Reads local Claude Code transcripts and prints WakaTime-style active time plus token/cost/tool tables. Local, read-only, zero deps.
---

# show-usage

Local "WakaTime for Claude Code". Reports time, sessions, tokens, cost, and tool usage for a
project, from the JSONL transcripts under `~/.claude/projects/`.

## Run

Run the bundled script with Node, using the path of the skill directory you loaded this from
(it sits at `<skill-dir>/scripts/session-time.mjs`):

```bash
node "<skill-dir>/scripts/session-time.mjs"
```

With no `--project` it measures the **current working directory's** project. Pass flags to
slice it. Append `--help` for the full flag list and examples; the common ones:

- `--by day|week|dow|hour|session|model|tool` breakdown (default `day`)
- `--since / --until YYYY-MM-DD` date window
- `--idle <min>` active-time gap cutoff (default 5)
- `--list-projects` rank every project
- `--no-subagents` exclude subagent transcripts from token/cost/tool totals
- `--json` raw numbers

## What to know before reading the numbers

- **Active time** = sum of message-gaps shorter than the idle cutoff; longer gaps count as
  breaks. A long single tool run reads as a break, so true wall-clock is a little higher.
- **Cost is an estimate** from a static price table in the script (no batch/tier discounts);
  edit `PRICING` when Anthropic rates change.
- **Subagents** are folded into token/cost/tool totals (real usage) but never into time, since
  they run concurrently inside a parent session.

## When invoked

Run the default report for the current project, show the tables, and offer the targeted views
(`--by hour`, `--by session`, `--list-projects`). State the active-vs-wall-clock caveat once.
