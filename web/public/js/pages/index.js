import React, { html, useState, useEffect, createRoot } from '../react-setup.js';
import { get, post } from '../api.js';
import { PageHeader, Card, PrimaryButton, SecondaryButton } from '../components/ui.js';
import { tokens } from '../tokens.js';

function PatientRow({ patient }) {
  const [firedAppt, setFiredAppt] = useState(false);
  const [firedFinance, setFiredFinance] = useState(false);
  const [ledger, setLedger] = useState(null);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    // Ledgers are created before this page is ever revisited (e.g. via a link, or a prior visit
    // in another tab) — check for one on mount so the panel doesn't misleadingly show "not
    // fired yet" for a patient whose intake has already started.
    get(`/api/ledgers/by-patient/${patient.id}`)
      .then((l) => { setLedger(l); setFiredAppt(true); setFiredFinance(true); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!(firedAppt && firedFinance) || ledger) return;
    setPolling(true);
    let cancelled = false;
    (async () => {
      for (let i = 0; i < 20 && !cancelled; i++) {
        try {
          const l = await get(`/api/ledgers/by-patient/${patient.id}`);
          if (!cancelled) { setLedger(l); setPolling(false); }
          return;
        } catch { /* not created yet */ }
        await new Promise((r) => setTimeout(r, 250));
      }
      setPolling(false);
    })();
    return () => { cancelled = true; };
  }, [firedAppt, firedFinance]);

  async function fireAppt() {
    await post('/api/demo/trigger/appointment-scheduled', { patientId: patient.id, appointmentId: patient.appointmentId });
    setFiredAppt(true);
  }
  async function fireFinance() {
    await post('/api/demo/trigger/financial-clearance', { patientId: patient.id, appointmentId: patient.appointmentId });
    setFiredFinance(true);
  }

  return html`
    <${Card}>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="font-semibold text-${tokens.text}">${patient.name}</p>
          <p class="text-sm text-${tokens.textMuted}">${patient.serviceType} • ${new Date(patient.appointmentStart).toLocaleString()}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <${SecondaryButton} onClick=${fireAppt} ariaLabel=${`Fire appointment scheduled for ${patient.name}`}>
            ${firedAppt ? '✅ Appointment scheduled' : '1. Fire: Appointment scheduled'}
          </${SecondaryButton}>
          <${SecondaryButton} onClick=${fireFinance} ariaLabel=${`Fire financial clearance for ${patient.name}`}>
            ${firedFinance ? '✅ Financial clearance done' : '2. Fire: Financial clearance completed'}
          </${SecondaryButton}>
        </div>
      </div>
      ${polling && html`<p class="mt-3 text-sm text-${tokens.textMuted}">Activating intake agent...</p>`}
      ${ledger && html`
        <div class="mt-3 flex flex-wrap gap-2 border-t border-${tokens.border} pt-3">
          <a href=${`/chat.html?ledger=${ledger.id}`} class="text-sm font-medium text-${tokens.accentText} underline">Open Chat Intake</a>
          <a href=${`/form.html?ledger=${ledger.id}`} class="text-sm font-medium text-${tokens.accentText} underline">Open Web Form</a>
          <a href=${`/launch/standalone?patientId=${patient.id}&appointmentId=${patient.appointmentId}`} class="text-sm font-medium text-${tokens.accentText} underline">SMART Standalone Launch</a>
          <a href=${`/launch?patientId=${patient.id}&appointmentId=${patient.appointmentId}`} class="text-sm font-medium text-${tokens.accentText} underline">SMART EHR Launch (staff sidebar)</a>
          <a href=${`/launch/ehr-with-sidebar?patientId=${patient.id}&appointmentId=${patient.appointmentId}`} class="text-sm font-medium text-${tokens.accentText} underline">EMR with Intake Sidebar</a>
          <a href=${`/demo-phone.html?patient=${patient.id}`} class="text-sm font-medium text-${tokens.accentText} underline">Open Demo Phone (SMS/Voice)</a>
        </div>
      `}
    </${Card}>
  `;
}

function App() {
  const [patients, setPatients] = useState([]);
  useEffect(() => { get('/api/patients').then((r) => setPatients(r.patients)); }, []);

  return html`
    <div class="mx-auto max-w-2xl pb-16">
      <${PageHeader} title="Digital Patient Intake Agent — Demo Control Panel"
        subtitle="Fire both trigger events for a patient to activate their intake agent, then open any channel." />
      <main class="mt-4 space-y-3 px-4 sm:px-6">
        ${patients.map((p) => html`<${PatientRow} key=${p.id} patient=${p} />`)}
      </main>
      <div class="mt-6 px-4 sm:px-6">
        <a href="/dashboard.html" class="text-sm font-medium text-${tokens.accentText} underline">→ Open Staff Registration Dashboard</a>
      </div>
    </div>
  `;
}

createRoot(document.getElementById('root')).render(React.createElement(App));
