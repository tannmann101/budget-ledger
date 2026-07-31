// report.js
// Pure JS, zero dependencies — matches simulationEngine.js's style.
// Builds a Markdown snapshot of the ledger: dashboard overview, the full
// income/expense log, a debt accounts snapshot, the current plan projection
// with a plain-English explanation, and the full static bills listing.

import { accrueDebt } from "./debtAccrual";
import { simulate, DEFAULT_ASSUMPTIONS, payBreakdown } from "./simulationEngine";
import { liveFixedBills } from "./Plan";

const fmt = (n) =>
  (n < 0 ? "-$" : "$") + Math.abs(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d) => d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
const fmtDateLong = (d) => d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
const inRange = (dateStr, days) => new Date(dateStr) >= daysAgo(days);

function scenarioClause(a) {
  const otHrs = Number(a.otHoursPerPeriod) || 0;
  const events = Number(a.onCallEventsPerMonth) || 0;
  const otPart = otHrs > 0 ? `${otHrs} OT hr${otHrs === 1 ? "" : "s"}/pay period` : "no overtime";
  const onCallPart = `${events} on-call event${events === 1 ? "" : "s"}/mo`;
  const certPart = `a ${a.certCadenceDays}-day cert cadence`;
  return `${otPart}, ${onCallPart}, and ${certPart}`;
}

function planExplanation(plan, assumptions, fixedBillsMonthly) {
  const monthlyIncome = payBreakdown(assumptions, 0).total * (26 / 12);
  const lines = [];
  lines.push(
    `To hit ${plan.payoffPeriod ? "this debt-free date" : "a debt-free date within the model horizon"}, this assumes ` +
    `${scenarioClause(assumptions)} — currently about ${fmt(monthlyIncome)}/mo in take-home pay at today's rate, ` +
    `against ${fmt(fixedBillsMonthly)}/mo in fixed bills (the live Static Bills total).`
  );
  lines.push(
    "Every dollar of surplus left after bills and each debt's minimum payment goes to the highest-rate debt first " +
    "(avalanche method) until it's paid off, then cascades to the next-highest-rate debt. Each cert earned (on the " +
    "cadence above) permanently raises future pay, compounding the surplus available each period."
  );
  if (plan.payoffPeriod) {
    lines.push(
      `At this pace: ${fmt(plan.totalInterest)} in total interest paid along the way, and ${fmt(plan.finalSavings)} ` +
      `in savings once debt hits $0 on ${fmtDateLong(plan.payoffDate)}.`
    );
  } else {
    lines.push(
      "At this pace, the model runs out of horizon (5 years) before debt reaches $0 — closing the gap needs more " +
      "surplus per period: higher pay, lower fixed bills, or an extra debt payment lever on the Plan page."
    );
  }
  return lines.join(" ");
}

export function buildReport({ data, whatIf }) {
  const assumptions = { ...DEFAULT_ASSUMPTIONS, ...(data.assumptions || {}) };
  const fixedBillsMonthly = liveFixedBills(data);
  const startDate = new Date();
  const accruedDebts = (data.debts || []).map((d) => accrueDebt(d, todayStr()));
  const plan = simulate({ debts: accruedDebts, savings: Number(data.savings), assumptions: { ...assumptions, fixedBillsMonthly }, periods: 260, startDate });
  const changed = whatIf && JSON.stringify(whatIf) !== JSON.stringify(assumptions);
  const whatIfPlan = changed
    ? simulate({ debts: accruedDebts, savings: Number(data.savings), assumptions: { ...whatIf, fixedBillsMonthly }, periods: 260, startDate })
    : null;

  const today = todayStr();
  const lines = [];
  const push = (...args) => lines.push(...(args.length ? args : [""]));

  push("# Household Ledger Snapshot");
  push(`_Generated ${today}_`);
  push();

  const totalDebt = accruedDebts.reduce((s, d) => s + d.balance, 0);
  const netWorth = Number(data.checking) + Number(data.savings) - totalDebt;
  const last90Income = (data.income || []).filter((p) => inRange(p.date, 90));
  const avgMonthlyIncome = last90Income.reduce((s, p) => s + Number(p.amount || 0), 0) / 3;
  const last90Spend = (data.transactions || []).filter(
    (t) => (t.type === "expense" || t.type === "bill" || (t.type === "debt-payment" && t.account === "Checking")) && inRange(t.date, 90)
  );
  const avgMonthlySpend = last90Spend.reduce((s, t) => s + Math.abs(Number(t.amount || 0)), 0) / 3;

  // 1. Dashboard overview
  push("## Dashboard Overview");
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

  // 2. Full income/expense log
  push("## Income/Expense Log");
  const sortedIncome = [...(data.income || [])].sort((a, b) => b.date.localeCompare(a.date));
  push(`### Income (${sortedIncome.length})`);
  if (sortedIncome.length === 0) {
    push("_No income logged._");
  } else {
    push("| Date | Note | Amount |");
    push("|---|---|---|");
    for (const p of sortedIncome) push(`| ${p.date} | ${p.note || "—"} | ${fmt(p.amount)} |`);
  }
  push();
  const sortedTxns = [...(data.transactions || [])].sort((a, b) => b.date.localeCompare(a.date));
  push(`### Transactions (${sortedTxns.length})`);
  if (sortedTxns.length === 0) {
    push("_Nothing logged yet._");
  } else {
    push("| Date | Type | Description | Amount | Account |");
    push("|---|---|---|---|---|");
    for (const t of sortedTxns) push(`| ${t.date} | ${t.type.replace("-", " ")} | ${t.description} | ${fmt(t.amount)} | ${t.account} |`);
  }
  push();

  // 3. Current debt accounts snapshot
  push("## Debt Accounts Snapshot");
  if (accruedDebts.length === 0) {
    push("_No debt accounts._");
  } else {
    push("| Account | Balance | Rate | Credit Limit | Min Pmt | Last Updated |");
    push("|---|---|---|---|---|---|");
    for (const d of accruedDebts) {
      push(`| ${d.name} | ${fmt(d.balance)} | ${d.rate ? `${d.rate}%` : "—"} | ${d.creditLimit ? fmt(d.creditLimit) : "—"} | ${d.minPayment ? fmt(d.minPayment) : "—"} | ${d.lastUpdated || "—"} |`);
    }
  }
  push();

  // 4. Current plan projection + explanation
  push("## Current Plan Projection");
  push("| Debt-free | Total Interest | Savings at Payoff |");
  push("|---|---|---|");
  push(`| ${plan.payoffPeriod ? fmtDate(plan.payoffDate) : "beyond model horizon"} | ${fmt(plan.totalInterest)} | ${fmt(plan.finalSavings)} |`);
  push();
  push(planExplanation(plan, assumptions, fixedBillsMonthly));
  push();
  if (changed) {
    push("### What-if Scenario (not saved)");
    push(`- Debt-free: ${whatIfPlan.payoffPeriod ? fmtDate(whatIfPlan.payoffDate) : "beyond model horizon"}`);
    push(`- Total interest: ${fmt(whatIfPlan.totalInterest)}`);
    const payoffDelta = plan.payoffPeriod && whatIfPlan.payoffPeriod ? whatIfPlan.payoffPeriod - plan.payoffPeriod : null;
    push(`- Payoff delta vs. saved plan: ${payoffDelta === null ? "—" : payoffDelta === 0 ? "unchanged" : `${payoffDelta > 0 ? "+" : ""}${(payoffDelta / 2.17).toFixed(1)} mo`}`);
    push();
  }

  // 5. Static bills
  push("## Static Bills");
  const staticBills = data.staticBills || [];
  if (staticBills.length === 0) {
    push("_No static bills configured._");
  } else {
    push("| Bill | Amount | Timeframe |");
    push("|---|---|---|");
    for (const b of staticBills) push(`| ${b.name} | ${fmt(b.amount)} | ${b.day || "—"} |`);
    push(`| **Total** | **${fmt(fixedBillsMonthly)}** | |`);
  }
  push();

  return lines.join("\n");
}
