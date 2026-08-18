// report.js
// Pure JS, zero dependencies — matches simulationEngine.js's style.
// Builds a Markdown snapshot of the ledger: dashboard overview, the full
// income/expense log, a debt accounts snapshot, a pay reference, and the
// full static bills listing.

import { accrueDebt } from "./debtAccrual";
import { DEFAULT_ASSUMPTIONS, payBreakdown } from "./simulationEngine";

const fmt = (n) =>
  (n < 0 ? "-$" : "$") + Math.abs(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const todayStr = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
const inRange = (dateStr, days) => new Date(dateStr) >= daysAgo(days);

export function buildReport({ data }) {
  const assumptions = { ...DEFAULT_ASSUMPTIONS, ...(data.assumptions || {}) };
  const staticBills = data.staticBills || [];
  const fixedBillsMonthly = staticBills.reduce((s, b) => s + Number(b.amount || 0), 0);
  const accruedDebts = (data.debts || []).map((d) => accrueDebt(d, todayStr()));
  const pay = payBreakdown(assumptions);
  const monthlyIncome = pay.total * (26 / 12);

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

  // 4. Pay reference
  push("## Pay Reference");
  push("| Base Rate | Take-Home Rate | OT Hrs/Period | OT Rate | On-Call/mo | Fixed Bills |");
  push("|---|---|---|---|---|---|");
  push(`| ${fmt(assumptions.baseHourlyRate)}/hr | ${(assumptions.takeHomeRate * 100).toFixed(1)}% | ${assumptions.otHoursPerPeriod} | ${fmt(assumptions.otHourlyRate)}/hr | ${assumptions.onCallEventsPerMonth} | ${fmt(fixedBillsMonthly)}/mo |`);
  push();
  push("| Pay Calculation | Baseline | OT | On-call | Total |");
  push("|---|---|---|---|---|");
  push(`| Per Period | ${fmt(pay.baseline)} | ${fmt(pay.ot)} | ${fmt(pay.onCall)} | ${fmt(pay.total)} |`);
  push(`| Per Month | ${fmt(pay.baseline * (26 / 12))} | ${fmt(pay.ot * (26 / 12))} | ${fmt(pay.onCall * (26 / 12))} | ${fmt(monthlyIncome)} |`);
  push();

  // 5. Static bills
  push("## Static Bills");
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
