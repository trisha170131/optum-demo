import { onTaskResponse } from './agentBus.js';

/**
 * Bridges Agent Interop responses back onto the Task Ledger. This lives on the intake agent's
 * side of the bus (the Prior Auth agent mock never touches the ledger directly) — conceptually
 * the same role a real event-bus consumer/webhook handler would play in production.
 */
export function wireAgentResponsesToLedger(ledgerService) {
  return onTaskResponse((envelope) => {
    if (envelope.task_type !== 'prior_auth.check_required') return;
    const ledger = ledgerService.getLatestByPatient(envelope.patient_id);
    if (!ledger) return;

    if (envelope.status === 'in_progress') {
      ledgerService.updateTask(
        ledger.id, 'coverage_update',
        { data: { priorAuthStatus: 'checking' } },
        'system:prior_auth_agent', 'system', 'prior_auth_check_started',
      );
      return;
    }

    if (envelope.status === 'completed') {
      const done = envelope.result.decision === 'approved';
      ledgerService.updateTask(
        ledger.id, 'coverage_update',
        {
          status: done ? 'done' : 'in_progress',
          data: { priorAuthStatus: envelope.result.decision, priorAuthDetail: envelope.result },
        },
        'system:prior_auth_agent', 'system', `prior_auth_${envelope.result.decision}`,
      );
    }
  });
}
