import React, { html, useState, useEffect, createRoot } from '../react-setup.js';
import { get, subscribeToLedger } from '../api.js';
import { PageHeader, ProgressBar, Card, StatusBadge } from '../components/ui.js';
import { DemographicsForm, InsuranceCardForm, CoverageUpdateStatus, ConsentForm, CopayForm } from '../components/taskForms.js';
import { sortTasksForDisplay } from '/shared/schemas.js';
import { tokens } from '../tokens.js';

const params = new URLSearchParams(location.search);

function TaskRenderer({ ledgerId, patientId, task, channel, onSkip }) {
  switch (task.key) {
    case 'demographics': return html`<${DemographicsForm} ledgerId=${ledgerId} task=${task} channel=${channel} onSkip=${onSkip} />`;
    case 'insurance_card': return html`<${InsuranceCardForm} ledgerId=${ledgerId} task=${task} channel=${channel} onSkip=${onSkip} />`;
    case 'coverage_update': return html`<${CoverageUpdateStatus} task=${task} />`;
    case 'consent': return html`<${ConsentForm} ledgerId=${ledgerId} task=${task} channel=${channel} onSkip=${onSkip} />`;
    case 'copay': return html`<${CopayForm} ledgerId=${ledgerId} task=${task} channel=${channel} patientId=${patientId} onSkip=${onSkip} />`;
    default: return null;
  }
}

function CompletedRow({ task }) {
  return html`
    <div class="flex items-center justify-between rounded-lg border border-${tokens.border} bg-white px-3 py-2">
      <span class="text-sm text-${tokens.text}">${task.label}</span>
      <${StatusBadge} status=${task.status} />
    </div>
  `;
}

function App() {
  const [ledger, setLedger] = useState(null);
  const [patient, setPatient] = useState(null);
  const [error, setError] = useState(null);

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
  if (!ledger) return html`<div class="p-6 text-${tokens.textMuted}">Loading your check-in...</div>`;

  const tasks = sortTasksForDisplay(ledger.tasks);
  // coverage_update is system-driven (prior-auth check) — it never needs patient input, so it
  // shouldn't occupy the single "active step" slot and block the rest of intake while staff
  // review it. It renders as an always-visible status card instead.
  const coverageTask = tasks.find((t) => t.key === 'coverage_update');
  const blockingTasks = tasks.filter((t) => t.key !== 'coverage_update');
  const done = blockingTasks.filter((t) => t.status === 'done' || t.status === 'skipped');
  const active = blockingTasks.find((t) => t.status !== 'done' && t.status !== 'skipped');
  const allDone = !active;

  return html`
    <div class="mx-auto max-w-lg pb-16">
      <${PageHeader}
        title="Let's get you checked in"
        subtitle=${patient ? `${patient.name} • ${new Date(patient.appointmentStart).toLocaleString()}` : ''} />
      <${ProgressBar} done=${done.length} total=${tasks.length} />
      <main class="mt-4 space-y-3 px-4 sm:px-6">
        ${done.map((t) => html`<${CompletedRow} key=${t.key} task=${t} />`)}
        ${coverageTask && coverageTask.status !== 'done' && html`<${CoverageUpdateStatus} task=${coverageTask} />`}
        ${active && html`
          <${TaskRenderer} ledgerId=${ledger.id} patientId=${ledger.patientId} task=${active} channel="chat"
            onSkip=${async () => { const { post } = await import('../api.js'); await post(`/api/ledgers/${ledger.id}/tasks/${active.key}/skip`, { channel: 'chat', actor: 'patient' }); }} />
        `}
        ${allDone && html`
          <${Card} className="text-center">
            <p class="text-lg font-semibold text-${tokens.success}">You're all set!</p>
            <p class="mt-1 text-sm text-${tokens.textMuted}">We'll see you at your appointment. Front desk check-in will just take a moment.</p>
          </${Card}>
        `}
      </main>
      <p class="mt-6 px-4 text-center text-xs text-${tokens.textMuted} sm:px-6">
        You can close this anytime — nothing is lost. Finish later from a text link, this page, or our web form at
        <a class="underline" href=${`/form.html?ledger=${ledger.id}`}>form.html</a>.
      </p>
    </div>
  `;
}

createRoot(document.getElementById('root')).render(React.createElement(App));
