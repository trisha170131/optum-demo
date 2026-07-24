import React, { html, useState, useEffect, createRoot } from '../react-setup.js';
import { get, post, subscribeToLedger } from '../api.js';
import { PageHeader, StepIndicator, Card, PrimaryButton, SecondaryButton } from '../components/ui.js';
import { DemographicsForm, InsuranceCardForm, CoverageUpdateStatus, ConsentForm, CopayForm } from '../components/taskForms.js';
import { sortTasksForDisplay } from '/shared/schemas.js';
import { tokens } from '../tokens.js';

const params = new URLSearchParams(location.search);
const STEP_LABELS = { demographics: 'Contact info', insurance_card: 'Insurance', consent: 'Consent', copay: 'Copay' };

function TaskRenderer({ ledgerId, patientId, task, onSkip }) {
  switch (task.key) {
    case 'demographics': return html`<${DemographicsForm} ledgerId=${ledgerId} task=${task} channel="web_form" onSkip=${onSkip} />`;
    case 'insurance_card': return html`<${InsuranceCardForm} ledgerId=${ledgerId} task=${task} channel="web_form" onSkip=${onSkip} />`;
    case 'consent': return html`<${ConsentForm} ledgerId=${ledgerId} task=${task} channel="web_form" onSkip=${onSkip} />`;
    case 'copay': return html`<${CopayForm} ledgerId=${ledgerId} task=${task} channel="web_form" patientId=${patientId} onSkip=${onSkip} />`;
    default: return null;
  }
}

function App() {
  const [ledger, setLedger] = useState(null);
  const [patient, setPatient] = useState(null);
  const [error, setError] = useState(null);
  const [viewingKey, setViewingKey] = useState(null);

  useEffect(() => {
    let unsubscribe = () => {};
    (async () => {
      try {
        let ledgerId = params.get('ledger');
        if (!ledgerId && params.get('patient')) {
          const l = await get(`/api/ledgers/by-patient/${params.get('patient')}`);
          ledgerId = l.id;
        }
        if (!ledgerId) { setError('No intake session found. Open this link from the Demo Control Panel.'); return; }
        const initial = await get(`/api/ledgers/${ledgerId}`);
        setLedger(initial);
        const { patients } = await get('/api/patients');
        setPatient(patients.find((p) => p.id === initial.patientId));
        unsubscribe = subscribeToLedger(ledgerId, setLedger);
      } catch (e) {
        setError(e.message);
      }
    })();
    return () => unsubscribe();
  }, []);

  if (error) return html`<div class="p-6 text-${tokens.text}">${error}</div>`;
  if (!ledger) return html`<div class="p-6 text-${tokens.textMuted}">Loading...</div>`;

  const tasks = sortTasksForDisplay(ledger.tasks);
  const coverageTask = tasks.find((t) => t.key === 'coverage_update');
  const steps = tasks.filter((t) => t.key !== 'coverage_update').map((t) => ({ ...t, shortLabel: STEP_LABELS[t.key] ?? t.label }));
  const activeStep = steps.find((t) => t.status !== 'done' && t.status !== 'skipped');
  const allDone = !activeStep;
  const current = steps.find((t) => t.key === viewingKey) ?? activeStep ?? steps[steps.length - 1];

  return html`
    <div class="mx-auto max-w-lg pb-16">
      <${PageHeader} title="Visit Check-In Form"
        subtitle=${patient ? `${patient.name} • ${new Date(patient.appointmentStart).toLocaleString()}` : ''} />
      <${StepIndicator} steps=${steps} currentKey=${current?.key} />
      <main class="mt-2 space-y-3 px-4 sm:px-6" role="group" aria-label="Step navigation">
        <nav class="flex flex-wrap gap-2 text-sm">
          ${steps.map((s) => html`
            <button key=${s.key} type="button" onClick=${() => setViewingKey(s.key)}
              class="min-h-[36px] rounded-md px-2 py-1 ${s.key === current?.key ? `bg-${tokens.accentSoft} font-semibold text-${tokens.accentText}` : `text-${tokens.textMuted} hover:underline`}">
              ${s.shortLabel}
            </button>
          `)}
        </nav>
        ${coverageTask && coverageTask.status !== 'done' && html`<${CoverageUpdateStatus} task=${coverageTask} />`}
        ${current && html`<${TaskRenderer} ledgerId=${ledger.id} patientId=${ledger.patientId} task=${current}
          onSkip=${async () => { await post(`/api/ledgers/${ledger.id}/tasks/${current.key}/skip`, { channel: 'web_form', actor: 'patient' }); setViewingKey(null); }} />`}
        ${allDone && html`
          <${Card} className="text-center">
            <p class="text-lg font-semibold text-${tokens.success}">You're all set!</p>
            <p class="mt-1 text-sm text-${tokens.textMuted}">We'll see you at your appointment.</p>
          </${Card}>
        `}
        <div class="flex justify-between pt-2">
          <${SecondaryButton} onClick=${() => (location.href = `/chat.html?ledger=${ledger.id}`)}>Switch to chat</${SecondaryButton}>
        </div>
      </main>
    </div>
  `;
}

createRoot(document.getElementById('root')).render(React.createElement(App));
