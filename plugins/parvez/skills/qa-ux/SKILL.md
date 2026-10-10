---
name: qa-ux
description: >-
  Pressure-tests a RUNNING web app and produces two cross-linked, executive-grade HTML reports by
  default: a Staff-QA release report (qa-report.html, 14 sections from release recommendation to
  defect tickets and risk register) and a Product Experience audit (ux-report.html, six personas
  across six journeys, scoring confusing, ugly, cheap, unfinished, inconsistent or frustrating
  moments into a Product Experience Score with prioritized redesigns). Every claim is backed by a
  browser screenshot or out-of-band evidence (API responses, data checks, file probes); nothing is
  invented and anything unverified is marked UNKNOWN. Use when the user asks to "QA the app",
  "release readiness", "write a QA/test report", "UX review", "design review", "product experience
  audit", "judge the UX", or invokes qa-ux.
when_to_use: >-
  Also triggers on "find what feels confusing/ugly/unfinished/cheap", "where would users hesitate or
  abandon", "is this ready to ship", or a request for screenshot-backed QA including mobile (via
  viewport resize). Runs BOTH passes unless the user scopes to just one ("just QA", "only UX").
argument-hint: "[app-url] [qa|ux]"
---

# qa-ux

Put a **running** product through the fire and report back like a leadership-facing reviewer.

## Default: run BOTH passes -> TWO reports
By default qa-ux runs both passes against the same running app and emits **two** self-contained HTML
reports into `<out>/` (default `.qa-reports/`), sharing one `<out>/screenshots/` folder:

1. **QA pass** (engineering / release gate) -> `references/qa-mode.md` -> writes `qa-report.html`.
2. **UX pass** (product experience / design) -> `references/ux-mode.md` -> writes `ux-report.html`.

Run QA first (it boots the app, builds the test-case catalogue, and captures most desktop screenshots),
then UX (it reuses those screenshots and adds the mobile/journey passes). **Cross-link the two** (each
report links to the other in its nav/header), and open both when done. Screenshots are shared, so the UX
pass should reuse QA's captures and only add what it needs (mobile viewport, extra states).

**Scope to one pass only if the user explicitly asks** ("just QA" / "only a UX review") - then produce
that single report. If unsure, do both.

## Universal rules (both modes)
1. **Screenshots are the source of truth.** Capture every screen and every state. If it *feels* wrong
   (spacing, hierarchy, alignment, tone, weight), report it. Never write "works as expected" - describe
   the experience quality.
2. **Evidence or it didn't happen.** UI claims need a screenshot; correctness claims (balances, stored
   records, generated files, APIs) need a real number / status code / probe output (e.g. a DB row,
   a file's size or `ffprobe` result). A `200` or a status card is not proof a
   thing is real - probe the artifact.
3. **Never invent data.** Not observed -> `UNKNOWN` / `NOT RUN`. UNKNOWN is an honest result.
4. **Explore, don't speed-run.** Optimize for "how many moments would make a real user hesitate?",
   not test count. Spend the time on the high-traffic surfaces.
5. **Keep the main session lean.** Fan out independent work (test-case generation from code, API/data
   checks, file/media probes) to background subagents; the main session owns the single shared
   browser (serial). Capture the mobile journey with a viewport resize (e.g. 390x844).
6. **Self-contained HTML report**: dark theme, modern typography, generous spacing, Linear/Notion/Stripe
   feel - sticky side nav, severity color system, collapsible `<details>`, status/test badges, callout
   blocks, a CSS execution timeline, simple CSS charts/heatmaps, structured cards over long prose.
   Reference screenshots relatively from a `screenshots/` folder next to the HTML so they render inline.
   Open the finished report for the user when done.

## Shared workflow
1. Locate/boot the app. Record build: branch, commit SHA (`git rev-parse --short HEAD`), env, versions.
   Mark UNKNOWN if not derivable.
2. Map surfaces (routes, primary flows). QA: generate the test-case catalogue from code first.
3. Drive the browser per the mode's journeys/scenarios; screenshot every state; capture console.
4. Verify correctness out-of-band where it matters (API responses, DB deltas, file probes) via subagents.
5. Assemble the report in the mode's structure. No invented data. Open it.

## Severity (shared)
- **Critical** - blocks a real user or core flow; data/money correctness wrong.
- **High** - a paid feature or acquisition step broken; a screen users would abandon.
- **Medium** - degraded surface, real friction, looks unfinished/inconsistent.
- **Low** - minor polish / environment-only.
- **Info** - observation, cosmetic, config smell.

Release call: any open Critical -> BLOCKED; Highs with workarounds -> APPROVED WITH RISKS; only
Low/Info -> APPROVED.

## Files
- `references/qa-mode.md` - 14-section QA release report spec.
- `references/ux-mode.md` - six-persona / six-journey Product Experience audit spec + output.
- `templates/qa-report-template.html` - QA report skeleton.
- `templates/ux-report-template.html` - UX audit skeleton.
