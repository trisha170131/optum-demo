import { ChannelAdapter } from './ChannelAdapter.js';

/** Linear, no-chat fallback. Reads/writes the identical TaskLedger as every other channel —
 * the only difference is the UI is a stepper instead of a conversation. */
export class WebFormAdapter extends ChannelAdapter {
  get name() { return 'web_form'; }
  async notify(patientId, text) {
    console.log(`[web_form -> ${patientId}] ${text}`);
    return true;
  }
}

export const webFormAdapter = new WebFormAdapter();
