---
name: structural-patterns
description: Score whether a structural design pattern (Adapter, Bridge, Composite, Decorator, Facade, Flyweight, Proxy) fits a code site, and recommend it only when scored preconditions are met. Use when the user asks "should I use an adapter/decorator/facade here", "where can I apply a structural pattern", or when object composition is awkward (incompatible interfaces, subclass explosion across two dimensions, part-whole trees, runtime-added responsibilities, message chains into a subsystem, memory blowup from many similar objects, controlled access). Each pattern has opportunity signatures, weighted preconditions, a threshold, and hard-veto anti-indicators; emits APPLY / CONSIDER / REJECT with cited evidence. Spoke of refactoring-guru; usable standalone.
---

# Structural Patterns

Structural patterns are about composing objects and classes into larger structures while
keeping them flexible. You score a site and report a verdict; you do not edit code. Follow
the shared scoring rules in `refactoring-guru/references/verdict-format.md`.

---

### Adapter
intent: make an existing class's interface fit the interface a client expects.

opportunity signatures:
  - a class you cannot change has the wrong method names/shapes for a client
  - wrapper code translating between two interfaces, duplicated
  - integrating a third-party or legacy API into a clean internal contract

preconditions (scored):
  [3] you need an object to satisfy an interface it does not implement
  [2] you cannot (or should not) modify the source class
  [2] more than one call site needs the same translation
  [1] you expect to swap the adapted implementation later
threshold: >= 5 (anchor: the [3] is mandatory)

anti-indicators (hard veto):
  - you control the source and can just change its interface
  - the translation is a one-off used in a single place trivially

cost: an extra wrapper type per adapted class.
language notes: structural typing / duck typing can remove the need for an explicit adapter.

---

### Bridge
intent: split an abstraction from its implementation so the two vary independently.

opportunity signatures:
  - a class hierarchy multiplying along two dimensions (Shape x Renderer -> N*M subclasses)
  - "ColoredCircle, ColoredSquare, TexturedCircle..." combinatorial naming
  - an abstraction tightly bound to one implementation it should not know about

preconditions (scored):
  [3] two independent dimensions of variation cause a subclass explosion
  [3] abstraction and implementation should evolve and ship separately
  [2] you want to switch implementations at runtime
  [1] both dimensions will keep growing
threshold: >= 6 (anchor: one [3])

anti-indicators (hard veto):
  - only one dimension varies
  - the combination count is small and stable
  - the implementation never changes independently

cost: two parallel hierarchies plus the bridge wiring; real conceptual overhead.
language notes: composition with an injected strategy object often achieves this with less
ceremony.

---

### Composite
intent: treat individual objects and compositions of objects uniformly via a tree.

opportunity signatures:
  - part-whole hierarchies (files/folders, UI nodes, org chart, AST)
  - client code with `if (isLeaf) ... else loop over children ...` repeated

preconditions (scored):
  [3] the domain is genuinely a part-whole tree
  [2] clients should treat leaves and composites the same way
  [2] operations recurse over the structure
  [1] the tree depth is arbitrary, not fixed
threshold: >= 5 (anchor: the [3] is mandatory)

anti-indicators (hard veto):
  - the structure is flat or fixed-depth
  - leaves and composites need fundamentally different client handling anyway

cost: a uniform interface that may force leaves to carry no-op child operations.

---

### Decorator
intent: attach responsibilities to an object dynamically, without subclassing for every combination.

opportunity signatures:
  - feature flags producing subclass explosion (e.g. EncryptedCompressedStream...)
  - wanting to stack optional behaviors at runtime in varying orders
  - cross-cutting wrapping (logging, caching, validation) around a core object

preconditions (scored):
  [3] responsibilities should be added/removed per instance at runtime
  [2] combinations would otherwise cause a subclass explosion
  [2] the wrappers share the component interface so they stack transparently
  [1] order of wrapping is meaningful and should be flexible
threshold: >= 5 (anchor: one [3] or two [2])

anti-indicators (hard veto):
  - there is exactly one fixed extra behavior (just add it / subclass once)
  - wrappers need to break the component interface
  - the stack is fixed and known at compile time (compose directly)

cost: many small wrapper classes; debugging through layers.
language notes: higher-order functions / middleware chains are the idiomatic Decorator in FP
and many web frameworks. Prefer them where they fit.

---

### Facade
intent: provide a simple unified interface to a complex subsystem.

opportunity signatures:
  - clients orchestrating many subsystem calls in a fixed sequence, duplicated
  - Message Chains reaching deep into a subsystem
  - a subsystem whose full surface clients should not depend on

preconditions (scored):
  [3] clients repeat a multi-step interaction with a subsystem
  [2] you want to decouple clients from the subsystem's internals
  [2] a small high-level API would cover most client needs
  [1] the subsystem may be replaced later behind the facade
threshold: >= 5 (anchor: one [3] or two [2])

anti-indicators (hard veto):
  - the subsystem is already simple
  - clients need fine-grained access the facade would hide

cost: one more layer to keep in sync with the subsystem.

---

### Flyweight
intent: share fine-grained objects to fit more of them in memory by separating intrinsic
(shared) from extrinsic (context) state.

opportunity signatures:
  - huge numbers of similar objects (glyphs, tiles, particles) straining memory
  - objects whose state is mostly identical across instances

preconditions (scored):
  [3] object count is large enough that memory is a measured problem
  [3] state splits cleanly into shared intrinsic and per-use extrinsic parts
  [2] the shared part is immutable
  [1] extrinsic state can be passed in cheaply at use time
threshold: >= 6 (anchor: one [3])

anti-indicators (hard veto):
  - object counts are modest (no real memory pressure)
  - state cannot be cleanly split, or the shared part mutates
  - it is premature optimization without a measurement

cost: a factory/pool, split state, more complex call sites. Easy to over-apply.

---

### Proxy
intent: provide a surrogate that controls access to another object (lazy, remote, protection, caching).

opportunity signatures:
  - lazy initialization of an expensive object behind hand-written checks
  - access control / permission checks scattered before using an object
  - remote calls or caching wrapped ad hoc around a service

preconditions (scored):
  [3] access to the real object must be controlled, deferred, or instrumented
  [2] the proxy can share the real object's interface so clients are unaffected
  [2] the control logic recurs and belongs in one place
  [1] the real object is expensive, remote, or sensitive
threshold: >= 5 (anchor: one [3] or two [2])

anti-indicators (hard veto):
  - no real need to control access; you just want to add behavior (that is Decorator)
  - a single inline check is simpler and used once

cost: a wrapper mirroring the subject interface; possible surprise about when the real
object actually runs.
distinguish: Decorator adds behavior, Proxy controls access. Same shape, different intent.

---

## Output

Emit per scored site in the orchestrator's unified report shape, with matched preconditions
and `file:line` evidence, score, any veto, verdict, and one-line why. If Decorator and Proxy
both seem to fit, state the distinguishing question (adding behavior vs controlling access).

## Evals

- Input: `EncryptedStream`, `CompressedStream`, `EncryptedCompressedStream` subclasses.
  Expected: Decorator APPLY (subclass explosion from stackable behaviors).
- Input: a single class with one extra logging behavior, fixed, compile-time.
  Expected: Decorator REJECT / "just subclass or add it" (proves the veto).
- Input: a service called through 5 ordered steps by three different callers.
  Expected: Facade APPLY.
- Input: 200 domain objects total, no memory pressure, asked about Flyweight.
  Expected: Flyweight REJECT (no measured memory problem; premature).
