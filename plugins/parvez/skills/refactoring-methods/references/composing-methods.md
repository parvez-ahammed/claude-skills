# Composing methods (deep mechanics)

These break up bloated methods so logic is packaged sensibly. They are the workhorses; most
refactoring sessions are mostly Extract Method.

## Extract Method

Preconditions: a fragment of a method can be grouped under one clear name; the fragment does
not depend on locals in a way that cannot be passed or returned.

Mechanics:
1. Create a new method named for WHAT it does, not how.
2. Copy the fragment into it.
3. Find locals the fragment reads: pass them as parameters.
4. Find locals the fragment writes and that are used after: return them (or, if more than
   one, reconsider the boundary or use a small result object).
5. Replace the original fragment with a call to the new method.
6. Run tests.

Risk: a written-to local used later silently lost. Mitigation: check every assignment in the
fragment against later uses before extracting.

## Replace Temp with Query

Preconditions: a temp holds the result of an expression with no side effects and is read
more than trivially; you want to extract a method but the temp blocks it.

Mechanics:
1. Confirm the temp is assigned once and the expression is side-effect free.
2. Extract the right-hand expression into a query method.
3. Replace reads of the temp with calls to the query.
4. Run tests after each replacement.
5. Remove the temp.

Risk: re-computing an expensive expression. Mitigation: only apply when the expression is
cheap, or memoize the query.

## Replace Method with Method Object

Preconditions: a long method has so many interacting locals that Extract Method is
impractical.

Mechanics:
1. Create a class named for the method.
2. Give it a field for the original object and a field per local variable.
3. Move the method body into a `compute()` (or similarly named) method on the new class.
4. The original method delegates to `new MethodObject(this, args).compute()`.
5. Run tests. Now Extract Method freely inside the method object: locals are fields, so
   extraction no longer needs parameter threading.

Risk: over-engineering a method that Extract Method alone could have handled. Apply only when
local entanglement genuinely blocks simpler extraction.
