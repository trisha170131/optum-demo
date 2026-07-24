import { ChannelAdapter } from './ChannelAdapter.js';

/**
 * Stubbed IVR flow for voice copay collection, modeled as a simple scripted state machine per
 * the brief ("can be a simple scripted state machine for the demo"). No real telephony here.
 *
 * Production swap: attach a real voice AI / IVR platform (e.g. a Twilio Voice + speech-to-text
 * pipeline, or a conversational voice AI vendor) that maps caller input onto these same states
 * and ultimately calls the same TaskLedgerService.updateTask for the copay task.
 */
const STATES = {
  greeting: { prompt: (amt) => `Hello. Your estimated copay for this visit is $${(amt / 100).toFixed(2)}. Press 1 to pay now, or 2 to skip.`, next: { '1': 'collect_card', '2': 'skipped' } },
  collect_card: { prompt: () => 'Please enter your 4-digit test card number followed by the pound key.', next: { default: 'confirm_payment' } },
  confirm_payment: { prompt: (amt) => `Thank you. We've charged $${(amt / 100).toFixed(2)} to your card on file. Press 1 to confirm.`, next: { '1': 'done' } },
  done: { prompt: () => 'Your copay is confirmed. Goodbye.', next: {} },
  skipped: { prompt: () => 'No problem — you can pay your copay later from any channel. Goodbye.', next: {} },
};

export class MockVoiceAdapter extends ChannelAdapter {
  constructor() {
    super();
    /** @type {Map<string, {state: string, amountCents: number}>} */
    this.calls = new Map();
  }

  get name() { return 'voice'; }

  async notify(patientId, text) {
    console.log(`[voice -> ${patientId}] ${text}`);
    return true;
  }

  startCall(patientId, amountCents) {
    this.calls.set(patientId, { state: 'greeting', amountCents });
    return { state: 'greeting', prompt: STATES.greeting.prompt(amountCents) };
  }

  advanceCall(patientId, input) {
    const call = this.calls.get(patientId);
    if (!call) throw new Error('no active call for patient');
    const stateDef = STATES[call.state];
    const nextState = stateDef.next[input] ?? stateDef.next.default;
    if (!nextState) return { state: call.state, prompt: 'Sorry, I didn\'t understand that.' };
    call.state = nextState;
    this.calls.set(patientId, call);
    return { state: nextState, prompt: STATES[nextState].prompt(call.amountCents) };
  }
}

export const mockVoiceAdapter = new MockVoiceAdapter();
