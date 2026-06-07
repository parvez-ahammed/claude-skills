# Skill index

Skills currently in this library (`skills/`). Run `sync-skills.ps1` to activate.

| Skill | What it does | Reuse |
|-------|--------------|-------|
| **deploy-to-vps** | Vendor-neutral push-to-deploy CI/CD to a VPS (any runtime), Caddy auto-TLS, OAuth/OIDC redirect setup, DNS (proxied-by-default), and baseline hardening (fail2ban, SSH-port rotation, firewall, CDN origin lockdown). Encodes the gotchas: env_file vs `$`-substitution, dishonest liveness `/health`, no-curl slim images, host-allowlist 400, ACME staging fallback, proxied-vs-grey-cloud, exact `redirect_uri` matching. | generic |

More skills are in progress and will land here as they're generalized for public use.
