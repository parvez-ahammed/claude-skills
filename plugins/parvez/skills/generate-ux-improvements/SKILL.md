---
name: generate-ux-improvements
description: Use when asked to find UX gaps, usability problems, product polish, or pre-release rough edges in an existing application and turn them into tracked work. Also use for "audit the UX", "what should we fix before launch", "find usability issues", "file UX tickets", "polish the product", or when the app cannot be run locally and the UI must be judged from source.
---

# Generate UX Improvements

Fan out read-only UX auditors across an app, then file what survives as GitHub issues.

**Core principle: partition before you parallelise.** Auditors given the same app
independently converge on the same two or three loudest problems. Ten unpartitioned
agents return ten copies of "add pagination", not thirty findings. The orchestrator's
real job is carving the surface into disjoint territories.

## Arguments

`/generate-ux-improvements [--agents N] [--issues M] [--scope <area>] [--dry-run]`

| Flag | Default | Meaning |
|---|---|---|
| `--agents N` | 3 | Parallel auditors. One territory each. |
| `--issues M` | 3 | Issues per auditor. Total = N x M. |
| `--scope` | whole app | Restrict to one area, for example `checkout`. |
| `--dry-run` | off | Print the issues, file nothing. |

Bare invocation means 3 agents, 3 issues each, 9 issues. Plain-language counts count:
"use 10 subagents to find 30 issues" is `--agents 10 --issues 3`.

## Workflow

### 1. Ground yourself (orchestrator, before dispatching)

- Find the binding design system: `DESIGN.md`, `STYLEGUIDE.md`, a Figma export, or the
  design section of `CLAUDE.md`. Auditors skip this unless told to, then file issues that
  contradict house style.
- Inventory the routes, feature folders, and shared component layer.
- Check `gh repo view` works and that labels exist. Create missing ones.

### 2. Partition into N disjoint territories

Carve by **user journey**, not by file type. Each territory gets its own screens, its own
backing endpoints, and a one-line charter. Territories must not share a primary screen.

A reliable ordering for a CRUD-plus-pipeline product, take the first N:

1. First run, sign-in, empty states
2. The primary list or table surface
3. The dashboard and health
4. The main authoring or configuration flow
5. Connecting external accounts, OAuth, credentials
6. Debugging and observability, where users go when something broke
7. Rules, ordering, precedence
8. Settings, admin, roles
9. Accessibility and interaction states across everything
10. Trust, privacy disclosure, and interface copy

Territories 9 and 10 are cross-cutting on purpose: they read the same files as everyone
else but judge a different axis, so they do not collide.

**Assign every shared component to exactly one owner.** Disjoint screens are not enough.
The real collision vector is the shared layer: the table primitive, the empty state, the
toast helper. Whoever owns the table owns "add pagination"; everyone else may cite it as
evidence but may not make it the subject of a finding. Name the owner in every prompt.

**Verify the app is really down before telling agents it is.** One `curl` against the dev
server settles it. Agents told "the app cannot run" will not try, so a wrong assumption
here costs you the whole browser dimension.

### 3. Dispatch all N in one message

Every auditor prompt carries, in this order:

1. What the product is, in two sentences.
2. Read the design system file first. It is binding. Drift from it is itself a defect.
3. This territory's charter and its explicit file list.
4. Whether the app runs. If it does not, say so: audit by reading code, and every claim
   becomes a code-reading inference.
5. Read-only. Modify nothing. File nothing. Return findings only.
6. Research requirement: name 3 to 6 real comparable products and require at least 2
   verified patterns with URLs. Without named comparables, agents cite nothing.
7. Exactly M issues. Highest value first.
8. The output contract below, verbatim.

### 4. The output contract

Give auditors the shape of the answer, not a list of things to avoid. State it as a
recipe they fill in:

```
### ISSUE 1
title: <imperative, <=70 chars>
labels: ux, <area>, <p1|p2|p3>
area: <territory>
problem: <3-5 sentences, grounded in code>
evidence:
- <path:line> <what the code does>
- <path:line> <...>
why_it_matters: <user impact + comparable pattern with URL>
proposal: <scoped, names the files to touch, respects the design system>
acceptance:
- [ ] <verifiable>
- [ ] <verifiable>
effort: S|M|L
```

Severity: p1 blocks or badly confuses on a main path. p2 is real friction. p3 is polish
that raises perceived quality.

### 5. Triage, then file

When all agents report:

- **Dedup.** Same root cause from two territories becomes one issue crediting both.
- **Drop the unevidenced.** No `path:line`, no issue.
- **Demote feature requests.** "Polish what exists" is the brief. A proposal that invents
  a new surface is either rescoped or dropped.
- **Verify a sample.** Open 3 or 4 cited lines yourself. Auditors that cannot run the app
  occasionally misread control flow.
- File with `gh issue create --title ... --body-file ... --label ...`. Body files avoid
  shell-quoting damage from backticks and code blocks.
- Every body ends with a provenance line stating the audit did not run the app, so a
  reader knows to verify before implementing.

Report back: issues filed with numbers, what was merged, what was dropped and why.

## Quick reference

| Situation | Do this |
|---|---|
| App cannot run locally | Audit from source. Say so in every issue body. |
| App does run | Add a browser pass; screenshots beat prose. |
| No design system file | Say so; auditors judge internal consistency instead. |
| Not a git or GitHub repo | Run the audit, write a markdown report, offer to file later. |
| Fewer than N sensible territories | Reduce N. Say why. Do not split one screen in two. |
| User wants a specific count | N x M must equal it. Adjust M, not the partition. |

## Common mistakes

- **Dispatching without partitioning.** The one failure that wastes the whole run.
- **Letting the design system go unread.** Auditors call the house style a bug.
- **Unbounded output.** "M issues plus a few extras" defeats the dedup budget and collides
  across territories. M means M.
- **Research with no named comparables.** "Research best practice" yields zero citations.
  Name the products.
- **Filing everything.** Triage is the step that makes the issues worth reading.
- **Inlining issue bodies into `gh issue create --body`.** Backticks execute. Use `--body-file`.
