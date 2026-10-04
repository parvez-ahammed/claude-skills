---
name: demo-maker
description: >-
  Build a pixel-exact, clickable HTML demo of a planned workflow that looks exactly like the app's
  real components - web via a DOM + CSS snapshot of the running, signed-in app; desktop (WinForms)
  via the app's own controls rendered off-screen. Use whenever the user asks for an HTML demo,
  clickable mockup, prototype, "pixel perfect demo", "how exactly will this workflow look", "show
  the PO / stakeholders how it will look", or a demo for a ticket or user story in a web app, a
  desktop client or both - even if they do not say "skill". Not for free-form design exploration
  or Figma work.
---

# demo-maker

Build a demo of a new workflow from the app's own rendered components, not from look-alikes. Web:
the live page's DOM and CSS, captured from the running app. Desktop: the client's own controls,
rendered to PNG. The output is a folder of static HTML (for example `<work-dir>/<ticket>/demo/`).
No product code changes.

The value is the capture technique and its traps. A hand-written mockup that is "close to" the app
drifts in spacing, fonts and colours, and stakeholders then argue about the drift instead of the
workflow.

## When to use / not use

- Use when: a planned change to an existing app must be shown as it will really look, step by step,
  before or while it is built.
- Do not use when: the app does not exist yet or the screen is new from scratch (use a design tool),
  or the user wants a UX critique of today's screen (use a review skill).

## Principle: stay as close as possible to the current app

This decides every design question:

1. Extend today's flow. For N items, repeat today's single-item content once per item (sections,
   blocks, rows). Do not design a new layout.
2. Reuse today's texts, components and behaviour. Search the codebase for an existing string first
   (tab labels, shared upload components, wait captions, grid captions, server messages).
3. A text is New only when the app has no text for the case. Aim for a handful. A first demo that
   invents fifty texts gets cut back to four after review - do the cutting before you build.
4. Research findings that need new UI (summary chips, progress lines, extra buttons) go to "Open
   questions" in the demo. They are not added to the demo.

## Workflow (each phase ends at a gate)

1. **Ticket and flow shape.** Read the ticket or story, including acceptance criteria. Ask one
   question at a time. Gate: the user picks the flow shape.
2. **Research.** Run two background agents in parallel:
   - public UX sources (NN/g, GOV.UK, USWDS, Carbon, Fluent, W3C WAI), ending with numbered rules
     and the findings that contradict the chosen direction;
   - repo side: the feature's code, earlier decisions and stakeholder feedback, backend limits,
     reusable components, and what breaks when one item becomes several.

   Present the changed design as a table (change, why) and ask only the product questions the code
   cannot answer. Gate: the user approves the design.
3. **Text register, before any HTML.** Fill `demo/text-register.md` (template below). Show the
   counts per category and every New and Reworded row. Gate: the user accepts the register. Web and
   desktop use one string for one meaning. The build scripts may only write texts from the register.
4. **Capture the web.** See `references/capture.md` > Web capture. Load `scripts/helpers.js` into
   the signed-in tab. Fake every write call the flow can reach (upload, delete, save, submit)
   **before** you click anything. Open every existing state the new flow reuses and snapshot each
   one. Then run `extract.py` and `build.py`.
5. **Compose.** New states use only class names found in the captured parts. `demo.css` holds only
   layout the new sections add (gap, flex), plus the demo step panel. Keep today's unchanged screen
   as its own page.
6. **Desktop (optional).** See `references/capture.md` > Desktop capture. `scripts/deskshot` renders
   real WinForms forms off-screen with `PrintWindow` and composites them over a screenshot of the
   running client.
7. **Verify.** Screenshot every step with browser automation, then look at each image. Check:
   - every web font and icon font reports `loaded` (`document.fonts`);
   - no page errors in the console;
   - the unchanged page matches the capture;
   - one full click-through of the main path, with every button in it;
   - the app's API log shows no write calls during capture.
8. **Deliver.** `index.html` holds the step thumbnails, the rules with their sources, the text
   register and the open questions. Open it for the user. List every process you started (API,
   dev server, desktop client, http server).

## Text register template

| # | Text | Where (web/desktop) | Category | Source or reason |
|---|------|------|----------|------------------|
| 1 | Upload Files | web toolbar, desktop toolbar | Reworded | Ticket: several files. Was "Upload File" |

Categories:
- **Reused**: today's text, cite `file:line`.
- **Reworded**: today's text changed; the reason must come from the ticket.
- **New**: text that is not in the app today.
- **Sample data**: invented server messages or names. Mark them as sample in the demo too.

A reworded text that the ticket does not require goes back to today's wording.

## Gotchas

- **Fonts fall back silently.** Bundlers (Vite and others) inject package CSS as `<style>` tags, so
  relative font URLs resolve against the page and download `index.html`. Replace every asset that
  `file` reports as HTML with the real file from `node_modules` (`@fontsource/*/files`, the
  component library's icon-font folder) or `src/`.
- **CSS-in-JS rules live only in the CSSOM.** Emotion, styled-components and JSS insert rules with
  `insertRule`, so the `<style>` text is empty. Read `cssRules` for those sheets.
- **`cssRules` drops `var()` shorthands.** `border: 1px solid var(--x)` serialises as empty
  longhands, and every outlined panel loses its border. Use a `<style>` tag's `textContent` when it
  has text; fall back to `cssRules` only for empty (CSSOM-filled) sheets. `helpers.js` does this.
- **Use the last snapshot of one page session.** CSS-in-JS in dev mode never removes a rule, so the
  last snapshot holds every rule from all earlier states. Never merge CSS from several snapshots by
  line - it breaks multi-line `@media` blocks.
- **Fake writes before the first click.** With an ES-module dev server, `await import("/src/...")`
  returns the same module instance the app uses, so replacing a method on an exported object fakes
  the server. Named function exports cannot be reassigned - block writes at the network level
  (`__blockWrites()` patches `fetch` and `XMLHttpRequest`), and reload the tab afterwards.
- **Paint the tab before you snapshot.** A background tab may not lay out virtualised grids or
  dialogs. Bring it to the front and take a screenshot before each snapshot or click.
- **Read eval output as UTF-8.** Piping a CLI's eval output into Python on Windows decodes it as
  cp1252: bullets become mojibake and icon-font glyphs break. Use
  `io.TextIOWrapper(sys.stdin.buffer, encoding="utf-8")`, or download the snapshot as a file.
- **Do not cut the body.** Dialog, popover and toast portals sit after the app root. Hide dev-only
  overlays (for example TanStack Query devtools, `.tsqd-parent-container`) with CSS instead.
- **`file:` URLs break fonts and are blocked by Playwright.** Serve the folder with
  `python -m http.server` and add `?r=<time>` to page URLs to avoid a cached page.
- **A missing `</div>` shows as a darker, indented second section.** Count closing tags against the
  captured markup when you compose a new state from parts.

## Common mistakes

| Mistake | Fix |
|---|---|
| Hand-written CSS "close to" the app | Only captured classes; measure against the capture page |
| Web and desktop wording drift | One register row per meaning, both columns filled |
| Inventing server messages | Copy real messages from backend code, or list them as Sample data |
| Treating the scripts as finished tools | They are a starting point: state names, faked methods, text replacements and new screens change per demo |
| New wording, chips or progress lines because research suggests them | Reuse the existing text or component; list the idea as an open question |
| Skipping phases because the user is in a hurry | Nothing is skipped. Keep questions short instead, and say which phases remain |
| Patch scripts written in a shell heredoc | Backslashes get lost; write the file with a file-write tool |

## Reference map

- `references/capture.md` - read before phase 4 (web) and phase 6 (desktop): exact steps and traps.
- `scripts/helpers.js` - load into the signed-in page: `__snap`, `__download`, `__blockWrites`,
  `__fakeModule`, `__dropFiles`, `__findByComponent`.
- `scripts/extract.py` - snapshots to `demo/assets/app.css` + `capture/parts/*.body.html`.
- `scripts/build.py` - parts to demo pages; edit `PAGES` and `REPLACEMENTS` per demo.
- `scripts/demo.css` - the demo step panel and a few layout helpers.
- `scripts/deskshot/` - net8.0-windows tool that renders WinForms forms to PNG and composites them.
