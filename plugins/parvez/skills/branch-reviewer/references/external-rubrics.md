# External review rubrics

Four lenses that fail differently from the seats. Paste the relevant block into the agent prompt
verbatim - do not have the agent fetch these at runtime (sources move, and a fetch costs a round trip
per agent).

Sources these were adapted from (public skill repos):
- Structural - `cursor/plugins` -> `cursor-team-kit/skills/thermo-nuclear-code-quality-review`
- Standards + spec - `mattpocock/skills` -> `skills/engineering/code-review`
- Five-axis - `addyosmani/agent-skills` -> `skills/code-review-and-quality`
- Production - `obra/superpowers` -> `skills/requesting-code-review/code-reviewer`

---

## A. Structural ("code judo")

> **Core mandate:** a rigorous audit of STRUCTURAL quality, not surface fixes. Actively hunt
> restructurings that keep behaviour while simplifying dramatically.
>
> **Non-negotiable standards:**
> 1. **Structural ambition** - hunt for removing whole branches, layers, conditionals. Prefer solutions
>    that feel inevitable in hindsight.
> 2. **File size** - a file moving from under 1k lines to over 1k is a strong smell; require
>    decomposition. Flag new files near 1k too.
> 3. **No spaghetti** - ad-hoc conditionals scattered into unrelated flows are design problems, not
>    style quirks.
> 4. **Design over acceptance** - do not rubber-stamp "it works" if it leaves the codebase messier.
>    Prefer removing pieces over moving complexity around.
> 5. **Direct, boring code** - flag brittle, magical or ad-hoc behaviour; thin abstractions and identity
>    wrappers that add indirection without clarity.
> 6. **Type and boundary cleanliness** - question unnecessary optionality, casts, `any`/`unknown`,
>    loosely shaped ad-hoc objects.
> 7. **Canonical logic placement** - feature logic leaking into shared paths; bespoke helpers
>    duplicating canonical utilities; code in the wrong layer.
> 8. **Atomic orchestration** - needlessly sequential async flows; designs that leave state partly
>    applied.
>
> **Preferred remedies:** delete indirection rather than polish it; reframe state models so conditionals
> disappear; turn special cases into simpler defaults; replace condition chains with typed models;
> separate orchestration from business logic; reuse existing canonical helpers.
>
> **Tone:** direct and serious about quality; uncompromising on maintainability, not rude.
>
> **Priority order:** (1) structural regressions (2) missed dramatic simplifications (3) spaghetti and
> branching growth (4) boundary, abstraction and type-contract clarity (5) file size and decomposition
> (6) modularity (7) legibility.
>
> For every finding: title, exact `file:line`, what is wrong, why it matters, and the concrete
> restructuring proposed (code sketch where useful). End with presumptive approval blockers.

**Why it earns a seat:** the only lens that reliably counts duplication at scale - "18 files repeat this
25-line block", "ten cloned resolvers awaited one after another". Per-file reviewers never see it.

**Its typical false positive:** severity inflation on shape problems, and confident runtime claims
inferred from structure. Send its `high` findings to the adversary first.

---

## B. Standards + spec (two axes, reported separately)

> Review on two axes and report them under separate headings - **never merge or re-rank across axes**.
> A change can pass one and fail the other: perfect code implementing the wrong thing, or correct
> output that breaks conventions. Separate reporting stops one from hiding the other.
>
> **Standards axis.** Gather the repo's own standards and cite them by name:
> - the project `CLAUDE.md` / `AGENTS.md` and `.claude/review-rules.md`
> - the user's global `CLAUDE.md`, including any comment policy
> - the feature's own documentation
> - any `.claude/rules/*.md` covering changed files
> - the Fowler baseline (Refactoring, ch. 3): Mysterious Name, Duplicated Code, Feature Envy, Data
>   Clumps, Primitive Obsession, Repeated Switches, Shotgun Surgery, Divergent Change, Speculative
>   Generality, Message Chains, Middle Man, Refused Bequest.
>
> Documented repo standards **override** the Fowler baseline. Skip anything a linter or compiler already
> enforces. Separate HARD VIOLATIONS (quote the standard's text) from JUDGEMENT CALLS.
>
> **Spec axis.** Derive intent from the ticket, commit messages, the feature's documentation, and the
> `CLAUDE.md` section on the subsystem. Report: (a) missing or partial requirements, (b) scope creep -
> behaviour nobody asked for, (c) requirements implemented incorrectly. Quote the lines you test
> against. If no spec exists, say "no spec available" rather than inventing one.
>
> Close with a one-line summary per axis naming the worst issue in each.

**Why it earns a seat:** the only lens that reads the feature's *own documentation* against the code. It
has found a doc that referred throughout to an enum that appears zero times in the codebase, and a
comment carrying a security reason that a later comment-trimming commit had deleted.

**Add when the project has audit logging or serializers:** have it run a **secret-field sweep** - list
every audit profile, serializer and DTO and check that anything holding a secret, key, token, password
or connection string is redacted or excluded. Name the sweep in the prompt or it gets done shallowly.

---

## C. Five-axis

> Walk every significant file through all five axes:
>
> 1. **Correctness** - spec alignment, edge cases, error paths, off-by-one, races, lifecycle and
>    re-entrancy, concurrency and ambient-state safety.
> 2. **Readability and simplicity** - naming, control flow, nesting, dead code, repeated conditionals
>    that signal a missing model.
> 3. **Architecture** - pattern consistency, module boundaries, dependency direction, feature logic in
>    shared modules, complexity moved vs reduced.
> 4. **Security** - input validation, secret handling, auth checks, isolation between accounts,
>    parameterized queries, output encoding, external data treated as untrusted.
> 5. **Performance** - N+1, unbounded loops, sync work that should be async, missing pagination, index
>    coverage vs the real query predicates, payload size, re-render cost.
>
> **Review tests first**: do they exist, do they check behaviour rather than implementation, do they
> cover edge cases, and - most useful - *which of the correctness risks above are untested?*
>
> **Severity labels:** `Critical:` (blocks merge - security flaw, data loss, broken function), no prefix
> = required before merge, `Consider:`, `Nit:`, `FYI`.
>
> Each finding: `file:line`, the concrete failure scenario (inputs/state -> wrong outcome), the fix. End
> with a verdict and a note on change size.

**Why it earns a seat:** the systematic sweep. It enumerates all N profiles, handlers or branches and
checks each, instead of sampling. Give it the security axis first and tell it to spend its budget there.

---

## D. Production readiness

> Act as a senior reviewer. **Read-only** - `git show`, `git diff`, `git log`. Never change HEAD or the
> working tree. Do not dispatch subagents. Work in several passes if the diff is large, and say so.
>
> Evaluate plan alignment, code quality, architecture and testing - then weight **production
> readiness** heavily:
> - **Migration strategy** - reversible? Does the down migration drop cleanly? Table-lock or long-run
>   risk on a large existing database? Column types and sizes sane? Indexes present and matching the
>   queries?
> - **Backward compatibility** - does this change the behaviour of *existing* paths? Can a failure in
>   the new code break an unrelated user operation? What happens if the new table is missing or a
>   registry throws?
> - **Data growth and retention** - is there a cap, prune or retention story? Who deletes this, ever?
> - **Rollout** - feature flag? Can it be turned off without a deploy? **Multiple hosts**: list every
>   app that builds the affected context or registers the affected service; one that misses it silently
>   loses data, one that registers it twice duplicates it.
> - **Observability** - if it breaks silently, what signal tells anyone it has stopped working?
>
> Report as: **Strengths** (specific, with `file:line`) / **Issues** tiered Critical / Important / Minor,
> each with file:line, what is wrong, why it matters, how to fix / **Recommendations** / **Assessment** -
> Yes | No | With fixes, plus one or two sentences of reasoning.
>
> Do not rubber-stamp. Do not mix nitpicks with critical issues. Do not comment on code you did not read.
> No vague language, no hedged verdict.

**Why it earns a seat:** it asks what no code-shaped rubric asks. On the run this playbook was built
from, the two real ship-blockers - an unbounded table with no prune, and no kill switch - came from this
seat alone; every other rubric missed both while reading the same files.

**Give this seat the build and test runs.** Its report gains the most from real numbers, and centralising
the runs here saves the other three from repeating them.
