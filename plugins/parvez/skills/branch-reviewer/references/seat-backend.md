# Backend hygiene seat

Read the project rules the orchestrator passed you first. They override this rubric. Where the project
rules are silent, review against the generic rules below, then the language's official style
conventions.

**Stack labels.** Rules marked **[.NET]** or **[EF Core]** apply only on that stack; skip them on
others and apply the same intent with the local idioms. Add your own project-specific rules (base
classes to reuse, exception types, logging fields, constant locations, naming suffixes) to
`.claude/review-rules.md` or `CLAUDE.md`.

## Scope

Server-side code (services, integrations, controllers, data access, background jobs, DTOs, mappers)
plus repo hygiene on backend assets (build files, IDE config, docs next to code).

## Ownership boundary

Backend owns **micro / hygiene**: naming, formatting, DRY within reach, in-file dead blocks, perf
micro-patterns. Architecture owns **macro / structural**. Full split in `../SKILL.md`.

## Severity

- **high** - perf regression on a hot path, public API break, security or permission gap, a
  cancellation token accepted and dropped where it can leak handles, a copy-pasted domain branch
  flipped so it notifies the wrong party, a server check that rejects every request from one client.
- **med** - naming, DRY, DTO shape, repo hygiene, dead code, not-found vs bad-request semantics,
  methods over the size cap.
- **low** - formatting, blank lines, comment style.

**Authorization findings are floored at `high`** and rated on API reachability. Architecture owns
them; raise one here only if architecture is not running. A tenant/organisation match without a user
check is one shape; the other is a verified user on the **wrong side** of a directional operation. If
a state-changing action calls an authorization helper, open the helper and read it end to end.

## High-signal checks (easy to miss on a diff)

- **Copy-pasted provider family.** Five near-identical resolvers each repeating try/catch, the type
  check and the same two queries. Expected shape: a base class plus a small override.
- **Risky domain branch copied.** The same `direction == A ? partyA : partyB` ternary in two or more
  classes. A flipped copy notifies the wrong party. Centralise it in one named helper.
- **Method over 150 lines** (new or changed): `med` / Required. Count on every changed method. Split at
  its steps (resolve, check, import) into named private methods.
- **Lying structured logs.** A `{EventType}` placeholder fed a different value; a multi-event handler
  logging one hardcoded event type. Label and value must agree.
- **Cancellation token accepted then ignored.** A public async method takes a token, inner I/O calls do
  not receive it.
- **Formatter drift.** Column-aligned `=`, mixed indentation, anything the IDE formatter would change.
- **Bare dictionary read that can throw.** `dict[key]` read, or `ContainsKey` then indexer -> a single
  try-get. Writes `dict[key] = v` are fine.
- **Locally constructed disposable never disposed** (HTTP content, responses, streams, hash
  instances). Client upload and download helpers are the usual site.
- **Unreachable guard.** `if (ids.Count > 0)` on a list the surrounding branch already proved
  non-empty. Delete it, or add the missing `else`. Reviewers read it as "the author was not sure what
  this holds".
- **Server check that trusts a request header (high).** A filter, middleware or validator that reads
  `Content-Length`, a header, a claim or a query value must handle it absent. Some HTTP clients always
  send chunked bodies with no `Content-Length`. A size check written as `ContentLength <= limit` with a
  nullable length evaluates `null <= x` as false and rejects every request from that client. Ask for a
  test of the absent case and list which clients call the endpoint.
- **Backend change checked against one client only (high).** For each changed endpoint, check, DTO or
  status code, find every caller (web UI, desktop or mobile app, installed agent, third-party
  integration) and confirm each still works, including old installed builds. They often send requests
  differently.
- **Request the edge firewall can block** (GET with a body, multipart from a non-browser client, a new
  query parameter, a new cookie, a larger body): hand to architecture with the `file:line`.
- **Delete through the wrong save path.** If the project routes soft deletes through a special save
  method or interceptor, every unit of work that removes a soft-deletable entity must use it; add-only
  units must not be switched.

## Never infer an external API's contract from this codebase (blocking)

Integration code is where this bites, and it is your scope. Any claim about an external system's
syntax, operators, status codes, paging, limits or version floors needs the vendor's documentation,
with the URL in the finding. "It looks inconsistent with its neighbours" is a Question. A recorded
live probe outranks vendor prose.

## Read the tests before the implementation - but do not report on them

What the tests assert tells you what the author believed the change does; the gap between that and
the diff is where your findings are. **Test quality and missing tests belong to the tests seat.** If
you spot one, add a single handover line at the end (`For tests seat: <one line>`) and move on.

---

## Rules

### 1. Formatting

- Output matches the IDE's or the formatter's "format document". Flag what it would change.
- No column-aligned `=` or `,` - one space around `=`, no padding to line up with neighbours.
- No mixed indentation in a file.
- **[.NET]** Drop explicit enum values when they equal the defaults. Keep them for `[Flags]`, for
  enums persisted as integers that need stable values, and for gaps.
- DTO blank-line style follows the siblings in the same folder.
- If the project groups members with `#region`: **one region of each name per class**. A feature
  that adds methods extends the existing region; it never opens a second pair with the same names.
  Grep for repeated region names; do not eyeball.

### 2. Naming

- **Service methods include the subject noun:** `CreateReportAsync`, not `ReportService.CreateAsync`.
- **Timestamps split by purpose.** Audit fields follow the project's base DTO names; domain event
  timestamps say what happened (`UploadedAt`, `PausedAt`). Do not "correct" one into the other.
- No storage-layer suffix on a plain foreign key (`scheduleId`, not `scheduleDbId`) unless it must be
  told apart from a separate business id in the same scope.
- Input DTOs follow the project's input-model suffix convention.
- **No short variable names** (`kvp`, `dt`, `ws`, `ea`). Spell them out, also in `foreach` and `out`
  variables. Lambda parameters (`x`) and loop counters (`i`) are fine.
- **The name matches the behaviour.** A `*IfRequired` or `Try*` with no condition drops the suffix; an
  `ImportAsync` that only processes is `ProcessAsync`.
- Singular scalars, plural collections; integer counts end in `Count`. **One term per concept across
  layers** (Schedule **or** Project, not both).
- **No invented vocabulary or cryptic references.** Use the established domain word. A new reader
  understands the names without a glossary.
- No trailing version letter on folder or project names; versioning lives in the build file.

### 3. DRY / inheritance

- **Reuse the base DTOs** before adding `Created*` / `Modified*` / `*ModifierId` fields by hand.
- Identical-property DTOs -> a base class.
- **Look for an existing base class** before hand-writing a sibling resolver, provider or service.
- **[EF Core]** N query methods that differ only by `Include` -> one method with an include-function
  parameter.
- **Repeated branch on a domain flag -> one named helper.** A silently flipped copy sends data to the
  wrong party.
- **The same two-step inline pattern twice in one PR -> a small util**, even if each copy is one line.
- **A long block doing a separable sub-task -> a named private method**, even if used once, so the
  caller reads as a list of intents.
- **Methods over 150 lines** are `med` / Required.
- Boilerplate prelude shared by twin methods -> one initializer helper.
- **One class per file.** No multi-class bundles. No two utility classes with the same name in one
  assembly or package.
- No dead `= new()` on a sub-object every caller overwrites.
- **Nullable consistency:** a nullable foreign key implies a nullable timestamp next to it.

### 4. Perf micro-patterns

- A set over a list for contains/lookup-heavy loops.
- Dictionary creation from data that may hold duplicate keys: handle duplicates explicitly (group
  first, or a safe builder) instead of throwing at runtime.
- **[EF Core]** `ExecuteUpdateAsync` / `ExecuteDeleteAsync` for bulk writes - never load a table to
  change one column.
- Combine several database round trips into one query.
- One try-get lookup instead of contains-then-index.

### 5. Layering / correctness

- **Never expose domain models at a service boundary** - map to a DTO. Input models only on input.
- One interface / service per responsibility; do not bolt a new concern onto an existing service.
- Authorization at controller level when every action shares a policy. **Permission checks verify the
  user, not only the organisation.**
- Config holds full URLs; code only appends query parameters. Do not leak one integration's concepts
  into a generic path.
- **A lookup miss is "not found" (404 semantics), not "bad request".** "X with id 5 not found" inside a
  bad-request exception contradicts itself. Do not copy legacy code that does this; do not mass-migrate
  it either.
- **A catch-all that swallows needs a one-line why** in place, plus enough log context (event, entity
  id) to diagnose.
- **[EF Core / LINQ]** Conditional filters compose instead of using a ternary: start from the base
  query, then `if (flag) query = query.Where(...)`. A method that takes a query takes
  `IQueryable<T>`, and callers assign the query to a named local before passing it. Named
  expression builders are for predicates reused across queries, not one-off filters.
- **Make types explicit.** A named typed model over `object` / `dynamic` / `Dictionary<string, object>`,
  and over cast-heavy code that recovers a type the design could carry. Question optionality: a
  nullable field no path leaves null is a false signal. Do not hide a missing required value behind
  `?? default`.

### 6. DI / async hygiene

- **[.NET]** Inject `ILogger<T>` (not `ILogger`, not `ILoggerFactory`). No `_logger?.` - DI guarantees
  non-null.
- No optional DI parameters with `null` defaults. Make the dependency required or register a no-op.
- **Five or more parameters, or repeated triads** (`accountId, projectId, jobId`) -> a context record.
- **Cancellation propagation:** if a public async method takes a token, every inner async I/O call
  receives it.
- **One-time setup belongs at startup**, not in a per-call hot path (library licence keys, security
  protocol settings, global serializer settings).
- **No `async` without `await`.** Same failure semantics across sibling branches (do not return empty
  in one and throw in another).
- **Every locally constructed disposable is disposed** (`using`). HTTP content, responses, streams,
  hash instances. Injected or DI-owned objects and a shared `HttpClient` are the exceptions.

### 7. Constants / literals

- Magic strings and numbers -> a constant or an enum. The same literal in two places in a PR is a
  constant.
- Inline defaults (font size, colour, date format, validation range) -> constants.
- Constants live in dedicated files per topic; do not bloat a service with a large constant block.
- Follow the project's chosen serializer; do not add a second JSON library.

### 8. Logging

- Structured-log placeholder names match the values passed.
- A handler that serves several event types logs the current one, not a hardcoded one.
- **A `catch` that returns null, empty or a default logs a Warning with the entity id**, and does not
  catch `OperationCanceledException` (or the stack's cancellation signal).
- A condition the user must know about is a Warning (or a user-visible warning record), not an Info
  line.
- **Every log line in a long-running job carries the job / correlation id.** Support finds lines by it.
- **A guard that refuses a job sets a terminal status.** A refusal that leaves the job "pending" shows
  as "overdue" with no reason.

### 9. Dead code / repo hygiene

- No commented-out blocks, empty classes, unused imports, or test-only paths in production code.
- **A guard that can never be false is dead code.** Decide: delete it, or the real finding is the
  missing `else`.
- No personal IDE config committed (`.code-workspace`, `.vs/`, `.idea/` user files, personal launch
  settings). No unexplained build-file overrides. Do not silently comment out previously active
  infrastructure.

### 10. Comments

Do not restate code. Document a non-obvious why only, in plain full sentences. No worked-example values
or ticket history in source. Full rule: **Comment quality** in `../SKILL.md`.

### 11. Sync, import and delete-by-absence correctness

Any subsystem that copies data between systems and deletes what is "not there any more" **deletes by
omission and guards by identity**. Nearly every data-loss bug in such code is one of these. A
violation is a data-loss finding, not a nit.

- **Reader / writer key symmetry.** Stored data keyed by a composed string (`{sourceId}|{scope}`): a
  reader that builds a different key than the writer reads a scope that never exists, gets an empty
  result, and the guard on top of it goes silently dead. When you touch the key builder or add a
  reader, grep every caller, split readers from writers, confirm identical keys. Grouped operations are
  the classic trap: writers key the real per-member scope, a reader keys the synthetic parent.
- **No identity comparison against a hand-built object.** If a DTO's id defaults to a new random GUID,
  an object built with `new Dto { ... }` carries a fresh id. A guard comparing it to a stored id never
  matches and passes unconditionally - which deletes live data. Anything that reaches an identity
  check goes through the mapper that sets the real id.
- **Empty source list = delete all.** "Remove what is NOT in this list" with an empty list removes
  everything of that type. Before trusting a source list, ask: can it be empty for any reason other
  than "nothing at the source" (a partial export, a filter, a skipped fan-out, a failed page)? If yes,
  that is a mass delete. Under-delete (leave stale rows) fails safe; over-delete fails destructive. The
  abort-on-fetch-failure guard often sits far from the delete; keep them coupled with a comment so a
  later edit cannot split them.
- **List the code that runs for the first time.** A fix that changes the shape of data (a dictionary
  going from one key to N, a fallback that stops firing) makes branches like `if (x != primary)` run
  for the first time. That first run is where data loss hides. List every previously dead branch.
- **Second instance of a formerly single thing.** A feature that adds N of what was always 1 breaks
  wherever old code used "the one" as a fallback or assumed a single id. Grep the touched paths for
  `primary`, `First()`, `Single`, single-id parameters, and the paths never updated to fan out.
- **Trace harm to the output, not the intermediate.** A wrong intermediate value proves nothing until
  traced to the destination payload or something a user sees. "This column is wrong" plus "nothing
  reads it before it is overwritten" is cosmetic.

### 12. Backward compatibility with clients you do not deploy

**Trigger:** any change to code that ships in a client you do not control the rollout of (desktop app,
mobile app, installed agent, SDK, third-party integration), or a server change such a client depends
on. Assume the oldest supported client stays live forever.

- **Both directions must behave exactly as today for the path that was not updated.** The server
  deploys first; clients lag. Dominant case **new server + old client**: the server must never *need*
  a new field from the client, send a shape the old client cannot read, or remove a field or route the
  old client uses. Secondary case **new client + old server**: the client degrades, never demands.
- **What breaks a lagging client, all silently:** a removed, renamed or retyped field or route; a new
  *required* request field (the server rejects it); a reused or reordered enum value; an existing field
  given a new meaning; tightened validation that rejects a previously valid payload; a wrapped or
  restructured response.
- **The contract is additive only.** Never remove, rename, retype or repurpose what a client touches.
  Deprecate in place; delete after the support floor passes it. New meaning = new field. New state =
  an enum member *appended*, never inserted, when enums serialize as integers.
- **Requests:** a new field is optional and the server falls back to the old behaviour. **Responses:**
  add fields, never restructure. Reference shape: a nullable list read as
  `list is { Count: > 0 } ? list : [singleOldValue]`, so both skews behave as today.
- **Tolerant deserialization is the assumption everything rests on - verify it once.** Additive-only is
  safe only if unknown JSON members are ignored on both sides. Prefer enums as strings with a default
  case over enums as integers.
- **Support floor, made loud.** If a server change cannot support an old client, refuse with an
  explicit "update required" gated on a minimum client version. Never a silent break.
- **Put data-safety guards on the side you deploy - the server.** A fix only in the client protects
  nobody until they update, which may be never.

## Cross-review flag

If a rule is broken once, find every instance and list them in one finding.

## Comments

Judge every added or edited comment in your files against **Comment quality** in `../SKILL.md`. One
finding per file. A deleted comment that carried a safety reason is `med` / `Required`.
