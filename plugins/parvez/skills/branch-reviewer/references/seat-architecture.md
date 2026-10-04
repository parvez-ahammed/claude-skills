# Architecture + business logic seat

Read the project rules the orchestrator passed you first. They override this rubric.

## Scope

- Cross-cutting structure on any stack (backend, frontend, full-stack).
- Business-logic correctness: field meaning, edge cases, races, role-based behaviour.
- "Should this DTO / mapping / service exist at all?" at boundaries (naming of an existing one
  belongs to the backend seat).
- Macro perf: filtering in the database, allocation strategy.
- Fewer comments than the hygiene seats, higher severity per comment.

**Out of scope by default: the PR description.** Read it for the author's intent, then say nothing
about its quality, unless the project rules ask for it. The one exception: a factual contradiction
between what the description claims and what the code does. That is a code finding; report it
against the code.

## Ownership boundary

Architecture owns **macro / structural**: *whether* a thing should exist and *where* it lives. The
backend seat owns **micro / hygiene**: *how* an existing thing is named, formatted or written. Full
split in `../SKILL.md`.

## Severity

Architecture rates higher than the per-stack seats:
- **high** - business-logic bug, permission or security gap, public API leak, race condition, data
  loss.
- **med** - service boundary violation, mapping sanity question, orphan endpoint, coupling between
  integrations.
- **low** - convention drift.

**Authorization findings are floored at `high`** and rated on API reachability, never UI
reachability. Full rule in `../SKILL.md`.

## What to flag

### Structural simplification - "code judo" (med; high when the PR makes the architecture worse)

Be ambitious about structure, not only correctness. The headline question on every diff: **could a
simpler reframing delete a whole branch, helper layer or kind of complexity while keeping behaviour?**

- **Complexity a reframe deletes.** A switch over N near-identical cases, a flag threaded through four
  methods, a helper that only reshapes another helper's output. Propose the restructuring that removes
  the category, and name the concrete smaller design.
- **Thin wrappers / identity abstractions.** A method, class or hook that forwards to one callee,
  renames a field, or wraps one call with no added invariant. Inline it. (One implementation behind an
  interface, a factory for one product, config for a value that never changes: same family.)
- **Feature-specific logic leaking into a shared path.** One integration's `if`, one customer's
  special case, one feature's status string in a layer every feature passes through. Say where it
  belongs.
- **New conditionals scattered across unrelated paths.** `if (isNewMode)` sprinkled into three
  untouched methods is a design signal. The case wants one seam: a branch at one boundary, a strategy,
  a polymorphic handler.
- **Generic mechanism hiding simple structure.** Reflection, dynamic dispatch, a config-driven engine
  or a `Dictionary<string, Func<...>>` where two explicit typed branches would read straighter.
- **File-size explosion.** A file the PR pushes past ~1,000 lines without strong reason. Name the seam
  to split on. (Component and hook caps for UI code live in the frontend seat.)

The backend seat collapses *duplication* in place; architecture asks whether the *shape itself*
should be smaller.

### Service boundaries (mostly med, sometimes high)

- **Bloated services.** New methods added to a service that already does too much belong in a new
  service.
- **Mappings between unrelated types.** A mapping between two types with no properties in common.
- **Event orchestration.** A business service raises **one** event; an orchestrator routes it to
  channels. The same notification must not be sent twice from two places.
- **Coupling between integrations.** Integration A using integration B's enum or types. Lift the type
  to a shared assembly under a neutral name, or give A its own type.
- **Public methods exposing internal helper signatures.** A public method whose parameters only make
  sense to the same service. Make it internal or give callers a higher-level API.
- **Domain model leak across a service boundary.** A service returns the entity instead of a DTO.

### Business-logic correctness (high)

- **Challenge field meaning.** "Recent transfers ordered by the scheduled time" is wrong when a job
  scheduled a year ago ran just now. Pick the field that means what the label says.
- **Build explicit counter-examples as tables** when raising one:
  ```
  Id | Created          | Scheduled        | Upload  | Download
  50 | 2026-05-03 12:00 | 2025-05-03 17:00 | Success | ...
  ```
- **Messaging that depends on the parties.** Wording for "same organisation" vs "another
  organisation" must differ when the product has both.
- **Recipients that depend on direction.** Sender-side events notify the receiver; receiver-side
  events notify the sender; status changes notify both.
- **Hard deletes where the system convention is soft delete** (or the reverse). Check the project
  rules for the convention.

### Authorization (high by default)

Read these in order on every diff that adds or reaches a state-changing route. They apply to any
product with sides or roles.

- **Permission checks verify the user, not only the organisation match.** Necessary, not sufficient.
- **Membership is not permission on a directional operation.** Operations with sides - upload vs
  download, send vs receive, request vs approve, read vs delete - must check **which side the caller
  is on**, not only that the caller belongs to the record. The classic miss is the right user, in a
  legitimate organisation, acting on the wrong side.
- **Read the whole authorization function, not its signature.** An `operation` / `action` / `mode`
  parameter that is accepted and then used on only one branch is the bug. The call site looks right
  because the argument is right there. Open the helper: it is usually unchanged and so invisible in
  the diff.
- **A permission computed for display is a display cache, never enforcement.** A `canX` flag on a DTO,
  a hook, a hidden button, a filtered list. Name the function the **server** calls on the write path
  and read that one. If the only side-aware or role-aware version of the rule lives in the layer that
  draws the screen, that is a `high` on its own.
- **When a rule exists in two places, prove they agree.** Grep every implementation - display flag,
  service guard, controller filter, background job, client - and diff their logic. One strict copy
  plus one permissive copy is `high`, and the permissive one is the one that runs.
- **A guard whose absence breaks zero tests is unverified.** Can the fixture even express an
  unauthorized caller? A suite that always puts the same organisation on both sides makes the gap
  unobservable: green suite, open hole. Demand the negative test and name the arrangement it needs.

### Reuse-invariant check - open the callee, do not trust the diff (high; the most expensive misses)

These ship to production and need hotfixes. They are invisible if you read only the changed lines.

- **For every existing method the diff calls, copies or adapts: open it, state its precondition in one
  line, prove it still holds in the new caller.** If you cannot, flag it.
- **Bulk vs single mismatch.** A method written to process *all* items in one pass often has
  batch-wide assumptions: a shared counter, "assign the same id to everything", one transaction over
  the set. Called per item, those break silently. Real shape: a persist routine built for "all
  schedules at once" was reused for one schedule, and every schedule got the same group id `1`.
- **Logic for one integration reused for another.** Deleting records of type A by calling the delete
  path built for type B; an endpoint for A querying B's tables. Each integration's invariants and data
  shape differ.
- **Storage or lifecycle mismatch.** A file stored in blob storage when its content is already
  persisted as rows: dead duplicate storage. Ask "given how this is stored and read, is this write
  needed at all?"
- **Call order changed on a stateful client.** When the diff reorders calls (from "fetch, delete,
  import per project" to "fetch all, then delete all"), list the state each call reads. A client that
  deletes "in the project it loaded last" now deletes in the wrong one.
- **The re-run path is missing.** If a create / persist / import can happen again (a changed file
  uploaded again), confirm it self-heals (update in place, idempotent) rather than handling only the
  first time. Flag add-only logic with no update or remove branch when the source can change.

### Cardinality - the code works for one of them (high; the highest-volume miss)

The author reasons correctly about the single case and never instantiates the plural one. The code is
not wrong, it is under-specified, and the diff reads fine because the loop is right there. Read what
the loop body writes **to**.

Walk this on every diff that touches a collection, a grouped operation, a multi-file import, a
multi-account path, or a list drawn in the UI:

- **Name every `.First()`, `[0]`, `Single()`, "primary", "current" or "selected" access** and ask what
  the second member does. Real shape: sorting an unrelated item before the current primary changed
  which item was primary, and its shared library got duplicated.
- **Assignment inside a loop where accumulation was meant.** `x = result` keeps only the last;
  `x.AddRange(result)` keeps all. Real shape: an audit file written per group to one key, so only the
  last group survived.
- **A list rebuilt instead of appended**, and the mirror: a list that should be rebuilt but
  accumulates across a retry.
- **Write the type list down, by name.** If a fix applies to one object type, list every type the same
  path handles and check each one individually, or say you checked. Fixing one type per QA round is
  how one bug becomes three reopens.
- **Update-only and match-by-stored-id rules, per type.** For each "update only what exists" or "match
  by stored id" rule, show the stored reference row for each object type it covers. A type with no row
  at the receiver is dropped every time.
- **Force an identity collision.** Two entities sharing the key the code joins on. Real shape: two
  files sharing a project id collapsed into one persisted record.
- **Counts computed two ways must agree.** A "delete all (N)" header and a "select all, then delete"
  count that differ are two queries claiming to be one.
- **The non-last delete.** Removing the second or middle member, not the last one, and checking both
  the destination and any reference store.

The UI shapes of this class (a list keyed by index, an option still offered after it was used) are in
the frontend seat; the severity call is still yours.

### Destructive-path audit - answer all four, in writing (high)

Scope: every delete, soft delete, overwrite, write to an existing location, `catch` that yields an
empty or default result, and every migration with a backfill. Ask explicitly; do not read for it.

1. **What else references this row?** A soft delete that hides a record a live configuration still
   points at is data loss, whatever the column says.
2. **What happens on the second write to this location?** Same storage key, same file path, same
   reference row. Merge, version, or clobber?
3. **Does a catch-all treat "read failed" as "nothing there"?** An exception swallowed into an empty
   list cannot be told apart from an empty source, and the caller then deletes by absence.
4. **Does the migration's backfill opt existing rows into a new active behaviour?** A default correct
   for new records is rarely correct retroactively (a new auto-delete policy applied to every existing
   account).

Also flag a **null or defaulted foreign key on a row that something else deletes by**: it orphans
silently and the orphan shows up only later.

Ask for the four answers in the PR description. If the author cannot answer 2 or 3 for a path in their
own diff, that is the finding.

### External-system claims need a vendor citation (blocking)

Integration work is where this bites. Before asserting that the code sends something an external
system will reject - an operator, a quoting form, a status code, a paging parameter, a version floor -
check the vendor's own documentation and cite the URL. The code shows what we send, never what the
other end accepts, so **consistency reasoning does not cross a vendor boundary**. Divergence between
two of *our* paths is a finding. Divergence between our form and our other form says nothing about
*their* parser. Uncited claims go under Questions: "does X accept Y?", with what would settle it.

### Cross-path consistency sweep (high when paths diverge)

- **When a validation / format / status / permission rule is touched, grep every sibling
  implementation and confirm they agree.** Divergence is a guaranteed user-facing bug.
- Real shape: **file names with spaces** accepted on one upload path and rejected on another - same
  file, two validators, opposite verdicts. Find every path (each upload flow, client and server) and
  ask for one shared rule.
- **"Status" and "latest" are defined once.** A status column that claims "the last uploaded file" but
  reads the last *transfer* (so a new, never-transferred file shows "success"), or a "transfer date"
  that actually shows completion time. The source field and the label must match in grid, detail and
  tooltip.

### Know the global contract before judging local code (high)

Some behaviour is central: error notifications, loading indicators, auth, logging, retries. A local
addition on top duplicates it, and you cannot see that from the diff. Load the global baseline first.
Example: an API layer that already shows an error toast on every failed request, plus a local
`onError` toast = two toasts per failure.

### Will the request pass the edge firewall or gateway? (high on a known blocked shape)

Applies when the project sits behind a WAF, API gateway or strict reverse proxy (say so in the
project rules, with the shapes it blocked before). Local runs and tests usually have no WAF, so a
blocked request works on the developer machine, passes every test, and fails with 403 or 413 only
after a release.

| The diff adds or changes | Typical edge behaviour |
|---|---|
| A GET or DELETE that reads a body | Often blocked. Use POST, or GET with route values |
| A file upload as `multipart/form-data` from a non-browser client (desktop app, service, CLI) | Some managed rule sets block it. A raw `application/octet-stream` body with metadata in the query string usually passes |
| A new query parameter, or a query value the user types (names, search text, filters, formulas, JSON) | May need an allow rule; OWASP Core Rule Set rules block `<>{}`, script text, SQL-like text |
| A new cookie, or a library that writes cookies (auth settings, chat or analytics widgets) | URL-encoded JSON cookies can trip rules and 403 every request |
| A larger body or a longer request (bulk payloads, big files) | Hits body-size and timeout limits |
| Free text in a body that can hold SQL- or script-like text (formulas, notes, Markdown) | Can match SQL injection or XSS rules when body inspection is on |

For each match, list every client that sends the request and the method, URL shape, content type and
body each one sends. A browser-only check misses the other clients.

- **high** for the first four rows when the project has seen that block before; **med** otherwise,
  phrased as a question naming the request shape.
- "It works locally" or "the tests pass" is never evidence.
- **Fix line:** use the shape that already passes, and name the check: run the flow from each client
  against a deployed environment and read the firewall log before release.

### Perf / resource use (macro; micro hygiene goes to backend)

- Filter in the database: "do we need the hidden rows anywhere? If not, leave them out of the query."
- Replace imperative loops with a clearer query form where it reads better.
- Remove per-call allocations. (.NET example: `MD5.HashData(bytes)` instead of `MD5.Create()` per call.)

### Dependency discipline (med; high when it lands in an installed client or a migration path)

The licence and price of an *added* package belong to the dependency seat. You own whether it should
be added at all, and how upgrades are done.

**Adding one:**
- Does the existing stack already solve this? Check the shared libraries first.
- Which apps does it reach? A package added to a shared library ships to every app that links it,
  including installed clients.
- Maintained, no known advisories?
- Frontend: bundle size impact.

**Upgrading one:**
- **Read the changelog, not the version number.** Semver is a promise, not a guarantee.
- **One dependency per PR.** A bulk bump hides which package broke and cannot be reverted cleanly.
- **Let the suite decide.** Green before and after; "it installed" is not verification.
- **Review the lockfile diff.** Most of what ships is transitive. Never hand-edit it; always commit it.
- A bulk "bump dependencies" PR with no changelog review is `med` on sight.

### Dead code / orphans (architecture level; in-file dead blocks go to backend)

- Unused hooks, unrendered components, orphan endpoints, imports that are never used (especially a
  data-fetching hook imported and then bypassed by a direct call).
- **Propose, do not delete silently.** An "unused" member is sometimes called by reflection, a job
  name, a serialized enum value, or another client's only call site.

```
DEAD CODE IDENTIFIED:
- <member> in <file> - replaced by <what>
-> safe to remove?
```

### Conventions

Consistency with established suffix and naming conventions for enums, events and codes. Check the
project rules; flag drift.

## Cross-review flag

If a problem appears once, find every instance and list them in one finding.

## Comments

Judge every added or edited comment in your files against **Comment quality** in `../SKILL.md`. Group
into one finding per file. A deleted comment that carried a safety reason is `med` / `Required`.
