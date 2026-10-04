# Test environment - <project name>

Copy this file into the project (for example `.claude/test-environment.md`) and fill in every
`<...>`. Delete the hints once a section is filled. Record the date you last checked it, because
ports and sign-in flows change.

Last checked: <YYYY-MM-DD>

## 1. What runs, and on which port

| Port | Process | How to start it |
|---|---|---|
| <api-port> (https) | <API host> | `<command>` |
| <ui-port> | <UI dev server> | `<command>` (check the real script name: `start` or `dev`) |
| <other-port> | <realtime / worker / ...> | `<command>` |

Check what is already listening before you start anything. The user often runs the API and UI in
their IDE.

```powershell
# Windows
Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -in <ports> } |
  ForEach-Object { "$($_.LocalPort) -> $((Get-Process -Id $_.OwningProcess).ProcessName)" }
```

```bash
# macOS / Linux
lsof -iTCP -sTCP:LISTEN -n -P | grep -E ':(<port1>|<port2>)'
```

Trap: starting a second copy of the API on a bound port fails with an "address in use" error. That
means it is already up, not that it is broken.

Side effects of starting it yourself: <for example "applies pending database migrations on
startup" - say so to the user before you start it>.

## 2. Prove the running build holds the code under test

A running API is a compiled binary. It does not follow your branch.

```powershell
(Get-Process -Id <pid>).StartTime
(Get-Item "<path to build output>/<changed assembly or bundle>").LastWriteTime
git log -1 --format=%cd HEAD
```

Both times must be later than the commit. If they are not, ask the user to restart from their IDE.

UI: <a hot-reload dev server always reflects the working tree / a built bundle does not - say which>.

Trap: if you ran a "does the test fail without the fix" check (stash, build, test, pop), rebuild
right after the pop. Otherwise the build without the fix stays in the output folder, and the user's
next run uses it.

## 3. Signing in

- Identity provider: <for example OAuth / OIDC provider, popup or redirect, `prompt=login` or silent>
- Test account and role: <role name only - never write a password here>
- Browser that holds a live session: <name>
- Browser that does NOT: <name>

Trap: an automation browser (Playwright and similar) often starts with a fresh profile that is not
signed in, and a popup sign-in arrives as a second tab. Before you conclude sign-in is broken, take
a screenshot of every open tab. Prefer a browser session that is already signed in. If sign-in stops
at a password prompt, ask the user to finish it in the open window. Never ask for the password.

## 4. Calling the API as the signed-in user

Where the token lives: <localStorage / sessionStorage / cookie>, key contains `<pattern>`.

Call the API from inside the signed-in page. That reuses the token and avoids local certificate
problems:

```js
const key = Object.keys(localStorage).find(k => k.toLowerCase().includes('<token key pattern>'));
const token = JSON.parse(localStorage.getItem(key)).<field holding the token>;
await fetch('<api base url>/<route>', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify(body)
});
```

No-token case: call from a shell and expect 401. A local dev certificate usually needs a skip flag
(`curl -k`, PowerShell `-SkipCertificateCheck`; add `-SkipHttpErrorCheck` so a 401 does not throw).

## 5. Database

- Engine and server: <engine, host, instance>
- Database name: <name> (read from <config file and key>)
- Auth: <integrated / user + password from a secret store - never paste secrets here>
- CLI: <command line that returns parseable output>

```
<query command template>
```

- Write flags: <flags needed for INSERT/UPDATE/DELETE>. Trap: some clients read fine but fail on
  writes without a flag (for example `sqlcmd` without `-I` fails on tables that need
  `QUOTED_IDENTIFIER`). You find out at cleanup time, which is the worst time. Test one write first.
- Quiet output: <for example `SET NOCOUNT ON`> keeps row-count noise out of evidence files.
- Table naming: <prefixes, where tenants / users / settings live>.
- Column width: check the real width before you seed a long value. Some catalogs report bytes, not
  characters (an `nvarchar(256)` column reports 512).
- Tools that cannot connect: <for example "a database MCP server cannot connect, because there is
  no SQL login">.

## 6. Seed data conventions

- Marker prefix: `zz<ticket>_` on every name you insert, so cleanup can match exactly.
- Ask the user before any write. The database is theirs.
- Insert order (parent first): <tables>
- Delete order (child first): <tables>
- Rows that must exist before a seed works: <for example a tenant, a user, a lookup row>
- Things you must never touch: <shared or external records>

## 7. Reading the UI

Snippets that read the page state the screenshot cannot show:

```js
// Grid example: headers, row count, which filter controls exist
({
  headers: [...document.querySelectorAll('<header cell selector>')].map(h => h.innerText.trim()).filter(Boolean),
  rows: document.querySelectorAll('<data row selector>').length,
  filterControls: document.querySelectorAll('<filter row / header filter / search selector>').length
})
```

Component traps: <for example "the lite grid renders no filter UI, so any column filter setting on
it is unreachable">.

## 8. Screenshots

- Viewport: <width x height> (wide enough that a grid fits in one frame; 1680x1000 is a good start)
- Where the automation tool saves files: <path>. Move them into the report's
  `test-evidence/screens/` folder after the run.
