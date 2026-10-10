# Report output - HTML report and blind-spot footer

Read at steps 6 and 8 of `../SKILL.md`.

## The HTML report (step 6)

Copy `../assets/report-template.html` to the report folder from the project rules, or by default
`.reviews/<branch>/review.html` (suggest adding `.reviews/` to `.gitignore`). Fill the placeholders:
`{{REF}} {{TITLE}} {{DATE}} {{BASE}} {{HEAD}} {{FILE_COUNT}}`, `{{SUMMARY_PARAGRAPH}}`,
`{{IMPACT_ROWS}}`, `{{COVERAGE_ROWS}}`, `{{FINDINGS}}`, `{{N_HIGH}} {{N_MED}} {{N_LOW}} {{N_TESTS}}`,
`{{REFUTED}}`, `{{TEST_CASES}}`, `{{FOOTER_LIST}}`, and delete the snippet comment at the end.

`{{FINDINGS}}` carries code, QA **and** text findings as one ranked list. Append the text seat's
rewrite table as its own block at the end, so the author applies every string change in one pass.
The template is self-contained (inline CSS and JS, no CDN) because the file gets opened from disk
and mailed around; keep it that way.

## Blind-spot footer - append to every report (step 8)

This is a **static diff review**. It does not run the app and cannot see code that was never written.
Emit a short trailing block titled `Not covered by static review (verify separately):` with the bullets
that apply:

- **Run-only behaviour** - duplicate notifications, dead click areas, stale screens, two-click flows,
  visual issues. Exercise the touched flow before merge (a manual walkthrough, or the `qa-ux` skill
  against the running app). Some of these are catchable statically once the global contract is known
  (duplicate error toast, missing cache invalidation) and the seats flag those, but confirm by running.
- **Missing requirements** - a case simply not implemented. A diff reviewer reviews lines that exist.
  Map each requirement to a change and a verification at plan time.
- **Edge firewall or gateway** (only when the diff changes an upload, a query parameter, a cookie, a
  request method or a body size, and the project sits behind a WAF or gateway) - local runs usually
  have no WAF, so a block shows only in a deployed environment. Run the flow from each client there
  and read the firewall log before release.

Drop the UI bullet on a pure-backend PR; drop the firewall bullet when no request shape changed.
