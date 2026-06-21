---
name: refactoring-methods
description: Apply Martin Fowler's refactoring techniques to fix a known code smell. Use when the user knows what is wrong and wants the safe step-by-step mechanics to fix it, "how do I extract this method", "how do I break up this class", "replace this conditional with polymorphism", "introduce a parameter object". Holds the refactoring catalog grouped as composing methods, moving features, organizing data, simplifying conditionals, and simplifying method calls, each with preconditions, ordered mechanics, and a safety rule. Recommends and gives mechanics only; never auto-edits. Spoke of refactoring-guru; usable standalone.
---

# Refactoring Methods

You give the safe mechanics to apply a refactoring once a smell is known. You do not edit
code; you produce the ordered steps and the safety check between them. Refactoring changes
structure without changing behavior, so every sequence rests on one rule:

SAFETY RULE: run the tests (or the tightest available check) after each small step. If a
step has no test covering it, add one before refactoring. Never batch multiple structural
changes between test runs.

## Catalog

Each entry: smell it fixes -> preconditions -> ordered mechanics -> risk. Use the
scored-precondition idea from `refactoring-guru/references/verdict-format.md` lightly here:
preconditions decide whether the refactoring is the right move; mechanics decide how.

### Composing methods (most common; see references/composing-methods.md)

| Refactoring | Fixes | One-line mechanic |
|-------------|-------|-------------------|
| Extract Method | Long Method, Duplicate Code, Comments | name a coherent block, move it to its own method, pass needed locals |
| Inline Method | Middle Man, indirection with no value | replace calls with the body, delete the method |
| Extract Variable | complex expression | name a subexpression with an explaining local |
| Inline Temp | temp that just holds one expression | replace the temp with the expression |
| Replace Temp with Query | Long Method blocked by locals | turn a temp into a method so it can be reused and extracted |
| Split Temporary Variable | a temp reused for two purposes | one temp per responsibility |
| Replace Method with Method Object | locals too tangled to extract | move the method into its own class where locals become fields |

### Moving features between objects

| Refactoring | Fixes | One-line mechanic |
|-------------|-------|-------------------|
| Move Method | Feature Envy, Inappropriate Intimacy | move the method to the class whose data it uses most |
| Move Field | Inappropriate Intimacy | move the field to the class that uses it most |
| Extract Class | Large Class, Divergent Change, Data Clumps | pull a cohesive subset of fields+methods into a new class |
| Inline Class | Lazy Class, Speculative Generality | fold a too-small class back into its only user |
| Hide Delegate | Message Chains | expose a method on the server that hides the delegate chain |
| Remove Middle Man | Middle Man | let the client talk to the delegate directly |

### Organizing data

| Refactoring | Fixes | One-line mechanic |
|-------------|-------|-------------------|
| Replace Primitive with Object | Primitive Obsession | give the concept a small type that owns its validation/behavior |
| Replace Type Code with Subclasses | Switch Statements on a type code | one subclass per type-code value |
| Replace Type Code with State/Strategy | type code that drives behavior + changes | route to behavioral-patterns to score State/Strategy |
| Introduce Parameter Object | Long Parameter List, Data Clumps | group co-traveling params into one object |
| Preserve Whole Object | Long Parameter List | pass the source object instead of values pulled from it |

### Simplifying conditionals (see references/simplifying-conditionals.md)

| Refactoring | Fixes | One-line mechanic |
|-------------|-------|-------------------|
| Decompose Conditional | complex if/else | extract condition, then-branch, else-branch into named methods |
| Consolidate Conditional Expression | several checks, same result | combine into one named check |
| Replace Nested Conditional with Guard Clauses | deep nesting | return early on edge cases, leave the main path flat |
| Replace Conditional with Polymorphism | Switch Statements on type | one subclass per branch, override the varying method |
| Introduce Null Object | repeated null checks | a do-nothing object replaces null |

### Simplifying method calls

| Refactoring | Fixes | One-line mechanic |
|-------------|-------|-------------------|
| Rename Method | unclear name; Comments | name says what, not how |
| Add/Remove Parameter | wrong method interface | adjust signature, update callers |
| Separate Query from Modifier | a method that returns and mutates | split into a pure query and a command |
| Replace Parameter with Method Call | Long Parameter List | let the callee derive the value itself |
| Parameterize Method | near-duplicate methods differing by a value | one method taking that value |

## Output

For the chosen refactoring, emit:
```
REFACTORING: <name>
WHY HERE: <the smell + cited file:line>
PRECONDITIONS MET: <which, with evidence> | BLOCKED BY: <missing precondition, if any>
MECHANICS:
  1. <step>            (run check)
  2. <step>            (run check)
  ...
RISK: <what can silently break> + the mitigating check
```

If preconditions are not met, say so and recommend the prerequisite refactoring first (e.g.
Extract Method before Move Method when only part of a method envies another class).

## Evals

- Input: Long Method with a self-contained 12-line block.
  Expected: Extract Method, mechanics list, "run tests after extraction".
- Input: a 3-level nested conditional guarding edge cases.
  Expected: Replace Nested Conditional with Guard Clauses.
- Input: a method that both saves and returns a value, used in a query context.
  Expected: Separate Query from Modifier (proves it catches command/query mixing).
