---
name: branch-reviewer
description: >-
  Multi-seat code review of a branch, diff or pull request. Six parallel reviewer seats
  (backend, frontend, architecture, tests, QA, text) review against their own rubrics, plus a
  dependency seat that runs only when the diff adds a library and reports its licence, commercial-use
  terms and price. Findings go through a refutation pass and end as one
  severity-ranked punch list plus a self-contained HTML report. Use for "review my PR", "review this
  branch", "code review", "audit this branch", "what will be flagged", "second opinion on my
  changes", "QA this PR", "what should be tested", "what regressions could this cause", "write test
  cases for this branch". Say `advanced` ("deep review", "full review before PR") for four extra
  external rubrics, an adversarial round and an HTML artifact; it also starts on its own for critical
  work (data sync, migrations, auth, background jobs, destructive paths). Say `comment` ("review PR
  123, comment mode") to post re-verified findings to GitHub, Azure DevOps or GitLab.
when_to_use: >-
  Also for "post these findings to PR 123" when the findings already exist (comment-only mode), and
  for "code review only" or "QA only" passes. Use it even on small or "trivial-looking" PRs: many
  recurring review hits come from PRs the author thought were tiny. Not for testing a running app
  (use qa-ux) or for judging whether a shipped feature keeps its promise (use grill-feature).
argument-hint: "[PR number | branch] [advanced] [comment]"
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

Backend owns micro / hygiene, architecture owns macro / structure. Tests own anything about whether a
change is verified. QA owns what a user experiences, what the ticket asked for, and what breaks in
files the diff never touched. Text owns the words. The full table is in
`references/ownership-split.md`; read it before step 4 (dedupe). When one finding maps to two axes,
architecture wins, shown once at the higher severity.

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

### Hard rules and severity floors (blocking)

Four rules hold whatever the diff size. The full text, with the real failures behind each, is in
`references/severity-floors.md`; every seat reads it.

- **External-system claims need a vendor citation.** A claim about a third party's syntax, operators,
  status codes, limits or contract cites the vendor's own documentation, or it is a Question.
  Internal symmetry says nothing about someone else's parser.
- **Unit tests are mandatory.** A behaviour change with no test in the same PR is `high` / Required
  and the verdict is **Not ready**. Every report carries `Unit test rule: PASS | FAIL | N/A - <reason>`.
- **Authorization gaps are floored at `high`**, rated on API reachability, never UI reachability.
  "The UI hides it" and "it is pre-existing" are context lines, never reducers.
- **Silent data loss is floored at `high`.** The tell is deletion by absence: code that treats "not in
  this list" as "gone at the source".

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
reads code accepts the author's verification as given, and that is how "it compiles" reaches QA. The
tests seat answers five questions (listed in `references/severity-floors.md`, the first being "which
test fails if this PR is reverted?") and the orchestrator carries the answers into the summary
without re-deriving them. Each unanswered one is a `high`.

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

There is no comment seat: a comment can only be judged next to the code it sits above. Every seat
judges each added or edited comment on necessity, language (Simplified Technical English) and
structure, with `references/comment-quality.md`. Comment findings are grouped per file, never one
per line. A deleted comment that carried a safety reason is `med` / `Required`.

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
   three times running because each fix handled one more object type (the first type, then a
   second, then a third) and nobody wrote the list down.
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
   to an absolute path (`${CLAUDE_SKILL_DIR}`, or the folder that holds this `SKILL.md`) and check:

   ```bash
   SKILL_DIR="${CLAUDE_SKILL_DIR}"   # if empty: the absolute path of the folder holding this SKILL.md
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
   what you pass them). Read `references/seat-prompts.md` for the base seat prompt and the extra
   lines for the QA and text seats. Every seat reads its own rubric by absolute path, plus the
   project rules, `references/severity-floors.md`, `references/ownership-split.md` and
   `references/comment-quality.md`. Seats are stateless, so never run them one after another:
   wall-clock time is the slowest seat, not the sum.

   The **dependency seat** gets the base prompt plus the list of added packages per manifest and the
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
   agent with no prior context** with the adversarial prompt in `references/seat-prompts.md`. It
   refutes each numbered finding, looks for what the seats missed (the untouched analogue branch, the
   second run, the second element, the destructive path), and judges each text rewrite as well as
   the complaint.

   Merge honestly. REFUTED findings are **dropped**, with a one-line note in the report saying what
   disproved them - that tells the reader the report was checked. UNPROVEN drops to Hypothesis and
   never leads. New adversary findings join the list. When the adversary is right and you were wrong,
   say so plainly.

6. **Write the HTML report** from `assets/report-template.html`, as `references/report-output.md`
   describes (default location `.reviews/<branch>/review.html`). Skip this step in `code-only` mode.
   Open the report for the user when done.

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

8. **Append the blind-spot footer** from `references/report-output.md`, tailored to the diff: this is
   a static review, so name what it cannot see (run-only behaviour, missing requirements, edge
   firewall).

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

## Rationalizations and disagreements

`references/review-discipline.md` lists the rationalizations this review does not accept (they apply
to the reviewer's own reasoning as much as the author's) and the order that settles a disagreement:
facts and measurements, then the project rules, then engineering principle, then consistency with
surrounding code. Read it before writing the verdict, and whenever the author pushes back.

## Honesty rules

- **Do not soften.** Calling a production bug a "minor concern" gets it deferred. Severity is a
  technical judgement, not a social one.
- **Do not pad.** A short accurate report beats a long one. Volume is not thoroughness.
- **Say what you did not check.** "UI flow not run", "did not open the export branch", "PLAUSIBLE,
  one step unread".
- **Accept an override gracefully** when the author has context you lack. Record it and do not
  re-argue next round - but still re-check an "accepted" item against the source each round.

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
- `references/severity-floors.md` - vendor citations, the unit-test rule, authorization and data-loss
  floors, the verification questions. Every seat reads it.
- `references/ownership-split.md` - who reports what; read before dedupe. Every seat reads it.
- `references/comment-quality.md` - how every seat judges code comments.
- `references/seat-prompts.md` - seat and adversarial prompt templates, plus a worked example (step 3).
- `references/report-output.md` - filling the HTML report and the blind-spot footer (steps 6 and 8).
- `references/review-discipline.md` - rejected rationalizations and the disagreement hierarchy.
- `assets/report-template.html` - the self-contained HTML report.
- `assets/review-rules.template.md` - starting point for a project's `.claude/review-rules.md`.
