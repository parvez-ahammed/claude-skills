---
name: platform-audit
description: Use when you want to find what could be made common, shared, or reusable across a milestone/phase/backlog of feature issues so features stop reimplementing the wheel, and want it done with software-engineering judgment (DRY, KISS, YAGNI, rule-of-three) rather than abstraction for its own sake. Produces a shared-platform design: the candidate common engines/primitives/UI, a verdict on each (build-now / narrow / resist), a cross-phase ownership check (what an earlier phase already owns so this one depends not rebuilds), and a build order. Invoke for "find common patterns", "what can be shared/reused", "make a platform layer", "are we reimplementing this", "decompose the milestone into shared + thin", "review for DRY across these issues".
---

# Platform Audit

## What this is for

A milestone of feature issues, read one at a time, hides the fact that most of them want the same
machinery (a generation engine, a provider call, a prompt, an upload, a filtered grid, an async
job). Built blind, each feature reimplements it, so you get N nightmares and N security surfaces.
This skill reads the whole set and proposes a **shared platform**: a small set of engines,
primitives, and UI the features *consume*, plus a thin layer per feature on top.

**Core principle:** features compose shared things and call a platform API; they do not rebuild
machinery. But shared is earned, not assumed. The output is only useful if it is honest about
which abstractions are worth it (DRY) and which would add complexity for little gain (KISS/YAGNI).

This is the structural lens over a groomed set of issues: where a summary tells you what the set
contains and grooming sharpens one issue, this decides what across the set becomes common.

## The two failure modes it must avoid

1. **Under-sharing** (the default): every feature owns its own copy. Catch with the rule of three.
2. **Over-sharing** (the seductive trap): a god-engine, a registry-of-one, a polymorphic
   everything-model, a framework where a function would do. Catch with KISS/YAGNI and by naming
   the simpler form. An audit that only ever says "yes, share it" is not credible.

## Inputs

A milestone title/number, a phase, a label, or an explicit issue list. Resolve to a concrete set
(`gh issue list --milestone "<title>" --json number,title`). Read the relevant bodies.

## Process

Run these as parallel read-only sweeps (dispatch agents when the set is large), then synthesize.

### 1. Find the candidate commons
Read the issues and look for the same capability described in >= 2 places under different names.
Sweep these recurring categories (adapt to the domain):
- **Engines:** a generation/processing pipeline, a provider/model gateway, a prompt/template
  assembler, a job/queue + streaming layer, an asset/storage service, a registry.
- **Primitives:** a hardened outbound fetch (SSRF), an upload validator, a cache wrapper, a
  cost/pricing table, a tenant/ownership scoping helper, a signer, an idempotency guard.
- **UI kit:** a filter/search/grid, an async-job hook, a gate hook, an estimate hook, a
  stat/KPI strip, a loading/empty/error/retry wrapper.

### 2. Cross-phase ownership check (the step people skip)
For each candidate, before proposing to build it, determine:
- Is it **already built** in the codebase (cite the file)? Often a sibling domain already has the
  primitive (`grep` for it) and the right move is to promote/reuse, not green-field.
- Is it **owned by an issue in another milestone/phase**? Re-sequenced milestones are the usual
  cause of drift: a piece sits in a phase that used to be earlier. If an earlier phase owns it
  (credit ledger, tenancy, auth), this milestone **depends on it**, it does not rebuild it.
- Or is it **truly unowned** new work this milestone must create?
Output: built-in-code / owned-by-#n-in-phase-X / unowned, with evidence.

### 3. Verdict per candidate (the judgment)
Score each against:
- **Rule of three:** >= 3 real consumers earns extraction now; 2 can wait.
- **DRY vs KISS:** does sharing remove real duplication, or just feel tidy?
- **YAGNI:** is the abstraction sized to today's need, or to an imagined future (a registry for
  one provider, a framework for one use)? Name the **simpler form** when it is over-built.
- **Coupling / scalability:** would sharing this force unrelated features to deploy in lockstep,
  leak a wrong key/tenancy, or trust the client for something the server must own? If so it is a
  bad seam; say what to do instead.
Verdict: **build-now** / **build-but-narrow** (with the narrowed scope) / **keep-per-feature**.

### 4. Build order
Topologically order the platform pieces so the shared layer exists before the features that
consume it. Pure utilities (no deps) first; the foundation issue (models/credit/queue) next;
engines that need the foundation after; the UI kit after the shell/components; features last.

## Output format

Always produce, in this order:

1. **Cross-phase table** - candidate | status (built-in-code <file> / owned-by-#n <phase> /
   unowned) | evidence. Lead with this: it prevents duplicate issues.
2. **Verdict table** - candidate | build-now / narrow / keep-per-feature | rule-of-three +
   DRY/KISS/YAGNI note | coupling risk | simpler form if over-built | 1-line rationale tied to a
   specific issue/file.
3. **What to resist** - the over-abstractions that would create a problem, and the simpler thing
   to do instead. This section is mandatory; an audit with no "resist" list did not do the work.
4. **Missed commons** - anything shared across >= 3 issues your list did not name.
5. **Build order** - the dependency-ordered sequence, naming which issues each piece unblocks.
6. (when authorized) **The platform spec + issues** - write a single platform doc (the SSOT), then
   create the build-first platform issues with `blocks` / `blocked-by` wired so feature issues
   depend on them, and fold foundation-level pieces (cost table, scoping, saga) into the existing
   foundation issue rather than spawning micro-issues.

## Quality bar

- Every "share it" and every "already owned" claim cites a real issue body or file, not memory.
- Honest split. If the milestone genuinely has little to share, say so; do not invent a platform.
- No new product scope. This audits structure, it does not add features.
- Name the simpler form whenever you recommend an abstraction. The KISS/YAGNI discipline is the
  point; without it this skill just manufactures frameworks.

## When NOT to use

- A single feature: nothing to share across, just build it.
- Ungroomed issues: the candidates will be vague. Groom the issues first.
- A request to summarise rather than restructure: that is a briefing, not an audit.
