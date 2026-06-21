# Strategy, State, Command (deep entries + disambiguation)

These three are the most-reached-for behavioral patterns and the most often confused. Read
this when scoring any of them.

## Strategy vs State: the one question

Both replace a switch/if on a kind with one class per kind. The difference is who decides the
next kind.

> Do the variants decide which variant runs next?

- No, the client/config picks the variant and variants are independent -> Strategy.
- Yes, a variant triggers the transition to another variant -> State.

Worked example. A sort algorithm chosen by config (quicksort vs mergesort): quicksort never
"becomes" mergesort. Independent. -> Strategy.

An order whose `status` goes draft -> paid -> shipped, where `paid.ship()` moves it to
`shipped`: the current state decides and performs the transition. -> State.

If you cannot tell, ask whether removing transitions still leaves meaningful variants. If
yes, it was Strategy with incidental state.

## Strategy (deep)

When it genuinely earns its place:
- two or more real algorithms for one task, selected at runtime;
- the selection conditional is duplicated or will grow;
- you want each algorithm unit-tested in isolation.

Mechanics if APPLY (hand to refactoring-methods for the safe steps):
1. Define a strategy interface for the one varying operation.
2. Move each branch of the conditional into a concrete strategy.
3. Inject the chosen strategy; replace the conditional with a call to it.

FP note: a strategy interface with one method is just a function type. In TypeScript,
Python, Kotlin, prefer passing a function unless you need multiple methods or stateful
strategies. A full class hierarchy for a one-method strategy is over-engineering: CONSIDER,
not APPLY.

## State (deep)

When it genuinely earns its place:
- behavior varies by an internal state AND states drive transitions among themselves;
- the same `switch(state)` recurs across several methods;
- invalid transitions should be structurally impossible.

Mechanics if APPLY:
1. Define a state interface with the operations that vary by state.
2. One class per state; each implements the operations and returns/sets the next state.
3. The context delegates to its current state object.

Caution: with only two states and one check, a boolean beats a State machine. Veto.

## Command (deep)

When it genuinely earns its place:
- requests must be reified: queued, scheduled, logged, undone, or replayed;
- invoker and receiver should be decoupled;
- operations are treated uniformly (e.g. a list of actions).

Mechanics if APPLY:
1. Define a command interface (`execute()`, and `undo()` if undo is required).
2. One command class (or closure) per operation, capturing its receiver and args.
3. The invoker holds commands and calls `execute()`; for undo, keep a history stack.

The undo requirement is the strongest signal. Without queue/undo/log/replay, a direct method
call is simpler: veto Command as needless indirection.

## Cross-pattern confusions to call out in reports

- Template Method vs Strategy: same goal (vary steps of an algorithm). Template Method uses
  inheritance and fixes the skeleton in a base class; Strategy uses composition and injects
  the variation. Prefer Strategy when the variation is runtime or inheritance is unwanted.
- Command vs Strategy: both wrap behavior in an object. Strategy answers "how to do X";
  Command answers "do X, and let me store/undo/queue that request".
- Observer vs Mediator: Observer is one-to-many notification; Mediator centralizes
  many-to-many coordination.
