---
name: creational-patterns
description: Score whether a creational design pattern (Factory Method, Abstract Factory, Builder, Prototype, Singleton) fits a code site, and recommend it only when scored preconditions are met. Use when the user asks "should I use a factory/builder here", "where can I apply a creational pattern", "how should I construct these objects", or when object construction is awkward (telescoping constructors, scattered `new`, type-switch instantiation, expensive clones, hand-rolled globals). Each pattern has opportunity signatures, weighted preconditions, a threshold, and hard-veto anti-indicators; emits APPLY / CONSIDER / REJECT with cited evidence. Spoke of refactoring-guru; usable standalone.
---

# Creational Patterns

Creational patterns are about object construction: making the system independent of how its
objects are created. You score a code site against each candidate and report a verdict. You
do not edit code.

Use the shared scoring rules in `refactoring-guru/references/verdict-format.md`: match
preconditions only with cited `file:line` evidence, hard-veto wins, three verdicts, apply
language notes last. When the user points at a site, score it. When asked "where can I apply
one", run the opportunity signatures over the target first (or ask code-smell-detector to),
then score the hits.

---

### Factory Method
intent: let a class defer instantiation to subclasses; create objects without naming the
concrete class at the call site.

opportunity signatures:
  - `new ConcreteClass()` scattered across callers that should not know the concrete type
  - a method whose only job is to pick and construct a subtype
  - subclasses that differ only in which product they create

preconditions (scored):
  [3] callers must work with a product through an interface/base type, not the concrete one
  [2] the concrete type to create varies by subclass or context
  [2] construction logic is duplicated across call sites
  [1] you foresee new product variants added behind the same interface
threshold: >= 5 (anchor: one [3] or two [2])

anti-indicators (hard veto):
  - only one concrete product exists and no second is realistic
  - callers legitimately need the concrete type
  - a plain function/constructor already does this with no duplication

cost: an extra layer of subclasses/overrides; indirection at construction.
language notes: in languages with first-class functions, a factory function passed as an
argument often beats a Factory Method class hierarchy. Downgrade if a function suffices.

---

### Abstract Factory
intent: create families of related objects that must be used together, without binding to
their concrete classes.

opportunity signatures:
  - several related products created in lockstep (e.g. Button + Checkbox + Menu per theme)
  - a config/flag selects a whole family of implementations
  - risk of mixing incompatible products from different families

preconditions (scored):
  [3] multiple product types vary together along the same dimension (theme, platform, vendor)
  [3] mixing products across families would be a bug
  [2] the family choice is made once, then reused throughout
  [1] new families are anticipated
threshold: >= 6 (anchor: one [3])

anti-indicators (hard veto):
  - only one product type varies (use Factory Method, not Abstract Factory)
  - the families never need to stay consistent with each other
  - there is only one family today and no second on the horizon

cost: a factory interface plus one concrete factory per family; significant ceremony.
language notes: dependency-injection containers often supply this more simply than a
hand-built abstract factory. Downgrade if a DI container is already in use.

---

### Builder
intent: construct a complex object step-by-step, separating construction from representation.

opportunity signatures:
  - constructor arity >= 4, or telescoping constructors
  - many optional / nullable parameters; callers pass nulls or flags to skip parts
  - object built then mutated through a fixed sequence before use

preconditions (scored):
  [3] the object has many independent optional parts
  [2] the same construction steps can produce different representations
  [2] construction order matters or must be validated as a whole
  [1] callers currently pass nulls/flags to skip parts
threshold: >= 5 (anchor: one [3] or two [2])

anti-indicators (hard veto):
  - the object is a simple value with 2-3 required fields
  - all params are required and order-independent
  - construction never varies

cost: a builder class/object and a fluent API to maintain.
language notes: languages with named/default/keyword arguments (Python, Kotlin, TS object
literals) often make a Builder redundant. Downgrade to CONSIDER when named args cover it.

---

### Prototype
intent: create new objects by cloning an existing instance rather than constructing from
scratch.

opportunity signatures:
  - an object is expensive to build (heavy init, DB/network) and many near-copies are needed
  - hand-written copy code duplicating field-by-field assignment
  - objects configured at runtime then replicated

preconditions (scored):
  [3] construction is genuinely expensive and copies share most state
  [2] the set of "kinds" is decided at runtime, not compile time
  [2] hand-rolled deep/shallow copy code already exists and is error-prone
  [1] the class hierarchy makes subclass-per-kind impractical
threshold: >= 5 (anchor: one [3] or two [2])

anti-indicators (hard veto):
  - objects are cheap to construct fresh
  - copies need to diverge so much that cloning saves nothing
  - shared mutable state would make clones alias dangerously

cost: a clone contract and correct deep/shallow copy semantics to maintain.
language notes: some languages give value semantics or built-in copy/clone; prefer those.

---

### Singleton
intent: ensure a class has exactly one instance with a global access point.

Treat with suspicion. Most "singletons" are global mutable state in disguise and should be a
normal object passed via dependency injection. Score conservatively.

opportunity signatures:
  - a hand-rolled global single instance (module global, static holder)
  - code reaching for one shared resource (config, connection pool) everywhere

preconditions (scored):
  [3] exactly one instance is a hard correctness requirement, not a convenience
  [2] the instance is effectively immutable or internally synchronized
  [1] passing it explicitly is genuinely impractical across the codebase
threshold: >= 5 (anchor: the [3] is mandatory)

anti-indicators (hard veto):
  - the instance holds mutable state shared across unrelated callers
  - it exists only to avoid passing a dependency (use DI instead)
  - it would make testing require global resets
  - more than one instance is ever legitimately wanted (per-tenant, per-test)

cost: hidden global coupling, harder testing, lifecycle/threading hazards.
language notes: a module-level value already is a singleton in most module systems. A
hand-built Singleton class is almost always redundant: downgrade to REJECT unless the [3]
correctness requirement is real.

---

## Output

Emit per scored site, in the orchestrator's unified report shape, with the matched
preconditions and their `file:line` evidence, the score, any veto, and APPLY/CONSIDER/REJECT
plus a one-line why. If two creational patterns both fit (rare), show both and the
distinguishing precondition.

## Evals

- Input: a class with a 6-arg constructor and four optional args, callers passing nulls.
  Expected: Builder APPLY (unless the language has named args -> CONSIDER).
- Input: a 2-field value object (id, name), both required.
  Expected: Builder REJECT (anti-indicator: simple value, all required). Proves the veto.
- Input: a module that exports one shared config object, immutable.
  Expected: Singleton REJECT / "already a module singleton, no pattern needed".
- Input: callers doing `new PdfExporter()` / `new CsvExporter()` chosen by a format flag,
  all used through an `Exporter` interface.
  Expected: Factory Method APPLY (or factory function in FP languages).
