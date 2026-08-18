// simulationEngine.js
// Pure JS, zero dependencies — matches the rest of this codebase's style.
//
// Used to also run a full avalanche debt-payoff simulation keyed off a cert
// raise/bonus cadence (the Plan page). That page is retired -- the cert
// system that drove its core growth assumption changed at work and can't be
// tracked this way anymore -- so only the piece that's still real and
// useful survives: payBreakdown, a transparent "what does a paycheck
// actually total" calculator with no cert projection baked in.

export const DEFAULT_ASSUMPTIONS = {
  takeHomeRate: 0.7776,
  baseHourlyRate: 24.22,
  otHoursPerPeriod: 0,
  otHourlyRate: 28.25,
  onCallEventsPerMonth: 2, // placeholder — a Saturday shift or a week of PCC hotline on-call, adjust to your real schedule
};

export const ONCALL_EVENT_RATE = 250; // $/event, gross — a Saturday shift or a week of on-call

// OT and on-call are both gross pay, taxed at the same take-home rate as
// base pay before landing in the bank — neither is a tax-free add-on.
export function payBreakdown(assumptions) {
  const baseline = assumptions.baseHourlyRate * 80 * assumptions.takeHomeRate;
  const ot = assumptions.otHoursPerPeriod * assumptions.otHourlyRate * assumptions.takeHomeRate;
  const onCall = assumptions.onCallEventsPerMonth * ONCALL_EVENT_RATE * assumptions.takeHomeRate * (12 / 26);
  return { baseline, ot, onCall, total: baseline + ot + onCall };
}
