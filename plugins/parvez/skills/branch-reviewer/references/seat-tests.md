# Tests seat

Read the project rules the orchestrator passed you first. They override this rubric, and they name the
test stack, the test folders and any part of the codebase that has no test suite.

## The hard rule (blocking)

**A change in behaviour ships with a unit test in the same PR.** Not "there are tests in that area",
not "QA will catch it", not "I tested it manually", not "tests in a follow-up". A behaviour change with
no test is a `high` and the PR is **Not ready**, however clean the code is.

Behaviour change: a new branch, a changed condition, a new method with logic, a changed default, a new
validation rule, a bug fix, a changed query, a changed serialization, a new integration path, a
migration with a backfill. If the diff changes what the software *does* for any input, it needs a test
that pins the new behaviour.

**Exempt** - do not invent a test for these:

- Pure formatting, naming, comment and dead-code removal.
- Moved code with no behaviour change, where a test already covers the moved logic.
- Config, build files, IDE files, docs.
- Generated code and designer files.

**The one exception, declared, never assumed.** If the project rules say a part of the codebase has no
test suite (often the frontend), a change there is not blocked for lacking a unit test - but the PR
must record what was exercised and how (the click path, a screenshot, or "not run"). Silence is not the
exception. An untested change with no recorded verification is still `high`.

State the verdict in every report, also when it passes:

```
Unit test rule: PASS - <test name>:<line> fails if this PR is reverted.
Unit test rule: FAIL - <what changed> has no test.
Unit test rule: N/A  - formatting only.
```

## Stack

Review against the test stack and conventions the repo already uses (from the project rules, or from
the existing test projects). Do not import conventions from another codebase. Examples below use .NET
(xUnit + FakeItEasy + FluentAssertions); apply the same intent on Jest, Vitest, pytest, Go testing,
JUnit and so on.

## Scope

All test code, plus the *absence* of tests anywhere in the diff. You own the question "is this change
verified, and is the verification worth anything?"

## Ownership

| Topic | Tests | Backend | Architecture |
|---|:---:|:---:|:---:|
| Does a test exist for this change | x | | |
| Test asserts on a fake instead of a result | x | | |
| Fixture cannot express the failing case | x | | |
| Missing negative / boundary / second-element case | x | | |
| Test naming and placement | x | | |
| Non-deterministic or order-dependent test | x | | |
| Production code shaped so it cannot be tested | x | | x (seam design) |
| Naming / formatting in production code | | x | |
| Whether the production logic is correct | | | x |

When a finding is "this guard is wrong **and** untested", architecture owns the correctness call and
you own the coverage gap. Report the gap; do not restate their finding.

## Severity

- **high** - a behaviour change with no test; a guard on a destructive, authorization or data-loss path
  whose absence breaks no test; a bug fix with no regression test; a test that passes when the
  implementation is broken.
- **med** - happy-path-only coverage on a branch with a real failure mode; fake-only verification where
  a real assertion was available; a fixture that cannot express the negative case; a missing
  second-element case on a collection the diff touches.
- **low** - naming, arrange/act/assert clarity, duplicate setup, a loose assertion where an exact one
  was available.

## Read the tests before the implementation

What the tests assert tells you what the author believed the change does. The gap between that belief
and the diff is where the findings are.

## High-signal checks

### 1. Name the test that fails if this PR is reverted

The single most useful line you produce. Name it with `file:line`. "There are tests in the area" is not
an answer. If the honest answer is none, say so - that is the finding.

### 2. Assertions on real output, not on fakes

`A.CallTo(() => x.Foo()).MustHaveHappened()` (or `expect(mock).toHaveBeenCalled()`) proves the fake was
called. It proves nothing about what the code produced. At least one assertion per behaviour lands on a
returned value, a persisted row, or the composed request that goes on the wire.

Fake verification is legitimate for one thing: proving a call did **not** happen, or happened with an
argument that has no observable result. Even then a hand-written recorder that stores what it received
reads better and survives refactoring.

Order of preference: the wire (the exact composed URL or payload), the returned value, the persisted row.

### 3. A guard whose absence breaks no test is unverified

Flip it. Delete it. Invert the comparison. If the suite still passes, the guard is decoration.

Then the harder question: **can the fixture even express the failing case?** A suite that always
arranges the happy shape - the same organisation on both sides, the caller always on the acting side,
the collection always non-empty, the fetch always complete - makes the gap unobservable. Green suite,
open hole. Demand the negative test *and name the arrangement it needs*.

### 4. Every bug fix carries a regression test

No exceptions. The test must fail against the old code - say so, and say how you know.

### 5. Instantiate the second element

The highest-volume miss class shows up in tests as a fixture with exactly one of everything. For every
collection the diff touches, check the suite covers **two**: two records, two groups, two files sharing
a key, three rows where the middle one is removed. One-element fixtures pass for code that only ever
handles the first. Where the code handles several object types, list them by name and check each.

### 6. Destructive and authorization paths get the negative test first

For any delete, void, overwrite, backfill or permission check, "the happy path is covered" is not
coverage - the failure case *is* the feature. Demand: the caller on the wrong side, the read that came
back short, the list that arrived empty, the second write to the same location.

### 7. Tests that restate the implementation

A test that computes the expected value with the same expression as the production code passes whatever
the code does. Expected values are literals, or built by an obviously different route.

Same family: a test whose only assertion is not-null, does-not-throw, or a count. Assert the value.

### 8. Determinism

Flag current-time calls, new random ids, random numbers, sleeps and delays, real filesystem or network
access, and dependence on test order or state left by another test. Generated fixture data is fine;
generated values *inside an assertion* are not - pin the value you assert on.

### 9. Behaviour names, not method names

`Export_WithFilter_ReadsUnfilteredIdsFirst` beats `TestExport2`. The name says the arrangement, the
action and the expected result. A reader who sees only the failing name in CI knows what broke.

### 10. Coverage stops at the first integration

A change to one integration, provider or adapter usually has analogues in the others. Ask what the
siblings do and whether any are covered. A rule implemented twice and tested once will diverge.

### 11. New test project hygiene

A new test project is added to every build target that runs tests (solution, workspace, CI config), or
it never runs and nobody notices it rot. Its references and settings match a sibling test project
exactly; do not blend conventions from two siblings.

## Rationalizations this seat does not accept

| Rationalization | Reality |
|---|---|
| "It is covered by integration tests" | Name the one that fails on revert. If you cannot, that is the finding. |
| "It is too hard to test" | A finding about the production code's shape. Name the seam that would make it testable. |
| "The logic is trivial" | Trivial logic is exactly what a one-line test pins cheaply. |
| "I tested it manually" | Verified once, by one person, never again. Record it *and* add the test. |
| "Tests will come in a follow-up" | File it with an owner, or do it now. |
| "AI wrote the tests, they look fine" | AI-written tests are confidently shaped and often assert nothing. Read every assertion. |
| "Coverage is already high in that file" | Coverage counts lines run, not behaviour checked. A test with no assertion has full coverage. |

## Cross-review flag

If a test-quality problem appears once, find every instance and list them in one finding.

## Comments

Judge every added or edited comment in test files against **Comment quality** in `comment-quality.md`: a
one-line why on a non-obvious arrangement, never a paragraph. One finding per file.
