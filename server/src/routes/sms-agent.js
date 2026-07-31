import { SMSAgent } from '../channels/SMSAgent.js';
import { MockFhirClient } from '../fhir/MockFhirClient.js';
import { readJsonBody, sendJson } from '../httpRouter.js';

export function registerSMSAgentRoutes(router, { ledgerService }) {
  const fhirClient = new MockFhirClient();
  const smsAgent = new SMSAgent(ledgerService, fhirClient);

  // POST /api/sms/message
  // Process incoming SMS message and return AI response
  router.post('/api/sms/message', async (req, res, { params }) => {
    try {
      const { ledgerId, message, phoneNumber } = await readJsonBody(req);

      if (!ledgerId || !message) {
        return sendJson(res, 400, { error: 'Missing ledgerId or message' });
      }

      const result = await smsAgent.processMessage(
        phoneNumber || 'unknown',
        message,
        ledgerId
      );

      sendJson(res, 200, {
        aiResponse: result.response,
        ledger: result.ledger,
        nextStep: result.nextStep,
      });
    } catch (error) {
      console.error('SMS Agent route error:', error);
      sendJson(res, 500, { error: error.message });
    }
  });

  // POST /api/sms/start
  // Start a new SMS intake session
  router.post('/api/sms/start', async (req, res, { params }) => {
    try {
      const { ledgerId, phoneNumber } = await readJsonBody(req);

      if (!ledgerId) {
        return sendJson(res, 400, { error: 'Missing ledgerId' });
      }

      const ledger = ledgerService.getLedger(ledgerId);
      if (!ledger) {
        return sendJson(res, 404, { error: 'Ledger not found' });
      }

      // Find first pending step and generate greeting
      const firstStep = ledger.tasks.find(t => t.status === 'pending');
      if (!firstStep) {
        return sendJson(res, 200, {
          greeting: "You are all set. No steps remaining.",
          ledger,
        });
      }

      // Get patient name for personalized greeting
      let patientFirstName = '';
      try {
        const patient = await fhirClient.getPatient(ledger.patientId);
        if (patient && patient.name && patient.name[0]) {
          patientFirstName = patient.name[0].given ? patient.name[0].given[0] : patient.name[0].text;
        }
      } catch (err) {
        console.warn('Could not fetch patient name:', err.message);
      }

      // Build greeting with patient's first name
      let greeting = '';
      if (patientFirstName) {
        greeting = `Hello ${patientFirstName}. I am reaching out to confirm and check you in for your appointment scheduled on July 25, 2026 at 2:00 PM. Can you please respond with your last name and date of birth to verify your identity?`;
      } else {
        greeting = `Hello. I am reaching out to confirm and check you in for your appointment. Can you please respond with your last name and date of birth to verify your identity?`;
      }

      sendJson(res, 200, {
        greeting,
        ledger,
        firstStep: firstStep.key,
      });
    } catch (error) {
      console.error('SMS start route error:', error);
      sendJson(res, 500, { error: error.message });
    }
  });
}
