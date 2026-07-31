import React, { html, useState, useEffect, createRoot } from '../react-setup.js';
import { get, post } from '../api.js';
import { tokens } from '../tokens.js';
import { useSSE } from '../lib/useSSE.js';

function PatientIntakeApp() {
  const [ledger, setLedger] = useState(null);
  const [selectedChannel, setSelectedChannel] = useState('text'); // 'text' | 'voice' | 'kiosk'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Get ledger on mount
  useEffect(() => {
    (async () => {
      try {
        const params = new URLSearchParams(location.search);
        let ledgerId = params.get('ledgerId');

        // Check sessionStorage for cached ledger
        if (!ledgerId) {
          const cached = sessionStorage.getItem('patient_ledger');
          if (cached) {
            const ledgerData = JSON.parse(cached);
            setLedger(ledgerData);
            setLoading(false);
            return;
          }
        }

        if (!ledgerId) {
          setError('No active intake session. Please start from the landing page.');
          setLoading(false);
          return;
        }

        // Fetch ledger from server
        const resp = await fetch(`/api/ledgers/${ledgerId}`);
        if (!resp.ok) throw new Error('Ledger not found');
        const data = await resp.json();
        setLedger(data);
        sessionStorage.setItem('patient_ledger', JSON.stringify(data));
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    })();
  }, []);

  // Listen for real-time ledger updates
  useSSE((event) => {
    if (event.type === 'ledger.updated' && ledger && event.data.id === ledger.id) {
      setLedger(event.data);
      sessionStorage.setItem('patient_ledger', JSON.stringify(event.data));
    }
  });

  if (loading) {
    return html`
      <div class="flex items-center justify-center min-h-screen">
        <div class="text-center">
          <div class="inline-block mb-4 text-4xl text-${tokens.accent} animate-pulse">◆</div>
          <p class="text-[#6B7280]">Loading your intake...</p>
        </div>
      </div>
    `;
  }

  if (error) {
    return html`
      <div class="flex items-center justify-center min-h-screen">
        <div class="text-center max-w-md">
          <div class="text-4xl mb-4">⚠️</div>
          <h1 class="text-lg font-bold text-[#374151] mb-2">Session Error</h1>
          <p class="text-[#6B7280] mb-4">${error}</p>
          <a href="/landing.html" class="text-${tokens.accent} underline font-medium">Return to home</a>
        </div>
      </div>
    `;
  }

  const progressPct = ledger ? Math.round((ledger.tasks.filter(t => t.status === 'done').length / ledger.tasks.length) * 100) : 0;
  const currentTask = ledger?.tasks.find(t => t.status === 'pending');
  const completedCount = ledger?.tasks.filter(t => t.status === 'done').length || 0;

  return html`
    <div class="flex flex-col h-screen bg-[#F9F8F6]">
      <!-- Header -->
      <div class="bg-white border-b border-[#E5E7EB] px-4 py-4 sm:px-6">
        <div class="flex items-center justify-between mb-4">
          <h1 class="text-lg font-bold text-[#374151]">Check-In Progress</h1>
          <a href="/landing.html" class="text-xs text-[#6B7280] hover:text-[#374151]">← Back</a>
        </div>
        <div class="flex items-center justify-between text-sm">
          <span class="font-medium text-[#374151]">${completedCount} of ${ledger?.tasks.length} steps complete</span>
          <span class="text-[#6B7280]">${progressPct}%</span>
        </div>
        <div class="mt-2 h-2 w-full bg-[#E5E7EB] rounded-full overflow-hidden">
          <div class="h-full bg-${tokens.accent} transition-all" style=${{ width: \`\${progressPct}%\` }}></div>
        </div>
      </div>

      <!-- Channel Selector -->
      <div class="bg-white border-b border-[#E5E7EB] px-4 py-3 sm:px-6">
        <div class="flex gap-2">
          <button onClick=${() => setSelectedChannel('text')}
            class="px-4 py-2 text-sm font-medium rounded-lg transition $${selectedChannel === 'text' ? `bg-${tokens.accent} text-white` : 'bg-[#F3F4F6] text-[#374151] hover:bg-[#E5E7EB]'}">
            💬 Text
          </button>
          <button onClick=${() => setSelectedChannel('voice')}
            class="px-4 py-2 text-sm font-medium rounded-lg transition $${selectedChannel === 'voice' ? `bg-${tokens.accent} text-white` : 'bg-[#F3F4F6] text-[#374151] hover:bg-[#E5E7EB]'}">
            🎤 Voice
          </button>
          <button onClick=${() => setSelectedChannel('kiosk')}
            class="px-4 py-2 text-sm font-medium rounded-lg transition $${selectedChannel === 'kiosk' ? `bg-${tokens.accent} text-white` : 'bg-[#F3F4F6] text-[#374151] hover:bg-[#E5E7EB]'}">
            📱 Kiosk
          </button>
        </div>
      </div>

      <!-- Channel Content -->
      <div class="flex-1 overflow-auto p-4 sm:p-6">
        ${selectedChannel === 'text' && html`
          <${AITextChat} ledger=${ledger} currentTask=${currentTask} />
        `}
        ${selectedChannel === 'voice' && html`
          <${AIVoiceCall} ledger=${ledger} currentTask=${currentTask} />
        `}
        ${selectedChannel === 'kiosk' && html`
          <${KioskChat} ledger=${ledger} currentTask=${currentTask} />
        `}
      </div>
    </div>
  `;
}

// AI Text Chat Component
function AITextChat({ ledger, currentTask }) {
  const [messages, setMessages] = useState([
    { role: 'ai', text: 'Hi! 👋 Let\'s get you checked in. We\'ll go through a few quick steps. Ready to start?' }
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || !currentTask) return;

    setSending(true);
    const userMessage = { role: 'patient', text: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');

    try {
      // Call API to process the message for current task
      const resp = await post(`/api/ledgers/${ledger.id}/chat`, {
        taskKey: currentTask.key,
        message: input,
      });

      if (resp.aiResponse) {
        setMessages((prev) => [...prev, { role: 'ai', text: resp.aiResponse }]);
      }
    } catch (err) {
      console.error('Chat error:', err);
    } finally {
      setSending(false);
    }
  };

  return html`
    <div class="flex flex-col h-full max-w-2xl mx-auto bg-white rounded-lg border border-[#E5E7EB] overflow-hidden">
      <!-- Messages -->
      <div class="flex-1 overflow-auto p-4 space-y-3">
        ${messages.map((msg, i) => html`
          <div key=${i} class="flex ${msg.role === 'patient' ? 'justify-end' : 'justify-start'}">
            <div class="max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${msg.role === 'patient'
              ? `bg-${tokens.accent} text-white`
              : 'bg-[#F3F4F6] text-[#374151]'}">
              ${msg.text}
            </div>
          </div>
        `)}
        ${sending && html`
          <div class="flex justify-start">
            <div class="bg-[#F3F4F6] px-4 py-2 rounded-lg text-[#6B7280] text-sm">
              AI is typing...
            </div>
          </div>
        `}
      </div>

      <!-- Input -->
      <div class="border-t border-[#E5E7EB] p-4 flex gap-2">
        <input type="text" value=${input} onChange=${(e) => setInput(e.target.value)} onKeyPress=${(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type your response..."
          class="flex-1 px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-${tokens.accent}" />
        <button onClick=${handleSend} disabled=${!input.trim() || sending}
          class="px-4 py-2 bg-${tokens.accent} text-white rounded-lg text-sm font-medium hover:bg-${tokens.accentHover} disabled:opacity-50">
          Send
        </button>
      </div>
    </div>
  `;
}

// AI Voice Call Component
function AIVoiceCall({ ledger, currentTask }) {
  const [callActive, setCallActive] = useState(false);
  const [transcript, setTranscript] = useState([
    { speaker: 'AI', text: 'Hi, this is your healthcare check-in assistant.' }
  ]);

  const handleStartCall = () => {
    setCallActive(true);
    // Simulate AI speaking
    setTimeout(() => {
      setTranscript((prev) => [...prev,
        { speaker: 'AI', text: 'Let\'s confirm your contact information. What\'s your current phone number?' }
      ]);
    }, 1000);
  };

  return html`
    <div class="flex flex-col h-full max-w-2xl mx-auto">
      <div class="bg-white rounded-lg border border-[#E5E7EB] p-8 text-center mb-6">
        <div class="mb-6">
          ${callActive ? html`
            <div class="inline-block">
              <div class="w-20 h-20 mx-auto mb-4 relative">
                <svg class="w-full h-full animate-pulse" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="50" cy="50" r="30" fill="none" stroke="#FF612B" stroke-width="2" opacity="0.8" />
                  <circle cx="50" cy="50" r="20" fill="none" stroke="#FF612B" stroke-width="2" opacity="0.6" />
                  <circle cx="50" cy="50" r="10" fill="#FF612B" />
                </svg>
              </div>
              <p class="text-sm text-[#6B7280] mb-4">Call in progress</p>
              <button onClick=${() => setCallActive(false)}
                class="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
                End Call
              </button>
            </div>
          ` : html`
            <svg class="w-16 h-16 mx-auto mb-4 text-[#FF612B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            <p class="text-sm text-[#6B7280] mb-4">Ready to start voice check-in?</p>
            <button onClick=${handleStartCall}
              class="px-6 py-3 bg-${tokens.accent} text-white rounded-lg font-medium hover:bg-${tokens.accentHover}">
              Start Voice Call
            </button>
          `}
        </div>
      </div>

      <!-- Transcript -->
      <div class="bg-white rounded-lg border border-[#E5E7EB] p-4 flex-1 overflow-auto">
        <p class="text-xs font-semibold text-[#6B7280] uppercase mb-3">Live Transcript</p>
        <div class="space-y-2">
          ${transcript.map((line, i) => html`
            <div key=${i} class="text-sm">
              <span class="font-medium text-[#374151]">${line.speaker}:</span>
              <span class="text-[#6B7280] ml-2">${line.text}</span>
            </div>
          `)}
        </div>
      </div>
    </div>
  `;
}

// iPad Kiosk Chat Component
function KioskChat({ ledger, currentTask }) {
  const [messages, setMessages] = useState([
    { role: 'ai', text: 'Welcome to our digital check-in! 📋 Let\'s get you set up for your appointment.' }
  ]);
  const [selectedOption, setSelectedOption] = useState(null);

  const handleOption = (option) => {
    setSelectedOption(option);
    setMessages((prev) => [
      ...prev,
      { role: 'patient', text: option },
      { role: 'ai', text: '✓ Thank you! Moving to the next step...' }
    ]);
  };

  return html`
    <div class="flex flex-col h-full max-w-2xl mx-auto bg-white rounded-lg border border-[#E5E7EB] overflow-hidden">
      <!-- Messages (iPad-optimized, larger text) -->
      <div class="flex-1 overflow-auto p-6 space-y-4">
        ${messages.map((msg, i) => html`
          <div key=${i} class="flex ${msg.role === 'patient' ? 'justify-end' : 'justify-start'}">
            <div class="max-w-sm px-6 py-3 rounded-xl text-base ${msg.role === 'patient'
              ? `bg-${tokens.accent} text-white`
              : 'bg-[#F3F4F6] text-[#374151]'}">
              ${msg.text}
            </div>
          </div>
        `)}
      </div>

      <!-- Option Buttons (iPad-friendly large buttons) -->
      <div class="border-t border-[#E5E7EB] p-6 space-y-3">
        <button onClick=${() => handleOption('Yes, all correct')}
          class="w-full px-6 py-4 bg-${tokens.accent} text-white rounded-lg text-base font-semibold hover:bg-${tokens.accentHover} transition">
          ✓ Yes, All Correct
        </button>
        <button onClick=${() => handleOption('Need to make changes')}
          class="w-full px-6 py-4 bg-[#F3F4F6] text-[#374151] rounded-lg text-base font-semibold hover:bg-[#E5E7EB] transition">
          ✎ Need to Make Changes
        </button>
        <button onClick=${() => handleOption('Skip for now')}
          class="w-full px-6 py-4 border-2 border-[#E5E7EB] text-[#374151] rounded-lg text-base font-semibold hover:border-${tokens.accent} transition">
          Skip for Now
        </button>
      </div>
    </div>
  `;
}

createRoot(document.getElementById('root')).render(React.createElement(PatientIntakeApp));
