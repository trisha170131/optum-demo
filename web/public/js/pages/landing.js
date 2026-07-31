import React, { html, useState, createRoot } from '../react-setup.js';
import { tokens } from '../tokens.js';

function LandingPage() {
  const handlePatientClick = () => {
    // Patient intake: can pass ledgerId via URL if returning, or start fresh
    const ledgerId = new URLSearchParams(location.search).get('ledgerId');
    location.href = ledgerId ? `/patient-intake.html?ledgerId=${ledgerId}` : '/patient-intake.html';
  };

  const handleStaffClick = () => {
    // Staff view requires SMART launch or manual login
    location.href = '/staff-intake.html';
  };

  return html`
    <div class="w-full max-w-md mx-auto px-4">
      <div class="text-center mb-12">
        <div class="inline-block mb-6 text-5xl font-bold text-${tokens.accent}">
          ◆
        </div>
        <h1 class="text-3xl font-bold text-[#374151] mb-2">Digital Patient Intake</h1>
        <p class="text-[#6B7280]">Complete your check-in quickly and securely</p>
      </div>

      <div class="space-y-4">
        <!-- Patient Entry -->
        <button onClick=${handlePatientClick}
          class="w-full p-6 bg-white border-2 border-${tokens.accent} rounded-lg hover:bg-[#FFF0E8] transition text-left group">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-lg font-bold text-[#374151] group-hover:text-${tokens.accent}">
                Patient Check-In
              </h2>
              <p class="text-sm text-[#6B7280] mt-1">
                Complete your intake via text, voice, or kiosk
              </p>
            </div>
            <div class="text-2xl group-hover:translate-x-1 transition">→</div>
          </div>
        </button>

        <!-- Staff Entry -->
        <button onClick=${handleStaffClick}
          class="w-full p-6 bg-white border-2 border-[#3B82F6] rounded-lg hover:bg-[#EEF2FF] transition text-left group">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-lg font-bold text-[#374151] group-hover:text-[#3B82F6]">
                Staff Registration
              </h2>
              <p class="text-sm text-[#6B7280] mt-1">
                Manage patient intakes and complete check-ins
              </p>
            </div>
            <div class="text-2xl group-hover:translate-x-1 transition">→</div>
          </div>
        </button>
      </div>

      <div class="mt-12 text-center text-xs text-[#9CA3AF]">
        <p>Need help? Contact registration at ext. 5000</p>
      </div>
    </div>
  `;
}

createRoot(document.getElementById('root')).render(React.createElement(LandingPage));
