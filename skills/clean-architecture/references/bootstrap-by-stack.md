# Bootstrap a Clean Architecture project, by stack

The layout matters less than making the **dependency direction enforceable** in that
ecosystem. Each stack below: the folders, and the mechanism that stops an inward layer
from referencing an outward one. Start with Domain + the ports, wire adapters at one
composition root, then add the guard (`scripts/check-layering.ps1` + a `clean-arch.json`).

## .NET (project references enforce the DAG)

Separate **projects** per layer; project references encode the rule (the compiler stops
inversions).

```
src/
  MyApp.Domain/          # no ProjectReferences at all
  MyApp.Application/      -> Domain
  MyApp.Infrastructure/   -> Domain, Application
  MyApp.Api/              -> Domain, Application, Infrastructure   (composition root)
  MyApp.Worker/           -> Domain, Application, Infrastructure
```

Domain `.csproj` references nothing. If someone adds `Infrastructure` to Domain's refs,
it's a visible, reviewable change - and the guard's `dotnet` DAG check fails it.

## TypeScript / Node (folders + a boundary linter)

Modules don't enforce direction by themselves - add a linter rule.

```
src/
  domain/         # entities, value objects, ports (interfaces)
  application/    # use cases; imports domain only
  infrastructure/ # adapters: prisma repos, http clients; imports domain+application
  presentation/   # express/nest controllers; thin
  main.ts         # composition root: wire adapters to ports
```

Enforce with **eslint-plugin-boundaries** (or `import/no-restricted-paths`): declare each
folder as an element type and the allowed imports, e.g. `domain` may import nothing,
`application` may import `domain`. Pair with `scripts/check-layering.ps1` for CI.

## Java / Kotlin (Gradle modules)

Use separate Gradle/Maven modules; the build graph enforces direction.

```
:domain          // no dependencies
:application     // depends on :domain
:infrastructure  // depends on :domain, :application
:app (boot)      // depends on all; composition root
```

`:domain`'s `build.gradle` lists no project deps. ArchUnit tests can additionally assert
"no class in domain depends on org.springframework.*".

## Go (internal packages + interfaces)

Go has no layer concept; use packages + the rule "outer imports inner, never the reverse".

```
internal/
  domain/         # entities + interfaces (ports)
  app/            # use cases; import domain
  adapters/       # db, http clients; import domain (+ app)
  http/           # handlers; thin
cmd/server/main.go  # composition root
```

Define repository **interfaces in domain/app**, implement them in `adapters`. The guard's
forbidden-import check (e.g. `database/sql` or `net/http` not allowed under `domain`)
catches leaks since Go's compiler won't.

## Python

```
src/
  domain/         # dataclasses/entities, Protocol ports
  application/    # use cases; import domain
  infrastructure/ # SQLAlchemy repos, clients
  api/            # FastAPI/Django views; thin
  main.py         # composition root
```

Use `Protocol`/ABC ports in domain/application; `import-linter` contracts enforce that
`domain` imports nothing outward.

## After bootstrap

1. Copy `assets/clean-arch.json`, set `roots` to your layer folders and `forbidden` to
   the frameworks/SDKs/outer-layer names each inner layer must not import.
2. `pwsh -File scripts/check-layering.ps1 -Config clean-arch.json` - confirm green.
3. Add it to CI and a pre-commit hook so the boundary is enforced on every change.
