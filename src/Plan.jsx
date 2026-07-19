import { useState, useMemo } from "react";
import { simulate, DEFAULT_ASSUMPTIONS, payBreakdown } from "./simulationEngine";
import { MONO, BG, INK, MUTE, LINE, HEAD_BG, TEAL, BRICK, GOLD } from "./theme";
import { Table, Th, Td, Btn, Input, SectionTitle, TabBar, Card, Note } from "./ui";

const fmt = (n) =>
  (n < 0 ? "-$" : "$") + Math.abs(Math.round(n)).toLocaleString();
const fmtDate = (d) => d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
const fmtDateLong = (d) => d.toLocaleDateString(undefined, { month: "long", year: "numeric" });

// Picks x-axis ticks that stay readable across both a few-month and a
// multi-year horizon: one per calendar year once the span is long enough,
// otherwise evenly-spaced month labels like before.
function pickTicks(refRows) {
  if (refRows.length < 2) return { ticks: refRows.map((_, i) => i), yearly: false };
  const spanDays = (refRows[refRows.length - 1].date - refRows[0].date) / 86400000;
  if (spanDays > 500) {
    const seen = new Set();
    const ticks = [];
    refRows.forEach((r, i) => {
      const yr = r.date.getFullYear();
      if (!seen.has(yr)) { seen.add(yr); ticks.push(i); }
    });
    return { ticks, yearly: true };
  }
  const step = Math.max(1, Math.ceil(refRows.length / 7));
  const ticks = [];
  refRows.forEach((_, i) => { if (i % step === 0) ticks.push(i); });
  if (ticks[ticks.length - 1] !== refRows.length - 1) ticks.push(refRows.length - 1);
  return { ticks, yearly: false };
}

function rowAt(rows, i) {
  return rows[Math.min(i, rows.length - 1)];
}

// Turns a raw assumptions object into a spoken-language clause, e.g.
// "10 OT hrs/pay period, 2 on-call events/mo, and a 45-day cert cadence" —
// the "why" behind whichever projection is being described.
function scenarioClause(a) {
  const otHrs = Number(a.otHoursPerPeriod) || 0;
  const events = Number(a.onCallEventsPerMonth) || 0;
  const otPart = otHrs > 0 ? `${otHrs} OT hr${otHrs === 1 ? "" : "s"}/pay period` : "no overtime";
  const onCallPart = `${events} on-call event${events === 1 ? "" : "s"}/mo`;
  const certPart = `a ${a.certCadenceDays}-day cert cadence`;
  return `${otPart}, ${onCallPart}, and ${certPart}`;
}

function insightText({ plan, whatIfPlan, changed, hover, startingDebt, assumptions, whatIf }) {
  const rows = plan.rows;
  const r = rowAt(rows, hover);
  const paidOff = r.debt <= 0.5;
  const pctPaid = startingDebt > 0 ? Math.max(0, Math.min(100, Math.round((1 - r.debt / startingDebt) * 100))) : 0;

  let text = `With ${scenarioClause(assumptions)}, the saved plan has you `
    + (paidOff ? "fully debt-free" : `${pctPaid}% of the way to debt-free`)
    + ` by ${fmtDateLong(r.date)}`;
  if (!paidOff && plan.payoffPeriod) {
    text += `, on pace to be completely debt-free by ${fmtDateLong(plan.payoffDate)}`;
  }
  text += `, having banked ${fmt(r.savings)} in savings against ${fmt(r.interestToDate)} in interest paid so far.`;

  if (changed && whatIfPlan) {
    const wr = rowAt(whatIfPlan.rows, hover);
    const delta = wr.debt - r.debt;
    const deltaText = Math.abs(delta) < 1
      ? "land in about the same place"
      : delta < 0 ? `be ${fmt(Math.abs(delta))} further ahead` : `be ${fmt(Math.abs(delta))} further behind`;
    text += ` Swap in ${scenarioClause(whatIf)} instead, and you'd ${deltaText} at this point`;
    text += whatIfPlan.payoffPeriod ? ` — debt-free by ${fmtDateLong(whatIfPlan.payoffDate)}.` : ".";
  }
  return text;
}

// Hand-rolled SVG chart, same approach as App.jsx's TrendChart — no chart library.
function PlanChart({ plan, whatIfPlan, changed, startingDebt, assumptions, whatIf }) {
  const rows = plan.rows;
  const whatIfRows = changed ? whatIfPlan.rows : null;
  const W = 700, H = 260, PAD_L = 58, PAD_R = 14, PAD_T = 14, PAD_B = 26;
  const innerW = W - PAD_L - PAD_R, innerH = H - PAD_T - PAD_B;
  const all = [...rows.map((r) => r.debt), ...(whatIfRows ? whatIfRows.map((r) => r.debt) : [])];
  const max = Math.max(...all, 1);
  const referenceRows = whatIfRows && whatIfRows.length > rows.length ? whatIfRows : rows;
  const n = referenceRows.length;
  const x = (i) => PAD_L + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v) => PAD_T + innerH - (v / max) * innerH;
  const path = (arr) => arr.map((r, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(r.debt).toFixed(1)}`).join(" ");
  const gridLines = 4;
  const { ticks, yearly } = pickTicks(referenceRows);
  const [hover, setHover] = useState(null);

  const payoffMarker = (payoffPeriod, color, label) => {
    if (payoffPeriod === null || payoffPeriod >= n) return null;
    return (
      <g>
        <circle cx={x(payoffPeriod)} cy={y(0)} r="4" fill={color} stroke={BG} strokeWidth="2" />
        <text x={x(payoffPeriod)} y={y(0) - 8} textAnchor="middle" fontFamily={MONO} fontSize="9.5" fill={color}>{label}</text>
      </g>
    );
  };

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 460, display: "block" }} onMouseLeave={() => setHover(null)}>
        {Array.from({ length: gridLines + 1 }).map((_, i) => {
          const gy = PAD_T + (innerH / gridLines) * i;
          const val = max - (max / gridLines) * i;
          return (
            <g key={i}>
              <line x1={PAD_L} x2={W - PAD_R} y1={gy} y2={gy} stroke={LINE} />
              <text x={PAD_L - 6} y={gy + 3} textAnchor="end" fontFamily={MONO} fontSize="10" fill={MUTE}>{fmt(val)}</text>
            </g>
          );
        })}
        {ticks.map((i) => (
          <text key={i} x={x(i)} y={H - 7} textAnchor="middle" fontFamily={MONO} fontSize="9.5" fill={MUTE}>
            {yearly ? referenceRows[i].date.getFullYear() : fmtDate(referenceRows[i].date)}
          </text>
        ))}
        <path d={path(rows)} fill="none" stroke={TEAL} strokeWidth="2" />
        {whatIfRows && <path d={path(whatIfRows)} fill="none" stroke={GOLD} strokeWidth="2" strokeDasharray="4 3" />}
        {payoffMarker(plan.payoffPeriod, TEAL, "debt-free")}
        {changed && payoffMarker(whatIfPlan.payoffPeriod, GOLD, "debt-free")}
        {referenceRows.map((_, i) => (
          <rect key={i} x={x(i) - innerW / Math.max(n - 1, 1) / 2} y={PAD_T}
            width={innerW / Math.max(n - 1, 1)} height={innerH} fill="transparent"
            style={{ cursor: "crosshair" }} onMouseEnter={() => setHover(i)} />
        ))}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={PAD_T} y2={PAD_T + innerH} stroke={INK} strokeOpacity="0.2" />
            <circle cx={x(hover)} cy={y(rowAt(rows, hover).debt)} r="4" fill={TEAL} stroke={BG} strokeWidth="2" />
            {whatIfRows && <circle cx={x(hover)} cy={y(rowAt(whatIfRows, hover).debt)} r="4" fill={GOLD} stroke={BG} strokeWidth="2" />}
          </g>
        )}
      </svg>
      <Card tint={HEAD_BG} style={{ marginTop: 10, fontFamily: MONO, fontSize: 11.5, color: INK, lineHeight: 1.55, minHeight: 34 }}>
        {hover !== null
          ? insightText({ plan, whatIfPlan: changed ? whatIfPlan : null, changed, hover, startingDebt, assumptions, whatIf })
          : <span style={{ color: MUTE }}>Hover the chart for a plain-English read of what your current numbers mean at that point in time.</span>}
      </Card>
    </div>
  );
}

export default function Plan({ data, commit, whatIf, setWhatIf }) {
  const assumptions = { ...DEFAULT_ASSUMPTIONS, ...(data.assumptions || {}) };

  const startDate = useMemo(() => new Date(), []);

  const plan = useMemo(
    () => simulate({ debts: data.debts, savings: Number(data.savings), assumptions, periods: 260, startDate }),
    [data.debts, data.savings, assumptions, startDate]
  );
  const whatIfPlan = useMemo(
    () => simulate({ debts: data.debts, savings: Number(data.savings), assumptions: whatIf, periods: 260, startDate }),
    [data.debts, data.savings, whatIf, startDate]
  );

  const changed = JSON.stringify(whatIf) !== JSON.stringify(assumptions);
  const payoffDeltaPeriods = plan.payoffPeriod && whatIfPlan.payoffPeriod ? whatIfPlan.payoffPeriod - plan.payoffPeriod : null;
  const interestDelta = whatIfPlan.totalInterest - plan.totalInterest;

  const saveAssumptions = () => {
    commit({ main: { assumptions: whatIf } });
  };
  const resetWhatIf = () => setWhatIf(assumptions);

  const [payView, setPayView] = useState("period");
  const payScale = payView === "month" ? 26 / 12 : 1;
  const payNow = payBreakdown(whatIf, 0);
  const payAfterNextCert = payBreakdown(whatIf, 1);
  const grossNow = Number(whatIf.baseHourlyRate) * 80;

  const field = (key, label, width = 90) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <label style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, textTransform: "uppercase" }}>{label}</label>
      <Input
        type="number"
        width={width}
        value={whatIf[key]}
        onChange={(v) => setWhatIf({ ...whatIf, [key]: v === "" ? "" : parseFloat(v) })}
      />
    </div>
  );

  return (
    <>
      <SectionTitle note={plan.payoffPeriod ? `debt-free ${fmtDate(plan.payoffDate)}` : "beyond model horizon"}>Current Plan (saved)</SectionTitle>
      <Table>
        <thead><tr><Th align="right">Debt-free</Th><Th align="right">Total interest</Th><Th align="right">Savings at payoff</Th></tr></thead>
        <tbody>
          <tr>
            <Td align="right" mono>{plan.payoffPeriod ? fmtDate(plan.payoffDate) : "—"}</Td>
            <Td align="right" mono style={{ color: BRICK }}>{fmt(plan.totalInterest)}</Td>
            <Td align="right" mono style={{ color: TEAL }}>{fmt(plan.finalSavings)}</Td>
          </tr>
        </tbody>
      </Table>
      <Note>
        Savings barely moves while debt is outstanding — the avalanche method sends nearly every surplus dollar
        at the highest-rate debt first, so savings mostly only grows from the savings-share of periodic cert
        bonuses until the debt-free date. Once debt hits $0, all further surplus flows straight into savings.
      </Note>
      <div style={{ marginTop: 12 }}>
        <PlanChart plan={plan} whatIfPlan={whatIfPlan} changed={changed} startingDebt={plan.rows[0].debt} assumptions={assumptions} whatIf={whatIf} />
      </div>
      <p style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, margin: "8px 0 0" }}>
        <span style={{ color: TEAL }}>■</span> saved plan
        {changed && <> &nbsp; <span style={{ color: GOLD }}>■</span> what-if (not saved)</>}
      </p>

      <SectionTitle note="adjust and preview before saving — this is a scratch preview, not saved until you click below">What-if</SectionTitle>
      <Card>
        <div style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, textTransform: "uppercase", letterSpacing: "0.03em", margin: "0 0 8px" }}>Pay</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 16 }}>
          {field("baseHourlyRate", "Base rate ($/hr)", 80)}
          {field("takeHomeRate", "Take-home rate (0-1)", 90)}
          {field("otHoursPerPeriod", "OT hrs/pay period", 80)}
          {field("otHourlyRate", "OT rate ($/hr, gross)", 90)}
          {field("onCallEventsPerMonth", "On-call/Sat events per mo", 80)}
          {field("certCadenceDays", "Cert cadence (days)")}
          {field("certRaiseMonthly", "Cert raise ($/mo)", 90)}
          {field("certBonusAmount", "Cert bonus ($)", 90)}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, textTransform: "uppercase", letterSpacing: "0.03em", margin: "0 0 8px" }}>Debt &amp; Bills</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
          {field("fixedBillsMonthly", "Fixed bills ($/mo)", 100)}
          {field("extraDebtPaymentPerPeriod", "Extra debt pmt ($/period)", 100)}
          {field("allocationSplit", "Split to debt (0-1)", 80)}
        </div>
      </Card>

      <SectionTitle note="how net pay is actually calculated — no black boxing">Pay Calculation</SectionTitle>
      <div style={{ marginBottom: 12 }}>
        <TabBar
          active={payView}
          onChange={setPayView}
          tabs={[{ id: "period", label: "Per Period" }, { id: "month", label: "Per Month" }]}
        />
      </div>
      <Table>
        <thead><tr>
          <Th> </Th><Th align="right">Gross</Th><Th align="right">Take-home rate</Th>
          <Th align="right">Net baseline</Th><Th align="right">+ OT</Th><Th align="right">+ On-call</Th>
          <Th align="right">+ Cert raise</Th><Th align="right">= Total</Th>
        </tr></thead>
        <tbody>
          <tr>
            <Td muted>Now</Td>
            <Td align="right" mono muted>{fmt(grossNow * payScale)}</Td>
            <Td align="right" mono muted>{Math.round(Number(whatIf.takeHomeRate) * 100)}%</Td>
            <Td align="right" mono>{fmt(payNow.baseline * payScale)}</Td>
            <Td align="right" mono>{fmt(payNow.ot * payScale)}</Td>
            <Td align="right" mono>{fmt(payNow.onCall * payScale)}</Td>
            <Td align="right" mono>{fmt(payNow.certRaise * payScale)}</Td>
            <Td align="right" mono style={{ color: TEAL }}>{fmt(payNow.total * payScale)}</Td>
          </tr>
          <tr>
            <Td muted>After next cert</Td>
            <Td align="right" mono muted>{fmt(grossNow * payScale)}</Td>
            <Td align="right" mono muted>{Math.round(Number(whatIf.takeHomeRate) * 100)}%</Td>
            <Td align="right" mono>{fmt(payAfterNextCert.baseline * payScale)}</Td>
            <Td align="right" mono>{fmt(payAfterNextCert.ot * payScale)}</Td>
            <Td align="right" mono>{fmt(payAfterNextCert.onCall * payScale)}</Td>
            <Td align="right" mono>{fmt(payAfterNextCert.certRaise * payScale)}</Td>
            <Td align="right" mono style={{ color: TEAL }}>{fmt(payAfterNextCert.total * payScale)}</Td>
          </tr>
        </tbody>
      </Table>
      <Note>
        Gross = base rate × 80 hrs per pay period{payView === "month" ? ", scaled to a monthly figure (× 26 pay periods ÷ 12 months)" : ""}.
        On-call = events/mo × $250/event, gross. OT and on-call are both taxed at the same take-home rate as
        base pay — neither is tax-free. Every number above comes from the What-if fields — change one and this
        recalculates.
      </Note>

      {changed && (
        <div style={{ display: "flex", gap: 16, alignItems: "center", margin: "18px 0 14px", fontFamily: MONO, fontSize: 12.5 }}>
          <span style={{ color: MUTE }}>vs. saved plan:</span>
          <span style={{ color: payoffDeltaPeriods > 0 ? BRICK : TEAL }}>
            payoff {payoffDeltaPeriods === null ? "—" : payoffDeltaPeriods === 0 ? "unchanged" : `${payoffDeltaPeriods > 0 ? "+" : ""}${(payoffDeltaPeriods / 2.17).toFixed(1)} mo`}
          </span>
          <span style={{ color: interestDelta > 0 ? BRICK : TEAL }}>
            interest {interestDelta >= 0 ? "+" : ""}{fmt(interestDelta)}
          </span>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: changed ? 0 : 18 }}>
        <Btn onClick={saveAssumptions} color={TEAL} primary>Save as plan</Btn>
        <Btn onClick={resetWhatIf} color={MUTE} small>reset</Btn>
      </div>
      <Note>
        "Save as plan" replaces Current Plan (saved) above with this what-if — that becomes the new committed
        baseline everyone sees. This projection models future interest on a bi-weekly schedule; it doesn't
        touch your real debt balances, which accrue interest daily on their own — see the Debts page.
        This what-if stays in place if you switch pages — use the "report" button on the Ledger page to export
        a full snapshot including it.
      </Note>
    </>
  );
}
