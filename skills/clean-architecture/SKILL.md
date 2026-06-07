---
name: clean-architecture
description: >-
  A rulebook + bootstrap + guard for building software with Clean / Hexagonal
  (Ports-and-Adapters) Architecture, in any language (.NET, TypeScript/Node, Java/Kotlin,
  Go, Python). Use this when starting a new project and you want to lay out the layers
  correctly, when structuring or refactoring code into Domain / Application /
  Infrastructure / Presentation, when deciding "where does this code go?", when adding a
  dependency or project reference and unsure if it inverts the architecture, or when the
  user asks "set up clean architecture", "how should I structure this", "is this the
  right layer", "did I break the dependency rule", "bootstrap a hexagonal project". Ships
  a config-driven layering guard so the boundaries are enforced, not just hoped for.
---

# Clean Architecture: rulebook, bootstrap, and guard

Clean / Hexagonal / Ports-and-Adapters architectures all share one core idea - **the
Dependency Rule** - and most teams get the *folders* right but let the *dependencies*
rot. This skill gives you the rule, a way to bootstrap the layout in your stack, and a
guard that mechanically enforces the boundaries (because nothing else will).

## The one rule that matters: dependencies point inward

```
        ┌───────────────────────── Presentation / API ─────────────────────────┐
        │  controllers, CLI, HTTP, gRPC, UI - thin; translate transport <-> use │
        │   ┌───────────────────── Infrastructure / Adapters ────────────────┐  │
        │   │  DB, ORM, external APIs, queues, file system, framework glue    │  │
        │   │   ┌──────────────── Application / Use Cases ─────────────────┐   │  │
        │   │   │  orchestrates domain to fulfil a use case; defines PORTS │   │  │
        │   │   │   ┌──────────────── Domain / Entities ────────────────┐  │   │  │
        │   │   │   │  business rules, entities, value objects - PURE   │  │   │  │
        │   │   │   └────────────────────────────────────────────────┘  │   │  │
        │   │   └──────────────────────────────────────────────────────┘   │  │
        │   └────────────────────────────────────────────────────────────┘  │
        └────────────────────────────────────────────────────────────────────┘
   source-code dependencies only ever point INWARD ───────────────────────────►
```

- **Domain** (innermost): entities, value objects, domain services, and **interfaces it
  owns** (ports). Depends on **nothing** - no framework, no ORM, no SDK, no I/O. If you
  delete every outer layer, Domain still compiles.
- **Application**: use cases that orchestrate the Domain. Declares **ports** (interfaces
  like `IUserRepository`, `IClock`, `IEmailSender`) it needs. Depends only on Domain.
- **Infrastructure / Adapters**: concrete implementations of the ports - EF/Prisma repos,
  HTTP clients, queues, the clock. Depends on Application + Domain. This is where
  frameworks and SDKs live.
- **Presentation / API**: controllers/CLI/UI. Thin - translate transport to a use-case
  call and back. May reference all inner layers (usually via DI wiring at the composition
  root).

**Inversion is the trick:** an inner layer needs a database, but it can't depend on the
database. So it defines a **port** (interface) and an outer **adapter** implements it;
the dependency now points inward (adapter -> port). This is the whole game.

## "Where does this code go?" - quick decisions

- A business rule / invariant -> **Domain** (entity method or domain service).
- "Do X to fulfil a request, calling repos/services" -> **Application** use case.
- Talking to Postgres / Stripe / S3 / SMTP -> **Infrastructure** adapter behind a port.
- Parsing an HTTP request, status codes, serialization -> **Presentation**.
- A `using`/`import` of a framework in Domain -> **wrong**; move it out or invert it.
- A controller doing a DB query directly -> **wrong**; call a use case.

## Bootstrap a new project

Pick your stack in `references/bootstrap-by-stack.md` - it gives the concrete folder/
project layout and, crucially, **how to make the dependency direction enforceable** in
that ecosystem (project references in .NET, module boundaries / ESLint in TS, Gradle
modules in Java, internal packages in Go). Start with the inner layers and the ports;
wire concrete adapters at a single composition root.

## Enforce it (or it rots)

Folder discipline decays under deadline pressure, and these violations never fail a build
or a test - they're architectural. Add the guard:

1. Copy `assets/clean-arch.json` to your repo root and edit it: declare each layer's
   source paths and the imports/namespaces forbidden in that layer.
2. Run the guard:
   ```
   pwsh -File scripts/check-layering.ps1 -Config clean-arch.json
   ```
   It scans each layer for forbidden imports (language-agnostic) and, for .NET, can
   verify the `.csproj` reference DAG. Non-zero exit on a hard violation.
3. Wire it into CI and/or a pre-commit hook so the boundary is checked every change, not
   remembered.

See `references/dependency-rule.md` for the deep dive: ports vs adapters, mapping at
boundaries, the common violations and how to fix each by inverting instead of bending the
rule.

## Don't over-build it

Clean Architecture is a means, not a trophy. For a tiny CRUD app it can be overkill - the
layers earn their keep when business rules are non-trivial and you want them independent
of frameworks and testable in isolation. Apply the dependency rule strictly where it
pays; don't add ceremony where it doesn't.
