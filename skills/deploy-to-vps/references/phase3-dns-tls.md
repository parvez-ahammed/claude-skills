# Phase 3 — DNS + TLS (proxied by default), cutover, decommission

Default to a **proxied/CDN** setup that hides the origin IP (recommended). Plain
DNS-only is simpler but exposes your server's IP (and thus ISP/region/attack surface).
This file covers the proxied path, the simple path, and non-Cloudflare DNS providers.

## Decision: proxied vs DNS-only

| | Proxied (Cloudflare orange) | DNS-only (grey / any registrar) |
|---|---|---|
| Origin IP | hidden from web visitors | **exposed** |
| TLS issuance | DNS-01 or Origin Cert (HTTP-01 won't work) | Caddy HTTP-01 (automatic) |
| Extras | WAF, DDoS, caching, rate-limit | none |
| Setup effort | medium | low |

Recommend **proxied** unless the user wants the absolute simplest path and doesn't
care about IP exposure. Proxied must be paired with the **origin firewall lockdown**
in `vps-hardening.md`, or attackers just scan the IP and bypass the CDN.

## Proxied path (Cloudflare, recommended)

1. **DNS A record**: name -> VPS IP, **Proxy ON (orange cloud)**.
2. **TLS** — HTTP-01 can't validate behind the proxy. Two options:
   - **DNS-01 challenge** (cleanest, supports wildcards): build/run a Caddy image with
     the `caddy-dns/cloudflare` plugin and give it a scoped **Zone.DNS:Edit** API
     token. In the Caddyfile:
     ```
     your.domain { tls { dns cloudflare {env.CF_API_TOKEN} } reverse_proxy app:8080 }
     ```
     Pass `CF_API_TOKEN` to the caddy service (via the rendered env / compose).
     Use a Caddy image that includes the plugin (custom build or a community image).
   - **Cloudflare Origin Certificate**: generate a 15-year origin cert in the
     Cloudflare dashboard (SSL/TLS -> Origin Server), mount it into Caddy with
     `tls /path/cert.pem /path/key.pem`, and set the zone SSL mode to **Full(strict)**.
3. **Lock the origin** to Cloudflare IPs + restrict SSH (see `vps-hardening.md` §5).
4. Cloudflare SSL/TLS mode: **Full(strict)** so the edge verifies the origin cert.

Add the API token (if DNS-01) as a GitHub secret and render it into the env so CI ships
it to the box. Never commit it.

## Simple path (DNS-only, any provider)

1. **A record**: name -> VPS IP, **not proxied** (grey cloud / a plain registrar like
   Namecheap, Route53, Porkbun, Google Domains).
2. Caddy issues automatically via **HTTP-01** once the record resolves and 80/443 are
   reachable. If Caddy started before DNS existed, it backed off — **restart Caddy**:
   `docker compose restart caddy`.
3. Verify it got a **production** cert (`acme-v02`, not `acme-staging-v02`).

## Other DNS providers (proxied alternatives to Cloudflare)

- **AWS CloudFront + Route53**, **Fastly**, **Bunny** — same idea: CDN hides origin,
  use an origin cert or DNS-01, lock the firewall to the CDN's published IP ranges.
- For **DNS-01 with a non-Cloudflare registrar**, Caddy has many `caddy-dns/*`
  provider plugins (route53, digitalocean, namecheap, godaddy, etc.) — same Caddyfile
  `tls { dns <provider> ... }` pattern with that provider's token.

## Gotchas

- **Proxied breaks HTTP-01/TLS-ALPN.** Use DNS-01 or an origin cert.
- **Staging fallback.** Repeated ACME failures (DNS `NXDOMAIN`, port blocked) trip the
  rate limit and Caddy falls back to **staging** (untrusted certs). Fix the cause,
  restart Caddy, confirm `acme-v02`.
- **Proxy alone doesn't hide the origin** — without the CDN-IP firewall lockdown, the
  IP is still directly reachable and SSH is never proxied.
- **TXT/CNAME for DNS-01** changes take propagation time; Caddy retries.

## Verify externally

```bash
nslookup your.domain                                   # resolves (to CDN IP if proxied)
curl -sS -o /dev/null -w "%{http_code}\n" https://your.domain/health   # 200, trusted cert
```

## Cutover (two switches, both required)

1. **Frontend API base URL** -> new domain; redeploy the frontend. Verify the deployed
   config actually changed (`curl -s https://frontend/config.js` or check the bundle).
2. **OAuth redirect URIs** (Phase 2) registered on the new host.
3. **CORS**: backend allowed origins must include the frontend origin. Check preflight:
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" -X OPTIONS https://your.domain/api/x \
     -H "Origin: https://frontend" -H "Access-Control-Request-Method: GET"   # 204
   ```
4. Hard-refresh the frontend (cached config), confirm requests hit the new host, login
   works, data loads.

## Decommission

Delete old compute only after end-to-end verification. Keep shared resources (static
frontend host, DNS, managed DB). Trim the old workflow to what remains. Rotate any
credential that leaked into logs/chat during the move.
