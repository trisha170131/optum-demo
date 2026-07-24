import { readJsonBody, sendJson, sendRedirect } from '../httpRouter.js';
import {
  createAuthorizationCode, exchangeCodeForToken, getSession,
  EHR_LAUNCH_SCOPES, STANDALONE_LAUNCH_SCOPES,
} from '../fhir/smartAuth.js';

/**
 * SMART on FHIR launch sequence: /launch (EHR) or /launch/standalone (patient-facing) ->
 * authorization redirect -> token exchange -> the UI then makes FHIR-scoped API calls.
 *
 * In this demo, `/launch` stands in for Epic redirecting into the app with `iss`+`launch`
 * params, and `/mock-auth/*` stands in for Epic's real authorization server. Production swap:
 * delete `/mock-auth/*`, and change `/launch` to redirect to Epic's real `/authorize` endpoint
 * (discovered from the FHIR server's `.well-known/smart-configuration`) with a real
 * `client_id`/PKCE challenge instead of `createAuthorizationCode` below.
 */
export function registerSmartRoutes(router) {
  // EHR launch: Epic would open this inside a sidebar iframe with `iss` + `launch` params.
  // We accept patientId/appointmentId directly here since we have no real Epic context to decode.
  router.get('/launch', async (req, res, { query }) => {
    const params = new URLSearchParams({
      patientId: query.patientId ?? 'pat-001',
      appointmentId: query.appointmentId ?? 'appt-001',
      launchType: 'ehr',
    });
    sendRedirect(res, `/mock-auth/authorize?${params}`);
  });

  // Standalone launch: what a patient opens from an SMS/portal link.
  router.get('/launch/standalone', async (req, res, { query }) => {
    const params = new URLSearchParams({
      patientId: query.patientId ?? 'pat-001',
      appointmentId: query.appointmentId ?? 'appt-001',
      launchType: 'standalone',
    });
    sendRedirect(res, `/mock-auth/authorize?${params}`);
  });

  // EHR launch with EMR sidebar: opens the EMR page with staff dashboard as a sidebar
  // This simulates launching the intake agent as an embedded app in a real EHR (Epic, Cerner, etc.)
  router.get('/launch/ehr-with-sidebar', async (req, res, { query }) => {
    const params = new URLSearchParams({
      patientId: query.patientId ?? 'pat-001',
      appointmentId: query.appointmentId ?? 'appt-001',
      launchType: 'ehr',
    });
    sendRedirect(res, `/mock-auth/authorize?${params}&nextPage=ehr.html`);
  });

  // Mock authorization endpoint — auto-"approves" instead of showing a real Epic login/consent
  // screen, since we have no real IdP here. Issues a single-use code, per standard OAuth2.
  router.get('/mock-auth/authorize', async (req, res, { query }) => {
    const { patientId, appointmentId, launchType, nextPage } = query;
    const scopes = launchType === 'ehr' ? EHR_LAUNCH_SCOPES : STANDALONE_LAUNCH_SCOPES;
    const code = createAuthorizationCode({ patientId, appointmentId, launchType, scopes });
    const callbackPage = nextPage ? `callback-to.html?page=${nextPage}` : 'callback.html';
    sendRedirect(res, `/${callbackPage}?code=${code}`);
  });

  // Token exchange, called by callback.html client-side JS (mirrors a real SMART app's flow).
  router.post('/api/smart/token', async (req, res) => {
    const { code } = await readJsonBody(req);
    const exchanged = exchangeCodeForToken(code);
    if (!exchanged) return sendJson(res, 400, { error: 'invalid_grant' });
    sendJson(res, 200, exchanged);
  });

  router.get('/api/smart/session', async (req, res, { query }) => {
    const session = getSession(query.token);
    if (!session) return sendJson(res, 404, { error: 'no_session' });
    sendJson(res, 200, session);
  });
}
