# Advanced mode - deep multi-rubric review

A wide review followed by a **narrowing** one. Breadth comes from many rubrics that do not share a
blind spot; credibility comes from an adversarial round that tries to kill every finding before it
reaches the author. On the run this playbook was built from, **six of the ten strongest findings did
not survive refutation** - including the only claimed Critical. Skipping the adversarial round does
not save a third of the cost; it spends the author's time instead of yours.

The deliverable is one HTML artifact, not a wall of terminal text.

Advanced mode replaces steps 3-8 of the standard flow in `../SKILL.md`. Comment mode (step 9) still
applies on top when the user asked for both.

## Phase 0 - Scope and integrity (before promising anything)

**0.1 Resolve the base explicitly, and never pass a bare SHA to a sub-agent.**

```bash
DEFAULT=$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's#^origin/##')
git fetch origin "$DEFAULT" --quiet
BASE=$(git merge-base HEAD "origin/$DEFAULT")   # origin/<default>, not the local branch - it is usually stale
git log --oneline "$BASE"..HEAD | head -50
git diff --stat "$BASE"..HEAD | tail -3
```

A stale local base produces a diff full of other people's merged work. Check that the commit list
looks like *one* piece of work; if not, ask the user which ref is the real base. Use the project rules'
base branch if they name one.

> **Trap.** A sub-agent handed `<sha>` with no framing reviewed *that commit* instead of using it as a
> baseline, and returned a confident report on the wrong code. Always write
> `base origin/<default> = <sha>` and `review <sha>..HEAD` in every prompt. Never the SHA alone.

**0.2 Pre-dump the diff** so ten agents do not each re-run git:

```bash
S="<session scratchpad or a temp folder>"
git diff "$BASE"...HEAD -- . \
  ':(exclude)*.Designer.cs' ':(exclude)*package-lock.json' ':(exclude)*pnpm-lock.yaml' \
  ':(exclude)*yarn.lock' ':(exclude)*.min.*' ':(exclude)*.snap' > "$S/feature.diff"
wc -l "$S/feature.diff"
```

Exclude generated files (ORM migration snapshots and designer files can be thousands of lines of
noise). Tell agents when the diff is mostly additions: they must **read whole current files** for
anything substantial, because the diff of a new 900-line file shows no context.

**0.3 Check the seat rubrics load** - the same gate as step 0 of the standard flow. Pass each agent the
**absolute path** of its rubric and have it read the file. Record which seats ran. A seat that silently
reviewed without its rubric is worse than one that did not run, because it looks like it worked.

**0.4 Establish ground truth yourself before the agents report.** Ten minutes here kills a predictable
class of false positive and gives you the standing to judge later. At minimum: which apps or hosts
register the thing being changed; whether a new table has an index, a retention story and a reversible
migration; what the authorization surface of the changed endpoints actually is.

## Phase 1 - Parallel review (one message, many `Agent` calls)

Two families, launched together. Do not run them one after another.

### Family A - the seats

Route by the scope table in `../SKILL.md`. **Architecture, tests, QA and text always run.** Each prompt
carries, pasted in full (sub-agents see only what you pass):

- the base framing from 0.1 and the diff path from 0.2,
- the absolute path to the seat's rubric, with an instruction to read it first,
- the paths to the project rules, which override the rubric,
- the **Investigation method** from `../SKILL.md` - all 9 points,
- the **Output contract** (Severity / Action / Issue / Failure / Fix),
- the shared rules by path: `severity-floors.md` (authorization rated on **API** reachability, never
  UI; silent data loss likewise), `ownership-split.md` and `comment-quality.md`.

### Family B - external rubrics

Four rubrics that fail differently from the seats. Full text in `external-rubrics.md`; paste the
relevant one into each agent rather than having it fetch.

| Agent | Lens | Catches what the seats miss |
|---|---|---|
| Structural | Restructurings that *delete* complexity; 1k-line ceiling; scattered special cases | Duplication at the scale of "18 files repeat this block" |
| Standards + spec | Two axes reported **separately**: repo conventions vs the feature's own docs | Comment-policy violations; docs that describe code that does not exist |
| Five-axis | Correctness, readability, architecture, security, performance | Systematic security sweeps; lifecycle and concurrency |
| Production | Migration strategy, rollout, kill switch, retention, backward compatibility | Operational gaps no code-shaped rubric asks about |

Give the production agent permission to **run the builds and test suites** (unless the project rules
forbid it) and report real numbers. One agent doing this beats four each spending ten minutes on the
test runner.

### Rules for every Phase 1 agent

- **Report only what you verified. Mark uncertain findings uncertain.** Say this explicitly; it
  measurably reduces invention.
- Cite the `file:line` you actually opened.
- Hand missing tests to the tests seat and wording to the text seat.

### When an agent dies

API or stream errors on long agents are common. **Resume it with `SendMessage`, do not relaunch** - a
relaunch pays for the whole investigation again. Tell it to finish from where it stopped, and give it
what other agents have since verified, so it spends its remaining budget on new ground.

## Phase 2 - Adversarial round (never skip)

Collect every `high`, plus any finding whose failure scenario rests on a file the reporter did not
open. Launch one **refutation agent** (two if the list is longer than ~12).

### Prompt template - refutation sweep

> You are an ADVERSARIAL VERIFIER in `<repo>` (branch `<branch>`, base `origin/<default>` `<sha>`).
> Several reviewers produced findings on `<feature>`. **Your job is to REFUTE them.** Default to
> "refuted" when the evidence is not clear. Do not be agreeable - a reviewer sounding confident is not
> evidence. Read the actual code for every claim.
>
> For EACH numbered claim return:
> - **VERDICT** - CONFIRMED / PARTIALLY CONFIRMED / REFUTED
> - **Evidence** - the exact `file:line` you read
> - **Severity after mitigations** (if confirmed) - the real-world severity *after* accounting for what
>   the reviewer may have missed: guard tests, unreachable call paths, callers that never hit it, a
>   check one layer up, a global contract that already covers it.
>
> A claim that an earlier verifier marked "clean" or "confirmed" is still a claim. Re-read the source.
> Be rigorous and concise. No preamble.

### Writing the claims

- **One claim per number**, stated as the reviewer stated it, including its severity words. Do not
  soften it; you are testing the claim as made.
- **Name the files to open.** "Check X, Y and Z" turns a vague audit into a bounded task.
- **Ask the second-order question**, which is where the value is:
  - not "is this a bug" but "what does it reach" - can it lose data, or only add noise?
  - not "is it missing" but "is it redundant" - does another mechanism already cover it?
  - not "is it reachable" but "construct the reachable path or declare it unreachable".
- **Take the known-refuted off the table.** If you verified something yourself in Phase 0, say so; do
  not spend the adversary's budget re-deriving it.

### A dedicated agent for any claimed Critical

A single Critical is worth its own agent with one question and a **three-way** verdict, because
"unresolved" is a legitimate and useful answer:

> **VERDICT:** one of "NO - here is what is actually there" / "YES - here is the exact path" /
> "UNRESOLVED - here is precisely what a human must confirm, and who would know".
>
> Do not guess. If the shape is `dynamic`, `object`, a string-to-string dictionary or otherwise
> open-ended so that any caller could put anything in it, **say so explicitly** - that is a real answer.

Require it to state what *is* there - the actual property names, the actual call sites. A "no" backed
by an enumerated list is worth ten bare "no"s.

Also ask for **reach, not only true/false**. "Confirmed" is much less useful than "confirmed, but only
under the same request and context, and it only ever adds entries, so nothing is lost".

### Adjudicating

You are the reviewer of record; the adversary is not automatically right either.

- Spot-check the refutations that carry the most weight against the code yourself.
- Where a rubric and the adversary disagree, **the one who quotes the file wins**.
- An adversary that refutes everything is as broken as a reviewer that confirms everything. If nothing
  survives, re-read its evidence before believing it.
- Keep **PARTIALLY CONFIRMED** as a real outcome. Most good findings land here: the mechanism is real,
  the consequence was overstated. Report both halves.

### What refutation reliably finds

| Pattern | Typical reviewer claim | What refutation usually finds |
|---|---|---|
| Runtime claim inferred from structure | "this silently drops X" | only one implementer exists; the branch is unreachable |
| Missing-guard claim | "nothing prevents Y" | the guard is one layer up, or a query filter covers it |
| Unbounded-query claim | "loads the whole table" | bounded by a per-account id set in single digits |
| Doc-vs-code contradiction | "violates the immutability guarantee" | the code is right and the *sentence* is wrong - fix the doc |
| Latent-overflow claim | "can exceed the column and fail the save" | no reachable call site; real, but a one-line insurance fix |
| Multi-host coverage gap | "host Z misses the registration" | host Z never touches that context |

Record every refutation with its evidence and carry it into the artifact's **Refuted - do not
re-raise** section. That section stops the next reviewer, human or model, re-deriving the same dead end.

## Phase 3 - The artifact

Publish **one HTML artifact** with the `Artifact` tool when the environment has one (load an
artifact-design skill first if one is available). Otherwise write a self-contained HTML file in the
report folder, reusing the CSS of `../assets/report-template.html`, and open it.

### Treatment

Utilitarian and technical, not editorial. The reader is the engineer who wrote the branch: they scan
for what to do, then read the evidence for the items they doubt. Optimise for scanning, and make every
claim traceable to a `file:line`.

- **A ledger, not an essay.** Each finding is a record: severity stripe, id, title, verdict chip, prose,
  a `Fix` line, and an evidence footer in monospace.
- **Stable ids** (`P-1`, `M-3`, `T-2`, `Q-5`, `R-4`) so the chat message, the PR discussion and the
  artifact refer to the same thing.
- **Semantic colour separate from the accent.** Blocking / fix / quality / refuted each get their own
  stripe.
- **Monospace carries the evidence** - paths, line numbers, counts with tabular numbers.
- Wide tables get their own `overflow-x: auto` container.

**Title:** name the branch or feature, not the genre. "Audit log: branch review", not "Code Review
Report".

### Required structure

1. **Masthead** - branch, base SHA, file and line counts. One paragraph with the honest headline,
   including how many findings the adversarial round killed.
2. **Verdict board** - the verdict in one line, two short paragraphs (what holds / what is missing), and
   a tally strip: Before prod - Before merge - Test gaps - Quality - Refuted.
3. **Findings grouped by what the author must do**, never by which agent found them:

| Section | Contains |
|---|---|
| Blocking for production | Ship-stoppers that are *not* merge-stoppers. Say which is which. |
| Fix before merge | Small bounded corrections that survived refutation. |
| Test gaps | Untested invariants, ranked by the cost of silent failure. |
| Text and UI copy | The text seat's before -> after rewrites, to apply in one pass. |
| Quality - not blocking | Structural work worth scheduling. Highest leverage first. |
| **Refuted - do not re-raise** | Every killed claim, with the evidence that killed it. |
| What is genuinely good | Specific, with `file:line`. Tells the author what to keep. |
| How this review was run | Seats that ran, seats that did not and why, project rules read, what the adversarial round did. |
| Verified state | Build and test numbers from actual runs, or "not run". |

### Per-finding shape

```
[id]  [title]                                   [verdict chip]
      What is wrong, in plain prose.
      Adversarial correction, when the round changed the severity - what was
      claimed and what survived.
      Fix: the concrete corrective.
      evidence: file:line - file:line - supporting fact
```

**Show downgrades.** When the round demotes a finding, keep both halves visible. A report that shows only
survivors looks like it never had a false positive, and the author calibrates trust on that.

**The Fix line is mandatory** in the blocking, fix and test-gap sections. A finding without a corrective
is an observation.

### Footer

Change sizing: how many reviewable PRs this branch really was, and what that cost. Connect an oversized
branch to a concrete consequence ("this is plausibly why the two most valuable guard tests are missing")
rather than asserting it.

### Publishing

- Keep the favicon and file path stable across republishes of the same review, so the URL holds.
- A follow-up review after fixes is a new artifact; the original records what was found before.

## Honesty rules specific to this mode

All standard honesty rules apply. Advanced mode adds:

- A seat that did not run is named in the artifact. Never imply coverage you did not have.
- If you refute more than half of one agent's `high` findings, say so - a signal about its prompt.
- **Also say it in chat.** Finish with the verdict, the two or three things that matter, and anything
  that did not run. The artifact is the reference; the message is the answer. Do not make the user open
  the artifact to learn whether their branch is in trouble.
