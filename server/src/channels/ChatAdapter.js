import { ChannelAdapter } from './ChannelAdapter.js';

/** Primary demo surface. The chat UI polls/streams the ledger directly via SSE, so "notify"
 * here is just a log line — production would push via a WebSocket event to an open chat session. */
export class ChatAdapter extends ChannelAdapter {
  get name() { return 'chat'; }
  async notify(patientId, text) {
    console.log(`[chat -> ${patientId}] ${text}`);
    return true;
  }
}

export const chatAdapter = new ChatAdapter();
