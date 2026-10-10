# Ownership split - who reports what

Read by the orchestrator before dedupe (step 4 of `../SKILL.md`) and by every seat. Two seats that
report the same thing twice make the punch list longer and teach the author to skim it.

Backend and architecture read the same server code. This table says who owns what.

| Topic | Backend | Architecture |
|---|:---:|:---:|
| Object-mapper formatting and configuration style | x | |
| "Should this mapping exist at all?" / type-pair sanity | | x |
| Dead commented-out blocks, unused imports | x | |
| Comment necessity, language and structure (see `comment-quality.md`) | x | |
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
