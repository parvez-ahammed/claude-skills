---
name: timesheet-from-transcripts
description: Use when the user needs to fill in a timesheet or time log and asks what they worked on for one or more past dates - "I need to fill my timesheet for these days", "what did I do on the 13th and 14th", "fill up my time log for last week", "search my conversations and check what I did on Monday". Reconstructs ticket numbers, short descriptions and non-overlapping time blocks per day from local Claude Code session transcripts under ~/.claude/projects, ready to paste into a time tracker.
---

# Timesheet from transcripts

Turns local Claude Code session transcripts (JSONL files the user never sees directly) into
copy-paste-ready timesheet rows per day: time range, ticket, short description.

**How this differs from `show-usage`.** `show-usage` measures *how much*: active time, sessions,
tokens and cost per project. This skill answers *what*: for a given date, which tickets you worked
on, what you did on each, and a clean sequence of time blocks that adds up to a working day. Use
`show-usage` for stats, this skill for the timesheet.

## When to use / not use

- Use when: the user names a date, a list of dates, or a vague range ("last week", "the 13th and
  14th") and wants to know what they worked on, in timesheet form.
- Don't use when: the user asks what changed in the code on a date. Use
  `git log --since --until` for that. Session activity is a different and richer signal than
  commits (research, reviews and debugging leave no commit).

## Step 1 - Resolve the dates

Turn relative references into absolute dates from the current date. **If a date is ambiguous**
("2th" may be the 2nd or the 12th; a bare day number may fall in two months), **ask before you
search.** A wrong guess costs a full search cycle.

Also confirm, or ask once:

- **Time zone.** Transcript timestamps are UTC. Use the user's local offset (from the system, or
  ask).
- **Ticket format** used by the user's tracker (see Step 3). Default to the generic patterns.
- **Target day length** (default 8 hours) and day start time (default 09:00).

## Step 2 - Find candidate session files

Transcripts live at `~/.claude/projects/<project-dir>/*.jsonl` (on Windows,
`%USERPROFILE%\.claude\projects\`). There is one directory per working directory Claude Code was
opened in; the name is the path with separators replaced by `-` (for example
`~/code/my-app` gives `-home-me-code-my-app`). Subagent transcripts sit in subfolders.

Find files with activity on each target date without reading them:

```bash
grep -l '"timestamp":"YYYY-MM-DDT' ~/.claude/projects/*/*.jsonl
```

UTC dates and local dates differ near midnight. Grep the day before and the day after as well, and
filter by local time later.

Check every project directory, not only the one for the current repo. Work for other clients or
personal projects gets reported in a separate list, not folded into tickets.

## Step 3 - Extract activity per session

**Do not read whole multi-MB JSONL files into your own context.** For more than two or three dates
or a double-digit file count, delegate the extraction to a subagent and ask for a summary back.
For one date and a few files, do it inline.

Tell the delegate to stop at raw extraction: session, ticket, first and last timestamp that day,
a 1-2 sentence description, and an "off-ticket" flag. The merge into time blocks is Step 4, and
you do it. If the delegate merges anyway, spot-check two of its blocks against the raw files
(a timestamp range and a ticket label) before you present them.

### JSONL shape

One JSON object per line. Lines with `"type":"user"` carry `message.content` (a string or an array
of content blocks), `timestamp` (ISO 8601, UTC), `cwd`, `sessionId`, and `gitBranch`. The first
user message in a session is usually the task. Sample a few later messages if that does not show
the scope (design talk, implementation, bug fix, review).

Recipe per file: grep only the target date's lines, then pull `timestamp`, `gitBranch` and message
text from those lines.

### Ticket detection

Look for ticket ids in this order, strongest first:

1. **Explicit mention in the user's messages** - "working on ABC-123", "ticket #456".
2. **Commit subjects and PR titles** the session wrote (`git commit -m`, PR create commands in
   tool calls).
3. **Branch name** from `gitBranch`, for example `feature/ABC-123-add-export`, `123-fix-login`,
   `bugfix/456_null_check`.

Default patterns (case-insensitive), adjust to the user's tracker:

| Tracker style | Pattern | Example |
|---|---|---|
| Project key + number (Jira, Linear, YouTrack) | `\b[A-Z][A-Z0-9]+-\d+\b` | `ABC-123` |
| Hash number (GitHub, GitLab) | `#\d+\b` | `#123` |
| Bare number at start of a branch or commit subject | `^(?:\w+/)?(\d{3,6})[_\-: ]` | `1234_add_export`, `1234 : Fix label` |

If the user gives their own regex, use only that one. If none match, label the block with a short
topic name instead of a ticket, and say so.

**The branch name is a weak signal. Always confirm it against the message content.** A session's
branch is often just whatever was checked out last. A session on `ABC-123-export` can be pure
sprint-planning chat or unrelated study. Read enough messages to confirm the branch matches the
work, for every session, not only the ones that look odd.

**Flag off-ticket work by content, not by directory.** Personal research, learning, or anything
not tied to a ticket goes in the separate list in Step 5, whichever project directory it is in.

**Drop noise.** A single bare timestamp, or a touch under about 2 minutes with no real message, is
not a work block.

## Step 4 - Build non-overlapping time blocks

Several sessions often run in parallel, so raw windows overlap. That is normal. The user wants a
believable total for the day, not minute-level precision. Turn overlaps into sequential blocks:

1. Convert UTC timestamps to local time.
2. Order tickets by when each started that day.
3. Weight each ticket's share by the depth of evidenced work, not by raw span. A session left open
   with one message at 09:00 and the next at 02:00 is not 17 hours of work. Steady back-and-forth
   for 3 hours is a real 3-hour block. Cut any raw window at obvious idle gaps (lunch, evening,
   overnight).
4. Round to 15 or 30 minutes and lay out sequential blocks from the day start that add up to the
   target day length (a little over is fine).

**Do not hide an implausible cluster.** If local time puts activity very late at night, either the
time zone is wrong for that day or the user really worked late. Keep that cluster as its own block
at its real time and ask which it was.

## Step 5 - Output

One fenced block per date, tab-separated `Time range<TAB>Ticket - Description`, ready to paste:

```
09:00-12:30	ABC-123 - Export to CSV (design + first implementation)
12:30-15:45	ABC-131 - Fix login redirect loop (root cause found, fix pushed)
15:45-17:15	#42 - Review of the caching PR (comments posted)
```

Next to each date header, state the total hours. Below the block, outside it, list:

- off-ticket or other-project sessions (with their times),
- dropped noise, if any,
- any assumption the user should confirm (time zone, a ticket inferred only from a branch).

If the user's tracker needs another format (CSV, one line per ticket with hours), convert at the
end. Keep the same blocks.

## Gotchas

| Mistake | Fix |
|---|---|
| Guessing an ambiguous date | Ask first. A wrong date wastes the whole search |
| Reading full JSONL files into your context | Grep the date, extract only the matching lines, or delegate |
| Trusting `gitBranch` as the ticket | Confirm against what the messages actually discuss |
| Treating an overnight or lunch gap as work | Weight by evidenced activity, not raw span |
| Presenting overlapping windows as they are | Merge into sequential blocks that add up to the day |
| Forgetting UTC vs local near midnight | Grep neighbouring dates and filter after converting |
| Folding personal or other-client work into tickets | List it separately |
