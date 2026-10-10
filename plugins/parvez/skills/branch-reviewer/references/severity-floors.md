# Hard rules and severity floors

These rules hold on every review, whatever the diff size. Every seat reads this file. A floor is a
minimum severity: context goes in the finding body, it never lowers the rating.

## External-system claims need a vendor citation, not an inference (blocking, `high`)

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

## Unit tests are mandatory (hard rule)

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

## Severity floor for authorization findings (non-negotiable)

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

## Severity floor for silent data loss (non-negotiable)

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

## Verification review - what did the author actually run? (blocking, `high`)

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
