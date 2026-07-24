/**
 * Stub for insurance card OCR extraction. A real production build would call a document-AI /
 * OCR vendor on the uploaded card photos; here we deterministically fabricate structured fields
 * per mock patient so the demo can showcase both the "no change" and "payer changed" paths.
 */
const OCR_RESULTS = {
  'pat-001': { payerName: 'Meridian Health Plan', memberId: 'MHP-88213045', groupNumber: 'GRP-4471', planType: 'PPO' },
  // James Chen's card photo shows a different payer than what's on file (Summit Care) — this is
  // the scenario that should route to the coverage-update / prior-auth flow.
  'pat-002': { payerName: 'Pinnacle Health Partners', memberId: 'PHP-30987712', groupNumber: 'GRP-2290', planType: 'PPO' },
  'pat-003': { payerName: 'Heritage Medicare Advantage', memberId: 'HMA-11004477', groupNumber: 'GRP-0099', planType: 'Medicare Advantage' },
};

export function runMockOcr(patientId) {
  return OCR_RESULTS[patientId] ?? { payerName: 'Unknown Payer', memberId: '', groupNumber: '', planType: '' };
}
