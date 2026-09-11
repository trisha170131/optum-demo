import { PATIENTS } from '../data/queue-data.js';

let allPatients = PATIENTS;
let filteredPatients = PATIENTS;
let sortDirection = 'asc';

function renderStats() {
  const html = `
    <div class="stat-card">
      <div class="stat-number">${allPatients.length}</div>
      <div class="stat-label">Patients in Queue</div>
      <div class="stat-detail">Ambulatory appointments today</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">${new Set(allPatients.map(p => p.dept)).size}</div>
      <div class="stat-label">Departments</div>
      <div class="stat-detail">Represented in queue</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">${new Set(allPatients.map(p => p.provider)).size}</div>
      <div class="stat-label">Providers</div>
      <div class="stat-detail">Scheduled today</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">${allPatients[0].time}</div>
      <div class="stat-label">Next Arrival</div>
      <div class="stat-detail">${allPatients[0].name} · Today</div>
    </div>
  `;
  document.getElementById('statRow').innerHTML = html;
}

function getStatusClass(statusLabel) {
  if (statusLabel.includes('Auto')) return 'status-auto';
  if (statusLabel.includes('SMS')) return 'status-sms';
  if (statusLabel.includes('Front')) return 'status-desk';
  return 'status-auto';
}

function renderQueue() {
  const html = filteredPatients.map((p, i) => `
    <a class="queue-row" href="${p.file}?scenario=${p.scenario}">
      <span class="queue-avatar">${p.name.split(' ').map(n => n[0]).join('')}</span>
      <span class="queue-name">${p.name}</span>
      <span class="queue-status ${getStatusClass(p.statusLabel)}">● ${p.statusLabel}</span>
      <div class="queue-meta">${p.dept} · ${p.provider}</div>
      <div class="queue-meta">${p.tagline}</div>
    </a>
  `).join('');

  document.getElementById('queueList').innerHTML = html;
  document.getElementById('queueBadge').textContent = filteredPatients.length;
}

function onSearch(query) {
  filteredPatients = allPatients.filter(p =>
    p.name.toLowerCase().includes(query.toLowerCase()) ||
    p.dept.toLowerCase().includes(query.toLowerCase()) ||
    p.provider.toLowerCase().includes(query.toLowerCase())
  );
  renderQueue();
}

function setView(view) {
  document.querySelectorAll('.qt-chip').forEach(el => el.classList.remove('active'));
  event.target.classList.add('active');
}

function toggleSort() {
  sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
  filteredPatients.sort((a, b) => {
    return sortDirection === 'asc' ? a.minutes - b.minutes : b.minutes - a.minutes;
  });
  document.getElementById('sortLabel').textContent = sortDirection === 'asc' ? 'Soonest First' : 'Latest First';
  renderQueue();
}

window.onSearch = onSearch;
window.setView = setView;
window.toggleSort = toggleSort;

renderStats();
renderQueue();
