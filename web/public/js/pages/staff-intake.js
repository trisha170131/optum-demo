import React, { html, useState, useEffect, createRoot } from '../react-setup.js';
import { get, post } from '../api.js';
import { tokens } from '../tokens.js';
import { useSSE } from '../lib/useSSE.js';

function StaffIntakeApp() {
  const [ledgers, setLedgers] = useState([]);
  const [staffId, setStaffId] = useState(null);
  const [staffName, setStaffName] = useState('');
  const [loginMode, setLoginMode] = useState(true);
  const [nameInput, setNameInput] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'not_started' | 'in_progress' | 'completed'
  const [expandedLedgerId, setExpandedLedgerId] = useState(null);
  const [selectedLedger, setSelectedLedger] = useState(null);
  const [loading, setLoading] = useState(false);

  // Load ledgers on mount
  useEffect(() => {
    const stored = sessionStorage.getItem('staff_id');
    if (stored) {
      const [id, name] = stored.split(':');
      setStaffId(id);
      setStaffName(name);
      setLoginMode(false);
      loadLedgers();
    }
  }, []);

  // Listen for real-time updates
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

  const loadLedgers = async () => {
    setLoading(true);
    try {
      const resp = await fetch('/api/ledgers');
      const data = await resp.json();
      setLedgers(data.ledgers || []);
    } catch (err) {
      console.error('Error loading ledgers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStaffLogin = () => {
    if (!nameInput.trim()) return;
    const staffId = `staff_${Date.now()}`;
    setStaffId(staffId);
    setStaffName(nameInput);
    setLoginMode(false);
    sessionStorage.setItem('staff_id', `${staffId}:${nameInput}`);
    loadLedgers();
  };

  const handleLogout = () => {
    sessionStorage.removeItem('staff_id');
    setStaffId(null);
    setStaffName('');
    setLoginMode(true);
    setLedgers([]);
  };

  if (loginMode) {
    return html`
      <div class="flex items-center justify-center min-h-screen">
        <div class="w-full max-w-md px-4">
          <div class="bg-white rounded-lg border border-[#E5E7EB] p-8">
            <div class="text-center mb-6">
              <div class="text-4xl mb-2">👤</div>
              <h1 class="text-2xl font-bold text-[#374151]">Staff Login</h1>
              <p class="text-[#6B7280] mt-2">Enter your name to access registration</p>
            </div>

            <div class="space-y-4">
              <input type="text" value=${nameInput} onChange=${(e) => setNameInput(e.target.value)} onKeyPress=${(e) => e.key === 'Enter' && handleStaffLogin()}
                placeholder="Your name (e.g., Jane Smith)"
                class="w-full px-4 py-2 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-${tokens.accent}" />

              <button onClick=${handleStaffLogin} disabled=${!nameInput.trim()}
                class="w-full px-4 py-2 bg-${tokens.accent} text-white rounded-lg font-medium hover:bg-${tokens.accentHover} disabled:opacity-50">
                Login
              </button>
            </div>

            <div class="mt-6 text-center">
              <a href="/landing.html" class="text-sm text-[#6B7280] hover:text-[#374151]">← Back to home</a>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  const filteredLedgers = filter === 'all'
    ? ledgers
    : ledgers.filter((l) => {
        if (filter === 'completed') return l.summary?.readyForCheckIn;
        if (filter === 'in_progress') return l.tasks.some(t => t.status === 'in_progress');
        if (filter === 'not_started') return l.tasks.every(t => t.status === 'pending');
        return true;
      });

  return html`
    <div class="flex flex-col h-screen bg-[#F9F8F6]">
      <!-- Header -->
      <div class="bg-white border-b border-[#E5E7EB] px-4 py-4 sm:px-6">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-lg font-bold text-[#374151]">Patient Registration</h1>
            <p class="text-xs text-[#6B7280] mt-1">Logged in as: ${staffName}</p>
          </div>
          <button onClick=${handleLogout}
            class="px-3 py-2 text-sm text-[#6B7280] hover:bg-[#F3F4F6] rounded-lg transition">
            Logout
          </button>
        </div>
      </div>

      <!-- Filters -->
      <div class="bg-white border-b border-[#E5E7EB] px-4 py-3 sm:px-6">
        <div class="flex gap-2 flex-wrap">
          ${['all', 'not_started', 'in_progress', 'completed'].map((f) => html`
            <button key=${f} onClick=${() => setFilter(f)}
              class="px-3 py-1.5 text-sm rounded-lg transition ${f === filter
                ? `bg-${tokens.accent} text-white`
                : 'bg-[#F3F4F6] text-[#374151] hover:bg-[#E5E7EB]'}">
              ${f === 'all' ? 'All' : f === 'not_started' ? 'Not Started' : f === 'in_progress' ? 'In Progress' : 'Completed'}
            </button>
          `)}
        </div>
      </div>

      <!-- Patient List -->
      <div class="flex-1 overflow-auto px-4 py-4 sm:px-6">
        ${loading && html`
          <div class="text-center text-[#6B7280]">Loading...</div>
        `}

        ${!loading && filteredLedgers.length === 0 && html`
          <div class="text-center py-12">
            <div class="text-4xl mb-2">✓</div>
            <p class="text-[#6B7280]">No patients in this category</p>
          </div>
        `}

        <div class="space-y-3 max-w-4xl">
          ${filteredLedgers.map((ledger) => {
            const completedCount = ledger.tasks.filter(t => t.status === 'done').length;
            const totalCount = ledger.tasks.length;
            const progressPct = Math.round((completedCount / totalCount) * 100);
            const isExpanded = expandedLedgerId === ledger.id;

            const statusText = completedCount === totalCount ? 'Completed'
              : completedCount > 0 ? 'In Progress' : 'Not Started';
            const statusColor = completedCount === totalCount ? '[#10B981]'
              : completedCount > 0 ? '[#F59E0B]' : '[#6B7280]';
            const statusBg = completedCount === totalCount ? '[#ECFDF5]'
              : completedCount > 0 ? '[#FFFBEB]' : '[#F3F4F6]';

            return html`
              <div key=${ledger.id} class="bg-white rounded-lg border border-[#E5E7EB] overflow-hidden hover:shadow-md transition">
                <!-- Patient Card Header -->
                <button onClick=${() => setExpandedLedgerId(isExpanded ? null : ledger.id)}
                  class="w-full text-left p-4 hover:bg-[#F9F8F6] transition">
                  <div class="flex items-start justify-between">
                    <div class="flex-1">
                      <h3 class="font-bold text-[#374151]">${ledger.patientId}</h3>
                      <p class="text-sm text-[#6B7280] mt-1">
                        Appointment: ${ledger.appointmentId}
                      </p>
                      <div class="flex items-center gap-3 mt-2">
                        <span class="inline-flex items-center rounded-full bg-${statusBg} px-2.5 py-0.5 text-xs font-medium text-${statusColor}">
                          ${statusText}
                        </span>
                        <span class="text-xs text-[#6B7280]">${completedCount}/${totalCount} done</span>
                      </div>
                      ${progressPct > 0 && html`
                        <div class="mt-2 flex items-center gap-2">
                          <div class="flex-1 h-1.5 bg-[#E5E7EB] rounded-full overflow-hidden">
                            <div class="h-full bg-${tokens.accent}" style=${{ width: \`\${progressPct}%\` }}></div>
                          </div>
                          <span class="text-xs text-[#6B7280]">${progressPct}%</span>
                        </div>
                      `}
                    </div>
                    <div class="text-[#6B7280] text-lg">${isExpanded ? '▼' : '▶'}</div>
                  </div>
                </button>

                <!-- Expanded Details -->
                ${isExpanded && html`
                  <div class="border-t border-[#E5E7EB] p-4 bg-[#F9F8F6] space-y-3">
                    <!-- Tasks List -->
                    <div>
                      <p class="text-xs font-semibold text-[#6B7280] uppercase mb-2">Tasks</p>
                      <div class="space-y-2">
                        ${ledger.tasks.map((task) => {
                          const taskStatusColor = task.status === 'done' ? '[#10B981]'
                            : task.status === 'failed' ? '[#DC2626]' : '[#6B7280]';
                          const taskStatusBg = task.status === 'done' ? '[#ECFDF5]'
                            : task.status === 'failed' ? '[#FEE2E2]' : '[#F3F4F6]';
                          return html`
                            <div key=${task.key} class="flex items-center justify-between p-2 bg-white rounded">
                              <div>
                                <p class="text-sm font-medium text-[#374151]">${task.label}</p>
                                <p class="text-xs text-[#6B7280] mt-0.5">via ${task.channel || 'unknown'}</p>
                              </div>
                              <span class="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-${taskStatusBg} text-${taskStatusColor}">
                                ${task.status === 'done' ? '✓' : task.status === 'failed' ? '!' : '○'}
                              </span>
                            </div>
                          `;
                        })}
                      </div>
                    </div>

                    <!-- Action Buttons -->
                    <div class="flex gap-2 pt-2 border-t border-[#E5E7EB]">
                      <button onClick=${() => {
                        sessionStorage.setItem('patient_ledger', JSON.stringify(ledger));
                        window.open(\`/patient-intake.html?ledgerId=\${ledger.id}\`, '_blank');
                      }}
                        class="flex-1 px-3 py-2 bg-${tokens.accent} text-white text-sm font-medium rounded-lg hover:bg-${tokens.accentHover}">
                        View Intake
                      </button>
                      <button onClick=${() => setSelectedLedger(ledger)}
                        class="flex-1 px-3 py-2 bg-[#E5E7EB] text-[#374151] text-sm font-medium rounded-lg hover:bg-[#D1D5DB]">
                        Take Over
                      </button>
                    </div>
                  </div>
                `}
              </div>
            `;
          })}
        </div>
      </div>
    </div>
  `;
}

createRoot(document.getElementById('root')).render(React.createElement(StaffIntakeApp));
