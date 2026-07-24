import React, { html, useState, useEffect, createRoot } from '../react-setup.js';
import { get } from '../api.js';
import { PageHeader } from '../components/ui.js';
import { sortTasksForDisplay } from '/shared/schemas.js';
import { tokens } from '../tokens.js';

function ReadinessPill({ summary }) {
  if (summary.readyForCheckIn) return html`<span class="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">✓ Ready for check-in</span>`;
  if (summary.actionNeeded) return html`<span class="inline-flex items-center rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">⚠ Action needed</span>`;
  return html`<span class="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">In progress</span>`;
}

const TASK_STATUS_DOT = { done: 'bg-emerald-500', skipped: 'bg-slate-400', in_progress: 'bg-amber-500', pending: 'bg-slate-300', failed: 'bg-rose-500' };

function LedgerRow({ ledger, expanded, onToggle }) {
  const tasks = sortTasksForDisplay(ledger.tasks);
  return html`
      <tr key=${ledger.id + '-row'} class="cursor-pointer border-b border-${tokens.border} hover:bg-slate-50" onClick=${onToggle}
          tabIndex="0" onKeyDown=${(e) => { if (e.key === 'Enter' || e.key === ' ') onToggle(); }}
          aria-expanded=${expanded} aria-label=${`Toggle task detail for ${ledger.patientName}`}>
        <td class="px-3 py-3 text-sm font-medium text-${tokens.text}">${ledger.patientName}</td>
        <td class="px-3 py-3 text-sm text-${tokens.textMuted}">${new Date(ledger.appointmentStart).toLocaleString()}</td>
        <td class="px-3 py-3 text-sm text-${tokens.text}">${ledger.summary.done} / ${ledger.summary.total}</td>
        <td class="px-3 py-3"><${ReadinessPill} summary=${ledger.summary} /></td>
        <td class="px-3 py-3 text-right text-sm text-${tokens.accentText}">${expanded ? 'Hide' : 'Details'}</td>
      </tr>
      ${expanded && html`
        <tr key=${ledger.id + '-detail'} class="border-b border-${tokens.border} bg-slate-50">
          <td colspan="5" class="px-3 py-3">
            <ul class="grid gap-2 sm:grid-cols-2">
              ${tasks.map((t) => html`
                <li key=${t.key} class="flex items-center gap-2 rounded-lg border border-${tokens.border} bg-white px-3 py-2 text-sm">
                  <span class="h-2.5 w-2.5 shrink-0 rounded-full ${TASK_STATUS_DOT[t.status] ?? 'bg-slate-300'}" aria-hidden="true"></span>
                  <span class="flex-1 text-${tokens.text}">${t.label}</span>
                  <span class="text-${tokens.textMuted}">${t.status.replace('_', ' ')}</span>
                  <span class="text-xs text-${tokens.textMuted}">via ${t.channel}</span>
                </li>
              `)}
            </ul>
            <div class="mt-3 flex gap-3 text-sm">
              <a class="text-${tokens.accentText} underline" href=${`/chat.html?ledger=${ledger.id}`}>Open patient chat view</a>
              <a class="text-${tokens.accentText} underline" href=${`/form.html?ledger=${ledger.id}`}>Open patient form view</a>
            </div>
          </td>
        </tr>
      `}
  `;
}

function AgentInteropPanel({ tasks }) {
  if (!tasks.length) return null;
  return html`
    <div class="mt-6 rounded-xl border border-${tokens.border} bg-white p-4">
      <h2 class="text-sm font-semibold text-${tokens.text}">Agent Interop activity</h2>
      <p class="text-xs text-${tokens.textMuted}">Task requests published to the Agent Interop bus (e.g. Prior Auth Agent checks).</p>
      <ul class="mt-2 space-y-1 text-sm">
        ${tasks.map((t) => html`
          <li key=${t.task_id} class="flex flex-wrap items-center gap-2 border-t border-${tokens.border} py-1.5 first:border-t-0">
            <span class="font-mono text-xs text-${tokens.textMuted}">${t.task_type}</span>
            <span class="text-${tokens.textMuted}">patient ${t.patient_id}</span>
            <span class="rounded bg-slate-100 px-2 py-0.5 text-xs">${t.status}</span>
            ${t.result && html`<span class="text-xs text-${tokens.textMuted}">${JSON.stringify(t.result)}</span>`}
          </li>
        `)}
      </ul>
    </div>
  `;
}

function App() {
  const [ledgers, setLedgers] = useState([]);
  const [agentTasks, setAgentTasks] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [dateFilter, setDateFilter] = useState('');
  const [actionOnly, setActionOnly] = useState(false);

  async function refresh() {
    const [{ ledgers }, { tasks }] = await Promise.all([get('/api/ledgers'), get('/api/agent-tasks')]);
    ledgers.sort((a, b) => new Date(a.appointmentStart) - new Date(b.appointmentStart));
    setLedgers(ledgers);
    setAgentTasks(tasks);
  }

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, []);

  const filtered = ledgers
    .filter((l) => !dateFilter || l.appointmentStart.startsWith(dateFilter))
    .filter((l) => !actionOnly || l.summary.actionNeeded);

  return html`
    <div class="mx-auto max-w-4xl pb-16">
      <${PageHeader} title="Staff Registration Dashboard" subtitle="Who's ready for check-in, and who still needs something." />
      <div class="mt-4 flex flex-wrap items-center gap-3 px-4 sm:px-6">
        <label class="text-sm text-${tokens.textMuted}">
          Filter by date
          <input type="date" value=${dateFilter} onChange=${(e) => setDateFilter(e.target.value)}
            class="ml-2 rounded-md border border-${tokens.border} px-2 py-1 text-sm" />
        </label>
        <label class="flex items-center gap-1.5 text-sm text-${tokens.textMuted}">
          <input type="checkbox" checked=${actionOnly} onChange=${(e) => setActionOnly(e.target.checked)} />
          Action needed only
        </label>
        ${dateFilter && html`<button class="text-sm text-${tokens.accentText} underline" onClick=${() => setDateFilter('')}>Clear</button>`}
      </div>
      <div class="mt-3 overflow-x-auto px-4 sm:px-6">
        <table class="w-full min-w-[600px] overflow-hidden rounded-xl border border-${tokens.border} bg-white text-left">
          <thead class="bg-slate-100 text-xs uppercase tracking-wide text-${tokens.textMuted}">
            <tr>
              <th class="px-3 py-2">Patient</th>
              <th class="px-3 py-2">Appointment</th>
              <th class="px-3 py-2">Progress</th>
              <th class="px-3 py-2">Status</th>
              <th class="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map((l) => html`<${LedgerRow} key=${l.id} ledger=${l} expanded=${expandedId === l.id} onToggle=${() => setExpandedId(expandedId === l.id ? null : l.id)} />`)}
          </tbody>
        </table>
        ${filtered.length === 0 && html`<p class="mt-4 text-sm text-${tokens.textMuted}">No intakes match this filter.</p>`}
      </div>
      <div class="px-4 sm:px-6"><${AgentInteropPanel} tasks=${agentTasks} /></div>
    </div>
  `;
}

createRoot(document.getElementById('root')).render(React.createElement(App));
