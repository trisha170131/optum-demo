/**
 * FhirClient interface. Every intake task module talks to FHIR-shaped data only through this
 * interface — never through raw fixture files directly. `MockFhirClient` (same directory) is
 * the demo implementation, reading static JSON fixtures shaped like real FHIR resources.
 *
 * Production swap: implement this same interface against Epic's actual FHIR R4 API
 * (base URL from the App Orchard registration, OAuth2 bearer token from the real SMART launch —
 * see `smartAuth.js` for where that plugs in) and nothing outside this file needs to change.
 */
export class FhirClient {
  async getPatient(_id) { throw new Error('not implemented'); }
  async getRelatedPersons(_patientId) { throw new Error('not implemented'); }
  async getCoverage(_patientId) { throw new Error('not implemented'); }
  async getAppointment(_id) { throw new Error('not implemented'); }
  async getConsentDocuments() { throw new Error('not implemented'); }
  async createConsent(_patientId, _consent) { throw new Error('not implemented'); }
  async updateCoverage(_patientId, _patch) { throw new Error('not implemented'); }
  async createPaymentNotice(_patientId, _notice) { throw new Error('not implemented'); }
}

export class ScopeError extends Error {
  constructor(scope) {
    super(`missing required SMART scope: ${scope}`);
    this.scope = scope;
  }
}
