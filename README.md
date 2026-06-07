# claude-skills

> ⚠️ **Work in progress.** An evolving, open-sourced toolkit of
> [Claude Code](https://claude.com/claude-code) building blocks - **skills**, **hooks**,
> and **commands**. Some are battle-tested, some are early. Expect churn. Reuse the
> patterns at your own discretion and adapt to your stack.

Not just skills - a toolkit, because the right Claude Code primitive depends on the job:

| Primitive | Use it for | Triggered by |
|-----------|-----------|--------------|
| **Skill** | knowledge / a workflow the model *applies with judgment* ("how to do X") | the model, on a matching task |
| **Hook** | deterministic **must-run-on-event** enforcement ("always do X when Y") | the harness, automatically |
| **Command** | a saved prompt the **user** fires | `/name` |

Rule of thumb: "*always do X when Y happens*" is a **hook**, not a skill - the model
forgets, the harness doesn't. "*how should I approach X*" is a **skill**.

## Skills (`skills/`)

| Skill | What it does | Scope |
|-------|--------------|-------|
| **deploy-to-vps** | Vendor-neutral push-to-deploy CI/CD to a VPS (any runtime: Node/Python/Go/.NET), Caddy auto-TLS, OAuth/OIDC redirect setup, DNS (proxied-by-default), and baseline hardening (fail2ban, SSH-port rotation, firewall, CDN origin lockdown). | generic |
| **honest-health-check** | Design health endpoints that assert real readiness (DB/deps reachable) instead of a hardcoded 200, and wire them into deploy gates + container/orchestrator probes. Pairs with `deploy-to-vps`. | generic |

## Hooks (`hooks/`)

| Hook | What it does | Install |
|------|--------------|---------|
| **secret-hygiene** | Block a commit that introduces a secret (gitleaks when present, conservative regex fallback). | git pre-commit hook, or a Claude Code PreToolUse hook - see `hooks/secret-hygiene/README.md` |

## Commands (`commands/`)

User-fired prompt shortcuts. None yet - coming as patterns stabilize.

## Layout

```
claude-skills/
  README.md        - this file
  LICENSE          - MIT
  INDEX.md         - catalog
  sync-skills.ps1  - copy skills/* into ~/.claude/skills so they go live
  _template/       - starting point for a new skill
  skills/          - skills (one folder each)
  hooks/           - hooks (script + install notes per hook)
  commands/        - user-fired commands
```

## Use

**Skills** - sync into Claude Code's personal skills dir:
```powershell
pwsh -File sync-skills.ps1   # copies skills/* into ~/.claude/skills
```
Then they show up in a Claude Code session and trigger on their `description`.

**Hooks** - install per-hook (a git hook, or a settings.json snippet). See each hook's
`README.md`. The `update-config` skill can wire Claude Code hooks into settings.json.

This repo is the **source of truth**; `~/.claude/skills/` is a synced copy.

## Writing a good skill

- **Pushy, specific `description`** - the only trigger signal; name the contexts and
  phrases it should fire on.
- Keep `SKILL.md` lean; push detail into `references/` (loaded on demand).
- Bundle deterministic steps as `scripts/`.
- Explain the **why**; avoid rigid ALWAYS/NEVER walls.
- If it's really "enforce X every time," make it a **hook**, not a skill.

## Contributing

Early days - issues and PRs welcome once it stabilizes. Each piece should be
self-contained, documented, and (where it has a verifiable output) shipped with a
tested script.

## License

MIT - see `LICENSE`.
