/**
 * Demographics task: pre-fill from the existing record via FhirClient, patient confirms or
 * corrects — never re-types unchanged data.
 */
export async function buildDemographicsPrefill(fhirClient, patientId) {
  const patient = await fhirClient.getPatient(patientId);
  const relatedPersons = await fhirClient.getRelatedPersons(patientId);
  const emergencyContact = relatedPersons[0];
  const phone = patient?.telecom?.find((t) => t.system === 'phone');
  const email = patient?.telecom?.find((t) => t.system === 'email');
  const address = patient?.address?.[0];

  return {
    name: patient?.name?.[0]?.text ?? '',
    phone: phone?.value ?? '',
    email: email?.value ?? '',
    addressLine: address?.line?.[0] ?? '',
    city: address?.city ?? '',
    state: address?.state ?? '',
    postalCode: address?.postalCode ?? '',
    emergencyContactName: emergencyContact?.name?.[0]?.text ?? '',
    emergencyContactPhone: emergencyContact?.telecom?.[0]?.value ?? '',
    emergencyContactRelationship: emergencyContact?.relationship?.[0]?.text ?? '',
  };
}
