# Phase 1 — VPS + self-running CI/CD (detailed)

Concrete command sequences. Templates are in `assets/`.

## 1. Provision + Docker

Ubuntu LTS VM. **Harden it first** (`references/vps-hardening.md`: non-root user,
key-only SSH on a non-standard port, fail2ban, default-deny firewall) before exposing
anything — a fresh box on port 22 gets brute-forced within minutes. Then install
Docker (over your custom SSH port):

```bash
ssh -p $SSH_PORT user@VM "curl -fsSL https://get.docker.com | sudo sh && \
  sudo usermod -aG docker \$USER && sudo systemctl enable --now docker && \
  docker --version && docker compose version"
```

Sizing: app + worker + Caddy ≈ 1-1.5 GB; pick 2 GB+. Put the VM near the **DB**.

## 2. CI deploy key (GitHub Actions -> VM)

Generate a dedicated key, install the public half on the VM, store the private half
as a GitHub secret. Keep it separate from your personal key.

```bash
ssh-keygen -t ed25519 -f ./deploy_key -N "" -C "gh-actions-deploy"
PUB=$(cat ./deploy_key.pub)
ssh user@VM "mkdir -p ~/.ssh && chmod 700 ~/.ssh && \
  grep -qxF '$PUB' ~/.ssh/authorized_keys 2>/dev/null || echo '$PUB' >> ~/.ssh/authorized_keys; \
  chmod 600 ~/.ssh/authorized_keys"
ssh -p $SSH_PORT -i ./deploy_key user@VM "echo OK"   # verify before storing
gh secret   set VPS_SSH_KEY  -R OWNER/REPO < ./deploy_key
gh variable set VPS_HOST     -R OWNER/REPO --body "VM_IP"
gh variable set VPS_USER     -R OWNER/REPO --body "user"
gh variable set VPS_SSH_PORT -R OWNER/REPO --body "49222"   # your custom SSH port
rm -f ./deploy_key ./deploy_key.pub              # don't leave the private key on disk
```

## 3. deploy/ assets

Copy `assets/docker-compose.yml` and `assets/Caddyfile` into `deploy/`. Adapt:
- build context + Dockerfile names, the API listen port (compose `expose` + Caddy
  `reverse_proxy` target + the health-check URL),
- the domain in the Caddyfile,
- `.gitignore` the rendered secrets file: `echo 'deploy/app.env' >> .gitignore`.

## 4. The workflow

Copy `assets/vps-deploy.yml` to `.github/workflows/`. Adapt `API_BASE`/`API_HOST`,
`REMOTE_DIR`, the `Render app.env` env keys (match your framework's config keys),
the Host header + port in the health check, and the network grep.

## 5. Secrets into GitHub

List what's there: `gh secret list -R OWNER/REPO`. Anything the backend needs that
isn't present (very commonly the **DB connection string** and provider tokens, if
they only lived in the old PaaS store) must be added. `assets/migrate-secrets.ps1`
shows the source->gh loop — run it yourself (safety layers block an assistant from
reading prod secret values).

## 6. Push + iterate

```bash
git add deploy .github/workflows/vps-deploy.yml .gitignore
git commit -m "ci: add VPS deploy pipeline"   # use -m flags; never bash @'...'@
git push origin main
gh run watch $(gh run list --workflow=vps-deploy.yml -L1 --json databaseId -q '.[0].databaseId')
```

When a run fails, SSH in and reproduce the exact failing probe — don't guess:

```bash
ssh user@VM 'cd ~/app/deploy && docker compose ps && \
  NET=$(docker network ls --format "{{.Name}}" | grep -E "app|deploy" | head -1) && \
  docker run --rm --network "$NET" curlimages/curl:8.11.1 -s -H "Host: your.domain" \
    -o /dev/null -w "code=%{http_code}\n" http://api:8080/health && \
  docker compose logs --tail=40 api'
```

Map the symptom to the gotcha in SKILL.md:
- `http_code=400 Invalid Hostname` -> missing Host header / AllowedHosts.
- `wget: not found` / container `unhealthy` -> slim image; disable Dockerfile
  healthcheck, probe externally with a curl sidecar.
- `ConnectionString ... not been initialized` -> the secret is empty in GitHub.
- `/health` returns `Healthy` but app is broken -> liveness-only endpoint; add a
  readiness/DB check.
- pipeline green but the app does nothing -> same; the health gate was dishonest.
