# Phase 2 — OAuth / OIDC redirect URIs (detailed)

Do this **before** repointing the frontend to the new host. When the backend host
changes, the OAuth callback URL changes, and the provider only accepts redirect URIs
registered **exactly** on the **specific client** the app uses. This is identical
across providers — only the console location differs:

| Provider | Where to edit redirect URIs |
|---|---|
| Google | console.cloud.google.com -> APIs & Services -> Credentials -> OAuth client |
| GitHub | Settings -> Developer settings -> OAuth Apps -> Authorization callback URL |
| Microsoft / Entra ID | Entra admin -> App registrations -> Authentication -> Redirect URIs |
| Auth0 / Okta | Application settings -> Allowed Callback URLs |
| Discord | Developer Portal -> your app -> OAuth2 -> Redirects |

The principle below is the same for all of them.

## Step 1 — read the EXACT redirect_uri the app emits (don't guess)

Hit the login-initiation endpoint on the new host and read the generated authorize
URL. It contains the authoritative `client_id` and `redirect_uri`:

```bash
curl -s https://your.domain/api/auth/login
# -> {"authUrl":"https://accounts.google.com/o/oauth2/v2/auth?client_id=...&redirect_uri=https%3A%2F%2Fyour.domain%2Fapi%2Fauth%2Fcallback&..."}

curl -s https://your.domain/api/auth/login | grep -oE 'client_id=[^&"]*|redirect_uri=[^&"]*'
```

URL-decode the `redirect_uri` (`%3A`->`:`, `%2F`->`/`). That decoded string is what
must be registered, character-for-character.

Note how the backend builds it. A common pattern:

```
RedirectUri => config["Google:RedirectUri"] ?? $"{Request.Scheme}://{Request.Host}/api/auth/callback"
```

If the config value is set (your pipeline should set it to the new host), that exact
value is sent. If it's null, it's derived from the request host — which behind a
proxy can surprise you. Prefer setting it explicitly in the rendered env.

## Step 2 — register on the matching client

In the provider console (e.g. Google Cloud -> APIs & Services -> Credentials), open
the OAuth client whose ID equals the `client_id` from step 1. Apps frequently have
**separate clients** for login vs each connector (e.g. a Gmail/Drive client) — make
sure you're editing the right one.

Add the new redirect URI **alongside** the old host's (don't delete the old until
the old backend is decommissioned). Match exactly: `https` not `http`, correct host
(watch for a missing dot, e.g. `exampleapp` vs `example.app`), **no trailing
slash**, lowercase. Add the connector URIs to their own client too, e.g.:

- login client: `https://your.domain/api/auth/callback`
- connector client: `https://your.domain/api/providers/<x>/callback`

## Step 3 — save + propagate

Click **Save** (adding a row in the UI is not saving). Changes propagate in minutes
(occasionally longer). Retry in an **incognito** window to avoid cached consent.

## Debugging `redirect_uri_mismatch`

It's almost never your code. Put two things side by side:
1. the app's emitted `redirect_uri` (step 1),
2. the registered list on the matching client.

The diff is usually: edited the **wrong client**, a **typo/trailing slash/scheme**,
or **not yet propagated / not saved**. The provider's "see error details" expander
shows the exact sent-vs-registered values.
