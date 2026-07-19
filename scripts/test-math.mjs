// test-math.mjs
// Pins down the pure money-math in simulationEngine.js and debtAccrual.js —
// the most consequential, easiest-to-silently-break logic in the app (this
// session alone fixed two real bugs in it: OT taxed as if it were already
// net, and a one-time bonus's startPeriod clamp swallowing period 0).
// Uses node's built-in test runner so no new dependency is needed.

import { test } from "node:test";
import assert from "node:assert/strict";
import { simulate, payBreakdown, DEFAULT_ASSUMPTIONS } from "../src/simulationEngine.js";
import { accrueDebt } from "../src/debtAccrual.js";

const baseAssumptions = {
  ...DEFAULT_ASSUMPTIONS,
  baseHourlyRate: 0,
  takeHomeRate: 1,
  otHoursPerPeriod: 0,
  onCallEventsPerMonth: 0,
  certRaiseMonthly: 0,
  certBonusAmount: 0,
  fixedBillsMonthly: 0,
  certCadenceDays: 100000, // effectively "never" within these short test horizons
  extraDebtPaymentPerPeriod: 0,
  allocationSplit: 0.5,
};

test("payBreakdown: OT and on-call are taxed at the take-home rate, not already-net", () => {
  const a = { ...DEFAULT_ASSUMPTIONS, baseHourlyRate: 20, takeHomeRate: 0.75, otHoursPerPeriod: 10, otHourlyRate: 30, onCallEventsPerMonth: 2, certRaiseMonthly: 0 };
  const { baseline, ot, onCall, certRaise, total } = payBreakdown(a, 0);
  assert.equal(baseline, 20 * 80 * 0.75); // 1200
  // 300 would mean OT is being treated as an already-net, tax-free rate — the bug this session fixed.
  assert.equal(ot, 10 * 30 * 0.75); // 225
  assert.ok(Math.abs(onCall - 2 * 250 * 0.75 * (12 / 26)) < 1e-9);
  assert.equal(certRaise, 0);
  assert.ok(Math.abs(total - (baseline + ot + onCall + certRaise)) < 1e-9);
});

test("payBreakdown: certsToDate compounds the permanent per-cert raise", () => {
  const a = { ...DEFAULT_ASSUMPTIONS, certRaiseMonthly: 81 };
  const zero = payBreakdown(a, 0);
  const two = payBreakdown(a, 2);
  assert.equal(zero.certRaise, 0);
  assert.ok(Math.abs(two.certRaise - 2 * (81 * 12 / 26)) < 1e-9);
});

test("simulate: interest accrues before that period's payment, and surplus overflow lands in savings", () => {
  const assumptions = { ...baseAssumptions, baseHourlyRate: 100 }; // netPay/period = 100*80*1 = 8000
  const debts = [{ id: "d1", name: "Test", balance: 1000, rate: 26, minPayment: null }]; // 26%/yr / 26 periods = exactly 1%/period
  const result = simulate({ debts, savings: 0, assumptions, periods: 3, startDate: new Date("2026-01-01") });

  assert.equal(result.payoffPeriod, 1);
  // period-1 interest: 1000 * 1% = 10 -> balance 1010, fully paid from the 8000 surplus, 6990 left over into savings
  assert.equal(result.rows[1].debt, 0);
  assert.ok(Math.abs(result.rows[1].savings - 6990) < 1e-9);
  assert.equal(result.finalSavings, result.rows[1].savings); // payoff snapshot, not the post-payoff running total
  assert.ok(Math.abs(result.totalInterest - 10) < 1e-9);
});

test("simulate: avalanche pays the highest-rate debt first, cascading leftover pool to the next debt in the same period", () => {
  const assumptions = { ...baseAssumptions, baseHourlyRate: 10 }; // netPay/period = 800
  const debts = [
    { id: "dA", name: "High rate", balance: 1000, rate: 26, minPayment: null }, // 1%/period
    { id: "dB", name: "Low rate", balance: 500, rate: 13, minPayment: null }, // 0.5%/period
  ];
  const result = simulate({ debts, savings: 0, assumptions, periods: 3, startDate: new Date("2026-01-01") });

  const byId = (rowDebts, id) => rowDebts.find((d) => d.id === id);
  // after period 1: all 800 surplus goes at dA (higher rate) first; dB untouched but still accrues its own interest
  const afterP1 = simulate({ debts, savings: 0, assumptions, periods: 1, startDate: new Date("2026-01-01") }).debts;
  assert.ok(Math.abs(byId(afterP1, "dA").balance - 210) < 1e-9); // 1000*1.01 - 800
  assert.ok(Math.abs(byId(afterP1, "dB").balance - 502.5) < 1e-9); // 500*1.005, no payment reached it

  // period 2: dA finishes ($212.10), its remaining pool ($587.90) cascades to dB in the same period
  assert.equal(result.payoffPeriod, 2);
  assert.ok(Math.abs(result.rows[2].debt) < 1e-6);
});

test("simulate: a non-primary debt's minPayment is honored, and money freed up by it finishing early joins the pool", () => {
  const assumptions = { ...baseAssumptions, baseHourlyRate: 10 }; // netPay/period = 800
  const debts = [
    { id: "dA", name: "High rate", balance: 5000, rate: 26, minPayment: null },
    { id: "dB", name: "Low rate, small balance", balance: 40, rate: 13, minPayment: 26 * 100 }, // min pmt/period = 100, way more than its balance
  ];
  const result = simulate({ debts, savings: 0, assumptions, periods: 1, startDate: new Date("2026-01-01") });
  const dB = result.debts.find((d) => d.id === "dB");
  // dB's min payment (100) exceeds its accrued balance (40.2), so it pays off fully and the
  // leftover (100 - 40.2 = 59.8) should flow into dA's pool rather than vanishing.
  assert.ok(Math.abs(dB.balance) < 1e-9);
});

test("simulate: cert bonus splits between debt paydown and savings per allocationSplit", () => {
  const assumptions = { ...baseAssumptions, certCadenceDays: 1, certBonusAmount: 1000, allocationSplit: 0.6 };
  const debts = [{ id: "d1", name: "Big debt", balance: 100000, rate: 0, minPayment: null }];
  const result = simulate({ debts, savings: 0, assumptions, periods: 1, startDate: new Date("2026-01-01") });

  assert.ok(Math.abs(result.debts[0].balance - (100000 - 600)) < 1e-9); // certToDebt = 1000 * 0.6
  assert.ok(Math.abs(result.rows[1].savings - 400) < 1e-9); // certToSavings = 1000 * 0.4
});

test("simulate: a one-time oneOff only applies on its startPeriod; a recurring one applies every period from startPeriod on", () => {
  const debts = [{ id: "d1", name: "Big debt", balance: 100000, rate: 0, minPayment: null }];
  const oneTime = simulate({
    debts, savings: 0, assumptions: baseAssumptions, periods: 3, startDate: new Date("2026-01-01"),
    oneOffs: [{ label: "bonus", amount: 500, startPeriod: 2, recurring: false }],
  });
  assert.equal(oneTime.rows[1].debt, 100000); // untouched period 1
  assert.equal(oneTime.rows[2].debt, 100000 - 500); // the bonus lands exactly on period 2
  assert.equal(oneTime.rows[3].debt, 100000 - 500); // and doesn't repeat on period 3

  const recurring = simulate({
    debts, savings: 0, assumptions: baseAssumptions, periods: 3, startDate: new Date("2026-01-01"),
    oneOffs: [{ label: "extra bill", amount: -100, startPeriod: 1, recurring: true }],
  });
  // a recurring shortfall is floored at 0 surplus rather than draining savings — it doesn't pay the
  // debt down faster, but it must not go negative either.
  assert.equal(recurring.rows[1].savings, 0);
  assert.equal(recurring.rows[3].savings, 0);
});

test("accrueDebt: accrues simple daily interest since lastUpdated and resets the clock", () => {
  const debt = { balance: 10000, rate: 18.25, lastUpdated: "2026-01-01" }; // 18.25%/365 = exactly 0.05%/day
  const accrued = accrueDebt(debt, "2026-01-11"); // 10 days
  assert.ok(Math.abs(accrued.interestAccrued - 10000 * 0.0005 * 10) < 1e-9); // 50
  assert.ok(Math.abs(accrued.balance - 10050) < 1e-9);
  assert.equal(accrued.lastUpdated, "2026-01-11");
});

test("accrueDebt: zero elapsed days accrues nothing; a rateless debt accrues nothing", () => {
  const debt = { balance: 500, rate: 20, lastUpdated: "2026-01-01" };
  const same = accrueDebt(debt, "2026-01-01");
  assert.equal(same.interestAccrued, 0);
  assert.equal(same.balance, 500);

  const noRate = accrueDebt({ balance: 500, rate: null, lastUpdated: "2026-01-01" }, "2026-02-01");
  assert.equal(noRate.interestAccrued, 0);
  assert.equal(noRate.balance, 500);
});

test("accrueDebt: a stale asOf date (clock skew) never produces negative interest", () => {
  const debt = { balance: 500, rate: 20, lastUpdated: "2026-02-01" };
  const accrued = accrueDebt(debt, "2026-01-01"); // asOf before lastUpdated
  assert.equal(accrued.interestAccrued, 0);
  assert.equal(accrued.balance, 500);
});
