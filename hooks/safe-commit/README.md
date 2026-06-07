# safe-commit (hook)

Validate the commit message before it lands. A **hook**, not a skill - message hygiene
should be enforced every commit, deterministically, not left to memory.

## Checks

**Default (on):**
- **No stray `@`-prefixed line** - catches the bash `@'...'@` slip that leaks a literal
  `@` into the subject. (Real bug; happened twice in a real repo.)
- **Conventional subject** - `type(scope): description` (`feat|fix|chore|docs|refactor|
  test|perf|build|ci|style|revert`). Disable with `SAFE_COMMIT_NO_CONVENTIONAL=1`.
- **Subject length** - warns over 72 chars (warning only).

**Optional (opt in via env var):**
- `SAFE_COMMIT_NO_EMDASH=1` - reject em dashes (—); use `-` or `:`.
- `SAFE_COMMIT_NO_AI_COAUTHOR=1` - reject `Co-Authored-By: <Claude/GPT/Copilot/Gemini>`
  trailers.

Bypass once (sparingly): `git commit --no-verify`.

## Install

```powershell
pwsh -File install.ps1 -Repo C:\path\to\your\repo
```

or copy `commit-msg` into `<repo>/.git/hooks/commit-msg` and `chmod +x` it.

To turn on the optional checks, export the env vars where your commits run (shell
profile, direnv `.envrc`, or before committing):

```bash
export SAFE_COMMIT_NO_EMDASH=1
export SAFE_COMMIT_NO_AI_COAUTHOR=1
```

## Note

`commit-msg` only sees the message, not the diff - pair it with the **secret-hygiene**
`pre-commit` hook to also block secrets in the content.
