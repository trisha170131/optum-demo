import { eventBus } from '../eventbus/EventBus.js';
import { readJsonBody, sendJson } from '../httpRouter.js';
import { handleLedgerStream } from './sse.js';
import { MockFhirClient } from '../fhir/MockFhirClient.js';
import { chatAdapter } from '../channels/ChatAdapter.js';
import { webFormAdapter } from '../channels/WebFormAdapter.js';
import { mockSmsAdapter } from '../channels/MockSmsAdapter.js';
import { mockVoiceAdapter } from '../channels/MockVoiceAdapter.js';
import { mockPaymentProcessor } from '../tasks/paymentProcessor.js';
import { buildDemographicsPrefill } from '../tasks/demographics.js';
import { buildInsuranceOnFile, extractInsuranceCard } from '../tasks/insuranceCard.js';
import { getConsentDocuments, signConsentDocument } from '../tasks/consent.js';
import { getExpectedCopay, recordCopayPaymentNotice } from '../tasks/copay.js';
import { publishTaskRequest, listTaskRequests } from '../agent-interop/agentBus.js';
import { TASK_KEYS } from '../../../shared/schemas.js';

// The intake agent's own backend has full FHIR access to its own patient population, the same
// way any backend service in a client-credentials grant would — distinct from the narrowly
// scoped, interactive SMART launch sessions the UI uses (see fhir/smartAuth.js + routes/smart.js).
const internalFhirClient = new MockFhirClient(['*']);

const CHANNEL_ADAPTERS = {
  chat: chatAdapter,
  web_form: webFormAdapter,
  sms: mockSmsAdapter,
  voice: mockVoiceAdapter,
};

function enrichLedger(ledger, fhirClient) {
  const total = ledger.tasks.length;
  const done = ledger.tasks.filter((t) => t.status === 'done' || t.status === 'skipped').length;
  const failed = ledger.tasks.some((t) => t.status === 'failed');
  const needsReview = ledger.tasks.some((t) => t.data?.priorAuthStatus === 'pending_review');
  return {
    ...ledger,
    summary: {
      done,
      total,
      readyForCheckIn: done === total && !failed && !needsReview,
      actionNeeded: failed || needsReview,
    },
  };
}

export function registerApiRoutes(router, { ledgerService }) {
  // ---- Demo control panel -------------------------------------------------
  router.get('/api/patients', async (req, res) => {
    const patients = internalFhirClient.patients.map((p) => {
      const appt = internalFhirClient.appointments.find((a) => a.participant[0].actor.reference === `Patient/${p.id}`);
      return { id: p.id, name: p.name[0].text, appointmentId: appt?.id, appointmentStart: appt?.start, serviceType: appt?.serviceType?.[0]?.text };
    });
    sendJson(res, 200, { patients });
  });

  router.post('/api/demo/trigger/appointment-scheduled', async (req, res) => {
    const { patientId, appointmentId } = await readJsonBody(req);
    eventBus.publish('appointment.scheduled', { patientId, appointmentId });
    sendJson(res, 200, { ok: true });
  });

  router.post('/api/demo/trigger/financial-clearance', async (req, res) => {
    const { patientId, appointmentId } = await readJsonBody(req);
    eventBus.publish('financial_clearance.completed', { patientId, appointmentId });
    sendJson(res, 200, { ok: true });
  });

  // ---- Task Ledger ---------------------------------------------------------
  router.get('/api/ledgers', async (req, res) => {
    const ledgers = ledgerService.listLedgers().map((l) => enrichLedger(l, internalFhirClient));
    const withPatients = ledgers.map((l) => {
      const patient = internalFhirClient.patients.find((p) => p.id === l.patientId);
      const appt = internalFhirClient.appointments.find((a) => a.id === l.appointmentId);
      return { ...l, patientName: patient?.name?.[0]?.text, appointmentStart: appt?.start };
    });
    sendJson(res, 200, { ledgers: withPatients });
  });

  router.get('/api/ledgers/:id', async (req, res, { params }) => {
    const ledger = ledgerService.getLedger(params.id);
    if (!ledger) return sendJson(res, 404, { error: 'not found' });
    sendJson(res, 200, enrichLedger(ledger, internalFhirClient));
  });

  router.get('/api/ledgers/by-patient/:patientId', async (req, res, { params }) => {
    const ledger = ledgerService.getLatestByPatient(params.patientId);
    if (!ledger) return sendJson(res, 404, { error: 'not found' });
    sendJson(res, 200, enrichLedger(ledger, internalFhirClient));
  });

  router.get('/api/ledgers/:id/stream', async (req, res, { params }) => {
    handleLedgerStream(req, res, ledgerService, params.id);
  });

  router.post('/api/ledgers/:id/tasks/:taskKey', async (req, res, { params }) => {
    const { status, data, channel = 'chat', actor = 'patient', action = 'updated' } = await readJsonBody(req);
    const adapter = CHANNEL_ADAPTERS[channel];
    const ledger = ledgerService.updateTask(params.id, params.taskKey, { status, data }, actor, channel, action);
    if (adapter) await adapter.notify(ledger.patientId, `Update recorded: ${params.taskKey} -> ${status}`);
    sendJson(res, 200, enrichLedger(ledger, internalFhirClient));
  });

  router.post('/api/ledgers/:id/tasks/:taskKey/skip', async (req, res, { params }) => {
    const { channel = 'chat', actor = 'patient' } = await readJsonBody(req);
    const ledger = ledgerService.skipTask(params.id, params.taskKey, actor, channel);
    sendJson(res, 200, enrichLedger(ledger, internalFhirClient));
  });

  // ---- Task-specific prefill / actions -------------------------------------
  router.get('/api/ledgers/:id/demographics/prefill', async (req, res, { params }) => {
    const ledger = ledgerService.getLedger(params.id);
    if (!ledger) return sendJson(res, 404, { error: 'not found' });
    sendJson(res, 200, await buildDemographicsPrefill(internalFhirClient, ledger.patientId));
  });

  router.get('/api/ledgers/:id/insurance/on-file', async (req, res, { params }) => {
    const ledger = ledgerService.getLedger(params.id);
    if (!ledger) return sendJson(res, 404, { error: 'not found' });
    sendJson(res, 200, await buildInsuranceOnFile(internalFhirClient, ledger.patientId) ?? {});
  });

  // Simulates: patient uploads front/back photo -> mock OCR extraction -> patient confirms.
  // If the OCR result implies a payer change, this adds a coverage_update task to the ledger
  // and kicks off the Agent Interop prior-auth check (per the brief's §7 demo scenario).
  router.post('/api/ledgers/:id/insurance/ocr', async (req, res, { params }) => {
    const ledger = ledgerService.getLedger(params.id);
    if (!ledger) return sendJson(res, 404, { error: 'not found' });
    const result = await extractInsuranceCard(internalFhirClient, ledger.patientId);

    if (result.payerChanged) {
      ledgerService.addTaskItem(params.id, TASK_KEYS.COVERAGE_UPDATE, 'Coverage change review', 'system');
      ledgerService.updateTask(
        params.id, TASK_KEYS.COVERAGE_UPDATE,
        { status: 'in_progress', data: { newPayer: result.extracted.payerName, priorAuthStatus: 'requested' } },
        'system', 'system', 'payer_change_detected',
      );
      publishTaskRequest('prior_auth.check_required', ledger.patientId, ledger.appointmentId, 'intake_agent', {
        payerName: result.extracted.payerName,
        memberId: result.extracted.memberId,
      });
    }

    sendJson(res, 200, result);
  });

  router.get('/api/ledgers/:id/consent/documents', async (req, res) => {
    sendJson(res, 200, { documents: await getConsentDocuments(internalFhirClient) });
  });

  router.post('/api/ledgers/:id/consent/sign', async (req, res, { params }) => {
    const ledger = ledgerService.getLedger(params.id);
    if (!ledger) return sendJson(res, 404, { error: 'not found' });
    const { docKey, docVersion, typedName } = await readJsonBody(req);
    const artifact = await signConsentDocument(internalFhirClient, ledger.patientId, docKey, docVersion, typedName);
    sendJson(res, 200, artifact);
  });

  router.get('/api/ledgers/:id/copay/amount', async (req, res, { params }) => {
    const ledger = ledgerService.getLedger(params.id);
    if (!ledger) return sendJson(res, 404, { error: 'not found' });
    sendJson(res, 200, await getExpectedCopay(internalFhirClient, ledger.appointmentId));
  });

  // ---- Mock payments ---------------------------------------------------------
  router.post('/api/payments/checkout', async (req, res) => {
    const { amountCents } = await readJsonBody(req);
    sendJson(res, 200, await mockPaymentProcessor.createCheckout(amountCents));
  });

  router.post('/api/payments/:checkoutId/confirm', async (req, res, { params }) => {
    const checkout = await mockPaymentProcessor.confirm(params.checkoutId);
    sendJson(res, 200, checkout);
  });

  router.post('/api/ledgers/:id/copay/payment-notice', async (req, res, { params }) => {
    const ledger = ledgerService.getLedger(params.id);
    if (!ledger) return sendJson(res, 404, { error: 'not found' });
    const { amountCents, checkoutId } = await readJsonBody(req);
    sendJson(res, 200, await recordCopayPaymentNotice(internalFhirClient, ledger.patientId, amountCents, checkoutId));
  });

  // ---- Demo Phone (mock SMS / voice) -----------------------------------------
  router.get('/api/demo-phone/sms/:patientId', async (req, res, { params }) => {
    sendJson(res, 200, { thread: mockSmsAdapter.getThread(params.patientId) });
  });

  router.post('/api/demo-phone/sms/:patientId/send', async (req, res, { params }) => {
    const { text } = await readJsonBody(req);
    await mockSmsAdapter.notify(params.patientId, text);
    sendJson(res, 200, { thread: mockSmsAdapter.getThread(params.patientId) });
  });

  router.post('/api/demo-phone/sms/:patientId/reply', async (req, res, { params }) => {
    const { text } = await readJsonBody(req);
    mockSmsAdapter.receiveReply(params.patientId, text);
    sendJson(res, 200, { thread: mockSmsAdapter.getThread(params.patientId) });
  });

  router.post('/api/demo-phone/voice/:patientId/start', async (req, res, { params }) => {
    const { amountCents } = await readJsonBody(req);
    sendJson(res, 200, mockVoiceAdapter.startCall(params.patientId, amountCents));
  });

  router.post('/api/demo-phone/voice/:patientId/input', async (req, res, { params }) => {
    const { input } = await readJsonBody(req);
    sendJson(res, 200, mockVoiceAdapter.advanceCall(params.patientId, input));
  });

  // ---- AI Chat endpoint (new patient view) -----------------------------------
  router.post('/api/ledgers/:id/chat', async (req, res, { params }) => {
    const { taskKey, message } = await readJsonBody(req);
    const ledger = ledgerService.getLedger(params.id);
    if (!ledger) return sendJson(res, 404, { error: 'ledger not found' });

    const task = ledger.tasks.find((t) => t.key === taskKey);
    if (!task) return sendJson(res, 404, { error: 'task not found' });

    // Generate a mock AI response based on the task type
    let aiResponse = '';
    switch (taskKey) {
      case TASK_KEYS.DEMOGRAPHICS:
        aiResponse = '✓ Got it! Your information is updated. Ready for the next step?';
        // Mark task as done
        ledgerService.updateTask(params.id, taskKey, { status: 'done' }, 'patient', 'chat', 'confirmed_demographics');
        break;
      case TASK_KEYS.INSURANCE_CARD:
        aiResponse = '✓ Thank you for providing your insurance info. Moving to the next step...';
        ledgerService.updateTask(params.id, taskKey, { status: 'done' }, 'patient', 'chat', 'confirmed_insurance_card');
        break;
      case TASK_KEYS.CONSENT:
        aiResponse = '✓ Thank you for reviewing and signing the consent forms.';
        ledgerService.updateTask(params.id, taskKey, { status: 'done' }, 'patient', 'chat', 'signed_consents');
        break;
      case TASK_KEYS.COPAY:
        aiResponse = '✓ Your payment has been processed. You\'re all set!';
        ledgerService.updateTask(params.id, taskKey, { status: 'done' }, 'patient', 'chat', 'paid_copay');
        break;
      default:
        aiResponse = 'Thank you for your response. Next question coming up...';
    }

    const updatedLedger = ledgerService.getLedger(params.id);
    sendJson(res, 200, {
      aiResponse,
      ledger: enrichLedger(updatedLedger, internalFhirClient),
    });
  });

  // ---- Agent interop debug view -----------------------------------------------
  router.get('/api/agent-tasks', async (req, res) => {
    sendJson(res, 200, { tasks: listTaskRequests() });
  });
}
