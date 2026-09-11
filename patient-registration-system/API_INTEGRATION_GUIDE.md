# Backend API Integration Guide

## Overview

This frontend is ready for backend integration. All mocked API calls are clearly marked and easy to replace with real Optum endpoints.

## Integration Points

### 1. EHR Patient Lookup
**Endpoint:** `POST /api/ehr/patient-lookup`

**Request:**
```json
{
  "name": "Elena Ruiz",
  "dob": "03/22/1979",
  "mrn": "MRN-70234"
}
```

**Response:**
```json
{
  "mrn": "MRN-70234",
  "demographics": {
    "address": "512 Willow Creek Dr",
    "phone": "555-0123"
  },
  "confidence": 0.99
}
```

### 2. Real-Time Eligibility (RTE)
**Endpoint:** `POST /v3/eligibility/check`

**Request:**
```json
{
  "payer": "Cigna HealthSpring",
  "member_id": "C-4471082"
}
```

**Response:**
```json
{
  "status": "Active · In-Network",
  "copay": "$35 specialist",
  "deductible": "$0 remaining"
}
```

### 3. Consent Check
**Endpoint:** `GET /api/consent/{mrn}`

**Response:**
```json
{
  "valid": true,
  "lastSignedDaysAgo": 180
}
```

### 4. MyChart Pre-Visit Status
**Endpoint:** `GET /api/mychart/{mrn}/pre-visit-status`

**Response:**
```json
{
  "completed": true,
  "fields_updated": ["medications", "allergies"],
  "consent_signed": true
}
```

### 5. SMS Outreach
**Endpoint:** `POST /api/outreach/sms`

**Request:**
```json
{
  "patient_phone": "555-0123",
  "message": "Hi, we need your current insurance...",
  "expected_response": "insurance"
}
```

## Implementation Strategy

**Phase 1: Replace Mock Calls**
1. Locate `runConnect()`, `runApi()`, `runSys()` functions in HTML files
2. Replace mock latency timers with real API calls
3. Update response handling to use actual data

**Phase 2: Add Error Handling**
1. Handle network timeouts
2. Implement retry logic
3. Add fallback UI for API failures

**Phase 3: Production Hardening**
1. Add authentication tokens
2. Implement HIPAA audit logging
3. Add data validation
4. Set up monitoring and alerts

## Before/After Example

### BEFORE (Mocked)
```javascript
async function runApi(phase){
  const entry = beginSysEntry(stepKey, { label: 'Running RTE' });
  await tickSysTimer(stepKey, entry, 2.6); // Fake delay
  
  updateSysEntry(stepKey, entry, { 
    detail: `${phase.resultLabel} — ${phase.resultDetail}` 
  });
}
```

### AFTER (Real API)
```javascript
async function runApi(phase){
  const entry = beginSysEntry(stepKey, { label: 'Running RTE' });
  const startTime = Date.now();
  
  const response = await fetch('/v3/eligibility/check', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      payer: phase.payer,
      member_id: extractMemberId(phase.payer)
    })
  });
  
  const data = await response.json();
  const elapsed = (Date.now() - startTime) / 1000;
  
  await tickSysTimer(stepKey, entry, elapsed);
  updateSysEntry(stepKey, entry, { 
    detail: `${data.status} — ${data.copay} · ${data.deductible}` 
  });
}
```

## API Requirements

### Authentication
- Bearer token or OAuth 2.0
- Tokens included in request headers
- Session management for staff

### Error Responses
```json
{
  "error": "invalid_member_id",
  "message": "Member ID not found in payer system"
}
```

### Rate Limiting
- Recommend: 100 req/min per user
- 429 responses for rate limit exceeded
- Exponential backoff for retries

### Security
- HTTPS only
- HIPAA audit logging
- Encrypt sensitive data in transit
- Validate all inputs

## Testing Recommendations

1. **Unit Tests** — Test each API wrapper function
2. **Integration Tests** — Test full workflow with mock APIs
3. **E2E Tests** — Test complete patient journey
4. **Load Tests** — Verify performance under concurrent users
5. **Security Tests** — Verify authentication and data protection

## Timeline

- **Week 1:** API integration for EHR and RTE
- **Week 2:** SMS/Voice outreach and consent management
- **Week 3:** Error handling, authentication, logging
- **Week 4:** Testing, deployment, documentation

---

**Status:** Ready for engineering  
**Priority:** RTE integration first (core functionality)  
**Estimated Effort:** 2-3 weeks
