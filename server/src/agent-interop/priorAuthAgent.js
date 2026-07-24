import { randomUUID } from 'node:crypto';
import { onTaskRequest, respondToTaskRequest } from './agentBus.js';

/**
 * Fake responder standing in for a real, separate "Prior Auth Agent" service. It only ever
 * talks to the intake agent through the Agent Interop bus (`agentBus.js`) — it has no idea a
 * Task Ledger even exists, which is the point: this proves the loosely-coupled pattern the
 * brief asks for, not a special case wired into the intake agent's internals.
 */
export function startPriorAuthAgent() {
  return onTaskRequest(async (envelope) => {
    if (envelope.task_type !== 'prior_auth.check_required') return;

    respondToTaskRequest(envelope.task_id, 'in_progress', null);

    // Simulate a real backend prior-auth check taking a couple of seconds.
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const needsReview = envelope.payload?.payerName === 'Pinnacle Health Partners';
    const result = needsReview
      ? { decision: 'pending_review', reason: 'New payer not yet verified — staff review required before visit.' }
      : { decision: 'approved', authNumber: `PA-${randomUUID().slice(0, 8).toUpperCase()}` };

    respondToTaskRequest(envelope.task_id, 'completed', result);
  });
}
