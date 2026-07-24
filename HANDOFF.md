# HANDOFF.md — Digital Patient Intake Agent (Demo → Production)

This is a working demo of the Digital Patient Intake Agent described in the build brief. It
runs entirely standalone against mock data — no real EMR, no real Epic sandbox, no real SMS/
voice/payment vendor. This document is the map from "what's here" to "what production needs."

## 1. How to run it

```
node server/src/server.js
```

Open `http://localhost:3000/` — that's the Demo Control Panel. Fire both trigger events for a
patient, then open any channel (Chat, Web Form, SMART EHR/Standalone launch, Demo Phone). Staff
view is at `/dashboard.html`.

No `npm install` step, on purpose — see §2.

## 2. Unusual environment constraint you should know about

This demo was built on a machine where **`registry.npmjs.org` and `registry.yarnpkg.com` are
blocked at the DNS level** (corporate network policy) and `nodejs.org`'s tarball downloads are
blocked by a proxy content filter. That made normal tooling (`npm install`, Vite, TypeScript,
Express, the Tailwind CLI) impossible to set up. If your engineering environment has normal
registry access, **this is the first thing to fix** — most of the "mocked for environment
reasons" items below go away once real tooling is available:

- Everything is plain JavaScript (ES modules), not TypeScript — there's no `tsc` without npm.
  Convert `shared/schemas.js` and friends to real `.ts` with proper types once you have a
  toolchain; the JSDoc comments in `shared/schemas.js` are a reasonable starting point for the
  type shapes.
- The frontend has no bundler — React, ReactDOM, and `htm` (JSX-like templates without a
  compiler) are loaded from the `esm.sh` CDN via native `<script type="module">` imports, and
  Tailwind is the browser JIT build (`cdn.tailwindcss.com`), which **is explicitly unsupported
  for production** by Tailwind themselves. Once you have npm, redo the frontend as a normal
  Vite + React + Tailwind (PostCSS) project — the component structure in `web/public/js/` should
  translate over with minimal changes (mostly: add JSX, add a build step, replace the CDN
  `<script>` tags).
- The backend has no Express — `server/src/httpRouter.js` is a ~100-line hand-rolled router
  using only `node:http`. Every route handler has the signature `(req, res, ctx) => {}`, which
  maps mechanically onto Express route handlers `(req, res) => {}` plus `req.params`/`req.query`.

## 3. What's mocked, and where to swap it for real

| Area | Mock (this repo) | Production swap |
|---|---|---|
| Trigger events | `server/src/eventbus/EventBus.js` — in-memory pub/sub | Real broker: Kafka, SNS+SQS, or EventBridge. Or, for real EHR triggering, Epic's CDS Hooks. `TriggerListener` (`server/src/triggers/TriggerListener.js`) only depends on the `EventBus` interface, so this is a swap of what `eventBus` is bound to, not a rewrite. |
| Task Ledger storage | `server/src/ledger/TaskLedgerStore.js` — JSON file on disk | Real datastore (Postgres, DynamoDB, etc.) behind the same `TaskLedgerStore` interface (`all()`, `get()`, `save()`). |
| FHIR data | `server/src/fhir/MockFhirClient.js` reading static fixtures in `server/src/fixtures/*.json` | Implement `FhirClient` (`server/src/fhir/FhirClient.js`) against Epic's real FHIR R4 API (base URL from your App Orchard registration). Every task module (`server/src/tasks/*.js`) only calls the `FhirClient` interface, never the fixtures directly. |
| SMART on FHIR auth | `server/src/fhir/smartAuth.js` — mock `/authorize` + `/token`, auto-approves | Point `/launch` and `/launch/standalone` (`server/src/routes/smart.js`) at Epic's real authorization server (from `.well-known/smart-configuration`), implement real OAuth2 + PKCE, delete `smartAuth.js`. |
| SMS | `server/src/channels/MockSmsAdapter.js` — in-memory thread, "Demo Phone" UI panel | Real Twilio (must be BAA-covered, since messages reference PHI-adjacent info like payment links) send + inbound webhook handler, same `ChannelAdapter` interface. |
| Voice / IVR | `server/src/channels/MockVoiceAdapter.js` — scripted state machine | Real voice AI / IVR platform (Twilio Voice + speech-to-text, or a conversational voice vendor) mapped onto the same states. |
| Payments | `server/src/tasks/paymentProcessor.js` — `MockPaymentProcessor`, no card data ever collected | Real PCI-compliant processor (Stripe, test mode first) using hosted Checkout/Elements so raw card data never touches this server. |
| Insurance card OCR | `server/src/tasks/mockOcr.js` — hardcoded per-patient results | Real document-AI/OCR vendor call on the uploaded card photos. |
| Consent / e-signature | `server/src/tasks/consent.js` — typed name + timestamp | Real e-signature/consent-management vendor (e.g. DocuSign or a healthcare-specific consent platform), plugged in at `fhirClient.createConsent`. |
| Agent Interop bus | `server/src/agent-interop/agentBus.js` — same in-memory `EventBus`, separate topic namespace | MCP-style tool calls between agents, a real event bus, or a shared task-queue service. `publishTaskRequest`/`onTaskRequest` are the only two calls anything depends on. |
| Prior Auth Agent | `server/src/agent-interop/priorAuthAgent.js` — fake responder, 2s delay, hardcoded decision | A real, separate Prior Auth agent/service subscribing to the same bus — this file proves the pattern works with the intake agent knowing nothing about the other agent's internals. |
| Design system | `web/public/js/tokens.js` — placeholder neutral palette + one teal accent | Optum's real design tokens (colors, spacing, type scale) weren't available in this environment. Every component reads from `tokens.js` rather than hardcoding colors, so this should be a one-file edit. |

## 4. Security/compliance notes carried over from the brief

- All patient data is synthetic (`server/src/fixtures/*.json`) — nothing here is real PHI.
- SMART scopes are real, checked constraints, not just requested and ignored — see
  `MockFhirClient._requireScope` and `server/src/fhir/verifyScopes.js` (a standalone smoke test
  proving a narrow-scope client is rejected). Production should keep this same discipline against
  real Epic scopes.
- Every Task Ledger item carries an `auditLog` (`shared/schemas.js` → `makeAuditEntry`) recording
  actor/action/channel/timestamp — this is the "who/what completed each item and when" trail the
  brief asks for. It's in the same JSON file as the rest of the ledger today; production should
  put this in an append-only audit table.
- No TLS/KMS is set up (this is a local demo server) — production must terminate TLS and encrypt
  data at rest per normal Optum infra standards.

## 5. Known demo-scale limitations (not production-appropriate even with real tooling)

- Single Node process, in-memory event bus and payment/SMS/voice state — restarting the server
  loses in-flight (non-ledger) state like open Demo Phone threads and Agent Interop request logs.
  The Task Ledger itself persists to `server/src/data/ledgers.json`.
- No auth on the staff dashboard or demo APIs — anyone who can reach the server can see every
  patient's ledger. The SMART launch flow issues real-looking session tokens but nothing checks
  them on subsequent API calls (`smart_token` is passed but not enforced) — wire real
  session/token enforcement into `routes/api.js` before this is anything but a demo.
- No automated test suite beyond the two smoke scripts (`server/src/triggers/verify.js`,
  `server/src/fhir/verifyScopes.js`). Add real unit/integration tests once you have a real test
  runner (Jest/Vitest need npm too).

## 6. Where things live (quick map)

```
server/src/eventbus/        EventBus interface + in-memory impl
server/src/triggers/        TriggerListener (2 mock events -> intake.initiate)
server/src/ledger/          TaskLedgerStore + TaskLedgerService (single source of truth)
server/src/tasks/           One module per intake task (demographics, insurance, consent, copay...)
server/src/channels/        ChannelAdapter interface + chat/sms/voice/web_form impls
server/src/fhir/            FhirClient interface, mock impl, mock SMART auth server
server/src/agent-interop/   Agent Interop bus + Prior Auth Agent mock
server/src/fixtures/        Static FHIR-shaped JSON (Patient, Coverage, Appointment, Consent...)
server/src/routes/          REST API, SSE stream, SMART launch routes
web/public/                 No-build-step frontend (chat/form/dashboard/demo-phone pages)
shared/schemas.js           Task Ledger + Agent Interop shapes, shared by server and browser
```

## 7. Demo walkthrough (matches the brief's §11 success criteria)

1. Open `/` (Demo Control Panel), fire both triggers for **James Chen** → intake agent activates.
2. Open his Chat Intake → complete demographics → simulate insurance card upload. His card OCRs
   to a different payer than what's on file, which:
   - adds a "Coverage change review" item to the Task Ledger
   - publishes a `prior_auth.check_required` request on the Agent Interop bus
   - the mock Prior Auth Agent responds ~2s later with `pending_review`
   - this shows up live on the chat page, the web form, and the dashboard without a refresh
3. Open `/form.html?ledger=<id>` for the same patient — identical progress, because both read/
   write the same Task Ledger via the same API.
4. Open `/dashboard.html` — James shows "⚠ Action needed" (prior auth pending review), a fully
   complete patient (e.g. Maria Alvarez, no payer change) shows "✓ Ready for check-in". Expand a
   row for the full per-task breakdown. The Agent Interop panel below the table shows the raw
   task-request/response history.
