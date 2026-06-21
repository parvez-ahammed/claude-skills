# Simplifying conditionals (deep mechanics)

Conditional logic gets complex fast. These untangle it.

## Decompose Conditional

Preconditions: an if/else where the condition and/or branches are themselves complicated.

Mechanics:
1. Extract the condition into a well-named boolean method (e.g. `isSummer(date)`).
2. Extract the then-branch into a named method.
3. Extract the else-branch into a named method.
4. Run tests. The conditional now reads as intent, not mechanics.

## Replace Nested Conditional with Guard Clauses

Preconditions: nested ifs where some branches handle edge/exceptional cases and one branch
is the "real" path.

Mechanics:
1. For each edge case, write an early return at the top.
2. Remove the corresponding nesting.
3. Leave the main path unindented at the end.
4. Run tests.

Risk: changing behavior when conditions are not mutually exclusive. Mitigation: confirm each
guarded case truly exits; do not merge conditions that have side effects.

## Replace Conditional with Polymorphism

Preconditions: a switch/if-else selects behavior based on a type code or kind, and the same
shape of conditional appears in more than one place. This is the bridge into design
patterns.

Mechanics:
1. Ensure a class hierarchy exists for the type (create one via Replace Type Code with
   Subclasses if needed).
2. Move one conditional into the relevant class as an overridable method.
3. Make each branch the override in its subclass.
4. Replace the original conditional with a call to the polymorphic method.
5. Run tests after moving each branch.
6. Repeat for the other duplicated conditionals; they collapse to the same call.

When the type also drives transitions or is chosen at runtime, this is really State or
Strategy: route to behavioral-patterns to score which, rather than hand-rolling the
hierarchy.

## Introduce Null Object

Preconditions: the same `if (x == null)` check is repeated in many places.

Mechanics:
1. Create a subclass / implementation representing "nothing" with do-nothing or neutral
   behavior.
2. Return the null object instead of null from the source.
3. Remove the null checks one at a time, running tests after each.

Risk: hiding a genuine error that should have failed loudly. Apply only when "nothing" is a
valid, expected case, not when null signals a bug.
