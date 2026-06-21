# Bloaters (deep entries)

Bloaters are code, methods, and classes that have grown so large they are hard to work
with. They accumulate; no single edit creates them.

## Long Method

Signs:
- body does not fit on one screen; you scroll to understand it
- many local variables and parameters interacting
- nested conditionals / loops more than two deep
- inline comments marking sections (each section wants to be its own method)

Why it hurts: the longer a method, the harder to understand, reuse, and test. Locals tangle
so extraction feels hard, which makes it grow further.

Fixes (route to refactoring-methods):
- Extract Method for any coherent block. This is 90% of the cure.
- Replace Temp with Query when locals only cache a computation.
- Introduce Parameter Object / Preserve Whole Object when extraction is blocked by a long
  parameter list.
- Decompose Conditional when the bulk is branching logic.
- Replace Method with Method Object as a last resort when locals are too entangled to
  extract directly.

## Large Class

Signs: many fields, many methods, several distinct responsibilities, the name is vague
("Manager", "Helper", "Service" doing five things).

Why it hurts: violates single responsibility; becomes a magnet for Divergent Change.

Fixes: Extract Class (pull a cohesive subset of fields+methods out), Extract Subclass (when
some features are used only in some cases), Extract Interface (to clarify how clients use
it). After extraction, watch for a creational pattern only if construction of the new parts
is itself complex.

## Long Parameter List

Signs: 4+ parameters, booleans/flags that switch behavior, several params that always
appear together.

Fixes: Introduce Parameter Object (group co-traveling params), Preserve Whole Object (pass
the source object instead of pulling values out of it), Replace Parameter with Method Call
(when the callee can derive the value). Flag params often signal a hidden Strategy: route to
behavioral-patterns to score.

## Primitive Obsession

Signs: strings/ints carrying domain meaning (currency as float, status as magic string,
phone number as string with ad-hoc validation everywhere).

Fixes: Replace Primitive with Object (a small value type owns validation and behavior),
Replace Type Code with Subclasses or with State/Strategy when the type code drives behavior.

## Data Clumps

Signs: the same cluster of fields/params keeps appearing (startDate+endDate, x+y+width+height).

Fixes: Extract Class for the clump, then Introduce Parameter Object at call sites. The test:
delete one field of the clump; if the rest stop making sense, they are a real object.
