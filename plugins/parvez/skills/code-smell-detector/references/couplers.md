# Couplers (deep entries)

Couplers are smells where classes know too much about each other. They are the costliest in
layered apps (controller/service/repository) because they erode the layer boundaries.

## Feature Envy

A method is more interested in another class's data than its own: it calls several getters
on one object and uses the results to compute something that conceptually belongs to that
object.

Detection: count, in one method, the calls/field-accesses on `self` versus on one other
object. If the other object dominates, that logic wants to live there.

Fix: Move Method to the envied class. If only part of the method envies, Extract Method
first, then move the extracted part. In a layered app, Feature Envy from a controller onto a
domain object usually means logic leaked up out of the service/domain layer; push it down.

## Inappropriate Intimacy

Two classes spend too much time in each other's private parts: reaching into fields,
relying on internals, bidirectional references.

Fix: Move Method/Field so each piece lives with the data it uses; Change Bidirectional
Association to Unidirectional; Replace Inheritance with Delegation when a subclass is
intimate with its parent's internals. Extract Class to host the shared concern if both
genuinely need it.

## Message Chains

`a.getB().getC().getD().doIt()`. The client is coupled to the whole navigation path; any
structural change along it breaks the client.

Detection: chained accessor calls more than two deep, especially crossing object/module
boundaries.

Fix: Hide Delegate (the first object exposes a method that hides the rest of the chain). If
the chain crosses into a whole subsystem, that is a Facade opportunity: route to
structural-patterns to score Facade. Beware over-applying Hide Delegate, which can create
Middle Man.

## Middle Man

A class delegates almost everything to another and adds nothing.

Detection: most methods are one-liners forwarding to a single collaborator.

Fix: Remove Middle Man (let clients talk to the real object), Inline the class. Exception:
the middle man is a deliberate Proxy/Decorator/Facade with real intent. Confirm intent
before removing; route to structural-patterns if the indirection is a real pattern.
