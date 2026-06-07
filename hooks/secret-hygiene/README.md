# secret-hygiene (hook)

Block a commit that introduces a secret. This is a **hook**, not a skill, on purpose:
"scan before every commit" must run **deterministically every time**, not depend on a
model remembering to. The harness (git, or Claude Code) enforces it.

It prefers [gitleaks](https://github.com/gitleaks/gitleaks) (accurate, full ruleset)
and falls back to a conservative regex scan when gitleaks isn't installed. It respects
`.gitleaksignore` for accepted historical findings, and `git commit --no-verify` to
bypass intentionally.

## Install (recommended): git pre-commit hook

Works for everyone committing in the repo - humans and AI agents alike.

```powershell
pwsh -File install.ps1 -Repo C:\path\to\your\repo
```

or manually: copy `pre-commit` into `<repo>/.git/hooks/pre-commit` and `chmod +x` it.
Install gitleaks for best coverage (the hook auto-uses it when present).

## Install (optional): Claude Code PreToolUse hook

Belt-and-suspenders so Claude's own `git commit` calls are scanned even in a repo
without the git hook. See `claude-settings-snippet.json` - add it under `hooks` in
`~/.claude/settings.json` (or a project `.claude/settings.json`) and fix the path.
(The `update-config` skill can wire this for you.)

## Why both

The git pre-commit hook is the real guard (universal, local). The Claude Code hook is
useful when you can't or don't want to install a git hook in every repo but still want
the agent's commits checked. Either way, the same `pre-commit` script does the work.

## Note

A pre-commit scan is the **last line**, not the only one. Keep secrets out of the repo
in the first place (env files gitignored, secrets in a manager / GitHub Secrets), and
run a full-history scan in CI. This hook stops the obvious mistake at the door.
