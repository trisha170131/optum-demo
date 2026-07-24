import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { FhirClient, ScopeError } from './FhirClient.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, '..', 'fixtures');

function loadFixture(name) {
  return JSON.parse(readFileSync(join(fixturesDir, name), 'utf-8'));
}

/**
 * Demo FhirClient backed by static fixture files instead of a live FHIR server. Enforces the
 * narrow SMART scopes it was granted (see smartAuth.js) so the scope-narrowing requirement in
 * the brief is a real, checked constraint here — not just a comment — even though it's a mock.
 */
export class MockFhirClient extends FhirClient {
  /** @param {string[]} scopes granted scopes from the SMART launch session */
  constructor(scopes = []) {
    super();
    this.scopes = new Set(scopes);
    this.patients = loadFixture('patients.json');
    this.relatedPersons = loadFixture('relatedPersons.json');
    this.coverages = loadFixture('coverages.json');
    this.appointments = loadFixture('appointments.json');
    this.consentDocuments = loadFixture('consentDocuments.json');
  }

  _requireScope(scope) {
    if (!this.scopes.has(scope) && !this.scopes.has('*')) throw new ScopeError(scope);
  }

  async getPatient(id) {
    this._requireScope('patient/Patient.read');
    return this.patients.find((p) => p.id === id) ?? null;
  }

  async getRelatedPersons(patientId) {
    this._requireScope('patient/RelatedPerson.read');
    return this.relatedPersons.filter((rp) => rp.patient.reference === `Patient/${patientId}`);
  }

  async getCoverage(patientId) {
    this._requireScope('patient/Coverage.read');
    return this.coverages.find((c) => c.beneficiary.reference === `Patient/${patientId}`) ?? null;
  }

  async getAppointment(id) {
    this._requireScope('patient/Appointment.read');
    return this.appointments.find((a) => a.id === id) ?? null;
  }

  async getConsentDocuments() {
    // Consent form templates are practice-level reference data, not scoped to a specific patient.
    return this.consentDocuments;
  }

  async createConsent(patientId, consent) {
    this._requireScope('patient/Consent.write');
    // Demo: just echo back a FHIR-shaped Consent resource; production would POST to Epic.
    return {
      resourceType: 'Consent',
      id: `consent_${Math.random().toString(36).slice(2, 8)}`,
      patient: { reference: `Patient/${patientId}` },
      status: 'active',
      dateTime: new Date().toISOString(),
      ...consent,
    };
  }

  async updateCoverage(patientId, patch) {
    this._requireScope('patient/Coverage.write');
    const coverage = this.coverages.find((c) => c.beneficiary.reference === `Patient/${patientId}`);
    if (coverage) Object.assign(coverage, patch);
    return coverage;
  }

  async createPaymentNotice(patientId, notice) {
    this._requireScope('patient/PaymentNotice.write');
    return {
      resourceType: 'PaymentNotice',
      id: `pn_${Math.random().toString(36).slice(2, 8)}`,
      request: { reference: `Patient/${patientId}` },
      status: 'active',
      created: new Date().toISOString(),
      ...notice,
    };
  }
}
