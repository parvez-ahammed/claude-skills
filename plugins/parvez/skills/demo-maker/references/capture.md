# Capture reference

The scripts in `scripts/` are a starting point, not finished tools. Copy `helpers.js`, `extract.py`,
`build.py` and `deskshot/` into `<work-dir>/capture/`, and `demo.css` into `<work-dir>/demo/`. Then
change, per demo:

- `helpers.js`: nothing, usually. The fakes are set up from the page with `__fakeModule` or
  `__blockWrites`.
- `extract.py`: pass the app origin and let it pick up every `*.html` snapshot in the folder.
- `build.py`: the `PAGES` list and the `REPLACEMENTS`. Replacements must match the Reworded rows of
  the text register.
- `deskshot/Screens.cs`: rewrite it for the demo. `Program.cs` (setup, `Snap`, `Composite`) stays.
- The page scripts `build.py` links (`demo.js`, `demo-data.js`, `demo-nav.js`) are written per demo:
  the step panel (`.demo-panel` in `demo.css`), the state switching, and the sample data.

## Web capture

### 1. Servers and sign-in

Start the app's dev server and API if they are not running, and wait for a health check. Use a
browser the user is already signed in to. Automation profiles (for example a fresh Playwright
profile) are usually signed out; if the page shows a sign-in or landing page, ask the user to sign
in. Some SPAs hang on "Loading..." after a full reload of a private route - load `/` and click the
nav link instead.

Any browser automation that can run JavaScript in the page works:

| Tool | Run JS | Get a large string out |
|---|---|---|
| Playwright MCP | `browser_evaluate` | `__download(name)`, then read the downloaded file |
| Chrome extension (Claude in Chrome) | its JavaScript tool | `__download(name)` |
| A CLI-driven browser (`<cli> eval --expression ...`) | eval command | redirect stdout to a file, decode as UTF-8 |

Do not return a whole snapshot through an MCP tool result - it is megabytes of HTML and CSS and
fills the context. Download it, or have the tool write it to disk.

### 2. Load the helpers

Evaluate the full text of `scripts/helpers.js` in the page. It defines:

- `await __snap(name)`: saves `<body>` plus all CSS to `window.__snaps[name]`; returns the size.
- `__download(name)`: saves `window.__snaps[name]` as `name.html` in the browser's download folder.
- `__blockWrites(allow?)`: patches `fetch` and `XMLHttpRequest`; every non-GET request returns
  `200 {}` without reaching the server. `allow` is an optional URL regex that may still pass.
- `await __fakeModule(path, { method: fn })`: imports a dev-server module and replaces methods on
  its exported objects. Vite and other ES-module dev servers return the same instance the app uses.
- `__dropFiles(target, names, type)`: fires a real `DragEvent` with a `DataTransfer` of fake files.
- `__findByComponent(name)`: React only - finds the first DOM node rendered by a component name
  (walks `__reactFiber$` keys). For Vue use `el.__vueParentComponent`, for Angular `ng.getComponent`.

### 3. Fake every write before the first click

List every POST, PUT, PATCH and DELETE the flow can reach. Fake each one with `__fakeModule` (to
return realistic data, for example a result dialog's payload) and call `__blockWrites()` as a
safety net. Count the write lines in the API log before and after the capture: only GETs and
polls may appear. Reload the tab when done, or later work from that tab stays blocked.

Example (Vite + an API object export):

```js
await __fakeModule("/src/apis/orders/orders.api.ts", {
  "ordersApi.submit": async () => ({ id: 1, status: "Accepted" }),
});
__blockWrites();
```

### 4. Snapshot every state the new flow reuses

Take all snapshots in one page session, so the last one holds every CSS-in-JS rule. Always include:

- the page before any action;
- each dialog variant (confirm, empty, error);
- status chips or badges of each colour (success, warning, error, info);
- a disabled button with a spinner;
- a tooltip (hover with a dispatched `MouseEvent`);
- a toast or snackbar.

Also include what is specific to the change: a drag overlay, selected rows, a partial failure.
Bring the tab to the front and take a screenshot before each snapshot.

### 5. Export, extract, fix assets

1. Export each snapshot to `capture/<name>.html` (`__download`, or a CLI eval redirected to a file).
2. `python extract.py --origin http://localhost:<port>` writes `demo/assets/app.css` (from the last
   snapshot) and `capture/parts/<name>.body.html`, and downloads every `url(...)` and `<img src>`
   on the origin into `demo/assets/`.
3. Fix the assets: run `file demo/assets/*` (or check the first bytes). Every font or image that is
   really HTML came from a relative URL in an injected `<style>`. Replace it with the file of the
   same name from `node_modules` (`@fontsource/*/files`, the component library's icon-font folder)
   or `src/`.

### 6. Build and serve

1. Edit `PAGES` and `REPLACEMENTS` in `build.py`, then `python build.py`. Pages get versioned links
   (`?v=`), and dev-only overlays are hidden with CSS.
2. `python -m http.server <port>` in the work folder. Open pages with `?r=<time>`.

### Compose new states

Find these class names in the parts and reuse them:

- the dialog shell and its title row;
- chips or badges, one per variant;
- buttons: primary, secondary, disabled;
- the spinner, the tooltip popper and the toast;
- the rows and list items the feature already uses.

CSS-in-JS class names (`css-1abc2de`) are stable within one build. Re-capture after the app's
styles change.

## Desktop capture (WinForms)

The same principle: render the client's own controls, not look-alikes. Third-party suites
(DevExpress, Telerik, Syncfusion, Infragistics) draw their own skin, so only the real control
gives the real look.

1. **Start the client** from its build output in the background. Check that the exe is newer than
   the feature's source files. Ask the user to sign in if needed.
2. **Backdrop.** Take a screenshot of the running main window on the right tab with any desktop
   automation (computer-use tool, `PrintWindow` on its handle, or the user's own screenshot). Save
   it to `capture/desktop-backdrop.png`. Native file pickers usually ignore synthetic typing - do
   not try to drive them.
3. **Tool.** `scripts/deskshot` is a `net8.0-windows` WinExe.
   - Set `ClientBin` in `deskshot.csproj` to the client's build output folder, and add a
     `<Reference>` for each client or vendor DLL you construct forms from. `Program.cs` resolves
     every other assembly from the same folder at run time.
   - Repeat the client's startup setup in `Program.ApplyClientSetup` (skin, accent colour, default
     font, DPI mode) - copy it from the client's `Main`. For DevExpress that is typically
     `UserLookAndFeel.Default.SetSkinStyle(...)` and `WindowsFormsSettings.SetAccentColor(...)`.
   - `dotnet run -- real` renders today's dialogs with sample data (the reference to compare
     against). `dotnet run -- new` renders the new screens. Edit both in `Screens.cs`.
4. **Traps.**
   - Use `PrintWindow(hwnd, hdc, 2)` (`PW_RENDERFULLCONTENT`), not a screen copy. A screen copy
     captures the lock screen or whatever window is on top.
   - Target the same .NET version as the client. Vendor controls can fail on a newer runtime (for
     example a license or icon check that throws), so do not run them from a PowerShell host that
     loads a different runtime.
   - Grids: add columns explicitly. Auto-populate often gives no columns before the form has a
     handle. Set the focused row in `form.Shown`.
   - A changed toolbar or status line: render the real control with `DrawToBitmap` (set
     `TabStop = false` to avoid a focus border) and paste it at the measured pixel position on the
     backdrop.
   - Dialogs: composite at the centre of the backdrop, the way `ShowDialog(owner)` with
     `CenterParent` places them. `Program.Composite` does this, with a light shadow.
5. **Viewer.** Make `desktop.html` a step viewer of the PNGs (arrow keys, the same demo panel as
   the web pages).
