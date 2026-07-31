// Use Claude API via REST (no npm dependency needed)
async function callClaudeAPI(systemPrompt, userMessage) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY not set. Please set it in environment variables."
    );
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

const INTAKE_STEPS = [
  {
    key: "appointment_confirm",
    label: "Confirm Appointment",
    prompt:
      "You have an appointment with Dr. {provider} on {date} at {time}. Can you confirm you'll be there?",
  },
  {
    key: "demographics",
    label: "Confirm Demographics",
    prompt:
      "Let me confirm your info: Name: {name}, DOB: {dob}, Address: {address}. Still correct?",
  },
  {
    key: "insurance",
    label: "Confirm Insurance",
    prompt:
      "Is {insurer} {plan} still your active insurance? (Yes/No/Changed)",
  },
  {
    key: "insurance_card",
    label: "Insurance Card Photo",
    prompt:
      "Can you text me a photo of your insurance card (front and back)?",
  },
  {
    key: "consent",
    label: "Consent & HIPAA",
    prompt:
      "Please confirm you've reviewed the consent forms. Reply 'I agree' to continue.",
  },
  {
    key: "copay",
    label: "Copay Payment",
    prompt:
      "Your estimated copay is ${amount}. Will you pay now or at check-in?",
  },
];

export class SMSAgent {
  constructor(ledgerService) {
    this.ledgerService = ledgerService;
  }

  /**
   * Process incoming SMS message
   * @param {string} phoneNumber - Patient phone number
   * @param {string} message - Patient message
   * @param {string} ledgerId - Intake session ID
   * @returns {Promise<{response: string, ledger: object, nextStep: string}>}
   */
  async processMessage(phoneNumber, message, ledgerId) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error(
        "ANTHROPIC_API_KEY not set. Please set it in environment variables."
      );
    }

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
      const systemPrompt = this._buildSystemPrompt(ledger, currentStep);
      const userPrompt = `Patient response: "${message}"`;

      // Call Claude API
      const aiResponse = await callClaudeAPI(systemPrompt, userPrompt);

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
  _buildSystemPrompt(ledger, currentStep) {
    const patient = ledger.patientId;
    const stepDef = INTAKE_STEPS.find((s) => s.key === currentStep.key);

    return `You are a friendly healthcare intake assistant helping patients complete their pre-appointment registration via SMS.

Current Step: ${stepDef.label}
Patient: ${patient}

Your job:
1. Ask the question naturally and conversationally
2. Be brief (SMS-friendly, under 160 chars when possible)
3. If the patient answered the previous question, acknowledge it positively
4. Ask the next question or move to the next step
5. Be empathetic and patient-friendly

Keep responses concise and friendly. Use emojis sparingly (only when appropriate).`;
  }

  /**
   * Parse patient intent from response
   */
  async _parseIntent(patientMessage, stepKey, aiResponse) {
    const lowerMsg = patientMessage.toLowerCase();

    // Simple intent detection based on step
    switch (stepKey) {
      case "appointment_confirm":
        return {
          isComplete: /yes|yep|correct|right|confirm|ok|good/i.test(
            lowerMsg
          ),
          confidence: 0.9,
        };
      case "demographics":
        return {
          isComplete: /yes|yep|correct|right|good|ok|all good/i.test(lowerMsg),
          confidence: 0.9,
        };
      case "insurance":
        return {
          isComplete:
            /yes|yep|still active|same/i.test(lowerMsg) ||
            /changed|new|different/i.test(lowerMsg),
          confidence: 0.85,
        };
      case "consent":
        return {
          isComplete: /agree|i agree|yes|confirm/i.test(lowerMsg),
          confidence: 0.9,
        };
      case "copay":
        return {
          isComplete: /now|pay now|at check.?in|later/i.test(lowerMsg),
          confidence: 0.85,
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
