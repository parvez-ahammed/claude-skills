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
| **vps-deploy** | Vendor-neutral push-to-deploy CI/CD to a VPS (any runtime: Node/Python/Go/.NET), Caddy auto-TLS, OAuth/OIDC redirect setup, DNS (proxied-by-default), and baseline hardening (fail2ban, SSH-port rotation, firewall, CDN origin lockdown). | generic |
| **honest-health-check** | Design health endpoints that assert real readiness (DB/deps reachable) instead of a hardcoded 200, and wire them into deploy gates + container/orchestrator probes. Pairs with `vps-deploy`. | generic |
| **clean-architecture** | Rulebook + bootstrap + config-driven guard for Clean / Hexagonal architecture in any language (.NET/TS/Java/Go/Python). The Dependency Rule, ports & adapters, per-stack layout, and a layering check to enforce boundaries. | generic |

## Hooks (`hooks/`)

| Hook | What it does | Install |
|------|--------------|---------|
| **secret-hygiene** | Block a commit that introduces a secret (gitleaks when present, conservative regex fallback). | git pre-commit hook, or a Claude Code PreToolUse hook - see `hooks/secret-hygiene/README.md` |
| **safe-commit** | commit-msg validator: no stray `@`, conventional subject, length; optional em-dash + AI-coauthor rejection. | git commit-msg hook - see `hooks/safe-commit/README.md` |

## Commands (`commands/`)

User-fired prompt shortcuts. None yet - coming as patterns stabilize.

## Install (any machine)

This repo is a **Claude Code plugin marketplace**. The skills ship as one plugin,
`parvez`, so on any machine:

```
/plugin marketplace add parvez-ahammed/claude-skills
/plugin install parvez@parvez-tools
```

Every skill goes live, namespaced `parvez:<skill>` (e.g. `parvez:vps-deploy`,
`parvez:clean-architecture`, `parvez:honest-health-check`), triggering on its
`description`. Update later with `/plugin marketplace update parvez-tools`.

Local authoring loop (test before pushing): `/plugin marketplace add .` from a clone,
then install — relative paths resolve against the repo.

## Layout

```
claude-skills/
  README.md                  - this file
  LICENSE                    - MIT
  INDEX.md                   - catalog
  .claude-plugin/
    marketplace.json         - marketplace manifest (name: parvez-tools)
  plugins/
    parvez/                  - the installable plugin (namespace prefix)
      .claude-plugin/plugin.json
      skills/                - skills (one folder each)
  _template/                 - starting point for a new skill
  hooks/                     - git hooks (script + install notes per hook)
  commands/                  - user-fired commands
  sync-skills.ps1            - legacy: copy skills into ~/.claude/skills (dev only)
```

## Use

**Skills** - install via the plugin (above). They trigger on their `description`. To
add a skill: drop a new folder under `plugins/parvez/skills/`, commit, push; installed
users pick it up on `/plugin marketplace update`.

**Hooks** - these are **git** hooks (commit-msg / pre-commit), not Claude lifecycle
hooks, so install per-hook (a git hook, or a settings.json snippet). See each hook's
`README.md`. The `update-config` skill can wire Claude Code hooks into settings.json.

`sync-skills.ps1` is the **legacy** path (copies into `~/.claude/skills` on this box
only) - kept for fast local iteration; the plugin marketplace is how it goes
cross-machine now.

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
