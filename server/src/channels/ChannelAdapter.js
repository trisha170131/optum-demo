/**
 * One interface, four implementations (chat / SMS / voice / web form). All of them ultimately
 * call the same TaskLedgerService — this file only standardizes how a channel notifies a
 * patient and describes progress back to them; the actual task read/writes happen through
 * TaskLedgerService directly from the route handlers, tagged with `channel` for the audit log.
 */
export class ChannelAdapter {
  get name() { throw new Error('not implemented'); }
  /** Send an outbound notification to the patient through this channel. */
  async notify(_patientId, _text) { throw new Error('not implemented'); }
}

export function progressSummary(ledger) {
  const total = ledger.tasks.length;
  const done = ledger.tasks.filter((t) => t.status === 'done' || t.status === 'skipped').length;
  return { done, total, text: `${done} of ${total} steps complete` };
}
