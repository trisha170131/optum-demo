/** Mock fee-schedule lookup — a real build would call a backend billing/eligibility service. */
export function lookupCopayCents(appointment) {
  return appointment?.feeScheduleAmountCents ?? 2500;
}
