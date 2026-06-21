---
name: grill-feature
description: >-
  Stand up a "grill room": independent, code-grounded agents that interrogate shipped features at
  the PROMISE level (does the real user-facing promise actually hold in the code, not "does it
  compile"), plus an optional CEO cost evaluator for unit economics. Each interrogator asks
  fundamental questions and ANSWERS them by reading the real code, then returns a verdict
  (BULLETPROOF / CRACKED / FAKE) with file:line evidence. Use whenever the request is to "grill"
  or pressure-test a feature, "is X actually ready / bulletproof", "can users really do Y" (e.g.
  publish to a third-party platform, download the export, does the stitch seam hold), audit
  promise-vs-reality across a codebase, interview features by reviewing code, make features
  bulletproof, or evaluate whether the cost/margin is too much. One feature (inline) or a whole
  release/phase (workflow sweep).
---

# Grill room

Interrogate features at the level that actually matters to a paying user: not "does the button
exist" but "does the promise behind the button hold". The answer comes from reading the real code,
never from the UI or from memory. Hidden or UI-gated features still count: judge the code.

Two roles run in the room:

1. **Feature interrogator** (one per feature). Asks 3-6 fundamental promise-level questions, then
   answers each from the code with `file:line` evidence, adversarially hunting for the gap between
   the claim and the implementation. Ends with a verdict.
2. **CEO cost evaluator** (one, cross-cutting; only for products with metered or paid actions).
   Reads the cost charged per paid action, any COGS/usage ledger, the external/provider calls
   invoked, and plan prices/entitlements, then computes per-action and per-plan margin and says
   plainly whether the cost is too much. Skip this role for a product with no per-action cost.

## The interrogation protocol

For one feature:

1. State the **promise**: the one-sentence thing the feature claims to do for a user.
2. Read the real code that backs it: follow the full call chain (entry point / route -> handler /
   controller -> service / business logic -> data layer), plus the relevant UI feature folder.
   Do not stop at the route.
3. Ask 3-6 questions at the right **altitude**. Good questions probe the promise, not the syntax:
   - Does the action actually reach the external system (publish actually hits the platform; the
     video is actually uploaded), or does it stop at our DB?
   - Is money/credit exact under retry and double-click (idempotent), and is a failure refunded?
   - Is tenant/owner isolation real (can account A read/mutate account B's rows)? Any IDOR?
   - What happens to an existing user with an expired token / a reconnect-required integration?
   - Is the persisted state real, or a no-op / stub / mock / fabricated number?
   - For configurable / AI features: is the config/override (model, settings, identity lock)
     actually USED at run time, or stored and ignored?
   - For multi-step media (stitching): does CONTENT continuity hold across the cut, or only format?
4. **Answer each question from the code**, citing `file:line`. No vibes.
5. Assign a verdict and list concrete gaps.

### Verdicts

- **BULLETPROOF** - the promise fully holds in the code, with evidence.
- **CRACKED** - it works but has a real gap or risk (un-refunded failure, weak isolation, an
  override that is stored but not applied, a seam that only holds at the format level).
- **FAKE** - the promise is not actually delivered: a stub, a mock, a no-op, or fabricated data.

Set `shipBlocker: true` when a gap would hurt a paying customer or lose money/data.

## Two ways to run

### One feature, inline (fast)

Dispatch a single read-only interrogator (the `Explore` agent fits) with the protocol above for the
one feature, and report its verdict. Use this for a "grill X" request about a single feature.

### A whole release/phase, as a sweep (the room)

Run the bundled workflow, which fans out one interrogator per feature plus the CEO cost pass and
synthesizes one report. Point `scriptPath` at the `room-workflow.js` shipped beside this skill
(in a plugin install, under `plugins/parvez/skills/grill-feature/room-workflow.js`; copy it into
your repo if you prefer a stable path):

```
Workflow({ scriptPath: "<path-to>/grill-feature/room-workflow.js" })
```

The shipped `FEATURES` array is a worked EXAMPLE. Replace it with your own `{ id, area, name,
promise, hints }` entries before launching, and drop the CEO cost pass if your product has no
per-action cost. The workflow runs in the background and returns `{ counts, interrogations, cost,
report }`. **Write the `report` to a dated file** (e.g. `docs/reviews/grill-<scope>-<date>.md`) so
stakeholders have the artifact (pass the date in, the workflow cannot read the clock).

The workflow is the deterministic engine; this skill is the protocol and the verdict bar. Keep the
interrogators read-only and code-grounded, keep the CEO pass (when used) tied to real `file:line`
cost evidence, and never soften a verdict to be polite: a CRACKED called BULLETPROOF is the one
outcome that makes the room worthless.
