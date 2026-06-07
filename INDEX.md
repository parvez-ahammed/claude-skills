# Skill index

Skills currently in this library (`skills/`). Run `sync-skills.ps1` to activate.

| Skill | What it does | Reuse |
|-------|--------------|-------|
| **deploy-to-vps** | Vendor-neutral push-to-deploy CI/CD to a VPS (any runtime), Caddy auto-TLS, OAuth/OIDC redirect setup, DNS (proxied-by-default), and baseline hardening (fail2ban, SSH-port rotation, firewall, CDN origin lockdown). Encodes the gotchas: env_file vs `$`-substitution, dishonest liveness `/health`, no-curl slim images, host-allowlist 400, ACME staging fallback, proxied-vs-grey-cloud, exact `redirect_uri` matching. | generic |
| **honest-health-check** | Health endpoints that assert real readiness (DB/deps reachable) not a hardcoded 200; liveness vs readiness; wiring into deploy gates + container/orchestrator probes. Node/Python/Go/.NET snippets. | generic |
| **clean-architecture** | Rulebook + bootstrap + config-driven layering guard for Clean / Hexagonal architecture (any language). Dependency Rule, ports & adapters, per-stack scaffolding, tested guard script. | generic |

## Hooks (`hooks/`)

| Hook | What it does |
|------|--------------|
| **secret-hygiene** | Pre-commit block on secrets (gitleaks + regex fallback). git pre-commit hook or Claude Code PreToolUse hook. |
| **safe-commit** | commit-msg validator: no stray `@`, conventional subject, length; optional em-dash + AI-coauthor rejection. |

More skills/hooks are in progress and will land here as they're generalized for public use.
