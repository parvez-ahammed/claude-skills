# The Dependency Rule, ports & adapters, and fixing violations

The single law: **source-code dependencies point inward only.** Inner layers know
nothing about outer layers. Everything else is mechanics for obeying it.

## Ports and adapters (how an inner layer "uses" the outside)

An inner layer often needs something the outside provides (a database, a clock, an email
sender). It cannot depend on the concrete thing. So:

1. The inner layer **defines an interface it owns** - a **port**. e.g. Application
   declares `interface UserRepository { findById(id): User }`.
2. An outer layer writes an **adapter** that implements the port - e.g. Infrastructure's
   `PostgresUserRepository implements UserRepository`.
3. At a single **composition root** (the entry point / DI container), you wire the adapter
   to the port.

Now the dependency points inward: `Infrastructure -> (port in) Application`. Application
never names Postgres. You can swap the adapter (in-memory for tests, a different DB later)
without touching business logic. That decoupling is the entire payoff.

## Mapping at the boundary (don't leak outer types inward)

Don't let an ORM entity, an HTTP DTO, or a framework type cross into the Domain. Map at
the edge: the Infrastructure adapter converts its DB row -> Domain entity; the
Presentation layer converts a Domain result -> HTTP response DTO. The Domain speaks only
in its own types. Yes, it's extra mapping code; it's also what keeps the core pure.

## Common violations and the fix (invert, don't bend)

| Violation | Why it's wrong | Fix |
|-----------|----------------|-----|
| Domain imports the ORM / a framework | Core now depends on infrastructure; can't test or reuse it in isolation | Move the type out; if Domain needs behavior, define a **port** and implement it in Infrastructure |
| Application imports Infrastructure (a concrete repo) | Use case bound to a specific adapter | Depend on the **port** in Application; inject the concrete repo at the composition root |
| Controller queries the DB / ORM directly | Presentation reaching past Application into persistence | Call an Application **use case**; the use case uses a repository port |
| Domain entity carries an HTTP/DTO/JSON attribute | Transport concern leaked into the core | Keep the entity pure; map to a DTO in Presentation |
| Outer type passed inward as a parameter | Hidden inward dependency on an outer type | Map it to a Domain/Application type at the boundary first |
| "Shared" project everything references | Becomes a dumping ground that re-couples layers | Put truly-shared *kernel* types in Domain; resist a catch-all Common project |

The tell: if obeying the rule feels like it needs an interface you don't have yet, that
interface (the port) **is** the design - add it, don't bend the rule by importing outward.

## Where DI / the composition root sits

The composition root (where concrete adapters are bound to ports) lives in the outermost
layer - the API/host/`main`. It's the *only* place allowed to know every concrete type.
Everything else depends on abstractions. This is why the outer layer may reference all
inner layers: it's wiring, not logic.

## Testing dividend

With ports, the Domain and Application layers test with **fake adapters** - no database,
no network, fast and deterministic. If you find yourself needing a real DB to unit-test a
business rule, a dependency is pointing the wrong way.
