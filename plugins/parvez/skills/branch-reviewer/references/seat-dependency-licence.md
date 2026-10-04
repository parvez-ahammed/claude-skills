# Dependency licence and cost seat

Runs ONLY when the diff adds a dependency that was not there before. Never on a version bump, never on
a removal, never on a diff that touches no manifest. If no dependency was added, this seat does not run
and reports nothing.

Whether the package *should* be added at all (reuse, which apps it reaches, maintenance) belongs to the
architecture seat. You own licence, price and redistribution duty.

## What counts as "added"

A new direct entry in a manifest, for example:

- `package.json` - a new key under `dependencies` or `devDependencies`
- `*.csproj` / `Directory.Packages.props` - a new `<PackageReference Include="...">`
- `pyproject.toml`, `requirements*.txt`, `go.mod`, `Cargo.toml`, `Gemfile`, `pom.xml`, `build.gradle`
- a lockfile only (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, ...) - a new *direct* dependency
  the manifest does not name. Report it: someone installed without saving, or the lock was rewritten.

A changed version of an existing package is out of scope, with one exception: a major-version bump
across which the vendor changed the licence terms (for example permissive to source-available, or to a
paid tier). Treat that as an addition.

## Distribution model

Judge against how the project ships, from the project rules: closed-source SaaS, an installed app or
agent shipped to customers, an open-source library, internal tooling. If the rules do not say, assume
**closed-source commercial software, including an installed client**, and state that assumption. Do not
judge against "free for open source".

## What to answer, per added package

Answer all four. Do not guess. If you cannot establish the licence from the package metadata or the
vendor page, say `unknown` and mark it `high`: an unknown licence is a legal question the author must
close before merge.

1. **Licence.** The SPDX id (MIT, Apache-2.0, BSD-3-Clause, LGPL-3.0, GPL-3.0, AGPL-3.0, BUSL-1.1,
   proprietary, dual). Cite where you read it: the package metadata `license` field, the repo `LICENSE`
   file, or the vendor's pricing page.
2. **Free or commercial for this use**, given the distribution model above.
3. **Price, if commercial.** The figure and the unit - per developer, per build agent, per server, per
   customer, per year. If the vendor lists tiers, name the tier this project would need and why. If the
   price is quote-only, say so.
4. **Redistribution duty.** Whether shipping it inside an installed client or a container image forces
   source disclosure, attribution files, or a notices screen.

## Severity floors

- Copyleft that reaches shipped code (GPL, AGPL, statically linked LGPL) -> `high`, always.
- Unknown or unreadable licence -> `high`.
- Commercial licence with a real price and no evidence the cost was agreed -> `high`. The finding is not
  "this is bad"; it is "someone has to sign off on this spend".
- Permissive (MIT, Apache-2.0, BSD) and free for commercial use -> `info`, one line per package, no
  action. Say it explicitly so the reader knows the check ran.
- A package that duplicates one already referenced in the repo -> `med`, name the existing one.

## Output

One table, then any findings in the orchestrator's normal shape.

| Package | Version | Licence | Free for commercial use | Price | Ships to customer |
|---|---|---|---|---|---|

Keep it to the added packages. Do not audit the existing dependency tree - nobody asked for it here.
