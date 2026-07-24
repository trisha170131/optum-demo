import { lookupCopayCents } from './feeSchedule.js';

export async function getExpectedCopay(fhirClient, appointmentId) {
  const appointment = await fhirClient.getAppointment(appointmentId);
  return { amountCents: lookupCopayCents(appointment), appointment };
}

export async function recordCopayPaymentNotice(fhirClient, patientId, amountCents, checkoutId) {
  return fhirClient.createPaymentNotice(patientId, {
    amount: { value: amountCents / 100, currency: 'USD' },
    payment: { reference: `MockCheckout/${checkoutId}` },
    status: 'active',
  });
}
