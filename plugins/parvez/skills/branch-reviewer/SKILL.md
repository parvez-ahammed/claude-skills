---
name: branch-reviewer
description: >-
  Multi-seat code review of a branch, a diff or a pull request. Six parallel reviewer seats
  (backend, frontend, architecture, tests, QA, text) each review against their own rubric, plus a
  dependency seat that runs only when the diff adds a library and reports its licence, whether it
  is free for commercial use, and its price. Every finding then goes through a refutation pass, and
  the result is one severity-ranked punch list plus a self-contained HTML report. Use for "review my
  PR", "review this branch", "code review", "audit this branch", "what will be flagged", "second
  opinion on my changes", and equally for "QA this PR", "what should be tested", "what regressions
  could this cause", "write test cases for this branch". Say `advanced` ("deep review", "full review
  before PR") for the deep shape: the six seats plus four external rubrics, an adversarial round and
  an HTML artifact; it also starts on its own for critical work (data sync, migrations, auth,
  background jobs, destructive paths). Say `comment` ("review PR 123, comment mode") to post the
  surviving findings as review comments on GitHub, Azure DevOps or GitLab, after an independent agent
  re-verifies every claim. Use "post these findings to PR 123" when the findings already exist.
  Use it even on small or "trivial-looking" PRs: many recurring review hits come from PRs the author
  thought were tiny.
---

# branch-reviewer

Six independent reviewer seats review a diff in parallel, plus a seventh dependency seat that runs
only when the diff adds a library. This skill is the orchestrator: it reads the diff, routes it to
the seats that apply, collects their results, removes duplicates, tries to refute every serious
finding, and returns one severity-ranked punch list.

The value is not "an LLM read the diff". It is the structure around the reading: an ownership split
so two seats never report the same thing twice, severity floors that social pressure cannot lower, a
rule that every finding carries a concrete failure scenario, and a refutation pass that kills the
confident-but-wrong findings before the author pays for them.

The seats are **not** separate skills. Each is a rubric under `references/`, passed to a sub-agent by
this orchestrator. A seat run on its own reports without the ownership split, the severity floors or
the verify pass, and a partial review then gets mistaken for a full one. The entry point is always
this skill.

## When to use / not use

- **Use when** the thing under review is code: a local branch, a diff, or someone else's pull
  request. Also when the question is "what should be tested before this merges" - QA is a seat here,
  not a separate run.
- **Do not use** to test a **running** app. This is a static review; it never clicks anything. For a
  release report with screenshots from the live app, use `qa-ux`.
- **Do not use** to ask whether an already shipped feature keeps its promise to users. That is
  `grill-feature`, which interrogates features, not diffs.
- **Do not use** for a one-line typo fix where you only want a quick correctness glance. A plain
  single-pass review is cheaper. (But see the effort levels: `quick` still runs the tests seat.)

## Project rules (read before every review)

The rubrics in this skill are generic. Every real codebase has its own conventions, traps and
deliberate decisions, and a reviewer that does not know them produces false positives.

**Before routing, look for project rules, in this order, and read every one that exists:**

1. `.claude/review-rules.md` - the dedicated file for this skill.
2. `CLAUDE.md` / `AGENTS.md` at the repo root and in the folders the diff touches.
3. `.claude/rules/*.md` that cover changed files.
4. Any guardrails or style guide those files point to.

Pass the paths of every file you found to **every seat**, and tell each seat to read them before its
own rubric. Where a project rule and a generic rubric disagree, **the project rule wins**. Record in
the report which project rule files were read, or "none found".

`assets/review-rules.template.md` is a starting template. It shows what a project can declare: the
base branch, build commands per folder, whether the reviewer may run builds, the issue tracker, the
notes folder, critical paths, sibling clients, repo-wide grep sweeps, house style, and a list of
**intentional behaviours that must not be flagged**. If the repo has no rules file and the review
produces a false positive that a rule would have prevented, suggest the user add one.

**Intentional-behaviour entries are not a blanket pass.** Do not report the behaviour an entry
describes. But confirm the code still does exactly what the entry says. If the code drifted from
the recorded decision, that is a finding.

## Modes

One entry point, several shapes. Read the mode from the user's words. When nothing says otherwise,
run **self-review**.

| The user says | Mode | Seats | Where the findings go |
|---|---|---|---|
| "review my PR", "review this branch", "what will be flagged" | **self-review** (default) | all 6 | punch list in chat + HTML report |
| "QA this", "what should be tested", "what regressions" | **self-review** | all 6 | same - QA is a seat, not a separate run |
| "advanced mode", "deep review", "full review before PR", "review with everything" | **advanced** | all 6 + 4 external rubrics | punch list in chat + HTML artifact |
| "review PR 123 and comment", "comment mode" | **comment** | all 6 | punch list, then the survivors are posted to the PR |
| "post these findings to PR 123" (findings already in hand) | **comment-only** | none | straight to the commenting flow |
| "code review only", "skip QA" | **code-only** | 4 code seats | punch list in chat |
| "QA only", "just the test cases" | **qa-only** | QA seat | HTML report |
| "review the copy", "check the wording" | **text-only** | text seat | rewrite table in chat |

Modes compose. "Advanced review of PR 123, comment mode" runs the advanced flow, then posts the
survivors through `references/commenting.md`.

**Never split a review across two invocations.** When QA was a separate step it ran on a small
fraction of branches - the ones where somebody remembered. `code-only` exists for a deliberate second
look after fixes, not as a default.

**Comment mode changes the posture, not only the destination.** Self-review produces a list the
author fixes privately. Comment mode produces public text on someone else's work: each wrong comment
costs the author time and costs you credibility for the next twenty. That is why it goes through
`references/commenting.md` and never posts directly.

**In comment mode the review target is not your branch.** Take the base from the PR, not from
`<default-branch>...HEAD`, and never assume the author is the user.

## Advanced mode

Advanced mode is this skill, not a separate one. Two entry points meant the deep review ran only when
someone remembered the second name. The playbook is `references/advanced-mode.md`; load it only in
this mode, so a normal review never pays for it.

What it adds: a strict base-resolution and diff-dump phase, four external rubrics that fail
differently from the seats (`references/external-rubrics.md`), a dedicated adversarial round on every
`high`, and one HTML artifact instead of terminal text. It costs several times a normal review.

### It runs on request, and it runs on criticality

Run advanced mode when **either** is true.

**1. The user asked.** "advanced", "deep review", "full review", "review with everything". This is a
manual override and it always wins, even on a small diff.

**2. The change is critical.** Anything that moves, transforms, schedules or authorizes real user
data is critical, whatever its size. Concretely, the diff touches any of:

| Critical area | Typical shape |
|---|---|
| Integrations with external systems | connectors, API clients, import/export, webhooks |
| Data sync and transfer | anything that copies, merges, or deletes by comparing two lists |
| Mapping and transformation | field mapping, formulas, serializers, value conversion |
| Persistence and migrations | schema migrations, backfills, retention, audit logging |
| Auth, permissions, multi-tenancy | auth schemes, role checks, account or org scoping, keys, tokens, secrets |
| Background work | queued jobs, recurring jobs, schedulers, realtime push |
| Rollout paths | anything that backfills, overwrites, republishes, or changes a shipped contract |
| Destructive paths | delete, purge, cancel, rollback, overwrite |

Also critical, whatever the folder: a long-lived or large branch, a security fix, a change to a
public API shape, and any diff whose failure is silent (wrong data written, not a crash). Add the
project's own critical paths from the project rules.

When criticality triggers it and the user did not ask, **say so in one line before starting** ("this
touches the sync engine, running advanced mode"). If the user says do it normally, do it normally.

Everything below - scope table, ownership split, output contract, severity floors, investigation
method, honesty rules - applies in advanced mode too. Advanced mode changes the flow, not the
standards.

## Scope determination

| Seat rubric | Runs when | Scope |
|---|---|---|
| `references/seat-backend.md` | server-side code, build files, migrations changed | hygiene, naming, DRY, async, perf micro-patterns, logging, ORM traps |
| `references/seat-architecture.md` | **always** | boundaries, business-logic correctness, authorization, cardinality, destructive paths, simplification |
| `references/seat-tests.md` | **always** (any behaviour change) | the unit-test hard rule, plus test quality |
| `references/seat-frontend.md` | UI code changed | rendering perf, state, data fetching, design system, UI fitness and conformance |
| `references/seat-qa.md` | **always** (any behaviour change) | impact beyond the diff, requirement coverage, user-facing defects, test cases |
| `references/seat-text.md` | **always** when a string a human reads changed | misreadable labels, jargon, failures with no cause or next action, house style; literal rewrites |
| `references/seat-dependency-licence.md` | **only** when the diff adds a dependency | licence, free for closed-source commercial use, price, redistribution duty |

Invoke every applicable row. Architecture, tests and QA are mandatory on every non-skipped PR. QA is
dropped only in `code-only` mode. The text seat runs whenever a shipped string changed, also on a
"pure backend" PR: an error message in a service is user-visible text. The dependency seat is the one
row not driven by folders: it runs on an added package (a new entry in `package.json`, `*.csproj`,
`Directory.Packages.props`, `pyproject.toml`, `requirements*.txt`, `go.mod`, `Cargo.toml`, `Gemfile`,
`pom.xml`, `build.gradle`, and so on) and stays silent otherwise.

Which folders count as backend and frontend comes from the project rules. Without them, infer from
the file types and say what you inferred.

## Skip rules

- Only `.gitignore` / `.editorconfig` / personal IDE config changed -> no review. Report "no in-scope
  changes" and flag any personal IDE file that slipped into the diff.
- Only docs or images -> architecture (doc naming, broken references) **plus text**, which owns the
  wording.
- Only shared config / infrastructure-as-code -> architecture only.
- Anything else -> follow the table.

A skipped review reports `Unit test rule: N/A`. Nothing else may skip the tests seat: a diff small
enough to look exempt is exactly the diff that ships an untested branch. The same holds for QA - a
one-line change that alters what a user sees still has consequences and an acceptance criterion.

## Ownership split (avoid double-flagging)

Backend and architecture read the same server code. This table says who owns what.

| Topic | Backend | Architecture |
|---|:---:|:---:|
| Object-mapper formatting and configuration style | x | |
| "Should this mapping exist at all?" / type-pair sanity | | x |
| Dead commented-out blocks, unused imports | x | |
| Comment necessity, language and structure (see **Comment quality**) | x | |
| Comment volume as a design smell | | x |
| Unused services, orphan endpoints, unrendered components | | x |
| DTO field naming, nullability, base-class reuse | x | |
| DTO existence at a boundary (domain model leak) | | x |
| Perf micro-pattern (set vs list lookups, bulk update calls) | x | |
| Perf macro-pattern (filter in the database, allocation strategy) | | x |
| Method and variable naming, formatting | x | |
| Service boundaries, single responsibility, public vs internal surface | | x |
| Business-logic correctness (field meaning, races) | | x |
| Authorization: who may perform a state change, and on which side | | x |
| Cardinality: code that assumes the first / primary / only element | | x |
| Destructive paths: what a delete, overwrite or backfill removes or orphans | | x |
| Requests an edge firewall or gateway can block | | x |

**Tests are a separate axis.** Anything about whether a change is verified belongs to the tests seat,
even on code the backend seat also reads. If backend or architecture spots a missing test, they hand
it over - one finding, attributed to tests.

**QA is a third axis.** Anything about what a user experiences, what the ticket asked for, or what
breaks in a file the diff never touched belongs to QA:

- a requirement in the ticket with no implementing change (no diff lines exist, so no code seat sees it)
- a recorded decision in the project's notes that the shipped code contradicts
- regressions in untouched callers, sibling integrations, other roles, the other party's side
- stale UI after a mutation, duplicate notifications, dead controls, silent drops
- the test cases someone must execute before merge

**Text is a fourth axis.** Anything about the words themselves belongs to the text seat. Frontend
owns how a control looks and behaves; text owns what it says. QA owns whether a message appears at
the right time; text owns whether it is the right message. A code seat that wants to flag wording
hands it to text with the `file:line`, and text returns the rewrite.

When one finding maps to two axes (rare): architecture wins, show it once at the higher severity.

## Output contract - every seat returns this shape

```
### [Severity: high | med | low] [Action: Required | Consider | Nit] [path/to/file.ext]:[line]
**Issue:** one-sentence problem.
**Failure:** concrete inputs or state -> the wrong output, crash, or loss. Required on high and med.
**Fix:** one-sentence corrective.
```

Severity:
- **high** - correctness bug, perf regression on a hot path, security or permission gap, data loss,
  public API break, compile error.
- **med** - naming, DRY, DTO shape, repo hygiene, dead code, divergence between two paths.
- **low** - formatting, comment style, blank lines. Comment findings are grouped per file, never one
  per line.

Severity says how bad. **Action says what the author must do**, and they are different axes. A `high`
the author may legitimately defer is `Consider`; a `low` that blocks (a lint gate, a typo in a
persisted enum name) is `Required`.

- **Required** - fix before merge, or defer explicitly with a reason in the PR.
- **Consider** - worth doing, author's call.
- **Nit** - optional; the author may ignore it silently.

### The Failure line is the filter

**A finding without a concrete failure scenario is not a finding.** "This could be a problem", "this
may not scale", "consider whether this handles X" make a punch list unreadable and train the author
to skim. If you cannot write the inputs and the wrong result, you have a question: put it under
Questions, or read one more file until it becomes a finding.

Quantify when the claim is quantitative: "N+1 across ~200 rows adds a round trip per row", not
"could be slow". A number the author can check is a number you must have checked.

`low` findings are exempt because formatting has no failure mode - which is also why they never lead
a report.

### External-system claims need a vendor citation, not an inference (blocking, `high`)

A claim about **something outside this repo** - an external API's filter syntax, its operators, its
status codes, its paging, its limits, a version floor, a library's contract - cannot be reviewed from
the codebase. The code shows what we *send*, never what the other end *accepts*.

The real failure: two independent sub-agents flagged a not-equals operator rendered as `!=` in a REST
filter builder as a Required fix, because every sibling operator in the same switch used a
`:eq:` / `:lt:` colon form. The vendor's documentation lists `!=` as the correct not-equals token, and
no colon form for it exists. The "fix" would have broken every not-equals filter in production.
Internal symmetry is not evidence about a third party's parser.

- **Verify against the vendor's own documentation** with a web search or fetch. Cite the URL. If you
  cannot find the vendor's statement, the claim does not ship as a finding.
- **Working notes are not an authority.** AI-written plans and notes in the repo are leads: use them
  to find the question and the source URL, then confirm at the source. A note that repeats a vendor
  claim is how a wrong claim gets turned into a confident one.
- **A measured result outranks a document.** A recorded response from the live server beats vendor
  prose, which is often stale (a doc said `200 OK` with an empty body; the server answered
  `204 No Content`). Re-run the probe if it is cheap.
- **No citation means it is a Question.** Phrase it "does X accept Y?" and say what would settle it.

To decide whether a claim is internal or external, ask who would have to change for the finding to
be wrong. If the answer is a vendor, it needs a citation.

### Unit tests are mandatory (hard rule)

**A change in behaviour ships with a unit test in the same PR.** A behaviour change with no test is a
`high` / **Required** finding and the verdict is **Not ready**, no matter how clean or small the code
looks. The tests seat owns the judgement; the orchestrator enforces the verdict.

Behaviour change: a new branch, a changed condition, a new method with logic, a changed default, a new
validation rule, a bug fix, a changed query or serialization, a new integration path, a migration with
a backfill. Exempt: formatting, naming, comment and dead-code removal, pure moves already covered by a
test, config and docs, generated code.

These are context lines, never reasons to waive it: "covered by integration tests" (then name the one
that fails on revert), "the logic is trivial", "too hard to test" (a finding about the code's shape),
"I tested it manually" (record that *and* add the test), "tests in a follow-up" (file it with an owner
or do it now), "coverage in that file is already high" (coverage counts lines run, not behaviour
checked).

**The one exception, which must be declared, never assumed.** If the project rules say a part of the
codebase has no test suite (common for a frontend), a change there is not blocked for lacking a unit
test - but it must record what was exercised and how. Silence is not the exception: an untested
change with no recorded verification is still `high`.

Every report carries the verdict line: `Unit test rule: PASS | FAIL | N/A - <reason>`.

### Severity floor for authorization findings (non-negotiable)

An authorization, permission or isolation gap (between users, accounts, orgs, tenants) is rated on
**API reachability**, never on UI reachability. These are context lines, never severity reducers:

- "our UI never sends that request" / "the button is hidden" / "the client filters it out"
- "the flag that gates it is computed correctly elsewhere"
- "the gap is pre-existing, the diff did not introduce it"
- "it needs a crafted HTTP request" / "the caller must already be signed in"

A signed-in user with curl is the baseline attacker. Pre-existing **and newly amplified** (new
endpoint, newly exposed identifier, new fan-out) is worse than pre-existing alone. Put the context in
the finding body, keep the severity at `high`. A gap that a design doc recorded and deferred is still
an open gap: cite the doc, do not inherit its verdict.

The inverse error is real too: an authorization concern the server already enforces is a **cleared
check, not a finding**. Trace the server-side gate before rating.

### Severity floor for silent data loss (non-negotiable)

A path that can delete, void, overwrite or orphan data the user did not ask to lose is floored at
`high`. Context lines, never reducers: "it only happens if the upstream read fails" (that is the
case, not the exception), "the row is only soft-deleted" (hiding data a live record points at is data
loss to the user), "the filter would have to be misconfigured" (a typo is the expected input), "it is
only one account".

The tell is **deletion by absence**: code that treats "not in this list" as "gone at the source".
Whatever builds that list is now a data-loss path, and every way it can come back short - a filter, a
failed page, an exception swallowed into an empty result, a per-item overwrite - is a `high`. Real
shapes: a catch-all on a read that treated any failure as "fresh destination" and overwrote an
existing file; a soft-delete of fields that a live configuration still referenced; a migration that
backfilled every existing account into an active auto-delete policy. Architecture owns these.

## Compile gate - run it, do not reason about it (blocking, `high`)

A reviewer that cannot say "it builds" has not finished. A missing type, a renamed class, a signature
drift in a shared library: the compiler finds these in seconds and a careful reader misses them,
because the diff shows the call site, which looks reasonable.

- **Map every changed project to every build target that includes it** (solution, workspace, package,
  module) and build **each**. "I built the API" proves nothing about the other apps that link the
  same library.
- **A shared library used by two apps is built twice.** It compiles clean in one and breaks the other.
- **The app nobody has open is the one that breaks.** A desktop host, a worker, a CLI: if the diff
  touches one file in it, build it.
- Run the builds **in parallel with the seats** (they do not need each other). Report one line:
  `Build: api OK, worker FAIL (1 error)`. **Any compile error is a `high`**, quoted verbatim with its
  `file:line`, and it leads the punch list.
- **If the project rules say the user runs builds**, do not run them. Read the changed code with a
  compiler's eye and say so: `Build: not run (project rules)`. An honest gap beats a silent one.

Use the build commands from the project rules. Without them, discover the build files near the
changed paths and say which commands you chose.

## Verification review - what did the author actually run? (blocking, `high`)

The compile gate proves *you* can build it. This asks what *the author* verified. A reviewer who only
reads code accepts the author's verification as given, and that is how "it compiles" reaches QA.

The tests seat answers these and returns them; the orchestrator carries them into the summary
without re-deriving them. Each unanswered one is a `high`:

- **Which test fails if this PR is reverted?** Name it, `file:line`. If the honest answer is "none",
  say so - it is the most useful line in the report.
- **Does the diff touch a migration, an integration, or a shared service with no test change?** Say it.
- **For UI changes: was the flow exercised, or only read?** A screenshot, a recorded click path, or
  an honest "not run".
- **Do the tests check behaviour or mocks?** At least one assertion on a real output.
- **Does every bug fix have a regression test?**

```
Unit test rule: PASS | FAIL | N/A - <reason>
Verification: revert-test <name> | NONE; UI flow exercised | not run
```

## Verify your own findings before reporting

Run this after merge and dedupe, before emitting. It costs one pass and decides whether the author
acts on the list or learns to skim it.

For **every `high`**, and every `med` whose Failure line rests on a file nobody opened: try to
*refute* it. Default to refuted when unsure. Open the file the claim was inferred from. Check whether
the missing guard exists one layer up, whether the caller already filters the case, whether a global
contract covers it.

- **CONFIRMED** - you read the path end to end and the failure holds.
- **PLAUSIBLE** - the shape is right but one step is unread. Name the step in the finding.

Drop anything refuted. Do not downgrade it to `low` to keep the work: a wrong `low` still costs a
read. If you refute more than half of one seat's `high` findings, say so - that is a signal about the
seat's prompt, not the diff.

**A claim that survived verification can still be false.** A reviewer's "checked, clean" is the
least-checked claim of all, because nobody re-verifies a clearance. When a finding or a clearance
reached you from an earlier verifier, re-read the source yourself; do not re-read the last verifier.

## Comment quality - every seat judges the comments in its own files

There is no comment seat: a comment can only be judged next to the code it sits above. Judge every
added or edited comment on three axes.

### 1. Necessity - does this comment earn its line?

Default: write the code, no comment. A comment is justified only when it carries something the code
cannot: a non-obvious **why** or a rejected alternative that looks correct; a **trap** the next reader
would fall into; a **cross-file invariant** the compiler does not enforce.

Flag as `low` / `Nit`, or `med` / `Consider` when the volume is systemic:

| Pattern | Why it fails |
|---|---|
| Restates the member name | The signature already said it |
| Walks the happy path line by line | The code is the walkthrough |
| Defends a design decision at length | Belongs in the PR description or commit body |
| The same two sentences repeated across sibling files | Put it once on the base class or interface |
| Added "for consistency" because neighbours have one | Consistency is not a reason |
| Longer than the code it guards | A design note in the wrong place |

**Reach for a name before a comment.** If a rename, an extracted local or an extracted private
method removes the need, the finding is the weak name. `FoldsIntoModified(profile)` needs no comment;
`ChildAction(profile, x)` does.

The reverse is a more expensive finding: **a deleted comment that carried a safety reason**. When a
diff removes a comment, ask what the next reader loses. A comment that records why an unsafe-looking
choice is safe today, and what would make it unsafe, is the one kind a trimming pass must keep.
Report its removal at `med` / `Required`.

### 2. Language - Simplified Technical English (ASD-STE100)

- Active voice, present tense.
- One idea per sentence. Twenty words or fewer for an instruction, twenty-five for a description.
- One word, one meaning. Do not call one thing a row, a record and an entry in the same file.
- Simple concrete words: "use", not "utilise"; "before", not "prior to".
- No noun stacks longer than three words.
- Keep the articles.
- No metaphor, jokes, slang or idiom. They do not survive translation or a decade.
- Plain ASCII punctuation: no em dash, en dash, curly quote, ellipsis or arrow character.
- No jargon a new team member would have to ask about. Say what the code does, in verbs.

### 3. Structure

- Written for **a maintainer changing this file next year**. They need the trap, not the journey.
- **Hard cap: one or two lines**, except a file-header or class-level contract note.
- Directly above what it explains.
- No AI tells: no "Note that...", no "This is important because...", no numbered narration, no
  restating the ticket.
- No stale comment: if the diff changed the behaviour and left the comment describing the old one,
  that is `med` / `Required`. A wrong comment is worse than none.
- No commented-out code. Git has it.

Applies to test files too. **Group comment findings**: one per file, or one per pattern across files,
with the worst two or three lines cited. If comment volume is the finding, say so as one `med` with
the ratio ("24 comment lines on 96 lines of code") and name which comments to keep.

## Effort levels

| Level | Seats | Verify pass | Use when |
|---|---|---|---|
| `quick` | applicable only, skip `low` - **tests still runs; text still runs on any changed string** | no | small diff, or a second look after fixes |
| `standard` (default) | all applicable | on `high` | normal reviews |
| `deep` | all applicable + a second independent pass on the riskiest file | on `high` and `med` | migrations, integrations, auth, destructive paths, a new feature folder |
| `advanced` | all applicable + four external rubrics (`references/advanced-mode.md`) | dedicated adversarial round on every `high` | the criticality table, or on request |

Higher levels widen coverage and raise the false-positive rate. The verify pass keeps that in check,
which is why it scales with the level.

## Investigation method (paste into every seat prompt)

The diff is where a review *starts*. Most bugs that survive review are not wrong changed lines; they
are correct-looking lines whose context the diff does not show. Before judging the changed lines:

1. **Open every method the diff calls, copies or adapts.** State its precondition; confirm it holds in
   the new caller. Catches a bulk method called per item, logic for one integration reused for
   another, a storage or lifecycle mismatch.
2. **Grep for sibling implementations of any rule the diff touches** (validation, format, status,
   permission). They must agree. A file-name rule enforced one way on upload and another way later is
   a user-facing bug.
3. **Load the global contract before judging a local handler.** Error notifications, query caching,
   auth and logging are often central; a local addition on top duplicates them.
4. **Check every integration / storage mode / role branch the change implies**, not only the one in
   the diff. A change on one branch usually has an analogue on the others.
5. **For any create / persist / import flow, reason about the second run** (re-upload, re-save). Does
   it self-heal, or handle only the first time?
6. **Instantiate the second element, not only the second run.** For every collection the diff
   touches, name each place it takes the *first*, the *primary* or the *only* member: `.First()`,
   `[0]`, a field assigned per iteration instead of accumulated, a list rebuilt instead of appended, a
   file written per item to one key, an id taken from the primary. For each, state the two-element
   scenario that breaks it and whether a test covers it. "It loops" is not an answer; read what the
   loop body writes *to*. This is the most expensive miss class in practice: one feature was reopened
   three times running because each fix handled one more object type (resources, then calendars,
   then structures) and nobody wrote the list down.
7. **Verify every external-system claim against vendor documentation** before writing it as a
   finding, and cite the URL. "Every sibling uses this form, so this one is wrong" is a Question.
8. **Apply the simplification lens.** Could a reframing delete a whole branch, helper layer or kind
   of complexity while keeping behaviour? Is this a thin wrapper that adds indirection without an
   invariant? Did feature-specific logic leak into a shared path? A working design that a smaller one
   replaces is still a finding (architecture owns the call).
9. **Re-open the source for every inherited claim** - a dev note, an earlier report, an "accepted" or
   "do not re-raise" label, a previous verifier's "clean". Which file and line did you open this round?
   If none, it is a Hypothesis.

If confirming a finding needs a file the diff did not include, read it. A reviewer that reads only
the diff reproduces the author's blind spots.

## Orchestration flow

0. **Confirm the seat rubrics exist before promising a review.** A clean punch list from seats that
   never ran is worse than no review, because it reads as coverage. Resolve this skill's directory
   (the folder that holds this `SKILL.md`) to an absolute path and check:

   ```bash
   SKILL_DIR="<absolute path of this skill's folder>"
   for s in seat-architecture seat-backend seat-frontend seat-tests seat-qa seat-text seat-dependency-licence; do
     test -s "$SKILL_DIR/references/$s.md" || echo "MISSING SEAT: $s"
   done
   ```

   A missing applicable seat is a `high` on its own, named as `Reviewers unavailable: <names>`. Never
   proceed quietly with fewer.

1. **Read the project rules** (see above) and **detect the base.**
   - Local branch: find the default branch (`git symbolic-ref --short refs/remotes/origin/HEAD`, or
     the project rules), then `git fetch origin --quiet` and
     `git diff --name-status $(git merge-base HEAD origin/<default>)...HEAD`. Use `origin/<default>`,
     not the local branch: a stale local base fills the diff with other people's merged work.
   - Pull request: take the base from the PR (see `references/commenting.md` for the GitHub, Azure
     DevOps and GitLab commands).

   Check that the commit list looks like *one* piece of work. If it does not, ask which ref is the
   real base. Cache the name-status list.

2. **Classify scope** with the table above. Apply skip rules first. In the same pass, map changed
   projects to build targets (compile gate), decide **advanced vs standard**, and check whether any
   dependency was added. If advanced: announce it in one line, read `references/advanced-mode.md`, and
   follow its phases in place of steps 3-8. Steps 0-2 and step 9 are shared.

3. **Spawn the seats in parallel - one assistant message, several `Agent` calls.** Start the builds in
   the same message. Paste the full **Investigation method** into each prompt (sub-agents see only
   what you pass them). Each prompt:

   ```
   Read the reviewer rubric at <SKILL_DIR>/references/<seat>.md and review the diff
   <base>...HEAD against it. That file IS your rubric - read it before judging anything.
   Project rules to read first, they override the rubric: <paths, or "none found">.
   (Tests seat: the unit-test hard rule is blocking. Return the
   `Unit test rule: PASS | FAIL | N/A - <reason>` line first.)
   Diff name-status (already classified, do not redo): <paste>
   Investigation method (follow before judging changed lines): <paste all 9 points>

   You have WebSearch and WebFetch. Any claim about an external system or library - syntax,
   operators, status codes, paging, limits, version floors - must be checked against the
   vendor's own documentation and the URL cited. Do not infer a third party's contract from
   this repo's internal consistency. Uncited external claims go under Questions.
   Output: STRICTLY the orchestrator's contract - Severity / Action / Issue / Failure / Fix.
   A finding without a concrete Failure line is a Question.
   Rank by severity; never drop a high or med to stay brief. Skip low nits if long.

   Read-only: do not change the working tree, the index, HEAD or branch state. Use git show,
   git diff, git log. For another revision, `git worktree add` a temp dir. The orchestrator
   runs the builds; you do not.

   Do not dispatch subagents. You are one seat and you review your whole scope yourself. If
   the scope is too large for one pass, do several passes and say so.
   ```

   **Extra lines for the QA seat:**

   ```
   Retrieve the ticket and its comments with the project's tracker tool (see project rules:
   gh issue view, az boards work-item show, a Jira or Linear CLI or MCP server). The acceptance
   criteria are what you grade coverage against. If the project keeps working notes (plans,
   decisions) in a folder, read them; if that folder is gitignored, ripgrep skips it, so use
   `rg --no-ignore` or `grep -rn`. Diff each recorded decision against what the commit does - a
   shipped change that contradicts a decision is a `high` and no code seat can see it.
   Number findings Q-1, Q-2, ... The orchestrator runs the adversarial pass; you do not.
   Return, in order: impact map, requirement coverage, findings, test cases, what you could
   not reach.
   ```

   **Extra lines for the text seat:**

   ```
   Your scope is every string a human reads. Read each changed string in its rendered context
   - open the component, the resource file, the email template - because a label judged
   without its control is judged blind. Grep the repo for the existing term before proposing
   a new one; one concept, one word. Every finding carries the literal before -> after
   rewrite; a text finding without a rewrite is a Question. Return the
   `Text: PASS | FAIL - <reason>` line first, then findings, then the rewrite table as
   `file:line | before | after`.
   ```

   **The dependency seat** gets the base prompt plus the list of added packages per manifest and the
   project's distribution model from the project rules (closed-source SaaS, installed app, open
   source library). Without it, assume closed-source commercial software shipped to customers and
   say so.

4. **Collect, dedupe, merge.**
   - Same `(file, line, issue)` from two seats -> keep one, attribute to the owner per the split.
   - Anything about a missing or weak test -> the tests seat.
   - Anything about the wording of a user-visible string -> the text seat; carry its rewrite verbatim.
     Never paraphrase a proposed string.
   - If tests returned `FAIL`, its finding leads the list with any compile error; verdict `Not ready`.
   - Group by severity (high -> med -> low), then by file.

5. **Adversarial pass on the QA and text findings.** These two seats reason about consequences and
   readers rather than lines, so they are the most exposed to a confident error. Spawn **one fresh
   agent with no prior context** and give it the name-status diff, the acceptance criteria, the
   numbered `Q-n` findings, every `high` text finding with its rewrite, and:

   ```
   Two jobs, in order.

   1. REFUTE. For each numbered finding, try to prove it wrong. Open the files. A finding
      survives only if you trace the failing path end to end yourself. Return for each:
      CONFIRMED (cite file:line) / REFUTED (cite what disproves it) / UNPROVEN (name the
      step you could not verify). Default to REFUTED when the evidence is ambiguous.
   2. FIND WHAT WAS MISSED. Assume the first reviewer anchored on the changed files and the
      happy path. Look at: the untouched analogue branch (other integration, other party,
      other role), the second run of every create/persist flow, the second element of every
      collection, and the destructive path (delete / overwrite / cancel / rollback).

   Return findings in the Severity / Action / Issue / Failure / Fix shape. Do not restate
   confirmed findings as new ones.

   For text findings, judge the REWRITE as well as the complaint. A rewrite that is longer
   than its control, invents a term the app does not use, is wrong about what the code does,
   or reads as marketing is REFUTED even when the complaint was fair - say which half failed
   and propose the shorter true string.
   ```

   Merge honestly. REFUTED findings are **dropped**, with a one-line note in the report saying what
   disproved them - that tells the reader the report was checked. UNPROVEN drops to Hypothesis and
   never leads. New adversary findings join the list. When the adversary is right and you were wrong,
   say so plainly.

6. **Write the HTML report.** Copy `assets/report-template.html` to the report folder from the project
   rules, or by default `.reviews/<branch>/review.html` (suggest adding `.reviews/` to `.gitignore`).
   Fill the placeholders: `{{REF}} {{TITLE}} {{DATE}} {{BASE}} {{HEAD}} {{FILE_COUNT}}`,
   `{{SUMMARY_PARAGRAPH}}`, `{{IMPACT_ROWS}}`, `{{COVERAGE_ROWS}}`, `{{FINDINGS}}`,
   `{{N_HIGH}} {{N_MED}} {{N_LOW}} {{N_TESTS}}`, `{{REFUTED}}`, `{{TEST_CASES}}`, `{{FOOTER_LIST}}`,
   and delete the snippet comment at the end.

   `{{FINDINGS}}` carries code, QA **and** text findings as one ranked list. Append the text seat's
   rewrite table as its own block at the end, so the author applies every string change in one pass.
   The template is self-contained (inline CSS and JS, no CDN) because the file gets opened from disk
   and mailed around; keep it that way. Skip this step in `code-only` mode. Open the report for the
   user when done.

7. **Return the punch list.** Order by leverage, not by file: correctness and data loss, then
   security, then structure, then missed simplifications, then the rest. A report that opens with
   formatting teaches the author to skim.

   Open with **Strengths** - two or three specific things done well, with `file:line`. Not politeness:
   an author who sees the reviewer understood the change trusts the rest. Vague praise is worse than
   none.

   Then the summary line: counts per severity and action, files touched, seats run, project rules
   read, build result, verification line, how many findings the verify pass refuted.

   Close with a **merge verdict**: `Ready to merge` / `Ready with fixes` / `Not ready`, plus one or two
   sentences of reasoning. **A tests `FAIL` forces `Not ready`.** **A text `FAIL` forces at most
   `Ready with fixes`**, naming the failing strings as the fixes. End with a one-line **structural
   verdict**: does the diff leave the local architecture better, neutral or worse? A missed dramatic
   simplification, an unjustified file-size jump, special-case branches scattered across paths, or a
   hacky abstraction are presumptive blockers. "It works" is not approval when a smaller shape was
   clearly available.

   **Closure gate.** A `Not ready` verdict ends with a ledger, one row per `high` and `med`:
   `Id | Severity | Owner | State`, where State is `fixed` (commit), `posted` (PR thread), `asked`
   (link to the product owner question), or `deferred` (follow-up issue). A PR should not leave draft
   while a `med` or higher finding has no state. A report that stays on the local disk closes nothing.

8. **Append the blind-spot footer** (below), tailored to the diff.

9. **Comment mode only - post the survivors.** Stop and re-read the punch list first: you are about to
   write on someone else's work. Read `references/commenting.md` and follow it. It carries the 90%
   confidence gate, the independent re-verification agent, the comment budget, the
   Commentator / Severity / Concern format, the voice rules, and the per-host posting commands.

   - **Send:** `high` and `med` findings that survived the verify and adversarial passes, each with its
     `file:line` and concrete Failure line.
   - **Do not send:** Hypothesis or UNPROVEN items, anything without a Failure line, formatting nits,
     the Strengths section, the merge verdict.

   The flow confirms with the user before anything is posted. Do not pre-approve on their behalf. In
   every other mode, stop at step 8. Never post to a PR unless the user asked for comment mode.

## Blind-spot footer - append to every report

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

## Parallel execution rules

- Seats are stateless - never run them one after another.
- Wall-clock time = the slowest seat, not the sum.
- Do not pre-rank seats; they share no state and cannot yield to each other.

## Worked example

```
M  src/Api/Permissions/ReportAccessPolicy.cs
M  src/Domain/Accounts/ApiKey.cs
M  web/src/features/files/FilesTab.tsx
A  web/src/features/files/UploadFailureAlert.tsx
```

Routing: backend (server code), frontend (`web/`), architecture, tests and QA always; text (the new
alert has user-visible strings). No manifest changed, so no dependency seat. Six `Agent` calls in one
message, builds started in the same message.

```
Summary: 7 findings - 1 high, 4 med, 2 low. 4 files. Seats: backend, frontend, architecture,
tests, QA, text. Project rules: .claude/review-rules.md. Build: api OK, web not run (project rules).
Unit test rule: FAIL - ReportAccessPolicy change has no test.

### [Severity: high] [Action: Required] src/Api/Permissions/ReportAccessPolicy.cs:42
**Issue:** The check verifies the organisation only; the user id is never checked.
**Failure:** User B in the same organisation calls GET /reports/{id} for user A's private
report -> 200 with A's data.
**Fix:** Check the report owner's user id before the organisation match.
```

## Rationalizations this review does not accept

Applies to the reviewer's own reasoning as much as the author's.

| Rationalization | Reality |
|---|---|
| "It compiles / tests pass, so it is fine" | Necessary, not sufficient. They say nothing about the second element, the destructive path, or the requirement nobody implemented. |
| "The logic is trivial, no test needed" | The test rule has no size threshold. Trivial logic is what a one-line test pins cheapest. |
| "There are tests in that area" | Name the one that fails if this PR is reverted. |
| "AI wrote it, it is probably fine" | AI code needs **more** scrutiny. It is confident and plausible exactly where it is wrong. |
| "It is a small diff" | Small diffs still bolt a branch onto a shared path and still push a file past its size. |
| "The refactor makes it cleaner" | Moving complexity is not reducing it. Look for a branch that disappeared. |
| "It is pre-existing" | Never a reducer for authorization or data loss. Pre-existing and newly amplified is worse. |
| "I will clean it up later" | File it with an owner, or do it now. An unowned later is a no. |
| "The UI prevents it" | Presentation is not enforcement. One curl away. |
| "I will read the diff myself instead of dispatching seats" | You are the orchestrator. Reading inline burns the context you need to merge, dedupe and verify. |
| "It is only a label" | The label is what the user acts on, and persisted or API-visible names outlive the sprint. |
| "Everyone here understands the wording" | Everyone here wrote it. The reader never saw the code. |
| "Risky area, but the diff looks clean - standard is enough" | Criticality is about what the code touches, not how the diff reads. |
| "LGTM" | Not a review. If there is nothing, say what you checked and found sound, by name. |
| "Every sibling uses that form, so this one is wrong" | Internal symmetry says nothing about a third party's parser. Cite the vendor or ask. |
| "The notes say so" | AI-written notes are leads, not citations. |
| "The last verifier cleared it" | A clearance is a claim too. Re-read the source. |

## Honesty rules

- **Do not soften.** Calling a production bug a "minor concern" gets it deferred. Severity is a
  technical judgement, not a social one.
- **Do not pad.** A short accurate report beats a long one. Volume is not thoroughness.
- **Say what you did not check.** "UI flow not run", "did not open the export branch", "PLAUSIBLE,
  one step unread".
- **Accept an override gracefully** when the author has context you lack. Record it and do not
  re-argue next round - but still re-check an "accepted" item against the source each round.

## Disagreement hierarchy

1. **Technical facts and measurements** beat opinions, on both sides. A benchmark ends a perf
   argument; a repro ends a correctness one.
2. **The project rules** are the authority on style and convention - not the reviewer's taste, not
   the author's. If a rule is wrong, change the rules file.
3. **Design questions** are judged on engineering principle, with the smaller shape favoured.
4. **Consistency with surrounding code** wins ties, if it does not degrade health.

Justified pushback is fine. Seats and reviewers defend with reasoning (a perf rule waived only with a
measurement, a mapping exception where shared properties are intended). Do not silently change a
finding without engaging the question.

## Reference map

- `references/seat-architecture.md` - structure, business logic, authorization, cardinality,
  destructive paths, edge-firewall shapes, dependency discipline.
- `references/seat-backend.md` - server-side rubric with generic rules plus labelled .NET / EF Core
  rules; sync and backward-compatibility rules.
- `references/seat-frontend.md` - UI rubric with labelled React / TanStack Query / MUI rules, the UI
  fitness rubric and the UI conformance checklist.
- `references/seat-tests.md` - the unit-test hard rule and test quality.
- `references/seat-qa.md` - impact map, requirement coverage, defect hunt, test cases.
- `references/seat-text.md` - adversarial review of every shipped string.
- `references/seat-dependency-licence.md` - licence, price and redistribution of added packages.
- `references/advanced-mode.md` - deep mode phases, adversarial protocol, artifact spec.
- `references/external-rubrics.md` - the four external rubrics, pasted verbatim into agents.
- `references/commenting.md` - comment mode: gates, format, voice, GitHub / Azure DevOps / GitLab.
- `assets/report-template.html` - the self-contained HTML report.
- `assets/review-rules.template.md` - starting point for a project's `.claude/review-rules.md`.
