// test-math.mjs
// Pins down the pure money-math in simulationEngine.js and debtAccrual.js.
// Uses node's built-in test runner so no new dependency is needed.

import { test } from "node:test";
import assert from "node:assert/strict";
import { payBreakdown, DEFAULT_ASSUMPTIONS } from "../src/simulationEngine.js";
import { accrueDebt } from "../src/debtAccrual.js";

test("payBreakdown: OT and on-call are taxed at the take-home rate, not already-net", () => {
  const a = { ...DEFAULT_ASSUMPTIONS, baseHourlyRate: 20, takeHomeRate: 0.75, otHoursPerPeriod: 10, otHourlyRate: 30, onCallEventsPerMonth: 2 };
  const { baseline, ot, onCall, total } = payBreakdown(a);
  assert.equal(baseline, 20 * 80 * 0.75); // 1200
  // 300 would mean OT is being treated as an already-net, tax-free rate — the bug this session fixed.
  assert.equal(ot, 10 * 30 * 0.75); // 225
  assert.ok(Math.abs(onCall - 2 * 250 * 0.75 * (12 / 26)) < 1e-9);
  assert.ok(Math.abs(total - (baseline + ot + onCall)) < 1e-9);
});

test("payBreakdown: zero OT hours and zero on-call events contribute nothing", () => {
  const a = { ...DEFAULT_ASSUMPTIONS, baseHourlyRate: 24, takeHomeRate: 0.8, otHoursPerPeriod: 0, onCallEventsPerMonth: 0 };
  const { baseline, ot, onCall, total } = payBreakdown(a);
  assert.equal(baseline, 24 * 80 * 0.8);
  assert.equal(ot, 0);
  assert.equal(onCall, 0);
  assert.equal(total, baseline);
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
