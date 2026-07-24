// Shared shapes used by both the server and the browser (loaded directly as an ES module by
// both — no build step, no bundler). Plain JS + JSDoc instead of TypeScript: this environment
// has no npm registry access, so there is no `tsc`. Production engineering should replace this
// with real TypeScript types shared via a proper package (see HANDOFF.md).

/** @typedef {'pending'|'in_progress'|'done'|'skipped'|'failed'} TaskStatus */
export const TASK_STATUS = Object.freeze({
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  DONE: 'done',
  SKIPPED: 'skipped',
  FAILED: 'failed',
});

/** Canonical intake task keys. Order here drives default UI ordering. */
export const TASK_KEYS = Object.freeze({
  DEMOGRAPHICS: 'demographics',
  INSURANCE_CARD: 'insurance_card',
  COVERAGE_UPDATE: 'coverage_update',
  CONSENT: 'consent',
  COPAY: 'copay',
});

export const CHANNELS = Object.freeze({
  CHAT: 'chat',
  SMS: 'sms',
  VOICE: 'voice',
  WEB_FORM: 'web_form',
  STAFF: 'staff',
  SYSTEM: 'system',
});

/**
 * @typedef {Object} AuditEntry
 * @property {string} actor - who/what did it, e.g. "patient", "staff:jdoe", "system:prior_auth_agent"
 * @property {string} action
 * @property {string} channel
 * @property {string} timestamp - ISO 8601
 */

/**
 * @typedef {Object} TaskItem
 * @property {string} key
 * @property {string} label
 * @property {TaskStatus} status
 * @property {string} channel - channel that last touched this task
 * @property {string} updatedAt - ISO 8601
 * @property {Object} data - task-specific payload (demographics fields, OCR result, etc.)
 * @property {AuditEntry[]} auditLog
 */

/**
 * @typedef {Object} TaskLedger
 * @property {string} id
 * @property {string} patientId
 * @property {string} appointmentId
 * @property {string} createdAt - ISO 8601
 * @property {TaskItem[]} tasks
 */

export function makeAuditEntry(actor, action, channel) {
  return { actor, action, channel, timestamp: new Date().toISOString() };
}

export function makeTaskItem(key, label, channel = CHANNELS.SYSTEM) {
  return {
    key,
    label,
    status: TASK_STATUS.PENDING,
    channel,
    updatedAt: new Date().toISOString(),
    data: {},
    auditLog: [makeAuditEntry('system', 'task_created', channel)],
  };
}

/** Display order — `coverage_update` isn't in the default set; it's inserted dynamically after
 * insurance card capture, but should still render in this logical position, not wherever it
 * happened to land in the stored array. */
export const TASK_ORDER = [
  TASK_KEYS.DEMOGRAPHICS,
  TASK_KEYS.INSURANCE_CARD,
  TASK_KEYS.COVERAGE_UPDATE,
  TASK_KEYS.CONSENT,
  TASK_KEYS.COPAY,
];

export function sortTasksForDisplay(tasks) {
  return [...tasks].sort((a, b) => TASK_ORDER.indexOf(a.key) - TASK_ORDER.indexOf(b.key));
}

export function defaultTaskItems() {
  return [
    makeTaskItem(TASK_KEYS.DEMOGRAPHICS, 'Confirm your contact info'),
    makeTaskItem(TASK_KEYS.INSURANCE_CARD, 'Upload your insurance card'),
    makeTaskItem(TASK_KEYS.CONSENT, 'Review & sign consent forms'),
    makeTaskItem(TASK_KEYS.COPAY, 'Pay your estimated copay'),
  ];
}

/**
 * Agent Interop task-request envelope — the schema any agent (this intake agent, a Prior Auth
 * agent, an Eligibility agent, etc.) publishes/subscribes against.
 * @typedef {Object} TaskRequestEnvelope
 * @property {string} task_id
 * @property {string} task_type - e.g. "prior_auth.check_required"
 * @property {string} patient_id
 * @property {string} appointment_id
 * @property {string} requested_by - agent name that published this
 * @property {Object} payload
 * @property {'requested'|'in_progress'|'completed'|'failed'} status
 * @property {Object|null} result
 * @property {string} createdAt
 * @property {string} updatedAt
 */

export function makeTaskRequest(task_type, patientId, appointmentId, requestedBy, payload) {
  return {
    task_id: `treq_${Math.random().toString(36).slice(2, 10)}`,
    task_type,
    patient_id: patientId,
    appointment_id: appointmentId,
    requested_by: requestedBy,
    payload,
    status: 'requested',
    result: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
