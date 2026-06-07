---
name: deploy-to-vps
description: >-
  Stand up an automated GitHub Actions CI/CD pipeline that deploys a containerized
  web app (any runtime: Node.js, Python, Go, .NET, Rust...) to a VPS on every push,
  pulling secrets from GitHub Secrets, fronted by Caddy for automatic HTTPS, with a
  real domain via any DNS/CDN provider, OAuth/OIDC redirect wiring, and baseline
  server hardening (fail2ban, non-standard SSH port, firewall, origin lockdown). Use
  this whenever the user wants push-to-deploy CI/CD to a server/VPS/VM over SSH, to
  move a backend off a PaaS (Render, Heroku, Fly, Railway, Vercel, Azure/AWS/GCP) onto
  a plain box, to wire Caddy / Let's Encrypt TLS, to point a domain (Cloudflare,
  Namecheap, Route53, etc.) at a server, to harden a fresh VPS against brute-force, or
  to debug OAuth redirect_uri_mismatch / ACME cert / container health-check failures
  during such a deploy. Vendor-neutral: any VPS host, any OAuth provider, any DNS.
  Configure strictly in order: VPS + pipeline first, then OAuth, then DNS/TLS.
  Trigger even when the user mentions only one piece ("github actions deploy my node
  app to a vps", "point my domain at my server", "harden my new ubuntu box",
  "redirect_uri_mismatch after moving hosts", "why is my cert stuck on staging").
---

# Deploy any containerized app to a VPS (CI/CD + OAuth + DNS/TLS + hardening)

Generic, vendor-neutral workflow for putting a Dockerized app on a plain VPS with a
**push-to-deploy** GitHub Actions pipeline, automatic HTTPS via **Caddy**, a real
domain through **any DNS provider**, OAuth/OIDC redirect setup, and **baseline
hardening**. The same flow works whether the app is Node.js, Python, Go, .NET, or
anything that runs in a container, and whether the host is Hetzner, DigitalOcean,
Contabo, Oracle, a cloud VM, or a bare box you SSH into.

The deep value is the **gotchas** under each phase — they produce green pipelines or
"looks fine" states that are actually broken. Read them before writing config.

## What stays the same across every stack

Only three things vary per project; everything else in this skill is identical:

1. **The Dockerfile(s)** and the app's **listen port** — runtime-specific. See
   `references/runtimes.md` for Node/Python/Go/.NET Dockerfile + port + healthcheck
   notes.
2. **The config/env keys** the app reads (e.g. `DATABASE_URL` for Node/Prisma vs
   `ConnectionStrings__DefaultConnection` for .NET) — rendered into the env file by CI.
3. **The provider consoles** (OAuth client, DNS zone) — same concepts, different UI.

The pipeline, compose layout, Caddy, health-check strategy, secret flow, and
hardening are **the same every time**. That is why this is a skill.

## Architecture

```
GitHub (main) --push--> GitHub Actions
                          | render .env from GitHub Secrets (single source of truth)
                          | rsync source + deploy assets over SSH (deploy key)
                          v
   VPS (hardened: non-std SSH port, fail2ban, firewall):
        Caddy (:80/:443 auto-TLS) -> app:PORT
        worker (optional, headless)     |
                                        v
                       external/managed DB or co-hosted DB container
   DNS/CDN (Cloudflare proxied by default) -> hides origin; firewall locks origin to it.
   Frontend (if separate) stays on its host; only its API base URL is repointed.
```

## Order of operations (do not reorder)

1. **VPS + pipeline + hardening** — app building, running, health-passing on the box,
   reachable internally; box hardened. No domain needed yet.
   See `references/phase1-vps-cicd.md` and `references/vps-hardening.md`.
2. **OAuth/OIDC** — register new redirect URIs *before* cutting over, or login breaks
   the instant you flip. See `references/phase2-oauth.md`.
3. **DNS + TLS** — point the domain, issue the cert, verify externally, cut over,
   decommission the old backend. See `references/phase3-dns-tls.md`.

Templates to copy live in `assets/`: `docker-compose.yml`, `Caddyfile`,
`vps-deploy.yml`, `migrate-secrets.ps1` (PaaS->GitHub secrets), `harden.sh`.

---

## Phase 1 — VPS + self-running CI/CD (+ hardening)

Goal: `git push` to `main` rebuilds and restarts the app on the VPS, secrets injected
from GitHub Secrets, gated by an honest health check — on a hardened box.

1. **Provision** any Ubuntu LTS VPS. **Harden it first** (see
   `references/vps-hardening.md`): create a non-root sudo user, key-only SSH on a
   **non-standard port**, **fail2ban**, a firewall (UFW/nftables) allowing only the
   SSH port + 80/443. Doing this before exposing services avoids a window of a
   wide-open box.
2. **Install Docker + compose** (`get.docker.com`; add the user to `docker`).
3. **CI deploy key**: dedicated SSH key, public half in the VM `authorized_keys`,
   private half in GitHub secret `VPS_SSH_KEY`; `VPS_HOST`, `VPS_USER`, and
   `VPS_SSH_PORT` as GitHub variables.
4. **`deploy/` assets**: `docker-compose.yml` + `Caddyfile` (templates in `assets/`).
   The app exposes its port only on the compose network; Caddy is the only thing
   publishing 80/443.
5. **Workflow** `assets/vps-deploy.yml`: on push to `main` touching the app/deploy
   paths — render `.env` from secrets, rsync to the box (over the custom SSH port),
   `docker compose up -d --build`, then honest health check. `.gitignore` the
   rendered env.
6. **Secrets into GitHub**: anything the app needs that isn't already a GitHub secret
   (commonly the DB URL + provider tokens if migrating off a PaaS) — add it.
   `assets/migrate-secrets.ps1` shows the source->`gh secret set` loop.
7. **Push, `gh run watch`, iterate** until the health check is green *and honest*.

### Phase 1 gotchas (these will bite you)

- **`env_file:` not compose `${VAR}` substitution for secrets.** Compose substitutes
  `${VAR}` in the compose file using `./.env`, and a secret containing a literal `$`
  (common in DB passwords/URLs) gets mangled. `env_file:` values are passed to the
  container **literally**. Render the app's real keys into the env file; point each
  service at it via `env_file:`. Don't map secrets through `environment: KEY: ${SECRET}`.
- **A green deploy can be a lie.** Many `/health` endpoints are **liveness only** —
  200 the moment the process boots, without touching the DB. Gate on **both** liveness
  *and* a readiness signal (grep logs for a DB-connection fatal, or hit an endpoint
  that exercises the DB). Else an app with an empty DB URL "passes".
- **Slim runtime images have no `wget`/`curl`.** A Dockerfile `HEALTHCHECK` using
  `wget` marks the container permanently `unhealthy` on images that lack it. Disable
  it in compose (`healthcheck: { disable: true }`) and probe **externally** from the
  workflow with a throwaway curl container on the compose network:
  `docker run --rm --network <proj>_<net> curlimages/curl -sf http://app:PORT/health`.
- **Host allowlists reject internal probes (HTTP 400 "Invalid Hostname").** If the
  framework enforces allowed hosts (.NET `AllowedHosts`, Django `ALLOWED_HOSTS`,
  Rails `config.hosts`), an internal probe to `http://app:PORT` carries Host `app` and
  is rejected. Send the real host header: `-H "Host: your.domain"`.
- **Anchor the health match.** `grep -qi healthy` matches `Unhealthy`. Use
  `grep -qi '^healthy'` or check the HTTP status.
- **Background-job frameworks flap at startup** (Hangfire/Celery/BullMQ) for ~15-30s
  while storage settles. Make the probe a retry loop, not a single shot.
- **Full-history secret scanners differ on push vs dispatch.** Gitleaks on `push`
  scans new commits; on `workflow_dispatch` it scans **full history** and trips old
  committed example secrets, failing the run. Prefer push-triggered deploys; add a
  `.gitleaksignore` for accepted historical findings (rotate anything real).
- **Building commit messages in bash: never `@'...'@`.** That is not a here-string in
  bash — it injects a literal `@` into the subject. Use repeated `-m` flags.

---

## Phase 2 — OAuth / OIDC redirect URIs

Do this **before** repointing the frontend. See `references/phase2-oauth.md`.

Universal across providers (Google, GitHub, Microsoft/Entra, Auth0/Okta, Discord,
generic OIDC): the callback URL changes when the host changes, and the provider only
accepts redirect URIs registered **exactly** on the **specific client** the app uses.

1. **Read the exact `redirect_uri` the app actually emits** — don't guess. Hit the
   login-initiation endpoint and parse the authorize URL's `client_id` + `redirect_uri`.
2. Open the OAuth client matching that **exact `client_id`** (apps often have separate
   clients for login vs each connector) and add the redirect URI
   **character-for-character** (scheme, host, no trailing slash, lowercase),
   **alongside** the old host's.
3. **Save** the form and expect **propagation delay**; retry in **incognito**.

`redirect_uri_mismatch` is almost always wrong-client or a typo, not your code.

---

## Phase 3 — DNS + TLS (proxied by default), cutover, decommission

See `references/phase3-dns-tls.md`. **Default to a proxied/CDN setup to hide the
origin IP** (the user's stated preference and good practice), with a firewall that
locks the origin to the CDN's IP ranges. Plain DNS-only is the simpler fallback but
exposes your server IP.

1. **DNS record** `name -> VPS IP`. Recommended: **Cloudflare proxied (orange cloud)**
   so visitors see Cloudflare's IP, not yours.
2. **TLS with a proxied origin**: Caddy's HTTP-01 challenge **won't validate behind
   the proxy**. Use the **DNS-01 challenge** (Caddy built with `caddy-dns/cloudflare`
   + a scoped API token) or a **Cloudflare Origin Certificate** with SSL mode
   **Full(strict)**. (Plain DNS-only/grey cloud + HTTP-01 is the simple alternative
   that exposes the IP.)
3. **Lock the origin to the CDN.** Proxying hides the IP from web visitors, but the box
   is still directly reachable (and SSH is never proxied). Restrict the firewall so
   80/443 accept **only Cloudflare's IP ranges**, and SSH only from your IP/VPN — then
   scanning the IP reveals nothing. See `references/vps-hardening.md`.
4. **Verify externally**, **cut the frontend over** (new API base URL + redeploy;
   confirm CORS), then **decommission** the old backend once login + data are verified.

### Phase 3 gotchas

- **Proxied breaks HTTP-01/TLS-ALPN.** Use DNS-01 or an origin cert (above).
- **Let's Encrypt staging fallback.** Repeated ACME failures (e.g. while DNS was
  `NXDOMAIN`) hit the rate limit and Caddy falls back to **staging** (untrusted).
  Fix DNS, restart Caddy, confirm the log shows `acme-v02` (production).
- **Proxy alone doesn't hide the origin** — pair it with the CDN-IP firewall lockdown,
  or attackers scan the IP directly and bypass the CDN entirely.
- **Cutover is two switches**: frontend API base URL *and* provider redirect URIs.

---

## Decommission checklist (migrations)

- [ ] App green on the VPS, health honest; box hardened (fail2ban, SSH port, firewall)
- [ ] OAuth redirect URIs registered on the new host (login verified)
- [ ] DNS live, production TLS verified externally, origin locked to the CDN
- [ ] Frontend repointed + redeployed, requests confirmed hitting the new host
- [ ] Login + data confirmed end-to-end
- [ ] Old compute deleted (keep shared: static frontend host, DNS, managed DB)
- [ ] Old workflow trimmed to what remains
- [ ] Any credential that leaked into logs/chat during the move **rotated**

## Safety during migrations

Reading prod secret values out of a PaaS, deleting prod resources, and force-pushing
may be blocked by an automated safety layer — correctly. When blocked, hand the exact
command to the user to run in their own session. Keep the old backend running until
the new path is proven; delete last.

## Reference map

- `references/phase1-vps-cicd.md` — provisioning, deploy key, workflow, debug map
- `references/vps-hardening.md` — fail2ban, SSH port, firewall, Cloudflare origin lockdown
- `references/runtimes.md` — per-stack Dockerfile + env keys (Node, Python, Go, .NET)
- `references/phase2-oauth.md` — exact redirect-uri matching across providers
- `references/phase3-dns-tls.md` — proxied + DNS-01 / origin cert; other DNS providers
