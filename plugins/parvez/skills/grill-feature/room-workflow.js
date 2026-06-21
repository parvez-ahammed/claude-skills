export const meta = {
  name: 'grill-room',
  description: 'Adversarial promise-level interrogation of each feature (code-grounded) + optional CEO cost evaluation + synthesis',
  phases: [
    { title: 'Interrogate', detail: 'one skeptical code-reading agent per feature' },
    { title: 'Cost', detail: 'CEO unit-economics pass (only for products with paid actions)' },
    { title: 'Synthesize', detail: 'merge verdicts + cost into one report' },
  ],
}

// ---------------------------------------------------------------------------
// REPLACE THIS ARRAY with your own features before launching.
// Each entry is one feature to interrogate. Hidden/UI-gated features still
// count: the interrogator judges the CODE, not the UI.
//   id      - short slug for labels
//   area    - grouping bucket (e.g. Auth, Payments, Editor)
//   name    - human name of the feature
//   promise - the one-sentence thing the feature claims to do for a user
//   hints   - where to start reading (files, routes, services). The agent
//             follows the real call chain from here; do not stop at the route.
// The entries below are a WORKED EXAMPLE for a generic SaaS app. Delete them.
// ---------------------------------------------------------------------------
const FEATURES = [
  { id: 'auth-emailpw', area: 'Auth', name: 'Email/password auth (login, signup, verify, reset)', promise: 'A user can sign up, verify email, log in, and reset password against real persisted state with rate limiting.', hints: 'auth routes -> auth controller -> auth service; the user/session models; the email-verification + reset-token flow' },
  { id: 'auth-oauth', area: 'Auth', name: 'OAuth / social sign-in', promise: 'A user can sign in via an external provider and a real session is created.', hints: 'oauth url + callback handlers, the token exchange, session creation' },
  { id: 'pay-checkout', area: 'Payments', name: 'Checkout + webhook idempotency', promise: 'Checkout works, payment webhooks are processed exactly once, subscription/entitlement state is correct.', hints: 'billing controller/service, checkout route, webhook handler, webhook-idempotency store, subscription model' },
  { id: 'core-publish', area: 'Core', name: 'Publish/export to an external system', promise: 'A user action actually reaches the external system, not just our own DB.', hints: 'the publish/export route -> job/queue -> the outbound provider call; confirm it leaves our system' },
]

const INTERROGATION = {
  type: 'object', additionalProperties: false,
  required: ['feature', 'area', 'verdict', 'shipBlocker', 'questions', 'gaps'],
  properties: {
    feature: { type: 'string' },
    area: { type: 'string' },
    promise: { type: 'string' },
    verdict: { type: 'string', enum: ['BULLETPROOF', 'CRACKED', 'FAKE'] },
    shipBlocker: { type: 'boolean' },
    questions: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['q', 'answer', 'evidence'], properties: { q: { type: 'string' }, answer: { type: 'string' }, evidence: { type: 'string' } } } },
    gaps: { type: 'array', items: { type: 'string' } },
  },
}

const COST = {
  type: 'object', additionalProperties: false,
  required: ['perAction', 'planMargin', 'verdict', 'concerns'],
  properties: {
    perAction: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { action: { type: 'string' }, creditsCharged: { type: 'string' }, providers: { type: 'string' }, estCogsUsd: { type: 'string' }, evidence: { type: 'string' } }, required: ['action', 'creditsCharged', 'estCogsUsd'] } },
    planMargin: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { plan: { type: 'string' }, priceUsd: { type: 'string' }, creditsPerMonth: { type: 'string' }, worstCaseCogsUsd: { type: 'string' }, marginNote: { type: 'string' } }, required: ['plan', 'marginNote'] } },
    verdict: { type: 'string' },
    concerns: { type: 'array', items: { type: 'string' } },
  },
}

const SYNTH = { type: 'object', additionalProperties: false, required: ['report'], properties: { report: { type: 'string' } } }

// Set to false for a product with no per-action / metered cost to skip the CEO pass.
const RUN_COST_PASS = true

const interrogate = (f) => `You are a skeptical senior engineer + QA, interrogating ONE shipped feature at the PROMISE level, by reading the ACTUAL code. Read-only.

Feature: ${f.name}
Area: ${f.area}
The promise: ${f.promise}
Where to look (start here, follow the real code): ${f.hints}

Rules:
- Judge the CODE, not UI visibility. Hidden/gated features still count.
- Ask 3 to 6 FUNDAMENTAL promise-level questions. Not "does it compile" but "does the promise actually hold for a real user". Examples of the right altitude: does the action actually reach the external system or stop at our DB; does a multi-step seam hold across the boundary; is money/credit exact under retry and double-click (idempotent); is tenant/owner isolation real (can account A read account B); what happens to an existing user with an expired token; is a failure refunded/rolled back; is a stored config/override actually used at run time; is the data persisted or a no-op.
- For EACH question, ANSWER it from the code, citing file:line evidence. Be adversarial: hunt for the gap between claim and implementation, mocks, stubs, TODOs, swallowed errors, missing persistence, IDOR, fabricated data, un-refunded failures, client-trusted state.
- Verdict: BULLETPROOF (promise fully holds in code), CRACKED (works but has a real gap/risk), FAKE (promise not actually delivered: stub/mock/no-op).
- shipBlocker = true if a gap would hurt a paying customer or lose money/data.
Return the structured schema. Be concrete; vague claims are useless.`

const costPrompt = `You are a cost-focused CEO/CFO evaluating the unit economics of this product from the REAL code. Read-only.

Read: the cost (credits / money) charged per paid action and the debit call sites; any COGS/usage ledger and where it is written; the external providers/models/APIs actually invoked and their pricing; and the plan prices + monthly entitlements. Cite file:line for charge amounts, provider/model names, and prices. Where a number is not in the code, state the assumption explicitly.

Produce:
- perAction: for each paid action, the amount charged (cite file:line), the external providers invoked, and an ESTIMATE of provider dollar COGS per run with assumptions stated.
- planMargin: for each plan, worst-case COGS if all monthly entitlement is spent on the most expensive action, vs the price, with a margin note (is it thin/negative?).
- verdict: one paragraph: is the cost too much, where is the product exposed to negative margin.
- concerns: concrete bullet risks (e.g. unmetered retries, a free-tier action that hits a paid provider, a missing rate limit on an expensive call).`

const synthPrompt = (rows, cost) => `You are the synthesis lead. Below are JSON interrogation verdicts for each feature${cost ? ', plus a CEO cost evaluation' : ''}. Write ONE markdown report.

INTERROGATIONS:
${JSON.stringify(rows, null, 1)}
${cost ? `\nCOST:\n${JSON.stringify(cost, null, 1)}` : ''}

The report must contain, in this order:
1. A one-paragraph executive summary (how many BULLETPROOF/CRACKED/FAKE, how many ship-blockers, the single biggest risk).
2. A verdict table: Feature | Area | Verdict | Ship-blocker | one-line headline gap.
3. "Ship-blockers" section: every shipBlocker=true item with its gaps and evidence, worst first.
4. "Cracks" section: CRACKED/FAKE items grouped by area with their concrete gaps + evidence.
${cost ? '5. "CEO cost read": the per-action economics, per-plan margin, the cost verdict, and the concerns.\n6. "Top 10 fixes" ranked by (customer/money impact x how cheap to fix).' : '5. "Top 10 fixes" ranked by (customer/money impact x how cheap to fix).'}
Keep evidence (file:line) inline. Be direct; this goes to stakeholders.
Return { report: <the full markdown> }.`

phase('Interrogate')
log(`Interrogating ${FEATURES.length} features${RUN_COST_PASS ? ' + CEO cost pass' : ''}`)
const [interrogations, cost] = await Promise.all([
  parallel(FEATURES.map((f) => () =>
    agent(interrogate(f), { label: `grill:${f.id}`, phase: 'Interrogate', agentType: 'Explore', schema: INTERROGATION }),
  )),
  RUN_COST_PASS
    ? agent(costPrompt, { label: 'ceo-cost', phase: 'Cost', agentType: 'Explore', schema: COST })
    : Promise.resolve(null),
])
const clean = interrogations.filter(Boolean)
log(`Got ${clean.length}/${FEATURES.length} verdicts; synthesizing`)

phase('Synthesize')
const synth = await agent(synthPrompt(clean, cost), { label: 'synthesis', phase: 'Synthesize', schema: SYNTH })

return {
  counts: {
    total: clean.length,
    bulletproof: clean.filter((r) => r.verdict === 'BULLETPROOF').length,
    cracked: clean.filter((r) => r.verdict === 'CRACKED').length,
    fake: clean.filter((r) => r.verdict === 'FAKE').length,
    shipBlockers: clean.filter((r) => r.shipBlocker).length,
  },
  interrogations: clean,
  cost,
  report: synth.report,
}
