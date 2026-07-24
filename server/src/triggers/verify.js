// Standalone smoke test for the Trigger Listener (Build Order step 2): fire both mock events
// and confirm `intake.initiate` fires exactly once, with a Task Ledger created.
import { eventBus } from '../eventbus/EventBus.js';
import { TaskLedgerService } from '../ledger/TaskLedgerService.js';
import { TaskLedgerStore } from '../ledger/TaskLedgerStore.js';
import { TriggerListener } from './TriggerListener.js';

class InMemoryStore extends TaskLedgerStore {
  constructor() { super(); this.map = new Map(); }
  all() { return Array.from(this.map.values()); }
  get(id) { return this.map.get(id) ?? null; }
  save(l) { this.map.set(l.id, l); return l; }
}

const ledgerService = new TaskLedgerService(new InMemoryStore());
const listener = new TriggerListener(ledgerService);
listener.start();

let initiateCount = 0;
eventBus.subscribe('intake.initiate', (payload) => {
  initiateCount += 1;
  console.log('intake.initiate fired:', payload);
});

eventBus.publish('appointment.scheduled', { patientId: 'pat-001', appointmentId: 'appt-001' });
console.log('after appointment.scheduled only, ledgers:', ledgerService.listLedgers().length);

eventBus.publish('financial_clearance.completed', { patientId: 'pat-001', appointmentId: 'appt-001' });
console.log('after both events, ledgers:', ledgerService.listLedgers().length);

if (initiateCount !== 1) {
  console.error(`FAIL: expected intake.initiate exactly once, got ${initiateCount}`);
  process.exit(1);
}
if (ledgerService.listLedgers().length !== 1) {
  console.error('FAIL: expected exactly one ledger created');
  process.exit(1);
}
console.log('PASS: trigger listener fires intake.initiate once both events are present.');
