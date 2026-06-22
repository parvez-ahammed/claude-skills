# qa-ux

Pressure-test a **running** web app and, by default, produce **two cross-linked HTML reports**:

- **`qa-report.html`** — Staff-QA release report (14 sections) with a 🟢/🟡/🔴 release recommendation,
  backed by Playwright screenshots + API/ffprobe evidence.
- **`ux-report.html`** — Product Experience audit from six personas across six journeys (A–F), with a
  Product Experience Score /100, ranked problems, and prioritized redesigns.

Both passes run against the same app and share one `screenshots/` folder. Scope to a single report
only if the user explicitly asks ("just QA" / "only UX").

## Use
Invoke `qa-ux`, or ask for a "QA / release report" or a "UX / product experience review" of a
running app. The skill drives the browser for screenshot proof (including mobile via viewport resize),
verifies correctness out-of-band (API, ffprobe), and never invents data (UNKNOWN when not verified).

## Layout
```
qa-ux/
  SKILL.md                         entry point, mode router, universal rules
  references/qa-mode.md            14-section QA release report spec
  references/ux-mode.md            six-persona / six-journey UX audit spec + output
  templates/qa-report-template.html
  templates/ux-report-template.html
```

## Output
A self-contained HTML report (dark, Linear/Notion/Stripe style: sticky nav, severity colors,
collapsible sections, badges, callouts, execution timeline, CSS charts) next to a `screenshots/`
folder, opened in the browser when done.

## Install
Global: place this folder at `~/.claude/skills/qa-ux/` (this location). Project-vendored: copy to
`<repo>/.claude/skills/qa-ux/`.
