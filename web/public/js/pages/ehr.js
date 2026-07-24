import React, { useState, useEffect } from 'https://esm.sh/react@18';
import { createRoot } from 'https://esm.sh/react-dom@18/client';
import { html } from '../react-setup.js';
import { tokens } from '../tokens.js';
import { useSSE } from '../lib/useSSE.js';

function EhrApp() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [fullscreenDashboard, setFullscreenDashboard] = useState(false);
  const [ledgers, setLedgers] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);

  // Load ledgers on mount
  useEffect(() => {
    (async () => {
      const resp = await fetch('/api/ledgers');
      const data = await resp.json();
      setLedgers(data.ledgers || []);
      if (data.ledgers?.[0]) setSelectedPatient(data.ledgers[0]);
    })();
  }, []);

  // Listen for ledger updates
  useSSE((event) => {
    if (event.type === 'ledger.updated') {
      setLedgers((prev) => {
        const idx = prev.findIndex((l) => l.id === event.data.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = event.data;
          return updated;
        }
        return [...prev, event.data];
      });
    }
  });

  const patientName = selectedPatient ? `${selectedPatient.patientId || 'Patient'}` : 'No patient selected';
  const progressPct = selectedPatient ? Math.round((selectedPatient.tasks.filter(t => t.status === 'done').length / selectedPatient.tasks.length) * 100) : 0;

  if (fullscreenDashboard) {
    return html`
      <div class="flex flex-col h-screen bg-[#F9F8F6]">
        <div class="flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB] bg-white">
          <h1 class="text-lg font-bold text-[#374151]">Patient Intake Dashboard — Fullscreen</h1>
          <button onClick=${() => setFullscreenDashboard(false)}
            class="px-3 py-1.5 text-sm font-medium text-white bg-${tokens.accent} rounded-lg hover:bg-${tokens.accentHover}">
            Back to EMR
          </button>
        </div>
        <div class="flex-1 overflow-auto p-4">
          ${selectedPatient ? html`
            <div class="bg-white rounded-lg border border-[#E5E7EB] p-5 shadow-sm">
              <h2 class="text-xl font-bold text-[#374151] mb-1">${patientName}</h2>
              <p class="text-sm text-[#6B7280] mb-4">Appointment: ${selectedPatient.appointmentId}</p>
              <div class="space-y-3">
                ${selectedPatient.tasks.map((task, i) => {
                  const statusBg = task.status === 'done' ? '[#ECFDF5]' : task.status === 'failed' ? '[#FEE2E2]' : '[#F3F4F6]';
                  const statusText = task.status === 'done' ? '[#10B981]' : task.status === 'failed' ? '[#DC2626]' : '[#6B7280]';
                  return html`
                    <div key=${task.key} class="flex items-center justify-between p-3 bg-[#F9F8F6] rounded-lg border border-[#E5E7EB]">
                      <span class="text-sm font-medium text-[#374151]">${task.label}</span>
                      <span class="inline-flex items-center rounded-full bg-${statusBg} px-2.5 py-0.5 text-xs font-medium text-${statusText}">
                        ${task.status === 'done' ? '✓ Done' : task.status === 'pending' ? 'Not started' : task.status === 'in_progress' ? 'In progress' : 'Needs attention'}
                      </span>
                    </div>
                  `;
                })}
              </div>
            </div>
          ` : html`<p class="text-[#6B7280]">No patient selected</p>`}
        </div>
      </div>
    `;
  }

  return html`
    <div class="flex flex-col h-screen bg-[#F9F8F6]">
      <!-- EMR Header -->
      <header class="bg-[#1F2937] text-white px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-6">
          <h1 class="text-lg font-bold">EHR — Donald Medical Centre</h1>
          <input type="text" placeholder="Search patients, orders..."
            class="px-3 py-1.5 rounded-lg bg-[#374151] text-white text-sm placeholder-[#9CA3AF] w-64" />
        </div>
        <div class="flex items-center gap-2">
          <span class="text-sm">Rachel Nguyen</span>
          <div class="w-8 h-8 rounded-full bg-[#FF612B] flex items-center justify-center text-xs font-bold">RN</div>
        </div>
      </header>

      <!-- Tabs -->
      <div class="flex gap-4 px-4 py-3 border-b border-[#E5E7EB] bg-white">
        <button class="px-3 py-2 text-sm font-medium text-[#FF612B] border-b-2 border-[#FF612B]">Claim pre-check</button>
        <button class="px-3 py-2 text-sm font-medium text-[#6B7280] hover:text-[#374151]">Schedule</button>
        <button class="px-3 py-2 text-sm font-medium text-[#6B7280] hover:text-[#374151]">Patient list</button>
      </div>

      <!-- Main Content -->
      <div class="flex flex-1 overflow-hidden">
        <!-- Left: EMR Content (70%) -->
        <div class="flex-1 flex flex-col overflow-auto ${sidebarOpen ? 'w-[70%]' : 'w-full'}">
          <div class="p-4 border-b border-[#E5E7EB] bg-white">
            <h2 class="text-base font-bold text-[#FF612B] mb-3">Patient Workqueues</h2>
            <div class="flex gap-2 text-sm border-b border-[#E5E7EB]">
              <button class="px-3 py-2 font-medium text-[#FF612B] border-b-2 border-[#FF612B]">Active (${ledgers.length})</button>
              <button class="px-3 py-2 text-[#6B7280]">Deferred (0)</button>
              <button class="px-3 py-2 text-[#6B7280]">Transferred (0)</button>
            </div>
          </div>

          <!-- Workqueue Table -->
          <div class="flex-1 overflow-auto p-4">
            <div class="bg-white rounded-lg border border-[#E5E7EB] overflow-hidden">
              <table class="w-full text-sm">
                <thead class="bg-[#F9F8F6] border-b border-[#E5E7EB]">
                  <tr>
                    <th class="px-4 py-3 text-left font-semibold text-[#374151]">Patient</th>
                    <th class="px-4 py-3 text-left font-semibold text-[#374151]">Status</th>
                    <th class="px-4 py-3 text-left font-semibold text-[#374151]">Appointment</th>
                  </tr>
                </thead>
                <tbody>
                  ${ledgers.map((ledger, i) => {
                    const isSelected = selectedPatient?.id === ledger.id;
                    const readyCount = ledger.tasks.filter(t => t.status === 'done').length;
                    const readyStatus = readyCount === ledger.tasks.length ? 'Ready for check-in' : 'In progress';
                    const statusColor = readyCount === ledger.tasks.length ? '[#10B981]' : '[#F59E0B]';
                    return html`
                      <tr key=${ledger.id} onClick=${() => setSelectedPatient(ledger)}
                        class="border-b border-[#E5E7EB] hover:bg-[#F9F8F6] cursor-pointer ${isSelected ? 'bg-[#EEF2FF]' : ''}">
                        <td class="px-4 py-3 font-medium text-[#374151]">${ledger.patientId}</td>
                        <td class="px-4 py-3">
                          <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-${statusColor === '[#10B981]' ? '[#ECFDF5]' : '[#FFFBEB]'} text-${statusColor}">
                            ${readyStatus} (${readyCount}/${ledger.tasks.length})
                          </span>
                        </td>
                        <td class="px-4 py-3 text-[#6B7280]">${ledger.appointmentId}</td>
                      </tr>
                    `;
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Right: Staff Dashboard Sidebar (30%, collapsible) -->
        ${sidebarOpen && html`
          <div class="w-[30%] border-l border-[#E5E7EB] bg-white flex flex-col overflow-hidden">
            <div class="flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB]">
              <h3 class="font-bold text-[#374151]">Patient Intake</h3>
              <div class="flex gap-1">
                <button onClick=${() => setFullscreenDashboard(true)} title="Expand to fullscreen"
                  class="p-1.5 text-[#6B7280] hover:bg-[#F3F4F6] rounded-lg transition">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6v12h12v-4m4-7h-4v4h4V9zm0 0V5h4v4h-4z" />
                  </svg>
                </button>
                <button onClick=${() => setSidebarOpen(false)} title="Collapse sidebar"
                  class="p-1.5 text-[#6B7280] hover:bg-[#F3F4F6] rounded-lg transition">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            <div class="flex-1 overflow-auto p-4">
              ${selectedPatient ? html`
                <div class="space-y-3">
                  <div>
                    <p class="text-xs font-semibold text-[#6B7280] uppercase mb-1">Patient</p>
                    <p class="text-sm font-bold text-[#374151]">${selectedPatient.patientId}</p>
                  </div>
                  <div>
                    <p class="text-xs font-semibold text-[#6B7280] uppercase mb-1">Progress</p>
                    <div class="w-full h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
                      <div class="h-full bg-${tokens.accent} transition-all" style=${{ width: \`\${progressPct}%\` }}></div>
                    </div>
                    <p class="text-xs text-[#6B7280] mt-1">${progressPct}% complete</p>
                  </div>

                  <div class="border-t border-[#E5E7EB] pt-3">
                    <p class="text-xs font-semibold text-[#6B7280] uppercase mb-2">Tasks</p>
                    ${selectedPatient.tasks.map((task) => {
                      const statusBg = task.status === 'done' ? '[#ECFDF5]' : task.status === 'failed' ? '[#FEE2E2]' : '[#F3F4F6]';
                      const statusText = task.status === 'done' ? '[#10B981]' : task.status === 'failed' ? '[#DC2626]' : '[#6B7280]';
                      return html`
                        <div key=${task.key} class="flex items-start justify-between mb-2 p-2 bg-[#F9F8F6] rounded">
                          <span class="text-xs font-medium text-[#374151]">${task.label}</span>
                          <span class="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium bg-${statusBg} text-${statusText}>
                            ${task.status === 'done' ? '✓' : task.status === 'failed' ? '!' : '○'}
                          </span>
                        </div>
                      `;
                    })}
                  </div>
                </div>
              ` : html`<p class="text-sm text-[#6B7280]">Select a patient to view intake status</p>`}
            </div>
          </div>
        `}
      </div>

      <!-- Collapse Button (when sidebar is closed) -->
      ${!sidebarOpen && html`
        <button onClick=${() => setSidebarOpen(true)}
          class="fixed bottom-4 right-4 p-3 bg-${tokens.accent} text-white rounded-lg shadow-lg hover:bg-${tokens.accentHover} transition"
          title="Open sidebar">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      `}
    </div>
  `;
}

const root = createRoot(document.getElementById('root'));
root.render(React.createElement(EhrApp));
