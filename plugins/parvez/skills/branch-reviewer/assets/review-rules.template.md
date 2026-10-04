# Review rules for <project name>

<!--
Copy to .claude/review-rules.md in your repo and fill in what applies. Delete sections you do not need.
branch-reviewer passes this file to every seat; where it disagrees with the generic rubrics, this file
wins. Keep each rule short and give its reason - a seat follows a rule with a reason better.
-->

## Repo basics

- Base branch: `main`
- Backend folders: `src/Api/`, `src/Workers/`
- Frontend folders: `web/`
- Test stack: xUnit + FluentAssertions (backend); none in `web/` - frontend changes record a manual check instead
- Issue tracker: GitHub issues (`gh issue view <n> --comments`); ticket number is the branch prefix
- Working notes folder (plans, decisions): `docs/plans/<ticket>/` (gitignored: use `rg --no-ignore`)
- Report folder: `.reviews/` (gitignored)

## Builds

- May the reviewer run builds? yes / no (no = "the user builds in the IDE"; report "Build: not run")
- Build targets per changed path:
  - `src/Api/**`, `src/Shared/**` -> `dotnet build src/Api/Api.sln`
  - `src/Workers/**`, `src/Shared/**` -> `dotnet build src/Workers/Workers.sln`
- Shared libraries that live in more than one build target: `src/Shared/` (build both)

## Distribution model

- Closed-source SaaS, plus a desktop agent installed by customers (affects the dependency seat)

## Critical paths (always run advanced mode)

- `src/Sync/**` - deletes rows that are missing from the source list
- `src/Migrations/**`
- `src/Auth/**`

## Clients that must keep working

- Web UI, desktop agent (customers update late - assume the oldest supported build stays live)
- The desktop agent sends chunked request bodies with no Content-Length

## Edge firewall / gateway

- Production sits behind a WAF; local runs have none
- Shapes blocked before: GET with a body; multipart uploads from the desktop agent; new cookies

## Project-specific rules

<!-- Your conventions the generic rubrics cannot know. Examples: -->
- Reuse `BaseAuditDto` for created/modified fields; do not add them by hand
- A lookup miss throws `NotFoundException`, never `ValidationException`
- Soft-deletable entities are removed only through `SaveChangesWithSoftDeleteAsync`
- Every log line in a job carries `JobId`
- UI: use the wrappers in `web/src/components/common/` (`AppTooltip`, `AppDialog`, `AppButton`), never the raw library primitive
- UI: colours and font sizes come from `web/src/theme/tokens.ts`; raw hex only in that file

## Repo-wide sweeps (run on every review of that area, whatever the diff touches)

- Frontend: `grep -rn 'console\.log' web/src` - zero hits allowed
- Backend: `grep -rnE '\.Result\b|\.Wait\(\)' src --include=*.cs` - no blocking waits on tasks

## Intentional behaviour - do not flag

<!-- Each entry: what it is, why it is deliberate. Seats skip it, but still check the code matches. -->
- Search returns 200 with an empty list for an unknown filter value. Old clients depend on it.
- Guests can see member names in a shared project. Product decision.

## House style

- Writing guide: `docs/writing-style.md` (ASCII punctuation, Simplified Technical English)
- PR descriptions are not reviewed
- CI does not run unit tests on PRs (a test the PR breaks is worth a comment)
