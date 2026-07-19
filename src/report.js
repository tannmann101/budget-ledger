// report.js
// Pure JS, zero dependencies — matches simulationEngine.js's style.
// Builds a Markdown snapshot of the ledger for external analysis: current
// real numbers, the saved "Set Plan" projection, and (if one is active) a
// distinct What-if Scenario projection alongside it.

import { accrueDebt } from "./debtAccrual";
import { simulate, DEFAULT_ASSUMPTIONS } from "./simulationEngine";

const fmt = (n) =>
  (n < 0 ? "-$" : "$") + Math.abs(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d) => d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
const inRange = (dateStr, days) => new Date(dateStr) >= daysAgo(days);

const ASSUMPTION_FIELDS = [
  ["baseHourlyRate", "Base rate ($/hr)"],
  ["takeHomeRate", "Take-home rate (0-1)"],
  ["otHoursPerPeriod", "OT hrs/pay period"],
  ["otHourlyRate", "OT rate ($/hr, gross)"],
  ["onCallEventsPerMonth", "On-call/Sat events per mo ($250 ea, gross)"],
  ["certCadenceDays", "Cert cadence (days)"],
  ["certRaiseMonthly", "Cert raise ($/mo)"],
  ["certBonusAmount", "Cert bonus ($)"],
  ["fixedBillsMonthly", "Fixed bills ($/mo)"],
  ["extraDebtPaymentPerPeriod", "Extra debt pmt ($/period)"],
  ["allocationSplit", "Split to debt (0-1)"],
];

function projectionLines(plan) {
  return [
    `- Debt-free: ${plan.payoffPeriod ? fmtDate(plan.payoffDate) : "beyond model horizon"}`,
    `- Total interest: ${fmt(plan.totalInterest)}`,
    `- Savings at payoff: ${fmt(plan.finalSavings)}`,
  ];
}
function assumptionLines(assumptions) {
  return ASSUMPTION_FIELDS.map(([key, label]) => `- ${label}: ${assumptions[key]}`);
}

const METHODOLOGY = [
  "Each pay period (bi-weekly, ~14 days) is simulated forward from today:",
  "",
  "- **Net pay** = (base hourly rate × 80 hrs × take-home rate) + (OT hours × OT rate × take-home rate) + (on-call/Saturday events per month × $250/event × take-home rate, prorated to a pay period) + accumulated cert raises. OT and on-call are gross pay taxed at the same take-home rate as base pay, never a tax-free add-on. Each cert earned, at the configured cadence, permanently adds (cert raise/mo × 12/26) to every future period's net pay — raises compound as more certs are earned.",
  "- **Committed spend** = fixed bills (a flat monthly figure, prorated per period) + each debt's real minimum payment. Net pay minus committed spend is the surplus available that period; the extra-debt-payment lever, if set, adds to it directly.",
  "- **Debt payoff** uses the avalanche method: the highest-rate debt gets 100% of the surplus (plus any cert-bonus share and minimum payments freed up from debts that finish paying off) each period, until it's paid off, then the next-highest-rate debt takes over. Every debt accrues interest each period at its own annual rate ÷ 26, applied to the balance before that period's payment.",
  "- **Cert bonuses** (one-time, on the same cadence as the raise) split between extra debt payment and savings per the allocation split.",
  "- Once all debt is paid off, all further surplus flows into savings instead.",
  "",
  "This is a simplified model of a real, fluctuating budget — actual income and expenses vary period to period, so treat the debt-free date and totals below as directional, not exact. The inputs listed below each projection are what's actually driving it; changing a rate, a raise amount, or a bill figure and re-running the simulation is how to test a different assumption against this same methodology.",
];

export function buildReport({ data, whatIf }) {
  const assumptions = { ...DEFAULT_ASSUMPTIONS, ...(data.assumptions || {}) };
  const startDate = new Date();
  const plan = simulate({ debts: data.debts, savings: Number(data.savings), assumptions, periods: 260, startDate });
  const changed = whatIf && JSON.stringify(whatIf) !== JSON.stringify(assumptions);
  const whatIfPlan = changed
    ? simulate({ debts: data.debts, savings: Number(data.savings), assumptions: whatIf, periods: 260, startDate })
    : null;

  const today = todayStr();
  const lines = [];
  const push = (...args) => lines.push(...(args.length ? args : [""]));

  push("# Household Ledger Snapshot");
  push(`_Generated ${today}_`);
  push();

  const totalDebt = data.debts.reduce((s, d) => s + accrueDebt(d, today).balance, 0);
  const netWorth = Number(data.checking) + Number(data.savings) - totalDebt;
  const last90Income = (data.income || []).filter((p) => inRange(p.date, 90));
  const avgMonthlyIncome = last90Income.reduce((s, p) => s + Number(p.amount || 0), 0) / 3;
  const last90Spend = (data.transactions || []).filter(
    (t) => (t.type === "expense" || t.type === "bill" || (t.type === "debt-payment" && t.account === "Checking")) && inRange(t.date, 90)
  );
  const avgMonthlySpend = last90Spend.reduce((s, t) => s + Math.abs(Number(t.amount || 0)), 0) / 3;

  push("## Overview");
  push("| Metric | Value |");
  push("|---|---|");
  push(`| Checking | ${fmt(data.checking)} |`);
  push(`| Savings | ${fmt(data.savings)} |`);
  push(`| Total Debt | ${fmt(totalDebt)} |`);
  push(`| Net Worth | ${fmt(netWorth)} |`);
  push(`| Avg Mo. Income (trailing 90d) | ${fmt(avgMonthlyIncome)} |`);
  push(`| Avg Mo. Spend (trailing 90d) | ${fmt(avgMonthlySpend)} |`);
  push(`| Spend / Income | ${avgMonthlyIncome > 0 ? `${Math.round((avgMonthlySpend / avgMonthlyIncome) * 100)}%` : "—"} |`);
  push();

  push("## Debt Accounts");
  push("| Account | Balance | Rate | Credit Limit | Min Pmt | Last Updated |");
  push("|---|---|---|---|---|---|");
  for (const d of data.debts || []) {
    const accrued = accrueDebt(d, today);
    push(`| ${d.name} | ${fmt(accrued.balance)} | ${d.rate ? `${d.rate}%` : "—"} | ${d.creditLimit ? fmt(d.creditLimit) : "—"} | ${d.minPayment ? fmt(d.minPayment) : "—"} | ${d.lastUpdated || "—"} |`);
  }
  push();

  push("## Income (trailing 90 days)");
  push(`- ${last90Income.length} paycheck(s) totaling ${fmt(last90Income.reduce((s, p) => s + Number(p.amount || 0), 0))}`);
  push(`- Average per check: ${fmt(last90Income.length ? last90Income.reduce((s, p) => s + Number(p.amount || 0), 0) / last90Income.length : 0)}`);
  push();

  const now = new Date();
  const recentMonths = new Set();
  for (let i = 0; i < 3; i++) recentMonths.add(new Date(now.getFullYear(), now.getMonth() - i, 1).toISOString().slice(0, 7));
  const categoryTotals = new Map();
  for (const e of data.expenses || []) {
    if (!recentMonths.has(e.month)) continue;
    const cat = (data.categories || []).find((c) => c.id === e.categoryId);
    const name = cat ? cat.name : e.categoryId;
    categoryTotals.set(name, (categoryTotals.get(name) || 0) + Number(e.amount || 0));
  }
  push("## Category Spend (trailing 3 months)");
  if (categoryTotals.size === 0) {
    push("_No logged expenses in this window._");
  } else {
    push("| Category | Total |");
    push("|---|---|");
    for (const [name, total] of [...categoryTotals.entries()].sort((a, b) => b[1] - a[1])) {
      push(`| ${name} | ${fmt(total)} |`);
    }
  }
  push();

  push("## How These Projections Are Calculated");
  push(...METHODOLOGY);
  push();

  push("## Set Plan (saved)");
  push("Inputs:");
  push(...assumptionLines(assumptions));
  push("Projection:");
  push(...projectionLines(plan));
  push();

  if (changed) {
    push("## What-if Scenario (not saved)");
    push("Inputs:");
    push(...assumptionLines(whatIf));
    push("Projection:");
    push(...projectionLines(whatIfPlan));
    push("Delta vs. Set Plan:");
    const payoffDelta = plan.payoffPeriod && whatIfPlan.payoffPeriod ? whatIfPlan.payoffPeriod - plan.payoffPeriod : null;
    push(`- Payoff: ${payoffDelta === null ? "—" : payoffDelta === 0 ? "unchanged" : `${payoffDelta > 0 ? "+" : ""}${(payoffDelta / 2.17).toFixed(1)} mo`}`);
    push(`- Total interest: ${whatIfPlan.totalInterest - plan.totalInterest >= 0 ? "+" : ""}${fmt(whatIfPlan.totalInterest - plan.totalInterest)}`);
    push();
  }

  return lines.join("\n");
}
