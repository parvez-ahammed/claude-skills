---
name: show-usage
description: Shows how much time, how many sessions, and how many tokens and dollars were spent on a coding project, from local Claude Code transcripts. Triggers on "show usage", "how long have I worked on this", "how much time did I spend", "my claude time", "wakatime for claude", "session stats", "token usage", "cost per project", "how many hours on this project". Prints WakaTime-style active time plus token/cost/tool tables. Local, read-only, zero deps.
argument-hint: "[--by day|week|dow|hour|session|model|tool] [--since YYYY-MM-DD] [--project <path>]"
---

# show-usage

Local "WakaTime for Claude Code". Reports time, sessions, tokens, cost, and tool usage for a
project, from the JSONL transcripts under `~/.claude/projects/`.

## Run

Run the bundled script with Node (16+, no packages needed):

```bash
node "${CLAUDE_SKILL_DIR}/scripts/session-time.mjs"
```

Pass any arguments the user gave straight through as flags.

With no `--project` it measures the **current working directory's** project. Pass flags to
slice it. Append `--help` for the full flag list and examples; the common ones:

- `--by day|week|dow|hour|session|model|tool` breakdown (default `day`)
- `--since / --until YYYY-MM-DD` date window
- `--idle <min>` active-time gap cutoff (default 5)
- `--list-projects` rank every project
- `--no-subagents` exclude subagent transcripts from token/cost/tool totals
- `--json` raw numbers

`README.md` in this skill directory has the full flag table and how transcripts are located; read
it only when the user asks how the numbers are computed.

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
