# Frontend seat - performance, state, design system, UI fitness

Read the project rules the orchestrator passed you first. They override this rubric.

**Stack labels.** Rules marked **[React]**, **[TanStack Query]**, **[MUI]** or **[virtualized grid]**
apply only on that stack; on another stack apply the same intent with local idioms. The generic rules
apply everywhere. Add your project's own rules - its wrapper components, design tokens, folder layout,
API layer contract, migrations in progress (for example "new UI uses library B, not legacy library A"),
and repo-wide grep sweeps - to `.claude/review-rules.md` or `CLAUDE.md`.

This file has three parts:
1. **Rules** - is the code well-formed?
2. **Fitness rubric** - is this the right element, in the right place, for the user's task?
3. **Conformance checklist** - does the element have the standard properties?

## Scope

All UI code: rendering perf, file structure, data fetching, design system, theme tokens, grids.

**Scope is the behaviour, not the folder.** When a change alters shared user-facing behaviour and the
product has other clients (desktop, mobile), check the sibling and say whether the change is needed
there. A gap in another client never appears in a web diff.

## Severity

- **high** - perf regression in a grid or long list (recycled rows with stale styles, every-render
  re-render), an accessibility break, two API layers that diverge and ship broken state, a mutation
  that leaves stale UI, a duplicate error toast, Save sending data that has not loaded.
- **med** - file structure and naming, data-fetching misuse, mixing styling systems, raw library
  primitive where a project wrapper exists, legacy library in new code, size caps exceeded.
- **low** - inline style hoisting, util doc comments, comment cleanup.

**A `canX` flag is not a permission.** Hiding a button, filtering a list or disabling an action on a
server-sent flag is presentation only; the request is one curl away. Never report "the UI prevents
it" as a mitigation. When a new flag gates a state-changing call, name the server-side function that
must enforce the same rule, so architecture can confirm the write path agrees.

## High-signal checks (easy to miss on a diff)

- **Global error-notification contract.** Many API layers show an error toast for every failed request
  unless the call opts out. You cannot judge a local `onError` / `catch` toast from the diff alone:
  open the API layer. A local toast on a call that did not opt out = two toasts per failure.
- **Cache invalidation across keys.** Trace each mutation's success handler and list every query now
  stale: sibling lists, history grids, status columns, counters. Canonical miss: a download mutation
  that never refreshes "download history" / "last downloaded by".
- **Effect used for derived state.** State that follows from route state, search params or props uses
  a render-time adjustment, not an effect.
- **DOM mutation in a recycled row** (grid row/cell callbacks setting `element.style.*`) -> stale
  styles under virtualization.
- **Inline function or object in heavy grid props** -> a new reference every render -> grid re-render.
- **The same ordered list encoded twice** (a visibility `switch` plus a parallel ordering array).
- **Saved or unsaved state, remount, Save before load.** For each editor check, default or Save: which
  source does it read, does it survive a tab change, and what does Save send before the data loads?
- **Request the edge firewall can block** (a new cookie, a library that writes cookies, a new query
  parameter, user text in a URL, a GET with a body): hand to architecture with the `file:line`.
- **Raw primitive over the project wrapper, hard-coded colour or font-size literals** - both repeat
  across files; when you flag one, say "check other instances".
- **Repo-wide sweeps.** If the project rules list grep sweeps (for example a banned prop value), run
  each on every frontend review, whatever the diff touches, and report every hit. Offenders are
  usually in files the diff does not touch, which is why diff-only reviews keep missing them.

### Cardinality, UI shape (severity call belongs to architecture)

- **A repeatable row list keyed by array index** while its inputs are controlled. Removing the *middle*
  row shifts every later index; editors keep their instance and get new props. Ask whether removing row
  2 of 3 was exercised, not row 3.
- **An option still offered after it was used.** If the model forbids using the same value twice, the
  dropdown stops offering the taken one. Validating after Save is the symptom fix.
- **A count drawn from a different source than the action it labels.** A header count from one query
  and a bulk action from another disagree at scale.
- **A list that is only correct at 10 rows.** Infinite scroll, virtualization and select-all need a
  realistic volume (thousands) before "works" means anything.
- **Validation that only fires on submit.** Derive the message and disable the confirm control; the
  error appears before the click, not after.

### What a new feature folder always draws

A new feature folder is where review volume concentrates. Walk these before reading logic:

- **Component over ~200 lines.** Count first, not last. A 400-line new component gets "break this up"
  however readable it is. Name the parts: banner, list, row, dialog.
- **A new per-component styles file** when the project keeps styles with the component or in the theme.
- **A style object imported across directories.** The expected fix is a wrapper component that owns
  its own styles; duplication across wrappers is the intended cost.
- **`build*` helpers returning JSX or style objects.** Propose the component, not a rename.
- **A verb-only name** (`normalize`, `transform`, `process`). If a reviewer would ask "normalizing
  *what*?", so should you.
- **A util file named after its one function, with one call site.** Grep the export. One hit -> inline
  it. Two hits -> the file stays but gets a role name.
- **A bare `.map(item => ({...}))` producing a domain shape.** Annotate the result type.
- **The same object literal built inline twice.**
- **A one-off spinner, button or status chip.** Search the shared component folder first. "The shared
  one is the wrong shape" means *add a variant there*, not build a local one.

## External library claims need a citation (blocking)

Before asserting how a UI library or data-fetching library behaves - a prop's meaning, a lifecycle
guarantee, a version-specific fix - check its own documentation and cite the URL. **Pin the version**
from `package.json`: current docs often describe behaviour the installed version does not have. An
uncited claim is a Question.

---

## Part 1 - Rules

### 1. Library choice and migrations

- If the project is migrating from one UI library to another, new screens use the target library;
  extend the legacy one only where it already is. (Declare the direction in the project rules.)
- Do not name things after the library to tell them apart from legacy code (`MuiFooButton`); that
  forces renames when the migration ends.
- **[MUI + Tailwind]** Do not mix utility-class styling into components styled by the component
  library's style prop. `<div className="flex gap-2">` next to `<Box sx>` is the textbook case.

### 2. Design system / theme

- **Theme first.** Colour, typography, spacing and mode-specific values come from theme tokens. Never a
  hard-coded colour name or literal (`"#333"`, `fontSize: "0.8125rem"`, `fontWeight: 500`).
- Raw colour values belong only in the token definition files. Values written elsewhere bypass the
  theme layer and do not change with dark mode or a palette change.
- A style value repeated across files -> a base reusable component with that style.
- **No page-level style overrides of a shared component.** They win on specificity, so later design
  system changes are silently bypassed on that page. If a shared component looks wrong, add a variant
  prop to it so every consumer benefits.

### 3. Reuse components

Reuse before creating. Use the project's wrapper components, not raw library primitives (tooltip,
chip, menu, icon button, confirmation dialog, status badge, buttons, inline progress, page spinner -
list yours in the project rules).

- **If no wrapper exists for a primitive, create it in the shared folder first**, then use it. The first
  author to need it owns the wrapper.
- **"The shared component is the wrong shape" is a reason to add a variant**, not to inline your own.
- Use a grid's built-in search before adding a custom search input. Check a feature (debounce) is
  needed before adding it.

### 4. Rendering performance

- **[React]** No inline function or object in heavy grid or list props. Hoist to a stable reference
  (`useCallback`, `useMemo`, or module level).
- **Derive, do not store.** A value that follows from props, route or other state is computed at render,
  not copied into state and synced with an effect.
- **[React]** State that follows from props or route uses a render-time adjustment:
  `if (navKey !== lastHandledNavKey) { setTab(...); setLastHandledNavKey(navKey); }`. It applies before
  commit (no one-frame flicker).
- **[React]** No inline style objects in render: hoist static ones to module constants; `useMemo` only
  objects that must merge a caller-supplied style. Inline objects defeat memoization.
- Do not overuse `useMemo` when the computation is cheap.
- **[TanStack Query]** No hand-rolled race guards (`isMounted` / `cancelled` refs) - the library already
  handles it.
- **[virtualized grid]** No imperative DOM changes in row/cell-prepared callbacks. Rows recycle and keep
  stale inline styles. Use the grid's class callback or a className plus a CSS rule.

### 5. Idioms / correctness

- **[React]** No `React.FC` on new components; declare props inline:
  `function FooBar({ a, b }: FooBarProps)`.
- **[TypeScript]** `== null` (not `=== null`) when a value can be null *or* undefined. `!x` only when
  `0` and `""` are not valid.
- Grid action columns have a non-empty caption (an empty one breaks screen readers); hide it visually
  if needed.
- **[TypeScript]** Annotate the result type where a collection becomes a domain shape:
  `all.map((item): FileRow => ({...}))`. Inference is not a type check: a renamed field compiles clean
  and the mismatch appears at the consumer. Same for `reduce` accumulators and DTO-building returns.
- **Saved or unsaved: name the source of each value an editor check reads.** A check about what the user
  is editing reads the form state, not the saved record. It must change before a save.
- **A default applied in an effect must survive a remount.** Tabs often mount only the active tab, so a
  ref or state flag resets on each tab change. Apply a default on a user action or at creation, never
  on mount.
- **Save must not send data that has not loaded.** `useState(initial)` seeded from a prop or query that
  arrives after mount stays empty. Disable Save until loaded, and ask what the server does with an empty
  value - an empty list can delete every row.
- **A stored preference is per user and grows with new options.** The storage key contains the user id.
  "All selected" is stored as `null`, not as today's id list.
- **After an `await` in a handler, check the dialog is still open** before navigating or setting state.
- **A failed capability query or lazy import shows a message.** It does not fall back to a permissive
  or empty screen.
- **[TypeScript]** No `any` / `as` escape hatches. A cast is a claim the compiler cannot check; flag it
  unless a short comment gives the reason (third-party `unknown`, narrowing after a runtime guard).
  Do not hide a required value behind `?? fallback`.

### 6. Data fetching [TanStack Query; same intent for other clients]

- **No `useQuery` directly in a component.** Put it in a hook with a key from the feature's key factory.
  A local string key cannot be invalidated elsewhere, and a long global `staleTime` keeps old data.
- Prefer `setQueryData` over `invalidateQueries` when the mutation response already carries the new
  state.
- **A state-changing mutation refreshes every query it affects.** Trace the success handler, list every
  stale key, refresh each. A long `staleTime` plus `refetchOnMount: false` keeps stale data after a route
  change; screens that need fresh data on entry need invalidation **and** a refetch on mount.
- **One error toast per action.** Know the global contract: either opt the call out of the global toast
  and keep the local one (custom wording), or drop the local one.
- A global loading indicator from `useIsFetching` + `useIsMutating`, not per-component spinners.
- If a data-fetching hook is imported, use it. Do not keep two parallel API layers; pick one, migrate
  fully.

### 7. File structure and component responsibility

- Domain logic (types, schemas, queries, API, hooks) lives with its feature; shared feature-agnostic UI
  lives in a shared components folder. Follow the project's layout.
- **Size caps: ~200 lines per component, ~300 per hook.** Move render functions with no closure
  dependencies to their own files.
- **One component = one concern.** Failure alert + file card + history grid + row menu + dialog state is
  not one component. Extract banners and alerts into their own files.
- **Separate logic from presentation with wrapper components** when JSX and decisions are interleaved.
- **The same multi-field shape built inline in two places -> a named transformer** next to its siblings.
  Two copies is the trigger, not three.
- Separate query, mutation and key files per feature.
- **Complex logic -> a hook.** If/else routing chains and nested ternaries -> named helpers.
- **One source of truth for ordered lists.** One `{ name, isVisible }[]` drives both visibility and order.
- **[DevExtreme tabs]** `selectedIndex` counts `visible: false` items; tab-index helpers use absolute
  order. Check the same trap in other tab libraries.
- Delete unused barrel files. New feature folders follow an existing pattern and export style.

### 8. Naming

- The component name reflects its scope. Feature-bound components carry the feature prefix; anything in
  the shared folder must be truly generic.
- Grid cell components carry a grid prefix (`GridEmptyCell`); wizard steps carry the wizard prefix.
- Name the actual UI primitive: a drop zone is `FileDropZone`, not `...Dialog`.
- **No `build*` prefix on functions that return JSX or style objects.** Name the thing, or make it a
  component.
- **A verb without its object is not a name.** `normalizeTitleForMatch`, not `normalize`. If you cannot
  name the object, the function does two things.
- **Util files are named for their role**, not their single function. A helper with one call site does
  not earn its own file.

### 9. Constants and enums

- **[TypeScript]** String unions of domain values -> a const object plus a derived type:
  `export const Role = { Sender: "sender", ... } as const; export type Role = (typeof Role)[keyof typeof Role];`
- Tab indices -> an enum, not `useState<0 | 1 | 2>`.
- MIME types, file extensions, repeated keys and magic numbers -> named constants in the feature's
  constants file; promote helpers used by two features to the shared utilities.
- Do not normalise values that are exact-match shared constants (`trim().toLowerCase()` on both sides
  invites "why?"). Normalise only where casing really differs across the boundary.

### 10. Inline styles, helpers, comments

- **[MUI]** An inline `sx` with more than ~5 properties -> a module-level constant in the same file.
- **Never import a style object from another directory.** Shared style modules look DRY and review as
  coupling: editing one restyles unrelated screens. Use a wrapper component; global values belong in the
  theme.
- Inline helpers -> shared utilities if reusable, else hoisted to module top.
- Comments: see **Comment quality** in `../SKILL.md`.

---

## Part 2 - Fitness rubric (reads the screen as a user, not as a diff)

Shippable, well-formed code still fails users. These items are all catchable from the diff plus the
existing screens, without running the app, by asking **"what is the user trying to do on this screen,
and does this help or interrupt them?"**

### F1. Every client, every time

If the same feature exists in more than one client (web, desktop, mobile), locate the sibling surface
for any change to shared behaviour and state whether the same change is needed there.

- **Silence is a finding.** "I only reviewed the web diff" is a gap, not a scope decision.
- A behaviour removed on one client and left on another is a divergence at `med`.
- Guidance text, empty states and controls present on one client and missing on another are findings
  even when no file of the other client is in the diff. The gap is invisible in the diff by design.

### F2. Feedback in proportion to what the user must do

- **A modal or blocking confirmation on the all-success path is `med`.** If every item in a batch
  succeeded, close quietly and show the outcome where the user already looks.
- Errors, warnings and mixed results interrupt. All-success does not.
- The success signal must **move, not vanish**: a persistent indicator in the list (a tick on the row)
  beats a modal the user dismisses and cannot get back.
- Any end state the user will want to confirm later is visible in the grid, not only in a message.

### F3. The control sits on the element that acts

- **A whole-row click handler** when a specific cell is the real target: put the link on that cell.
- **A whole-container drop zone with no visible boundary** unless a label says so.
- **Every drag-and-drop path has a button alternative** in the same view.
- If the reviewer had to read the handler to learn something was clickable, so will the user.

### F4. The default view answers the question the user came with

For a new or changed grid or popup, answer in the review:

- Which columns does the user need for the decision this screen exists for? Those are the defaults.
- Everything else goes to the column chooser, **hidden by default, not deleted**, and keeps search, sort
  and filter.
- A column nobody needs is noise; removing it is a legitimate finding.
- A modal too small to show the default set is part of the same finding.

### F5. Errors name the value that failed

A "no match" / "not found" / "invalid" message contains **the value that failed**: the file name with
its extension, the id, the searched name. A message that names the failure class without the instance
leaves the user unable to act: `med`, higher when it is the only way to recover.

### F6. Disclose the reach of a change at the point of action

**If the write reaches records outside the scope of the current screen, the screen says so before the
action.** Typical shapes: a file uploaded in one place used by every record that shares it; a template
change that propagates to everything built from it; a shared config used by every service; seed or
reference data that live records point at.

When the diff adds or changes such a write and the UI does not name the other records that will
change, that is `med`, and `high` when the effect is destructive or the same user cannot undo it.

### F7. Colour and styling tell the truth about state

- **Muted grey text means secondary or disabled.** Primary data drawn muted tells the user it does not
  matter.
- A tick, chip or badge maps to one state and means it the same way in every grid.
- Do not let a copied style block decide what a value communicates.

### F8. Labels match what the data is

- Prepositions carry meaning: **"Used by" names an actor; "Used in" names a container.**
- Check each new column header, modal title and button label against its value: actor, container, time
  or count. A wrong preposition sends the user looking for the wrong thing.

### The meta-rule

**When you find one instance, enumerate the class.** A checklist of instances is blind to the next
instance. Before reporting a fitness finding, ask which other screens have the same shape, and say so.

Ownership: QA cross-checks F2, F4 and F6 from the requirements side. Architecture owns F6 when the reach
crosses a service or a shared table. Wording inside these elements goes to the text seat.

---

## Part 3 - Conformance checklist

Many items are **run-only**: a static review cannot confirm them, so list them under "verify
separately". Items a diff *can* catch - a new grid column missing sort/filter/tooltip, a hard-coded date
format, a status id shown to users, delete without confirmation, Save never disabled, an unmasked
secret - are fair to flag directly.

### Grids

- Every column sortable and (where sensible) filterable; filter option lists are searchable and unique.
- A search box; working column chooser, reset layout, export.
- Clear indicators when a filter or sort is applied; the sort survives a filter.
- Columns resizable with a minimum width - never to invisible.
- Large data scrolls (or pages) consistently with the rest of the app.
- An empty state ("No data").
- Overflowing cell text truncated with an ellipsis plus a tooltip with the full text.
- A new column inherits every existing column behaviour (sort, filter, alignment).
- Alignment follows the system convention (numbers right-aligned).
- Dates use the same format as other date columns and the user's timezone; number formatting is
  consistent.
- Every icon has a tooltip.
- Header names follow one capitalisation convention; long headers wrap or truncate with a tooltip.
- A loading indicator while loading.
- **Status columns never show a raw status id** - not in cells, not in filters.
- Version-like values sort correctly.
- Copy actions confirm success.
- Every end state the user will want to confirm later is shown in the grid.
- The column chooser keeps at least one column, and mandatory columns cannot be hidden.
- No double scrollbars.

### Forms

- A label or placeholder on every input; mandatory fields marked; empty mandatory fields highlighted.
- Meaningful error messages; no stack traces.
- Submit disabled until mandatory fields are filled.
- Success and failure messages after submit.
- Length limits enforced.
- Multi-select dropdowns work after scrolling.
- Cancelling a dirty form asks for confirmation.
- Password fields are `type=password`.
- Special characters handled per field.
- Date pickers consistent with the rest of the app.
- Validation in the UI, not only on the server.

### Navigation

- The current location is clear.
- Slow pages show a loader.
- Filters, search and sort are kept when the user comes back.

### Modals

- Consistent title style and capitalisation.
- Consistent buttons.
- Either a bottom Cancel or a top-right close, not both.
- Content scrolls; background dimmed.

### View mode

- A new property has an info icon or help text; abbreviations are explained.
- Truncated text has a tooltip; empty values show a placeholder dash.
- The same field type uses the same icon everywhere.
- Secrets are never visible.
- URLs are real links.
- No overflow at common resolutions.
- Images have alt text.
- No console errors.
- API errors show friendly messages.

### Edit mode

- Save disabled when nothing changed or a mandatory field is empty.
- Everything visible in view mode is present in edit mode.
- Leaving with unsaved changes asks for confirmation.
- **Delete always confirms**, and its control is styled as destructive.
- Disabled fields look disabled.

### Security

- Secrets masked; error messages do not expose system internals; session timeout is announced.

### Toasts and typography

- Error and success toasts are visually distinct; long messages offer "see more".
- Font family, size, weight and spacing consistent; no spelling mistakes.

## Cross-review flag

If a rule is broken once, find every instance and list them in one finding.

## Comments

Judge every added or edited comment in your files against **Comment quality** in `../SKILL.md`. One
finding per file. A deleted comment that carried a safety reason is `med` / `Required`.
