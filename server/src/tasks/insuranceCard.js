import { runMockOcr } from './mockOcr.js';

export async function buildInsuranceOnFile(fhirClient, patientId) {
  const coverage = await fhirClient.getCoverage(patientId);
  if (!coverage) return null;
  return {
    payerName: coverage.payor?.[0]?.display ?? '',
    memberId: coverage.subscriberId ?? '',
    groupNumber: coverage.class?.[0]?.value ?? '',
    planType: coverage.extension?.find((e) => e.url === 'plan-type')?.valueString ?? '',
  };
}

/**
 * Runs the (stubbed) OCR extraction and compares it against the payer on file. Returns the
 * extracted fields plus whether this looks like a payer change — the signal that routes to the
 * coverage-update step and, from there, the Agent Interop prior-auth check.
 */
export async function extractInsuranceCard(fhirClient, patientId) {
  const extracted = runMockOcr(patientId);
  const onFile = await buildInsuranceOnFile(fhirClient, patientId);
  const payerChanged = !onFile || onFile.payerName !== extracted.payerName;
  return { extracted, onFile, payerChanged };
}
