# Scored-precondition format (shared schema)

Every pattern entry (and every refactoring entry) in the spoke skills uses this fixed
shape. It is the mechanism that turns "should I apply this pattern" from taste into a
checkable decision.

```markdown
### <Pattern or Refactoring name>
intent: <one line: what it accomplishes>

opportunity signatures (what to grep for in code):
  - <structural signal a detector or spoke can find>
  - <another signal>

preconditions (scored, weight in []):
  [3] <strong signal that this is a genuine fit>
  [2] <supporting signal>
  [1] <weak / corroborating signal>
threshold: >= N   (and at least one [3] or two [2])

anti-indicators (any present -> hard veto, REJECT):
  - <condition under which the pattern is wrong here>

cost: <complexity the pattern adds: indirection, classes, ceremony>
language notes: <cases where a language idiom makes it redundant -> downgrade>
evidence required: cite file:line for each matched precondition.
verdict: APPLY | CONSIDER | REJECT  + one-line why
```

## Scoring rules

1. Match each precondition against the code. A precondition counts only if you can cite a
   concrete `file:line` as evidence. Unsupported preconditions score 0.
2. Sum the weights of the matched preconditions.
3. Check anti-indicators first. If any anti-indicator is present, the verdict is REJECT,
   regardless of score. The veto is absolute.
4. Otherwise:
   - score >= threshold AND the anchor rule is met (at least one [3], or two [2]) -> APPLY.
   - score close to threshold but missing the anchor, OR cost outweighs the problem on
     small/stable code -> CONSIDER (with a YAGNI note).
   - score below that -> REJECT.
5. Apply language notes last: if the target language makes the pattern redundant (e.g. a
   module-level singleton, a built-in iterator protocol, first-class functions standing in
   for a one-method Strategy), downgrade one verdict step and say why.

## Why each rule exists

- Evidence requirement kills hallucinated fit: you cannot claim a precondition you cannot
  point at.
- Hard veto stops pattern-for-pattern's-sake: a tempting score never overrides a structural
  reason the pattern is wrong.
- Three verdicts (not two) preserve the honest middle: "plausible but not yet worth it".
- Language notes keep the advice idiomatic instead of dogmatically OO.
