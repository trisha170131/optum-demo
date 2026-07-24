import React, { html, useState, useEffect, createRoot } from '../react-setup.js';
import { get, post } from '../api.js';
import { PageHeader, Card, PrimaryButton, TextField } from '../components/ui.js';
import { tokens } from '../tokens.js';

const params = new URLSearchParams(location.search);
const patientId = params.get('patient');

/**
 * Stands in for the patient's actual phone. Real Twilio would deliver the SMS/call to a real
 * device; here the "device" is just this page, reading the same MockSmsAdapter/MockVoiceAdapter
 * state the server tracks. Tapping a link in a message navigates this browser tab there, same
 * as a real phone would.
 */
function App() {
  const [thread, setThread] = useState([]);
  const [reply, setReply] = useState('');

  async function refresh() {
    const r = await get(`/api/demo-phone/sms/${patientId}`);
    setThread(r.thread);
  }
  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
  }, []);

  async function sendReply() {
    if (!reply.trim()) return;
    await post(`/api/demo-phone/sms/${patientId}/reply`, { text: reply });
    setReply('');
    refresh();
  }

  function extractLink(text) {
    const match = text.match(/https?:\/\/\S+/);
    return match?.[0];
  }

  if (!patientId) return html`<div class="p-6">Missing ?patient= in URL.</div>`;

  return html`
    <div class="mx-auto max-w-md pb-16">
      <${PageHeader} title="Demo Phone" subtitle="Simulates the patient's phone receiving texts from the intake agent." />
      <main class="mt-4 space-y-3 px-4">
        <${Card}>
          <div class="space-y-2">
            ${thread.length === 0 && html`<p class="text-sm text-${tokens.textMuted}">No messages yet — trigger an SMS from the chat/web-form copay step.</p>`}
            ${thread.map((m, i) => html`
              <div key=${i} class="flex ${m.direction === 'out' ? 'justify-start' : 'justify-end'}">
                <div class="max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.direction === 'out' ? `bg-slate-100 text-${tokens.text}` : `bg-${tokens.accent} text-white`}">
                  ${m.text}
                  ${m.direction === 'out' && extractLink(m.text) && html`
                    <div><a class="mt-1 inline-block underline" href=${extractLink(m.text)}>Open link →</a></div>
                  `}
                </div>
              </div>
            `)}
          </div>
          <div class="mt-3 flex items-end gap-2 border-t border-${tokens.border} pt-3">
            <div class="flex-1"><${TextField} id="reply" label="Reply as patient" value=${reply} onChange=${setReply} /></div>
            <${PrimaryButton} onClick=${sendReply}>Send</${PrimaryButton}>
          </div>
        </${Card}>
      </main>
    </div>
  `;
}

createRoot(document.getElementById('root')).render(React.createElement(App));
