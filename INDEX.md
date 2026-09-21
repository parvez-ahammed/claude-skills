# Skill index

Skills currently in this library (`plugins/parvez/skills/`). Install via the plugin:
`/plugin marketplace add parvez-ahammed/claude-skills` then `/plugin install parvez@parvez-tools`.

| Skill | What it does | Reuse |
|-------|--------------|-------|
| **vps-deploy** | Vendor-neutral push-to-deploy CI/CD to a VPS (any runtime), Caddy auto-TLS, OAuth/OIDC redirect setup, DNS (proxied-by-default), and baseline hardening (fail2ban, SSH-port rotation, firewall, CDN origin lockdown). Encodes the gotchas: env_file vs `$`-substitution, dishonest liveness `/health`, no-curl slim images, host-allowlist 400, ACME staging fallback, proxied-vs-grey-cloud, exact `redirect_uri` matching. | generic |
| **honest-health-check** | Health endpoints that assert real readiness (DB/deps reachable) not a hardcoded 200; liveness vs readiness; wiring into deploy gates + container/orchestrator probes. Node/Python/Go/.NET snippets. | generic |
| **clean-architecture** | Rulebook + bootstrap + config-driven layering guard for Clean / Hexagonal architecture (any language). Dependency Rule, ports & adapters, per-stack scaffolding, tested guard script. | generic |
| **refactoring-guru** | Orchestrator for refactoring + design-pattern work: understands intent, routes to the spokes, merges findings. Patterns recommended only when a site meets scored preconditions with cited evidence. | generic |
| **code-smell-detector** | Detects the 22 refactoring.guru smells (five groups) in a file/function/dir, each with `file:line` evidence and the candidate refactoring/pattern it maps to. Spoke of refactoring-guru; standalone too. | generic |
| **refactoring-methods** | Fowler's refactoring catalog (composing methods, moving features, organizing data, simplifying conditionals/calls) with preconditions + ordered mechanics + a safety rule. Recommends mechanics; never auto-edits. Spoke. | generic |
| **creational-patterns** | Scores whether a creational pattern (Factory Method, Abstract Factory, Builder, Prototype, Singleton) fits a site: opportunity signatures, weighted preconditions, threshold, hard-veto anti-indicators -> APPLY/CONSIDER/REJECT. Spoke. | generic |
| **structural-patterns** | Same scoring for structural patterns (Adapter, Bridge, Composite, Decorator, Facade, Flyweight, Proxy). Spoke. | generic |
| **behavioral-patterns** | Same scoring for behavioral patterns (Strategy, State, Command, Observer, Chain of Responsibility, Template Method, Visitor, Mediator, Iterator, Memento). Spoke. | generic |
| **platform-audit** | Across a milestone/backlog of issues, finds the shared engines/primitives/UI worth extracting with DRY/KISS/YAGNI judgment: cross-phase ownership table, per-candidate verdict (build-now/narrow/resist), a mandatory "what to resist" list, and a dependency-ordered build order. | generic |
| **grill-feature** | Stands up a "grill room" of independent, code-grounded interrogators that test features at the PROMISE level and return BULLETPROOF/CRACKED/FAKE with `file:line` evidence, plus an optional CEO unit-economics pass. One feature inline, or a whole release as a background workflow sweep. | generic |
| **show-usage** | WakaTime-style active time + token/cost/tool tables computed locally from Claude Code session transcripts. Read-only, zero-dep `node` script; per-project or all-projects. | generic |
| **qa-ux** | Pressure-test a running web app and emit TWO cross-linked HTML reports by default: a Staff-QA release report (14 sections, 🟢/🟡/🔴 recommendation, Playwright + API/ffprobe evidence) and a UX product-experience audit (6 personas x 6 journeys, Product Experience Score /100, ranked redesigns). Drives the browser for screenshot proof incl. mobile; never invents data (UNKNOWN when unverified). Scope to one report only if asked. | generic |
| **video-maker** | Animated promo / explainer / social videos built entirely from code: HTML scenes, local TTS voice-over, generated music, captions and thumbnail, rendered to MP4. A claims check gates every on-screen statement. | generic |
| **demo-maker** | Pixel-exact clickable HTML demos of a planned workflow, captured from the real running app (DOM + CSS snapshot) and optionally from real WinForms controls, so the product owner sees exactly how it will look. Stays close to today's app. | generic |
| **user-guide-maker** | User-facing feature guide for a ticket or PR as self-contained HTML + PDF. Learns from the code, then a fresh agent checks every claim. Optional attach to Azure DevOps, Jira or GitHub. | generic |
| **branch-reviewer** | Multi-seat review of a branch / PR (backend, frontend, architecture, tests, QA, text, plus a licence seat for new dependencies), a refutation pass, a ranked punch list and an HTML report. Advanced mode adds an adversarial round; comment mode re-verifies each claim before posting to GitHub, Azure DevOps or GitLab. Reads your project rules file. | generic |
| **branch-test-report** | Runs a branch against the live app (not a reading of the diff): seeds data, predicts results with queries, drives the browser, and writes an HTML report with screenshots for a product owner (base vs branch, open items only). | generic |
| **bug-fixer** | One bug end-to-end: reproduce, root cause before fix, a regression test that fails without the fix, then verify. Hard-won debugging traps included. | generic |
| **story-implementer** | One user story end-to-end: analyze, break down, pick tasks, implement, test, verify, with a pre-PR gate (criteria trace, backward compatibility, every client that calls a changed endpoint). | generic |
| **plain-writer** | House style for prose that lands in git, PRs and docs: ASCII punctuation, Simplified Technical English, no jargon, short commit messages, why-only code comments, plus a PR-description sub-skill that fills any repo's template. | generic |
| **seo-aeo** | Audit and improve a site's SEO and AEO (AI answer engines): meta, JSON-LD, robots, sitemap, llms.txt, prerendering for SPAs, then prove it with local test scripts. | generic |
| **timesheet-from-transcripts** | Reconstruct what you worked on for past dates (tickets, descriptions, time blocks) from local Claude Code transcripts, ready for a timesheet. Configurable ticket patterns. | generic |
| **generate-ux-improvements** | Fan out parallel read-only UX auditors over an app, then file what survives as GitHub issues. Partitions the surface into disjoint territories first (unpartitioned agents all return the same loudest two findings), enforces a fixed issue contract with `file:line` evidence and named comparable products, then dedups, drops the unevidenced, and files with `--body-file`. Configurable agents (default 3) and issues each (default 3). Works when the app cannot be run: audits from source and stamps every issue with that provenance. Complements `qa-ux`, which needs a running app and emits HTML reports instead of issues. | generic |

## Hooks (`hooks/`)

| Hook | What it does |
|------|--------------|
| **secret-hygiene** | Pre-commit block on secrets (gitleaks + regex fallback). git pre-commit hook or Claude Code PreToolUse hook. |
| **safe-commit** | commit-msg validator: no stray `@`, conventional subject, length; optional em-dash + AI-coauthor rejection. |

More skills/hooks are in progress and will land here as they're generalized for public use.
