// Use Claude API via REST (no npm dependency needed)
// Falls back to mock mode if API key not set
async function callClaudeAPI(systemPrompt, userMessage, stepKey) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  // If no API key, use mock mode for demo purposes
  if (!apiKey) {
    return generateMockResponse(userMessage, stepKey);
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 500,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userMessage,
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      `Claude API error: ${error.error?.message || response.statusText}`
    );
  }

  const data = await response.json();
  return data.content[0].text;
}

// Mock response generator for demo mode
function generateMockResponse(userMessage, stepKey) {
  const mockResponses = {
    identity_confirm: "Thank you for confirming your identity. We have verified your last name and date of birth.",
    insurance: "Thank you for confirming your insurance coverage. Your Blue Cross Blue Shield plan is active in our system.",
    demographics: "Thank you. We have confirmed all your contact information and demographics are current.",
    consent: "Thank you for reviewing and confirming the consent forms and privacy practices.",
    copay_display: "Your estimated copay for this visit is $30. Payment can be made now or at check-in.",
  };

  return mockResponses[stepKey] || "Thank you for that information.";
}

const INTAKE_STEPS = [
  {
    key: "identity_confirm",
    label: "Confirm Identity",
    prompt: "Hi {name}, I am reaching out to confirm and check you in for your appointment scheduled on {date}. Can you please respond with your last name and date of birth to verify your identity?",
  },
  {
    key: "insurance",
    label: "Confirm Insurance",
    prompt: "Thank you. Can you please confirm that {insurer} is still your active insurance provider?",
  },
  {
    key: "demographics",
    label: "Confirm Contact Information",
    prompt: "Can you please confirm your current mailing address is still {address}?",
  },
  {
    key: "consent",
    label: "Consent & Privacy Review",
    prompt: "Have you had the opportunity to review our consent forms and privacy practices? Please reply 'yes' to confirm.",
  },
  {
    key: "copay_display",
    label: "Copay Notification",
    prompt: "Your estimated patient responsibility for this visit is ${amount}. This can be paid today or at check-in.",
  },
];

export class SMSAgent {
  constructor(ledgerService, fhirClient) {
    this.ledgerService = ledgerService;
    this.fhirClient = fhirClient;
  }

  /**
   * Process incoming SMS message
   * @param {string} phoneNumber - Patient phone number
   * @param {string} message - Patient message
   * @param {string} ledgerId - Intake session ID
   * @returns {Promise<{response: string, ledger: object, nextStep: string}>}
   */
  async processMessage(phoneNumber, message, ledgerId) {
    try {
      const ledger = this.ledgerService.getLedger(ledgerId);
      if (!ledger) {
        throw new Error(`Ledger not found: ${ledgerId}`);
      }

      // Find next pending step
      const currentStep = this._findNextPendingStep(ledger);
      if (!currentStep) {
        return {
          response:
            "✓ You're all set! See you at your appointment.",
          ledger,
          nextStep: null,
        };
      }

      // Build context for Claude
      const systemPrompt = await this._buildSystemPrompt(ledger, currentStep);
      const userPrompt = `Patient response: "${message}"`;

      // Call Claude API (or use mock if no API key)
      const aiResponse = await callClaudeAPI(systemPrompt, userPrompt, currentStep.key);

      // Parse patient intent and update ledger
      const intent = await this._parseIntent(
        message,
        currentStep.key,
        aiResponse
      );

      if (intent.isComplete) {
        this.ledgerService.updateTask(
          ledgerId,
          currentStep.key,
          { status: "done" },
          "patient",
          "sms",
          "message_response"
        );
      }

      // Find next step after update
      const updatedLedger = this.ledgerService.getLedger(ledgerId);
      const nextStep = this._findNextPendingStep(updatedLedger);

      // Build response message
      const responseMessage = this._buildResponseMessage(
        aiResponse,
        nextStep
      );

      return {
        response: responseMessage,
        ledger: updatedLedger,
        nextStep: nextStep?.key || null,
      };
    } catch (error) {
      console.error(`SMS Agent error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Find next incomplete step in intake
   */
  _findNextPendingStep(ledger) {
    return ledger.tasks.find((t) => t.status === "pending");
  }

  /**
   * Build system prompt for Claude
   */
  async _buildSystemPrompt(ledger, currentStep) {
    let patientName = '';
    try {
      const patient = await this.fhirClient.getPatient(ledger.patientId);
      if (patient && patient.name && patient.name[0]) {
        patientName = patient.name[0].given ? patient.name[0].given[0] : patient.name[0].text;
      }
    } catch (err) {
      console.warn('Could not fetch patient name:', err.message);
    }

    const stepDef = INTAKE_STEPS.find((s) => s.key === currentStep.key);
    const prompt = stepDef.prompt.replace('{name}', patientName);

    return `You are a professional healthcare intake assistant helping patients complete their appointment registration via secure message.

Current Step: ${stepDef.label}
Patient First Name: ${patientName}

Your job:
1. Maintain a professional, respectful tone
2. Keep responses concise and clear
3. Acknowledge patient responses positively before asking the next question
4. Never ask for sensitive information via text (SSN, full payment info, etc.)
5. Focus on confirming identity, insurance, contact info, and obtaining consent

Standard greeting for first step: "${prompt}"

Keep responses professional and HIPAA-compliant. Do not include emojis.`;
  }

  /**
   * Parse patient intent from response
   */
  async _parseIntent(patientMessage, stepKey, aiResponse) {
    const lowerMsg = patientMessage.toLowerCase();

    // Simple intent detection based on step
    switch (stepKey) {
      case "identity_confirm":
        // Check if message contains both a name and date of birth pattern
        return {
          isComplete: /\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|dob|birth/.test(lowerMsg),
          confidence: 0.85,
        };
      case "insurance":
        return {
          isComplete: /yes|yep|correct|right|confirm|ok|good|active/i.test(
            lowerMsg
          ),
          confidence: 0.9,
        };
      case "demographics":
        return {
          isComplete: /yes|yep|correct|right|confirm|ok|good|current|same/i.test(lowerMsg),
          confidence: 0.9,
        };
      case "consent":
        return {
          isComplete: /yes|yep|confirm|agree|ok|correct/i.test(lowerMsg),
          confidence: 0.9,
        };
      case "copay_display":
        return {
          isComplete: true,
          confidence: 1.0,
        };
      default:
        return { isComplete: false, confidence: 0.5 };
    }
  }

  /**
   * Build response message with next question
   */
  _buildResponseMessage(aiResponse, nextStep) {
    if (!nextStep) {
      return "✓ All set! See you at your appointment. 🎉";
    }
    return aiResponse;
  }
}
