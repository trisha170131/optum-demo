import { SMSAgent } from '../channels/SMSAgent.js';
import { readJsonBody, sendJson } from '../httpRouter.js';

export function registerSMSAgentRoutes(router, { ledgerService }) {
  const smsAgent = new SMSAgent(ledgerService);

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

      // Check if API key is missing
      if (error.message.includes('ANTHROPIC_API_KEY')) {
        return sendJson(res, 503, {
          error: 'Claude API not configured. Set ANTHROPIC_API_KEY environment variable.'
        });
      }

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
          greeting: "✓ You're all set! No steps remaining.",
          ledger,
        });
      }

      const greeting = `Hi! 👋 Let's get you checked in for your appointment. ${firstStep.label}`;

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
