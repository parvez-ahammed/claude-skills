# Prerendering the public page of a single-page app

Use this when the site is a client-rendered SPA (Vite, CRA, Angular, Vue) and a framework change to SSR or
static generation is too large. If the project already uses Next.js, Nuxt, Astro, Remix or SvelteKit, use
the framework's static generation instead and skip this file.

## Goal

The host returns three different HTML files:

| Request | File | Robots | Contains |
|---------|------|--------|----------|
| `/` (and other public marketing pages) | `index.html` | index (production only) | full prerendered page, metadata, JSON-LD, small boot script |
| app routes (`/app/...`, `/settings/...`) | `app.html` | `noindex`, no canonical | empty root, full app scripts and CSS |
| anything else | `404.html` | `noindex` | static "page not found" with a link home, status 404, no scripts |

## Build steps (a proven pattern for Vite + React)

1. Normal `vite build` produces the app. Enable `build.manifest` so a later script can find the chunk
   file names.
2. A second Vite build in SSR mode compiles a small prerender entry (`LandingPrerenderEntry.tsx`) that
   exports a function returning the landing page as an HTML string (`renderToString`, with the CSS-in-JS
   cache extracted - for MUI/emotion use `createEmotionServer` and inline the critical styles).
3. A Node script (`scripts/prerender-landing.mjs`):
   - copies the built `index.html` to `app.html` and adds `noindex`;
   - puts the rendered HTML into `index.html` as `<div id="landing-static">...</div>` before the empty
     `<div id="root"></div>`, with its styles inline;
   - replaces the `<head>` SEO block (mark it with `<!-- seo:start -->` / `<!-- seo:end -->` in the
     source `index.html` so the script can find it and fail when it cannot);
   - removes the `<noscript>Enable JavaScript</noscript>` message;
   - removes the app stylesheet link from `index.html` and inlines only the reset and the fonts the
     landing page needs, so the first paint does not wait for the app CSS;
   - writes `404.html` from the same frame;
   - writes `robots.txt` as `Disallow: /` and adds `noindex` when the production flag is not set;
   - deletes the SSR build folder.
4. The build check runs last (see `build-check.md`).

## Boot script

`index.tsx` becomes a tiny file that decides what to start:

- A visitor with no sign-in data gets the landing-only start: `hydrateRoot` on `#landing-static` (inside
  `startTransition`), with only the landing page code. This keeps the landing page small.
- A signed-in visitor, or a click on "Sign in" / "Get started", loads the full app with a dynamic
  `import()`. The app removes the static copy when it mounts.

Set a byte budget for everything the landing start loads (one shipped example: 450 KB raw for landing chunks, 100 KB for
the entry file) and fail the build when an import pulls app code back in. Read the Vite manifest and follow
the static `imports` of the entry and the landing chunk to count the bytes.

## Host rules

The host must send each request to the right file. IIS example (`web.config`):

- rule "App routes": `^(app|settings|account|...)(/|$)` gives `app.html`
- `httpErrors` for 404 uses `404.html` with `existingResponse="Replace"` and keeps status 404
- `index.html` and `app.html`: `Cache-Control: no-cache`; hashed static files: long cache
- add MIME types that IIS does not know (`.webp`, `.woff2`, `.txt` for `llms.txt`)

Other hosts: Netlify `_redirects`, Vercel `rewrites`, nginx `try_files` with explicit locations, Azure
Static Web Apps `navigationFallback` with `exclude` plus `responseOverrides` for 404. The trap is the
same everywhere: the default "send index.html for every path" makes every unknown URL a 200.

The list of app route prefixes lives in two places (router and host rules). Let the build check compare
them, or a new route returns 404 in production only.

## Traps

- Hydration mismatch: anything in the landing page that reads `window`, time, random values or sign-in
  state during render gives different HTML on server and client. Read those in an effect.
- CSS order changes when routes become lazy. Compare the winning CSS rule per selector on app pages
  before and after (write a small script for this; comparing screenshots is not enough).
- Stale chunks after a deploy: wrap lazy imports, reload once on a failed chunk load, then show an error
  page.
- Sign-in popups are blocked when opened after an `await` of a large chunk. Fall back to redirect.
- Font preload made first paint slower. Test it with Lighthouse before keeping it.
