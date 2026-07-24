import { html, useState, useEffect } from '../react-setup.js';
import { get, post } from '../api.js';
import { Card, PrimaryButton, SecondaryButton, TextField, StatusBadge } from './ui.js';
import { tokens } from '../tokens.js';

const actionsFor = (channel) => ({
  complete: (ledgerId, taskKey, data, action) =>
    post(`/api/ledgers/${ledgerId}/tasks/${taskKey}`, { status: 'done', data, channel, actor: 'patient', action }),
  skip: (ledgerId, taskKey) => post(`/api/ledgers/${ledgerId}/tasks/${taskKey}/skip`, { channel, actor: 'patient' }),
});

function TaskShell({ task, children, onSkip, hideSkip }) {
  return html`
    <${Card}>
      <div class="flex items-start justify-between gap-3">
        <h2 class="text-base font-semibold text-${tokens.text}">${task.label}</h2>
        <${StatusBadge} status=${task.status} />
      </div>
      <div class="mt-4 space-y-4">${children}</div>
      ${!hideSkip && task.status !== 'done' && html`
        <div class="mt-4 border-t border-${tokens.border} pt-3">
          <button type="button" onClick=${onSkip}
            class="text-sm font-medium text-${tokens.textMuted} underline-offset-2 hover:underline min-h-[44px]">
            Skip for now — I'll finish this later
          </button>
        </div>
      `}
    </${Card}>
  `;
}

export function DemographicsForm({ ledgerId, task, channel, onSkip }) {
  const { complete } = actionsFor(channel);
  const [fields, setFields] = useState(task.data?.confirmed ? task.data : null);
  const [loading, setLoading] = useState(!task.data?.confirmed);

  useEffect(() => {
    if (fields) return;
    get(`/api/ledgers/${ledgerId}/demographics/prefill`).then((data) => { setFields(data); setLoading(false); });
  }, []);

  if (loading || !fields) return html`<${TaskShell} task=${task} onSkip=${onSkip}><p class="text-sm text-${tokens.textMuted}">Loading your info on file...</p></${TaskShell}>`;

  const set = (key) => (val) => setFields((f) => ({ ...f, [key]: val }));

  return html`
    <${TaskShell} task=${task} onSkip=${onSkip}>
      <p class="text-sm text-${tokens.textMuted}">We already have this on file — just confirm it's still correct, or fix anything that's changed.</p>
      <${TextField} id="phone" label="Mobile phone" value=${fields.phone} onChange=${set('phone')} autoComplete="tel" />
      <${TextField} id="email" label="Email" value=${fields.email} onChange=${set('email')} autoComplete="email" />
      <${TextField} id="addressLine" label="Street address" value=${fields.addressLine} onChange=${set('addressLine')} autoComplete="address-line1" />
      <div class="grid grid-cols-2 gap-3">
        <${TextField} id="city" label="City" value=${fields.city} onChange=${set('city')} autoComplete="address-level2" />
        <${TextField} id="postalCode" label="ZIP code" value=${fields.postalCode} onChange=${set('postalCode')} autoComplete="postal-code" />
      </div>
      <${TextField} id="emergencyContactName" label="Emergency contact name" value=${fields.emergencyContactName} onChange=${set('emergencyContactName')} />
      <${TextField} id="emergencyContactPhone" label="Emergency contact phone" value=${fields.emergencyContactPhone} onChange=${set('emergencyContactPhone')} autoComplete="tel" />
      ${task.status !== 'done' && html`
        <${PrimaryButton} onClick=${() => complete(ledgerId, task.key, { ...fields, confirmed: true }, 'confirmed_demographics')}>
          Confirm, this is correct
        </${PrimaryButton}>
      `}
    </${TaskShell}>
  `;
}

export function InsuranceCardForm({ ledgerId, task, channel, onSkip }) {
  const { complete } = actionsFor(channel);
  const [ocrResult, setOcrResult] = useState(task.data?.extracted ? task.data : null);
  const [scanning, setScanning] = useState(false);

  async function simulateUpload() {
    setScanning(true);
    const result = await post(`/api/ledgers/${ledgerId}/insurance/ocr`, {});
    setOcrResult(result);
    setScanning(false);
  }

  return html`
    <${TaskShell} task=${task} onSkip=${onSkip}>
      ${!ocrResult && html`
        <p class="text-sm text-${tokens.textMuted}">Take a photo of the front and back of your insurance card (or choose a file). We'll read the details for you.</p>
        <div class="flex flex-wrap gap-3">
          <${SecondaryButton} onClick=${simulateUpload}>${scanning ? 'Scanning card...' : '📷 Simulate photo upload (front)'}</${SecondaryButton}>
        </div>
      `}
      ${ocrResult && html`
        <div class="rounded-lg bg-${tokens.accentSoft} p-3 text-sm text-${tokens.text}">
          <p class="font-medium">Here's what we read from your card:</p>
          <dl class="mt-2 grid grid-cols-2 gap-1">
            <dt class="text-${tokens.textMuted}">Payer</dt><dd>${ocrResult.extracted.payerName}</dd>
            <dt class="text-${tokens.textMuted}">Member ID</dt><dd>${ocrResult.extracted.memberId}</dd>
            <dt class="text-${tokens.textMuted}">Group #</dt><dd>${ocrResult.extracted.groupNumber}</dd>
            <dt class="text-${tokens.textMuted}">Plan type</dt><dd>${ocrResult.extracted.planType}</dd>
          </dl>
        </div>
        ${ocrResult.payerChanged && html`
          <p class="text-sm text-${tokens.warn}">
            Looks like your insurance changed since your last visit — we're double-checking coverage for this appointment (see below).
          </p>
        `}
        ${task.status !== 'done' && html`
          <${PrimaryButton} onClick=${() => complete(ledgerId, task.key, ocrResult, 'confirmed_insurance_card')}>
            Yes, that's correct
          </${PrimaryButton}>
        `}
      `}
    </${TaskShell}>
  `;
}

export function CoverageUpdateStatus({ task }) {
  const status = task.data?.priorAuthStatus;
  const copy = {
    requested: 'Checking your new coverage — this usually takes a moment.',
    checking: 'Still checking your new coverage with prior authorization...',
    approved: 'Good news — your new coverage is verified and this visit is pre-authorized.',
    pending_review: 'Your new plan needs a quick look from our staff before your visit. No action needed from you right now.',
  }[status] ?? 'Reviewing your coverage change...';

  return html`
    <${TaskShell} task=${task} hideSkip=${true}>
      <p class="text-sm text-${tokens.text}">${copy}</p>
      ${task.data?.newPayer && html`<p class="text-sm text-${tokens.textMuted}">New payer: ${task.data.newPayer}</p>`}
    </${TaskShell}>
  `;
}

export function ConsentForm({ ledgerId, task, channel, onSkip }) {
  const { complete } = actionsFor(channel);
  const [docs, setDocs] = useState([]);
  const [signed, setSigned] = useState(task.data?.signedDocs ?? {});
  const [typedName, setTypedName] = useState('');
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    get(`/api/ledgers/${ledgerId}/consent/documents`).then((r) => setDocs(r.documents));
  }, []);

  async function signOne(doc) {
    if (!typedName.trim()) return;
    const artifact = await post(`/api/ledgers/${ledgerId}/consent/sign`, { docKey: doc.key, docVersion: doc.version, typedName });
    const next = { ...signed, [doc.key]: { typedName, signedAt: artifact.dateTime, artifactId: artifact.id, version: doc.version } };
    setSigned(next);
    if (docs.every((d) => next[d.key])) {
      await complete(ledgerId, task.key, { signedDocs: next }, 'signed_all_consents');
    }
  }

  return html`
    <${TaskShell} task=${task} onSkip=${onSkip}>
      <p class="text-sm text-${tokens.textMuted}">Please review and sign each form below. Typing your full name counts as your signature.</p>
      ${docs.map((doc) => html`
        <div key=${doc.key} class="rounded-lg border border-${tokens.border} p-3">
          <div class="flex items-center justify-between gap-2">
            <h3 class="font-medium text-${tokens.text}">${doc.title}</h3>
            ${signed[doc.key]
              ? html`<span class="text-sm text-${tokens.success}">Signed by ${signed[doc.key].typedName}</span>`
              : html`<button type="button" class="text-sm text-${tokens.accentText} underline min-h-[36px]" aria-expanded=${expanded === doc.key} aria-controls=${'body-' + doc.key} onClick=${() => setExpanded(expanded === doc.key ? null : doc.key)}>${expanded === doc.key ? 'Hide details' : 'Read details'}</button>`}
          </div>
          <p class="mt-1 text-sm text-${tokens.textMuted}">${doc.summary}</p>
          ${expanded === doc.key && html`<p id=${'body-' + doc.key} class="mt-2 rounded bg-slate-50 p-2 text-sm text-${tokens.text}">${doc.body}</p>`}
          ${!signed[doc.key] && html`
            <div class="mt-2 flex flex-wrap items-end gap-2">
              <div class="flex-1 min-w-[180px]">
                <${TextField} id=${'sig-' + doc.key} label="Type your full legal name to sign" value=${typedName} onChange=${setTypedName} />
              </div>
              <${PrimaryButton} onClick=${() => signOne(doc)} disabled=${!typedName.trim()}>Sign</${PrimaryButton}>
            </div>
          `}
        </div>
      `)}
    </${TaskShell}>
  `;
}

export function CopayForm({ ledgerId, task, channel, patientId, onSkip }) {
  const { complete } = actionsFor(channel);
  const [amount, setAmount] = useState(task.data?.amountCents ?? null);
  const [payMode, setPayMode] = useState(null);
  const [checkout, setCheckout] = useState(null);
  const [voice, setVoice] = useState(null);
  const [smsSent, setSmsSent] = useState(false);

  useEffect(() => {
    if (amount != null) return;
    get(`/api/ledgers/${ledgerId}/copay/amount`).then((r) => setAmount(r.amountCents));
  }, []);

  async function payByWeb() {
    const chk = await post('/api/payments/checkout', { amountCents: amount });
    setCheckout(chk);
  }
  async function confirmWebPayment() {
    await post(`/api/payments/${checkout.id}/confirm`, {});
    await post(`/api/ledgers/${ledgerId}/copay/payment-notice`, { amountCents: amount, checkoutId: checkout.id });
    await complete(ledgerId, task.key, { amountCents: amount, paidVia: 'web' }, 'paid_copay_web');
  }
  async function sendSmsLink() {
    await post(`/api/demo-phone/sms/${patientId}/send`, { text: `Pay your $${(amount / 100).toFixed(2)} copay: ${location.origin}/chat.html?ledger=${ledgerId}` });
    setSmsSent(true);
  }
  async function startVoiceCall() {
    const v = await post(`/api/demo-phone/voice/${patientId}/start`, { amountCents: amount });
    setVoice(v);
  }
  async function advanceVoice(input) {
    const v = await post(`/api/demo-phone/voice/${patientId}/input`, { input });
    setVoice(v);
    if (v.state === 'done') await complete(ledgerId, task.key, { amountCents: amount, paidVia: 'voice' }, 'paid_copay_voice');
    if (v.state === 'skipped') await actionsFor(channel).skip(ledgerId, task.key);
  }

  if (amount == null) return html`<${TaskShell} task=${task} onSkip=${onSkip}><p class="text-sm text-${tokens.textMuted}">Looking up your copay...</p></${TaskShell}>`;

  return html`
    <${TaskShell} task=${task} onSkip=${onSkip}>
      <p class="text-sm text-${tokens.text}">Your estimated copay for this visit is <strong>$${(amount / 100).toFixed(2)}</strong>.</p>
      ${task.status !== 'done' && !payMode && html`
        <div class="flex flex-wrap gap-2">
          <${SecondaryButton} onClick=${() => setPayMode('web')}>💳 Pay now (web)</${SecondaryButton}>
          <${SecondaryButton} onClick=${() => setPayMode('sms')}>💬 Text me a pay link</${SecondaryButton}>
          <${SecondaryButton} onClick=${() => setPayMode('voice')}>☎️ Pay by phone (IVR demo)</${SecondaryButton}>
        </div>
      `}
      ${payMode === 'web' && task.status !== 'done' && html`
        <div class="rounded-lg border border-${tokens.border} p-3">
          ${!checkout
            ? html`<${PrimaryButton} onClick=${payByWeb}>Enter test payment</${PrimaryButton}>`
            : html`
              <p class="text-sm text-${tokens.textMuted}">Test card on file: 4242 4242 4242 4242 (Stripe test mode — no real card data in this demo).</p>
              <div class="mt-2"><${PrimaryButton} onClick=${confirmWebPayment}>Confirm $${(amount / 100).toFixed(2)} payment</${PrimaryButton}></div>
            `}
        </div>
      `}
      ${payMode === 'sms' && html`
        <div class="rounded-lg border border-${tokens.border} p-3 text-sm">
          ${smsSent
            ? html`<p class="text-${tokens.success}">Sent! Check the Demo Phone panel to see and tap the link.</p>`
            : html`<${PrimaryButton} onClick=${sendSmsLink}>Send text</${PrimaryButton}>`}
        </div>
      `}
      ${payMode === 'voice' && html`
        <div class="rounded-lg border border-${tokens.border} p-3 text-sm">
          ${!voice
            ? html`<${PrimaryButton} onClick=${startVoiceCall}>📞 Start demo call</${PrimaryButton}>`
            : html`
              <p class="italic text-${tokens.text}">IVR: "${voice.prompt}"</p>
              ${voice.state === 'greeting' && html`<div class="mt-2 flex gap-2"><${SecondaryButton} onClick=${() => advanceVoice('1')}>Press 1 (pay)</${SecondaryButton}><${SecondaryButton} onClick=${() => advanceVoice('2')}>Press 2 (skip)</${SecondaryButton}></div>`}
              ${voice.state === 'collect_card' && html`<div class="mt-2"><${SecondaryButton} onClick=${() => advanceVoice('4242')}>Enter test card #</${SecondaryButton}></div>`}
              ${voice.state === 'confirm_payment' && html`<div class="mt-2"><${SecondaryButton} onClick=${() => advanceVoice('1')}>Press 1 (confirm)</${SecondaryButton}></div>`}
            `}
        </div>
      `}
    </${TaskShell}>
  `;
}
