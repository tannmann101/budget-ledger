// simulationEngine.js
// Pure JS, zero dependencies — matches the rest of this codebase's style.
// Field names/units match App.jsx's real debt shape: rate is a percent
// (16.49, not 0.1649), and minPayment is either a dollar amount or null
// (null = "no separate minimum, this debt just gets whatever avalanche
// money is left over" — same convention as "Your card" in buildSeedData).

export const PERIOD_DAYS = 365.25 / 26; // bi-weekly pay period

export const DEFAULT_ASSUMPTIONS = {
  takeHomeRate: 0.7776,
  baseHourlyRate: 24.22,
  otHoursPerPeriod: 0,
  otNetPerHour: 28.25,
  certRaiseMonthly: 81.0,
  certBonusAmount: 2500,
  allocationSplit: 0.7,
  fixedBillsMonthly: 2207.4,
  certCadenceDays: 45,
  extraDebtPaymentPerPeriod: 0,
};

export const ONCALL_CYCLE_DEFAULT = [250, 250, 125, 250, 125];
// Placeholder per-pay-period cycle. Replace with real figures once known,
// same as the Excel model used real Aug-Dec 2026 numbers before falling
// back to a repeating assumption.

export function periodToDate(startDate, p) {
  return new Date(startDate.getTime() + p * PERIOD_DAYS * 86400000);
}

export function payBreakdown(assumptions, certsToDate) {
  const baseline = assumptions.baseHourlyRate * 80 * assumptions.takeHomeRate;
  const ot = assumptions.otHoursPerPeriod * assumptions.otNetPerHour;
  const certRaise = certsToDate * ((assumptions.certRaiseMonthly * 12) / 26);
  return { baseline, ot, certRaise, total: baseline + ot + certRaise };
}

/**
 * @param {Array}  debts        real ledger shape: [{ id, name, balance, rate, minPayment }]
 *                               rate is a PERCENT (16.49), minPayment is $/mo or null
 * @param {number} savings
 * @param {Object} assumptions  see DEFAULT_ASSUMPTIONS
 * @param {Array}  [oneOffs]    [{ label, amount, startPeriod, recurring }]
 * @param {Array}  [oncallCycle]
 * @param {number} [periods]
 * @param {Date}   [startDate]
 */
export function simulate({
  debts,
  savings,
  assumptions,
  oneOffs = [],
  oncallCycle = ONCALL_CYCLE_DEFAULT,
  periods = 100,
  startDate = new Date(),
}) {
  let d = debts.map((x) => ({ ...x, rate: Number(x.rate) / 100, balance: Number(x.balance) }));
  let sav = savings;
  let certAccumulator = 0;
  let certsToDate = 0;
  let totalInterest = 0;
  let payoffPeriod = null;
  const cadencePeriods = assumptions.certCadenceDays / PERIOD_DAYS;

  const rows = [{ period: 0, date: startDate, debt: d.reduce((s, x) => s + x.balance, 0), savings: sav }];

  for (let p = 1; p <= periods; p++) {
    const oncallGross = oncallCycle[(p - 1) % oncallCycle.length];
    const oncallNet = oncallGross * assumptions.takeHomeRate;

    const willCert = certAccumulator + 1 >= cadencePeriods ? 1 : 0;
    certAccumulator = willCert ? certAccumulator + 1 - cadencePeriods : certAccumulator + 1;
    certsToDate += willCert;

    const { total: baseTotal } = payBreakdown(assumptions, certsToDate);
    const netPay = baseTotal + oncallNet;
    const fixedBillsPeriod = (assumptions.fixedBillsMonthly * 12) / 26;
    const committedMin = d.reduce((s, x) => s + ((Number(x.minPayment) || 0) * 12) / 26, 0);
    const surplus = netPay - fixedBillsPeriod - committedMin;

    const activeOneOffs = oneOffs.filter((e) =>
      e.recurring ? p >= e.startPeriod : p === e.startPeriod
    );
    let oneOffPositive = 0,
      oneOffNegative = 0;
    activeOneOffs.forEach((e) =>
      e.amount >= 0 ? (oneOffPositive += e.amount) : (oneOffNegative += e.amount)
    );
    const effectiveSurplus = surplus + oneOffNegative;

    const certBonus = willCert ? assumptions.certBonusAmount : 0;
    const certToDebt = certBonus * assumptions.allocationSplit;
    const certToSavings = certBonus - certToDebt;

    let interestThisPeriod = 0;
    d.forEach((x) => {
      if (x.balance > 0.005) {
        const interest = x.balance * (x.rate / 26);
        x.balance += interest;
        interestThisPeriod += interest;
      }
    });
    totalInterest += interestThisPeriod;

    const active = d.filter((x) => x.balance > 0.005).sort((a, b) => b.rate - a.rate);
    const primary = active[0];
    let freedPool = 0;
    active.forEach((x) => {
      if (x !== primary && x.minPayment) {
        const minPeriod = (Number(x.minPayment) * 12) / 26;
        const pay = Math.min(minPeriod, x.balance);
        x.balance -= pay;
        freedPool += minPeriod - pay;
      }
    });

    let pool = Math.max(effectiveSurplus, 0) + certToDebt + freedPool + oneOffPositive
      + (Number(assumptions.extraDebtPaymentPerPeriod) || 0);
    for (const x of active) {
      if (pool <= 0) break;
      const pay = Math.min(pool, x.balance);
      x.balance -= pay;
      pool -= pay;
    }
    sav += certToSavings + pool;

    const totalDebt = d.reduce((s, x) => s + Math.max(x.balance, 0), 0);
    if (payoffPeriod === null && totalDebt <= 0.5) payoffPeriod = p;

    rows.push({ period: p, date: periodToDate(startDate, p), debt: totalDebt, savings: sav });
    if (payoffPeriod !== null && p >= payoffPeriod + 2) break;
  }

  const payoffDate = payoffPeriod ? periodToDate(startDate, payoffPeriod) : null;
  return { rows, payoffPeriod, payoffDate, totalInterest, finalSavings: sav, debts: d };
}
