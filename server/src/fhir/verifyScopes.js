// Smoke test proving SMART scope enforcement in MockFhirClient is real, not just a comment.
import { MockFhirClient } from './MockFhirClient.js';
import { ScopeError } from './FhirClient.js';

const narrow = new MockFhirClient(['patient/Patient.read']); // no Coverage.read granted
try {
  await narrow.getCoverage('pat-001');
  console.error('FAIL: expected ScopeError for missing patient/Coverage.read');
  process.exit(1);
} catch (err) {
  if (!(err instanceof ScopeError)) { console.error('FAIL: wrong error type', err); process.exit(1); }
  console.log('PASS: narrow-scope client correctly rejected getCoverage:', err.message);
}

const wide = new MockFhirClient(['patient/Patient.read', 'patient/Coverage.read']);
const coverage = await wide.getCoverage('pat-001');
if (!coverage) { console.error('FAIL: expected coverage with granted scope'); process.exit(1); }
console.log('PASS: granted-scope client fetched coverage:', coverage.payor[0].display);
