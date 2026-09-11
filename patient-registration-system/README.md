# Optum Patient Registration System

A modern, AI-assisted patient registration and check-in system for healthcare facilities with Real-Time Eligibility verification.

## Features

- **Registration Queue Dashboard** — Real-time view of patients awaiting registration
- **Ambulatory Check-In** — 5-stage resolution waterfall (Auto → Outreach → Kiosk → Front Desk)
- **Acute Registration** — ED/walk-in with ambient listening
- **Real-Time Eligibility (RTE)** — Live insurance verification with copay calculation
- **Multi-Channel Outreach** — SMS, Voice, Kiosk, Staff assistance

## Quick Start

```bash
# Start a local server
npx http-server public -p 8000

# Open in browser
open http://localhost:8000/public/index.html
```

## Project Structure

```
patient-registration-system/
├── public/                       # Client-facing HTML pages
│   ├── index.html               # Landing page
│   ├── queue-dashboard.html     # Patient queue
│   ├── ambulatory-registration.html  # Ambulatory workflow
│   └── acute-registration.html  # Acute workflow
├── src/
│   ├── css/                    # Design system
│   ├── js/                     # JavaScript modules
│   └── data/                   # Patient data
├── demo.html                   # Single-file demo
└── README.md                   # This file
```

## Three Key Scenarios

**1. Elena Ruiz** — Perfect Auto-Resolution
- RTE returns: Active · $35 copay
- All fields resolve automatically
- Zero outreach, zero staff time

**2. Marcus Webb** — RTE Exception + SMS
- RTE returns: Inactive (plan ended 01/2026)
- System routes to SMS outreach
- Patient responds with updated insurance

**3. Diane Foster** — Full Cascade
- Auto-resolution flags items
- SMS, kiosk, front desk escalation
- Multi-stage fallback

## Real-Time Eligibility (RTE) Integration

The system demonstrates RTE integration by:

1. Capturing patient identity from EHR or ambient listening
2. Looking up insurance eligibility in real-time
3. Calculating copay based on insurance plan
4. Handling exceptions (inactive, no coverage, etc.)
5. Routing to appropriate resolution channel

## Backend Integration Points

Ready for engineers to integrate:
- `/api/ehr/patient-lookup` — EHR patient identity
- `/v3/eligibility/check` — Real-Time Eligibility
- `/api/mychart/{mrn}/pre-visit-status` — Pre-visit checks
- `/api/outreach/sms` — SMS outreach
- `/api/consent/{mrn}` — Consent management

See `API_INTEGRATION_GUIDE.md` for full integration details.

## Status

- ✅ Frontend complete and functional
- ✅ All UI/UX working with mocked APIs
- ✅ Three complete patient scenarios
- ⏳ Ready for backend engineering integration

## Technology Stack

- HTML5, CSS3, ES6 JavaScript
- No frameworks or build step
- Native ES6 modules
- Design system with CSS variables

## Next Steps

1. **Backend Integration** — Replace mock APIs with real endpoints
2. **Staff Authentication** — Add IAM/SSO
3. **HIPAA Compliance** — Audit logging, data encryption
4. **Production Deployment** — CI/CD, staging, production

---

**Status:** Frontend complete and ready for backend integration  
**Version:** 1.0.0  
**Last Updated:** September 2026
