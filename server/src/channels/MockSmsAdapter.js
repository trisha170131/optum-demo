import { ChannelAdapter } from './ChannelAdapter.js';

/**
 * Mock SMS channel — no real Twilio account in this environment, so this simulates the whole
 * conversation in-process. The "Demo Phone" panel in the web UI reads `getThread` and posts
 * replies through `receiveReply`, which is exactly what a real inbound-SMS webhook handler
 * would do.
 *
 * Production swap: replace the body of `sendMessage`/`receiveReply` with a real Twilio
 * (BAA-covered number, since this carries PHI-adjacent info) send + webhook handler. Anything
 * more complex than yes/no or a payment link should still just link back to the chat/web
 * session, per the brief.
 */
export class MockSmsAdapter extends ChannelAdapter {
  constructor() {
    super();
    /** @type {Map<string, {direction: 'out'|'in', text: string, timestamp: string}[]>} */
    this.threads = new Map();
  }

  get name() { return 'sms'; }

  getThread(patientId) {
    return this.threads.get(patientId) ?? [];
  }

  _append(patientId, direction, text) {
    const thread = this.threads.get(patientId) ?? [];
    thread.push({ direction, text, timestamp: new Date().toISOString() });
    this.threads.set(patientId, thread);
    return thread;
  }

  async notify(patientId, text) {
    this._append(patientId, 'out', text);
    return true;
  }

  /** Simulates the patient typing a reply / tapping a link on their phone. */
  receiveReply(patientId, text) {
    return this._append(patientId, 'in', text);
  }
}

export const mockSmsAdapter = new MockSmsAdapter();
