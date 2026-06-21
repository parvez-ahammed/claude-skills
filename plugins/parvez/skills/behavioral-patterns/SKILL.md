---
name: behavioral-patterns
description: Score whether a behavioral design pattern (Strategy, State, Command, Observer, Chain of Responsibility, Template Method, Visitor, Mediator, Iterator, Memento) fits a code site, and recommend it only when scored preconditions are met. Use when the user asks "should I use a strategy/state/observer here", "where can I apply a behavioral pattern", or when object interaction is awkward (switch on a type to pick an algorithm, behavior driven by internal state, requests needing queue/undo, one-to-many notifications, request handled by a chain, duplicated algorithm skeletons, operations spread across a class hierarchy, tangled many-to-many communication). Each pattern has opportunity signatures, weighted preconditions, a threshold, and hard-veto anti-indicators; emits APPLY / CONSIDER / REJECT with cited evidence. Spoke of refactoring-guru; usable standalone.
---

# Behavioral Patterns

Behavioral patterns are about how objects interact and distribute responsibility. You score
a site and report a verdict; you do not edit code. Follow the shared scoring rules in
`refactoring-guru/references/verdict-format.md`.

The three highest-value, most-confused patterns (Strategy, State, Command) have deep entries
with worked disambiguation in `references/strategy-state-command.md`. Read it when scoring
any of them, or when a Switch-Statements smell points here.

---

### Strategy
intent: define a family of interchangeable algorithms and select one at runtime.

opportunity signatures:
  - switch/if-else selecting between algorithms (sort, pricing, validation, export)
  - a flag parameter that changes which algorithm runs
  - duplicated algorithm-selection conditionals in several places

preconditions (scored):
  [3] multiple interchangeable algorithms exist for one well-defined task
  [2] the choice is made at runtime by the client or config
  [2] the selection conditional recurs or will grow with new algorithms
  [1] algorithms should be testable and swappable in isolation
threshold: >= 5 (anchor: the [3] is mandatory)

anti-indicators (hard veto):
  - there is only one algorithm and no realistic second
  - the variants differ trivially (a parameter would do)
  - the "algorithms" actually drive transitions between each other (that is State)

cost: one type per algorithm plus wiring.
language notes: a first-class function or lambda is the idiomatic Strategy in most modern
languages. Downgrade a full Strategy-class hierarchy to CONSIDER when a function passed as an
argument covers it.

---

### State
intent: let an object alter its behavior when its internal state changes; it appears to
change class.

opportunity signatures:
  - a `status`/`mode` field plus switch/if on it in many methods
  - explicit state-machine logic with transitions hand-coded
  - behavior and allowed transitions both depend on the current state

preconditions (scored):
  [3] behavior varies by an internal state AND the states define transitions among themselves
  [2] the state machine has several states and the conditional repeats across methods
  [2] new states are expected
  [1] invalid transitions should be made impossible by structure
threshold: >= 5 (anchor: the [3] is mandatory)

anti-indicators (hard veto):
  - there are only two states and one or two checks (a boolean is simpler)
  - the variants do not control transitions (that is Strategy, not State)
  - states never change after construction

cost: a class per state and transition wiring; more moving parts.

---

### Command
intent: turn a request into an object so it can be parameterized, queued, logged, or undone.

opportunity signatures:
  - operations needing undo/redo, queueing, scheduling, or audit logging
  - UI actions / menu items duplicating invocation logic
  - a need to decouple the invoker from the receiver of an action

preconditions (scored):
  [3] requests must be stored, queued, logged, or undone (reified as objects)
  [2] invoker and receiver should be decoupled
  [2] operations are parameterized and treated uniformly
  [1] you want macro/composite commands
threshold: >= 5 (anchor: the [3] is mandatory)

anti-indicators (hard veto):
  - a direct method call is enough; no queue/undo/log requirement
  - it only adds indirection with no reuse

cost: a command type per operation; bookkeeping for undo state.

---

### Observer
intent: define a one-to-many dependency so dependents are notified of changes automatically.

opportunity signatures:
  - manual lists of callbacks/listeners with hand-rolled notify loops
  - polling for a change that could be pushed
  - several components needing to react to one source of truth

preconditions (scored):
  [3] one subject's change must notify a varying set of dependents
  [2] subject and observers should be loosely coupled (subject does not know concrete types)
  [2] observers subscribe/unsubscribe dynamically
  [1] the dependent set changes at runtime
threshold: >= 5 (anchor: the [3] is mandatory)

anti-indicators (hard veto):
  - exactly one fixed dependent (just call it)
  - the framework already provides reactivity/events (use it, do not reinvent)

cost: subscription lifecycle, ordering, and leak management (unsubscribe).
language notes: built-in event emitters / reactive streams / signals are the idiomatic
Observer. Prefer the platform mechanism over a hand-built one.

---

### Chain of Responsibility
intent: pass a request along a chain of handlers until one handles it.

opportunity signatures:
  - nested if-else trying handlers in order
  - middleware-like processing where each step may handle or pass on
  - approval/escalation flows

preconditions (scored):
  [3] more than one handler may process a request and the set/order varies
  [2] the sender should not know which handler will act
  [2] handlers should be composable and reorderable
  [1] new handlers are added over time
threshold: >= 5 (anchor: the [3] is mandatory)

anti-indicators (hard veto):
  - exactly one handler always handles it
  - order is fixed and trivial

cost: chain wiring; risk of a request falling off the end unhandled.

---

### Template Method
intent: define an algorithm's skeleton in a base method, letting subclasses override
specific steps.

opportunity signatures:
  - sibling classes with near-identical methods differing in a few steps (Duplicate Code)
  - a fixed sequence with one or two varying steps

preconditions (scored):
  [3] an invariant algorithm skeleton with a few varying steps duplicated across subclasses
  [2] the variation is by subtype, decided at compile time
  [1] the step set is stable
threshold: >= 4 (anchor: the [3] is mandatory)

anti-indicators (hard veto):
  - the variation is chosen at runtime (that is Strategy via composition)
  - inheritance is undesirable here (prefer Strategy/composition)

cost: inheritance coupling; base class controls the flow.
note: often the lighter answer to the same duplication is Strategy by composition. Compare.

---

### Visitor
intent: add operations to a class hierarchy without modifying its classes.

opportunity signatures:
  - many unrelated operations over a stable set of node types (AST walkers, exporters)
  - adding a method to every subclass each time a new operation is needed

preconditions (scored):
  [3] the object structure is stable but operations are added often
  [3] operations span the whole hierarchy and do not belong on the nodes
  [2] double dispatch is genuinely needed
  [1] node types rarely change
threshold: >= 6 (anchor: one [3])

anti-indicators (hard veto):
  - node types change often (Visitor makes that painful: every visitor must update)
  - only one or two operations exist
  - the operations belong naturally on the objects themselves

cost: heavy boilerplate (accept/visit), double dispatch, hard for newcomers.

---

### Mediator
intent: centralize complex many-to-many communication between objects in one mediator.

preconditions (scored):
  [3] a set of objects communicate in a tangled n-to-n web
  [2] the coupling makes them hard to reuse or change independently
  [2] coordination logic is duplicated/spread across them
  [1] interactions will grow
threshold: >= 5 (anchor: the [3] is mandatory)

anti-indicators (hard veto):
  - few objects with simple, direct relationships
  - the mediator would become a god object (re-evaluate the design instead)

cost: the mediator can centralize too much and turn into a god object.

---

### Iterator
intent: access elements of a collection sequentially without exposing its representation.

preconditions (scored):
  [3] clients need to traverse a custom/complex structure without seeing its internals
  [2] multiple traversal strategies are needed
  [1] uniform traversal across different collection types is wanted
threshold: >= 4 (anchor: the [3] is mandatory)

anti-indicators (hard veto):
  - the language/stdlib already provides iteration for this collection (use it)
  - the structure is a plain array/list

cost: an iterator type to maintain.
language notes: nearly every modern language has a built-in iterator protocol. A hand-built
Iterator is almost always REJECT unless traversing a genuinely custom structure.

---

### Memento
intent: capture and externalize an object's internal state so it can be restored later,
without violating encapsulation.

preconditions (scored):
  [3] you need snapshots/undo of an object's state
  [2] the state must be captured without exposing internals
  [1] multiple restore points are needed
threshold: >= 4 (anchor: the [3] is mandatory)

anti-indicators (hard veto):
  - no undo/snapshot requirement
  - the state is trivial to copy directly

cost: memento storage and lifecycle.

---

## Output

Emit per scored site in the orchestrator's unified report shape, with matched preconditions
and `file:line` evidence, score, any veto, verdict, one-line why. For the classic confusions
(Strategy vs State, Template Method vs Strategy, Decorator vs Chain), state the single
distinguishing question; see references/strategy-state-command.md for Strategy/State/Command.

## Evals

- Input: `switch(sortKind) { quicksort | mergesort | bubblesort }`, chosen by a param.
  Expected: Strategy APPLY (or a function in FP languages -> CONSIDER).
- Input: an order with `status` in {draft, paid, shipped} where each status decides which
  status comes next, switched on in 5 methods.
  Expected: State APPLY (variants drive transitions). Proves Strategy/State disambiguation.
- Input: a single sort algorithm, no second planned.
  Expected: Strategy REJECT (anti-indicator: one algorithm). Proves the veto.
- Input: iterating a plain array, asked about Iterator.
  Expected: Iterator REJECT (built-in iteration exists).
