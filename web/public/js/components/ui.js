import { html } from '../react-setup.js';
import { tokens } from '../tokens.js';

export function PageHeader({ title, subtitle }) {
  return html`
    <header class="border-b border-${tokens.border} bg-${tokens.surface} px-4 py-4 sm:px-6">
      <h1 class="text-lg font-semibold text-${tokens.text} sm:text-xl">${title}</h1>
      ${subtitle && html`<p class="mt-1 text-sm text-${tokens.textMuted}">${subtitle}</p>`}
    </header>
  `;
}

export function ProgressBar({ done, total }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return html`
    <div role="progressbar" aria-valuenow=${done} aria-valuemin="0" aria-valuemax=${total}
         aria-label="Intake progress" class="px-4 pt-3 sm:px-6">
      <div class="flex items-center justify-between text-sm font-medium text-${tokens.text}">
        <span>${done} of ${total} steps complete</span>
        <span class="text-${tokens.textMuted}">${pct}%</span>
      </div>
      <div class="mt-2 h-3 w-full rounded-full bg-[#E5E7EB]">
        <div class="h-3 rounded-full bg-${tokens.accent} transition-all shadow-md" style=${{ width: `${pct}%` }}></div>
      </div>
    </div>
  `;
}

const STATUS_STYLES = {
  done: { label: 'Done', bg: '[#ECFDF5]', text: '[#10B981]' }, // opi-green
  in_progress: { label: 'In progress', bg: '[#FFFBEB]', text: '[#F59E0B]' }, // opi-gold/amber
  pending: { label: 'Not started', bg: '[#F3F4F6]', text: '[#6B7280]' }, // light gray
  skipped: { label: 'Skipped', bg: '[#F3F4F6]', text: '[#9CA3AF]' }, // light gray
  failed: { label: 'Needs attention', bg: '[#FEE2E2]', text: '[#DC2626]' }, // opi-red
};

export function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.pending;
  return html`
    <span class="inline-flex items-center rounded-full bg-${s.bg} px-2.5 py-0.5 text-xs font-medium text-${s.text}">
      ${s.label}
    </span>
  `;
}

export function StepIndicator({ steps, currentKey }) {
  const currentIndex = steps.findIndex((s) => s.key === currentKey);
  return html`
    <ol class="flex items-center gap-1 overflow-x-auto px-4 py-3 sm:px-6" aria-label="Intake steps">
      ${steps.map((step, i) => {
        const state = step.status === 'done' || step.status === 'skipped' ? 'done' : i === currentIndex ? 'current' : 'upcoming';
        const circle = state === 'done' ? `bg-${tokens.accent} text-white` : state === 'current' ? `border-2 border-${tokens.accent} text-${tokens.accentText}` : 'border-2 border-slate-300 text-slate-400';
        return html`
          <li key=${step.key} class="flex flex-1 items-center gap-1 last:flex-none">
            <div class="flex flex-col items-center gap-1">
              <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${circle}" aria-current=${state === 'current' ? 'step' : undefined}>
                <span aria-hidden="true">${state === 'done' ? '✓' : i + 1}</span>
                <span class="sr-only">${step.shortLabel} — ${state === 'done' ? 'completed' : state === 'current' ? 'current step' : 'not started'}</span>
              </span>
              <span class="hidden text-center text-[11px] leading-tight text-${tokens.textMuted} sm:block" aria-hidden="true">${step.shortLabel}</span>
            </div>
            ${i < steps.length - 1 && html`<div class="h-0.5 flex-1 ${state === 'done' ? `bg-${tokens.accent}` : 'bg-slate-200'}"></div>`}
          </li>
        `;
      })}
    </ol>
  `;
}

export function Card({ children, className = '' }) {
  return html`
    <div class="rounded-lg border border-[#E5E7EB] bg-${tokens.surface} p-4 shadow-sm hover:shadow-md transition-shadow sm:p-5 ${className}">
      ${children}
    </div>
  `;
}

export function PrimaryButton({ children, onClick, disabled, type = 'button', ariaLabel }) {
  return html`
    <button type=${type} onClick=${onClick} disabled=${disabled} aria-label=${ariaLabel}
      class="min-h-[44px] rounded-lg bg-${tokens.accent} px-4 py-2.5 text-sm font-semibold text-white
             shadow-sm transition hover:bg-${tokens.accentHover} focus:outline-none focus-visible:ring-2
             focus-visible:ring-${tokens.accent} focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
      ${children}
    </button>
  `;
}

export function SecondaryButton({ children, onClick, ariaLabel }) {
  return html`
    <button type="button" onClick=${onClick} aria-label=${ariaLabel}
      class="min-h-[44px] rounded-lg border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-medium
             text-${tokens.text} shadow-sm transition hover:bg-[#F9F8F6] focus:outline-none focus-visible:ring-2
             focus-visible:ring-${tokens.accent} focus-visible:ring-offset-2">
      ${children}
    </button>
  `;
}

export function TertiaryButton({ children, onClick, ariaLabel }) {
  return html`
    <button type="button" onClick=${onClick} aria-label=${ariaLabel}
      class="min-h-[44px] rounded-lg bg-${tokens.secondary} px-4 py-2.5 text-sm font-semibold text-white
             shadow-sm transition hover:bg-${tokens.secondaryHover} focus:outline-none focus-visible:ring-2
             focus-visible:ring-${tokens.secondary} focus-visible:ring-offset-2">
      ${children}
    </button>
  `;
}

export function TextField({ id, label, value, onChange, type = 'text', autoComplete }) {
  return html`
    <div>
      <label for=${id} class="block text-sm font-medium text-${tokens.text}">${label}</label>
      <input id=${id} name=${id} type=${type} value=${value} autoComplete=${autoComplete}
        onChange=${(e) => onChange(e.target.value)}
        class="mt-1 block w-full min-h-[44px] rounded-lg border border-[#E5E7EB] px-3 py-2 text-base
               text-${tokens.text} shadow-sm focus:border-${tokens.accent} focus:outline-none
               focus:ring-2 focus:ring-${tokens.accent} transition" />
    </div>
  `;
}
