---
name: qa-ux
description: Pressure-test a RUNNING web app and produce TWO executive-grade HTML reports by default - a QA release report AND a UX product-experience audit (qa-report.html + ux-report.html, cross-linked). (1) QA pass - a Staff-QA release report (14 sections cover/release-recommendation/exec-summary/scope/traceability/per-scenario-execution/defect-tickets/evidence/API/coverage/risk/readiness/actions/appendix) backed by Playwright screenshots + API/ffprobe evidence. (2) UX pass - a Product Experience audit from six personas (Senior Product Designer, UX Researcher, Frontend Reviewer, Design Systems Lead, first-time user, impatient customer) across six journeys, scoring confusing/ugly/cheap/unfinished/inconsistent/frustrating/cognitively-heavy moments with a Product Experience Score and prioritized redesigns. Runs BOTH passes unless the user scopes to just one. Use when the user asks to "QA the app", "release readiness", "write a QA/test report", OR "UX review", "design review", "product experience audit", "find what feels confusing/ugly/unfinished/cheap", "judge the UX", "where would users hesitate or abandon", or invokes qa-ux. Drives the browser for screenshot proof (incl. mobile via viewport resize); never invents data; marks UNKNOWN when not verified.
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
2. **Evidence or it didn't happen.** UI claims need a screenshot; correctness claims (credits, media,
   APIs) need a real number / status code / ffprobe output. A `200` or a status card is not proof a
   thing is real - probe the artifact.
3. **Never invent data.** Not observed -> `UNKNOWN` / `NOT RUN`. UNKNOWN is an honest result.
4. **Explore, don't speed-run.** Optimize for "how many moments would make a real user hesitate?",
   not test count. Spend the time on the high-traffic surfaces.
5. **Keep the main session lean.** Fan out independent work (test-case generation from code, API/ledger
   checks, ffmpeg/ffprobe probes) to background subagents; the main session owns the single shared
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
4. Verify correctness out-of-band where it matters (API, DB deltas, ffprobe) via subagents.
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
