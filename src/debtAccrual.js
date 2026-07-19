// debtAccrual.js
// Pure JS, zero dependencies — matches simulationEngine.js's style.
// Handles real (non-simulated) interest accrual on debt balances between
// updates, since real balances otherwise only ever change when a
// payment/charge/correction is manually logged.

export function accrueDebt(debt, asOfDateStr) {
  const rate = Number(debt.rate) || 0;
  const days = Math.max(0, (new Date(asOfDateStr) - new Date(debt.lastUpdated || asOfDateStr)) / 86400000);
  const interestAccrued = Number(debt.balance) * (rate / 100 / 365) * days;
  return { ...debt, balance: Number(debt.balance) + interestAccrued, lastUpdated: asOfDateStr, interestAccrued };
}
