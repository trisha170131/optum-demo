import { eventBus } from '../eventbus/EventBus.js';

/**
 * Subscribes to two mock events (`appointment.scheduled`, `financial_clearance.completed`).
 * When both have arrived for the same patient+appointment, emits `intake.initiate` and creates
 * the Task Ledger for that intake instance.
 *
 * This is intentionally modeled as plain pub/sub over `EventBus` so it maps cleanly onto a real
 * message broker (Kafka / SNS+SQS / EventBridge) later, or onto Epic's CDS Hooks for real-world
 * triggering — this class would not need to change, only what `eventBus` is bound to.
 */
export class TriggerListener {
  constructor(ledgerService) {
    this.ledgerService = ledgerService;
    /** @type {Map<string, {appointmentScheduled: boolean, financialClearanceCompleted: boolean}>} */
    this.pending = new Map();
  }

  _key(patientId, appointmentId) {
    return `${patientId}:${appointmentId}`;
  }

  start() {
    const unsub1 = eventBus.subscribe('appointment.scheduled', ({ patientId, appointmentId }) => {
      this._recordEvent(patientId, appointmentId, 'appointmentScheduled');
    });
    const unsub2 = eventBus.subscribe('financial_clearance.completed', ({ patientId, appointmentId }) => {
      this._recordEvent(patientId, appointmentId, 'financialClearanceCompleted');
    });
    return () => { unsub1(); unsub2(); };
  }

  _recordEvent(patientId, appointmentId, flag) {
    const key = this._key(patientId, appointmentId);
    const state = this.pending.get(key) ?? { appointmentScheduled: false, financialClearanceCompleted: false };
    state[flag] = true;
    this.pending.set(key, state);

    if (state.appointmentScheduled && state.financialClearanceCompleted) {
      this.pending.delete(key);
      // Idempotency: don't spin up a second ledger if intake was already initiated for this
      // patient+appointment (e.g. events replayed by an at-least-once broker in production).
      const existing = this.ledgerService.listLedgers()
        .find((l) => l.patientId === patientId && l.appointmentId === appointmentId);
      const ledger = existing ?? this.ledgerService.createLedger(patientId, appointmentId);
      eventBus.publish('intake.initiate', { patientId, appointmentId, ledgerId: ledger.id });
    }
  }
}
