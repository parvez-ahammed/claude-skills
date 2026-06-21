---
name: code-smell-detector
description: Detect code smells in a file, function, or directory and map each to candidate fixes. Use when the user wants to find what is wrong with code, "find code smells", "review this for quality", "what should I clean up here", or as the first step of a vague "refactor this" / "improve this" request. Covers the 22 refactoring.guru smells across five groups (Bloaters, Object-Orientation Abusers, Change Preventers, Dispensables, Couplers). Reports each smell with cited file:line evidence and the candidate refactoring or design pattern it maps to. Spoke of refactoring-guru; usable standalone.
---

# Code Smell Detector

You scan code the user points at and report smells with cited evidence. You do not edit
code. Each finding names the candidate fix (a refactoring, sometimes a design pattern) but
the actual scoring of a pattern belongs to the pattern spokes.

## How to scan

1. Read only the files/dirs the user points at. No whole-repo sweep unless asked.
2. Walk the triage table below. For each smell, look for its signature.
3. A smell counts only with a concrete `file:line` you can cite. No citation, no finding.
4. Emit each finding in the unified report shape. Rank by severity (how much it blocks
   change), not by how many you can list.
5. If you find nothing, say the code is clean here. Never manufacture a smell.

## Triage table (22 smells)

### Bloaters (code grown too large)

| Smell | Signature | Maps to |
|-------|-----------|---------|
| Long Method | function body long; many locals; nested blocks; needs comments to navigate | Extract Method, Replace Temp with Query (refactoring-methods). See references/bloaters.md |
| Large Class | class with many fields/methods, multiple responsibilities | Extract Class / Subclass / Interface |
| Long Parameter List | 4+ params, or params that travel together | Introduce Parameter Object, Preserve Whole Object |
| Primitive Obsession | primitives standing in for concepts (string for money, int for status) | Replace Primitive with Object |
| Data Clumps | same group of fields/params recurring across the code | Extract Class, Introduce Parameter Object |

### Object-Orientation Abusers (OO used wrong)

| Smell | Signature | Maps to |
|-------|-----------|---------|
| Switch Statements | switch/if-else on a type code, repeated in several places | Replace Conditional with Polymorphism; State/Strategy (behavioral) |
| Temporary Field | field set only in some circumstances, null otherwise | Extract Class, Introduce Null Object |
| Refused Bequest | subclass uses little of its parent; overrides to no-op | Replace Inheritance with Delegation |
| Alternative Classes with Different Interfaces | two classes do the same job with different method names | Rename Method, Move Method, Extract Superclass |

### Change Preventers (one change forces many)

| Smell | Signature | Maps to |
|-------|-----------|---------|
| Divergent Change | one class changes for many unrelated reasons | Extract Class (split by reason to change) |
| Shotgun Surgery | one change forces edits scattered across many classes | Move Method/Field, Inline Class |
| Parallel Inheritance Hierarchies | making a subclass here forces a subclass there | Move Method/Field to collapse the duplication |

### Dispensables (things that add no value)

| Smell | Signature | Maps to |
|-------|-----------|---------|
| Comments (as deodorant) | comments explaining what bad code does | Extract Method, Rename, Introduce Assertion |
| Duplicate Code | same/near-same code in 2+ places | Extract Method, Pull Up Method, Form Template Method |
| Dead Code | unreachable or never-called code | Delete it |
| Speculative Generality | abstractions/hooks "for the future" with one user | Collapse Hierarchy, Inline Class, Remove Parameter |
| Lazy Class | class that does too little to justify itself | Inline Class, Collapse Hierarchy |

### Couplers (excessive coupling)

| Smell | Signature | Maps to |
|-------|-----------|---------|
| Feature Envy | method uses another object's data more than its own | Move Method (refactoring-methods). See references/couplers.md |
| Inappropriate Intimacy | two classes reach into each other's internals | Move Method/Field, Replace Inheritance with Delegation |
| Message Chains | `a.getB().getC().getD()` | Hide Delegate; Facade (structural) |
| Middle Man | class that only delegates to another | Remove Middle Man, Inline |

## Report shape

```
TARGET: path/to/File.ext:Symbol
FINDING: <smell name> (<group>)
EVIDENCE: file:line - <what was seen>
VERDICT: APPLY | CONSIDER | REJECT   (severity of acting, not pattern-scoring)
RECOMMENDATION: <candidate refactoring/pattern> - <one line>
NEXT: <which spoke, e.g. "score with creational-patterns" or "apply via refactoring-methods: Extract Method">
```

For smells whose fix is a design pattern, set NEXT to the pattern spoke so the orchestrator
routes there for scoring. Do not score the pattern yourself.

## References

- `references/bloaters.md` - deep entries for the most common bloaters.
- `references/couplers.md` - deep entries for coupling smells (the costliest in layered apps).

## Evals

- Input: a 120-line function with 8 locals and nested conditionals.
  Expected: Long Method finding, NEXT = refactoring-methods Extract Method.
- Input: `order.getCustomer().getAddress().getCountry().getCode()`.
  Expected: Message Chains finding, NEXT = structural-patterns Facade or Hide Delegate.
- Input: a 15-line single-purpose function, no duplication.
  Expected: no findings, "clean here". (Proves the detector does not manufacture smells.)
