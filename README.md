# claude-skills

> ⚠️ **Work in progress.** This is an evolving, personal collection of
> [Claude Code](https://claude.com/claude-code) skills. Skills here are added and
> refined over time; some are battle-tested, some are early. Expect churn. Open-sourced
> so others can reuse the patterns - use at your own discretion and adapt to your stack.

A library of reusable, version-controlled **skills** (codified workflows) for Claude
Code. A skill is a folder with a `SKILL.md` (YAML frontmatter + instructions) and
optional `scripts/`, `references/`, and `assets/`. Claude always sees a skill's name +
description and pulls the body + bundled files in only when the skill triggers
(progressive disclosure), so a large skill costs almost nothing until it's used.

## Skills

| Skill | What it does | Scope |
|-------|--------------|-------|
| **deploy-to-vps** | Vendor-neutral push-to-deploy CI/CD to a VPS (any runtime: Node/Python/Go/.NET), Caddy auto-TLS, OAuth/OIDC redirect setup, DNS (proxied-by-default), and baseline hardening (fail2ban, SSH-port rotation, firewall, CDN origin lockdown). | generic |

More skills are in progress and will be added as they're generalized for public use.

## Layout

```
claude-skills/
  README.md        - this file
  LICENSE          - MIT
  INDEX.md         - catalog
  sync-skills.ps1  - copy skills/* into ~/.claude/skills so they go live
  _template/       - starting point for a new skill
  skills/          - the skills (one folder each)
```

## Use

1. **Author / edit** under `skills/<name>/` (copy `_template/` to start, or use the
   `skill-creator` skill).
2. **Activate** by syncing into Claude Code's personal skills dir:
   ```powershell
   pwsh -File sync-skills.ps1
   ```
   Copies every `skills/*` into `~/.claude/skills/` (Windows:
   `C:\Users\<you>\.claude\skills\`), which Claude Code auto-discovers.
3. **Verify** in a Claude Code session - the skill shows in the available-skills list
   and triggers on phrases matching its `description`.

This repo is the **source of truth**; `~/.claude/skills/` is a synced copy. Edit here,
sync, commit, push.

## Writing a good skill

- **Pushy, specific `description`** - it's the only trigger signal; name the contexts
  and phrases it should fire on.
- Keep `SKILL.md` lean; push detail into `references/` (loaded on demand).
- Bundle deterministic steps as `scripts/` so they aren't re-derived each run.
- Explain the **why**; avoid rigid ALWAYS/NEVER walls.

## Contributing

Early days - issues and PRs welcome once it stabilizes. Skills should be self-contained,
documented, and (where they have a verifiable output) shipped with a working script.

## License

MIT - see `LICENSE`.
