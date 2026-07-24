/**
 * Consent & HIPAA task. Demo e-signature is a typed name + timestamp; production would plug in
 * a real e-signature/consent-management vendor (e.g. DocuSign, or a healthcare-specific consent
 * platform) right where `fhirClient.createConsent` is called below.
 */
export async function getConsentDocuments(fhirClient) {
  return fhirClient.getConsentDocuments();
}

export async function signConsentDocument(fhirClient, patientId, docKey, docVersion, typedName) {
  return fhirClient.createConsent(patientId, {
    // Stored signed-artifact reference: which document + version was signed, by whom, and when.
    identifier: [{ value: `${docKey}@${docVersion}` }],
    sourceAttachment: { title: `${docKey} v${docVersion}`, data: undefined },
    performer: [{ display: typedName }],
    provision: { type: 'permit' },
  });
}
