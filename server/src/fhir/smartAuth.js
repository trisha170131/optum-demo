import { randomUUID } from 'node:crypto';

/**
 * Mock SMART on FHIR authorization server. Simulates the pieces of Epic's real OAuth2/SMART
 * security model that a launch sequence needs — `/authorize` and `/token` — without any real
 * identity provider, since we don't have Epic App Orchard sandbox credentials in this demo.
 *
 * Production swap: delete this file. Point the app's launch URLs at Epic's real authorization
 * server (discovered via the FHIR server's `.well-known/smart-configuration`), and implement
 * real OAuth2 authorization-code-with-PKCE against Epic's actual login/consent UI.
 *
 * Narrow scopes only — this demo requests exactly what each launch mode needs, not `patient/*`.
 */
export const EHR_LAUNCH_SCOPES = [
  'launch',
  'patient/Patient.read',
  'patient/RelatedPerson.read',
  'patient/Coverage.read',
  'patient/Coverage.write',
  'patient/Appointment.read',
  'patient/Consent.write',
  'patient/PaymentNotice.write',
];

export const STANDALONE_LAUNCH_SCOPES = [
  'launch/patient',
  'patient/Patient.read',
  'patient/RelatedPerson.read',
  'patient/Coverage.read',
  'patient/Coverage.write',
  'patient/Consent.write',
  'patient/PaymentNotice.write',
];

// code -> launch context (single-use, short-lived — good enough for a demo)
const pendingCodes = new Map();
// access_token -> launch context
const sessions = new Map();

export function createAuthorizationCode(launchContext) {
  const code = `code_${randomUUID().slice(0, 12)}`;
  pendingCodes.set(code, launchContext);
  return code;
}

export function exchangeCodeForToken(code) {
  const context = pendingCodes.get(code);
  if (!context) return null;
  pendingCodes.delete(code);
  const accessToken = `tok_${randomUUID().slice(0, 16)}`;
  sessions.set(accessToken, context);
  return { accessToken, context };
}

export function getSession(accessToken) {
  return sessions.get(accessToken) ?? null;
}
