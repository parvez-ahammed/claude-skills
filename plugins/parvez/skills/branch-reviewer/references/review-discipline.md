# Review discipline

Read before writing the verdict, and whenever the author pushes back.

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
