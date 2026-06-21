# Master linkage map

Symptom -> candidate refactoring(s) and/or candidate pattern(s) -> spoke that scores it.
The orchestrator uses this to decide which spoke to invoke for a given symptom. The pattern
spoke always has final say via its scored preconditions; this table only nominates
candidates.

## Smell -> refactoring (fix the smell directly)

| Smell | Group | Candidate refactorings | Spoke |
|-------|-------|------------------------|-------|
| Long Method | Bloater | Extract Method, Replace Temp with Query, Decompose Conditional | refactoring-methods |
| Large Class | Bloater | Extract Class, Extract Subclass, Extract Interface | refactoring-methods |
| Long Parameter List | Bloater | Introduce Parameter Object, Preserve Whole Object | refactoring-methods |
| Primitive Obsession | Bloater | Replace Primitive with Object, Introduce Parameter Object | refactoring-methods |
| Data Clumps | Bloater | Extract Class, Introduce Parameter Object | refactoring-methods |
| Switch Statements | OO-Abuser | Replace Conditional with Polymorphism, Replace Type Code with Subclasses | refactoring-methods + creational/behavioral |
| Temporary Field | OO-Abuser | Extract Class, Introduce Null Object | refactoring-methods |
| Refused Bequest | OO-Abuser | Replace Inheritance with Delegation, Extract Superclass | refactoring-methods |
| Divergent Change | Change-Preventer | Extract Class (split responsibilities) | refactoring-methods |
| Shotgun Surgery | Change-Preventer | Move Method/Field, Inline Class | refactoring-methods |
| Parallel Inheritance | Change-Preventer | Move Method/Field to collapse hierarchies | refactoring-methods |
| Comments (crutch) | Dispensable | Extract Method, Rename, Introduce Assertion | refactoring-methods |
| Duplicate Code | Dispensable | Extract Method, Pull Up Method, Form Template Method | refactoring-methods + behavioral |
| Dead Code | Dispensable | Delete; Inline | refactoring-methods |
| Speculative Generality | Dispensable | Collapse Hierarchy, Inline Class, Remove Parameter | refactoring-methods |
| Lazy Class | Dispensable | Inline Class, Collapse Hierarchy | refactoring-methods |
| Feature Envy | Coupler | Move Method, Extract Method | refactoring-methods |
| Inappropriate Intimacy | Coupler | Move Method/Field, Replace Inheritance with Delegation | refactoring-methods |
| Message Chains | Coupler | Hide Delegate, Extract Method | refactoring-methods + structural (Facade) |
| Middle Man | Coupler | Remove Middle Man, Inline | refactoring-methods |

## Symptom -> candidate design pattern (when refactoring alone is not enough)

### Creational (object construction)

| Symptom | Candidate pattern | Spoke |
|---------|-------------------|-------|
| constructor arity high / telescoping ctors / many optional params | Builder | creational-patterns |
| `new ConcreteClass` scattered; subclass decides which type to make | Factory Method | creational-patterns |
| families of related objects must be created together and stay consistent | Abstract Factory | creational-patterns |
| object expensive to build, needs many similar copies | Prototype | creational-patterns |
| hand-rolled global single instance | Singleton (often anti; verify) | creational-patterns |

### Structural (object composition / interfaces)

| Symptom | Candidate pattern | Spoke |
|---------|-------------------|-------|
| incompatible interface needs to fit an expected one | Adapter | structural-patterns |
| abstraction and implementation vary independently (combinatorial subclasses) | Bridge | structural-patterns |
| tree of part-whole objects treated uniformly | Composite | structural-patterns |
| add responsibilities to one object at runtime without subclass explosion | Decorator | structural-patterns |
| complex subsystem needs a simple entry point; Message Chains | Facade | structural-patterns |
| many similar objects blow memory; shared intrinsic state | Flyweight | structural-patterns |
| need to control / defer / guard access to an object | Proxy | structural-patterns |

### Behavioral (object interaction / responsibility)

| Symptom | Candidate pattern | Spoke |
|---------|-------------------|-------|
| switch/if selecting interchangeable algorithms at runtime | Strategy | behavioral-patterns |
| object behavior changes with internal state; state-machine if/switch | State | behavioral-patterns |
| request needs to be queued, logged, undone, parameterized | Command | behavioral-patterns |
| one-to-many change notification / event subscription | Observer | behavioral-patterns |
| request handled by one of a chain of handlers | Chain of Responsibility | behavioral-patterns |
| algorithm skeleton fixed, steps vary by subclass; Duplicate Code in siblings | Template Method | behavioral-patterns |
| operation added across a class hierarchy without editing the classes | Visitor | behavioral-patterns |
| many objects communicate in a tangle (n-to-n) | Mediator | behavioral-patterns |
| traverse a collection without exposing its structure | Iterator | behavioral-patterns |
| capture and restore object state (undo) | Memento | behavioral-patterns |

## Disambiguation notes

- Strategy vs State: Strategy's variants are chosen by the client and rarely change each
  other; State's variants drive transitions between themselves. Distinguishing precondition:
  "do the variants decide the next variant?" yes -> State, no -> Strategy.
- Factory Method vs Abstract Factory: one product vs a family of related products.
- Decorator vs Proxy: Decorator adds behavior; Proxy controls access. Same shape, different
  intent.
- Adapter vs Facade: Adapter makes one interface fit a required one; Facade simplifies a
  whole subsystem.
