---
name: branch-test-report
description: Tests a branch, pull request or ticket against the real running app and hands back proof. Runs the backend tests, seeds and cleans test data, drives the API and the browser, and writes one self-contained HTML report with screenshots that a product owner can read - a run against the live app, not a reading of the diff. Use when asked "run the tests and give me a report", "test this branch end to end", "automated test with visual verification", "QA this with screenshots", or "give me a test report for this PR".
argument-hint: "[branch | PR number | ticket id]"
---

# Branch test report

Run the change, prove it with evidence, and write one HTML report. A claim with no evidence file
is not a result.

## Core rule

**Test the running app, not the diff.** Reading the code tells you what it should do. Only the
running app tells you what it does. Most of the defects this workflow finds are invisible in the
diff and obvious in the browser.

## When to use / not use

- Use when: a branch or PR is ready to try, and someone wants evidence that it works - cases,
  screenshots, data checks, and a verdict.
- Don't use when: the user wants a code review (read the diff instead), or only wants the unit
  tests run (run them directly).

## Before the first run on a project

Copy `references/environment-template.md` into the project (for example
`.claude/test-environment.md`) and fill it in once: ports, how to prove the running build is
current, sign-in, how to call the API with a real token, database access, seed conventions. Read
it at the start of every run. If it does not exist yet, find each answer, then write it down - the
next run starts from there instead of from zero.

## Deliverables

Write everything into one output folder for the ticket or branch. Use the folder the project
already uses for generated files (keep it out of version control), for example
`.test-reports/<ticket-or-branch>/`:

| File | What it is |
|---|---|
| `test-plan-<date>.md` | Environment, test data, cases, and what you chose not to cover |
| `test-report-<date>.html` | The report. Findings first, then every case with its result |
| `test-scripts/seed.*`, `cleanup.*` | The test data and its exact removal |
| `test-evidence/_env/` | Row counts before seed, after seed, after cleanup |
| `test-evidence/<CASE-ID>/` | API responses, query output |
| `test-evidence/screens/` | Full page PNGs, one per case that shows something |

If the folder already holds numbered files, continue that sequence.

## Workflow

1. **Scope the change.** `git diff --stat <base>...HEAD` (base = the branch the PR targets). List
   the touched areas: backend services, API endpoints, migrations, frontend screens. Read the
   changed files. That gives you the case list, not the verdict.

2. **Bring up the environment.** Read the project's environment file first. The API and UI are
   often already running in the user's IDE. **Prove the running API was built after the last
   commit** before you trust any result from it.

3. **Run the backend suite.** Map each changed test file to its test project and run each project.
   Record passed/failed per project.

4. **Look at the data.** Query the tables the feature reads. Most local databases do not hold the
   states a new screen must show. Ask the user before you write to their database, then seed with a
   marker prefix (for example `zz<ticket>_`) so cleanup is exact.

5. **Write the query that predicts the answer.** Before you open the browser, run the query that
   says which rows the feature should return. Compare the API and the screen against it. Without it
   you only check that the screen shows something.

6. **Drive the API directly.** Try the edge cases the UI cannot reach: paging past the end, page 0,
   an oversized page size, an id the caller may not see, and no token at all.

7. **Drive the browser.** Use a browser automation tool (for example Playwright MCP). Read the page
   first (accessibility snapshot or a DOM read through `evaluate`), then take the screenshot to
   prove it.

8. **Clean up and prove it.** Run the cleanup script. The report must show the row count back at
   its starting value.

9. **Write the report.** Copy `references/report-template.html`. Findings ranked first, each with
   where it shows, how to reproduce, a screenshot, and a suggested fix. Then the case tables. Then
   what you did not cover and why. Follow the report rules below.

## Report rules - the reader is a product owner

- **Compare the base branch with this branch only.** "On the base branch the grid shows X. On this branch it
  shows Y." No history of how the branch got there.
- **No commit hashes, no local file names, no evidence paths** in the visible text. Screenshots
  are embedded as data URIs, so the report is one file to share. Name the screen and the steps, not the source file.
- **Open items only.** No closed findings, no "fixed during testing" list, no empty sections, no
  revision history or rounds. Delete any template section you have nothing for.
- Plain words. If a sentence needs a developer to explain it, rewrite it.
- Keep the plan, scripts and raw evidence in the output folder for developers. The report does not
  point at them.

## What to actually try in the browser

Rendering the happy path proves almost nothing. These found real defects:

- **Hard reload the page.** A grid built from an async query often renders once with the wrong
  settings and never corrects itself. Compare a cold load against a warm click-through.
- **Sort every new column.** A custom sort fed a display label instead of the raw value ties
  unrelated rows together.
- **Read the label next to the control.** A reused component carries the wording of its first use.
- **Count the filter UI.** If the grid renders no filter row, header filter or search panel, every
  filter setting on its columns is unreachable. Read the DOM to check.

## Cover the states, not just the screen

For each new column or cell, list its states and make each one appear: value present, value
missing, value at its maximum length, and every status the enum allows. Seed whatever the database
lacks. A report that only ever shows one state has not been tested.

## Honesty rules

- A case you could not run is **Not covered** with a reason, never a pass.
- Say which cases the seeded data made possible, and confirm the data is gone.
- When a state cannot be reached, say why. "The filter drops any selection not in the current
  result, so it cannot empty the grid" is a finding about the design, not a gap in the testing.
- Failures stay in the table as failures.

## Gotchas

| Mistake | What to do |
|---|---|
| Testing against an API process built before the change | Compare the process start time and the build output time against the commit time. If older, ask the user to restart it - do not kill their process |
| A stash/test/pop check left a build without the fix | After you check that a test fails without the fix, rebuild at once. Otherwise the no-fix binary stays in the output folder and the user's next run uses it |
| Signing in through the automation browser | Its profile is often not signed in. Use a browser session that is, or ask the user to finish sign-in in the open window. Never ask for a password |
| Database writes fail but reads work | Some CLI clients need extra flags for writes (for example `sqlcmd` needs `-I` for `QUOTED_IDENTIFIER`). Test one write before seeding |
| Screenshotting without reading the page | Read the DOM or the accessibility tree first. The read finds it, the screenshot proves it |
| Calling it a pass because the grid rendered | Compare against the query you wrote in step 5 |
| Seeding without asking | The database is the user's. Ask, then seed with a marker prefix |
| Leaving seeded rows behind | Cleanup output goes in the evidence folder and the report says the data is gone |
| One screenshot of the happy path | One per state, plus one per finding |

## Reference map

- `references/environment-template.md` - copy into the project and fill in before the first run.
- `references/report-template.html` - copy for each report and replace every TODO.
