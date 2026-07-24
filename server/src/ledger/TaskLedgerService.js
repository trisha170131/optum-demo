import { randomUUID } from 'node:crypto';
import { eventBus } from '../eventbus/EventBus.js';
import { defaultTaskItems, makeAuditEntry, makeTaskItem, TASK_STATUS } from '../../../shared/schemas.js';

/**
 * Single source of truth for Task Ledgers. Every channel adapter (chat, SMS, voice, web form)
 * and the staff dashboard read/write through this service, so progress made on one channel is
 * immediately visible on all the others. Publishes `ledger.updated` on every change — that's
 * what the SSE route (`routes/sse.js`) fans out to connected clients.
 */
export class TaskLedgerService {
  constructor(store) {
    this.store = store;
  }

  createLedger(patientId, appointmentId) {
    const ledger = {
      id: `ledger_${randomUUID().slice(0, 8)}`,
      patientId,
      appointmentId,
      createdAt: new Date().toISOString(),
      tasks: defaultTaskItems(),
    };
    this.store.save(ledger);
    eventBus.publish('ledger.updated', ledger);
    return ledger;
  }

  getLedger(id) {
    return this.store.get(id);
  }

  getLatestByPatient(patientId) {
    const matches = this.store.all().filter((l) => l.patientId === patientId);
    matches.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return matches[0] ?? null;
  }

  listLedgers() {
    return this.store.all();
  }

  addTaskItem(ledgerId, key, label, channel) {
    const ledger = this.store.get(ledgerId);
    if (!ledger) throw new Error(`unknown ledger ${ledgerId}`);
    if (ledger.tasks.some((t) => t.key === key)) return ledger;
    ledger.tasks.push(makeTaskItem(key, label, channel));
    this.store.save(ledger);
    eventBus.publish('ledger.updated', ledger);
    return ledger;
  }

  /**
   * @param {string} ledgerId
   * @param {string} taskKey
   * @param {{status?: string, data?: Object}} patch
   * @param {string} actor - "patient", "staff:<name>", "system:<agent>"
   * @param {string} channel
   * @param {string} action - short audit description, e.g. "confirmed_address"
   */
  updateTask(ledgerId, taskKey, patch, actor, channel, action) {
    const ledger = this.store.get(ledgerId);
    if (!ledger) throw new Error(`unknown ledger ${ledgerId}`);
    const task = ledger.tasks.find((t) => t.key === taskKey);
    if (!task) throw new Error(`unknown task ${taskKey} on ledger ${ledgerId}`);

    if (patch.status) task.status = patch.status;
    if (patch.data) task.data = { ...task.data, ...patch.data };
    task.channel = channel;
    task.updatedAt = new Date().toISOString();
    task.auditLog.push(makeAuditEntry(actor, action, channel));

    this.store.save(ledger);
    eventBus.publish('ledger.updated', ledger);
    return ledger;
  }

  skipTask(ledgerId, taskKey, actor, channel) {
    return this.updateTask(ledgerId, taskKey, { status: TASK_STATUS.SKIPPED }, actor, channel, 'skipped');
  }
}
