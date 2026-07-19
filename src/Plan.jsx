import { useState, useMemo } from "react";
import { simulate, DEFAULT_ASSUMPTIONS, payBreakdown } from "./simulationEngine";
import { buildReport } from "./report";

const todayStr = () => new Date().toISOString().slice(0, 10);

const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const SANS = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
const BG = "#FFFFFF";
const INK = "#1A1A1A";
const MUTE = "#6B6B68";
const LINE = "#DEDEDA";
const HEAD_BG = "#EFEFEC";
const TEAL = "#2E6F62";
const BRICK = "#B3432B";
const GOLD = "#A5760F";

const fmt = (n) =>
  (n < 0 ? "-$" : "$") + Math.abs(Math.round(n)).toLocaleString();
const fmtDate = (d) => d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });

function Table({ children }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: SANS }}>
        {children}
      </table>
    </div>
  );
}
function Th({ children, align }) {
  return (
    <th style={{
      textAlign: align || "left", padding: "7px 10px", background: HEAD_BG, borderBottom: `1px solid ${LINE}`,
      fontSize: 11, fontWeight: 600, letterSpacing: "0.02em", color: MUTE, textTransform: "uppercase", whiteSpace: "nowrap",
    }}>{children}</th>
  );
}
function Td({ children, align, mono, muted }) {
  return (
    <td style={{
      textAlign: align || "left", padding: "7px 10px", borderBottom: `1px solid ${LINE}`,
      fontFamily: mono ? MONO : SANS, color: muted ? MUTE : INK, whiteSpace: "nowrap",
    }}>{children}</td>
  );
}
function Btn({ onClick, children, color = TEAL, small }) {
  return (
    <button onClick={onClick} style={{
      border: `1px solid ${color}`, background: "transparent", color, fontFamily: MONO,
      fontSize: small ? 11 : 12, padding: small ? "3px 7px" : "5px 10px", borderRadius: 4, cursor: "pointer", whiteSpace: "nowrap",
    }}>{children}</button>
  );
}
function Input({ value, onChange, placeholder, width, type = "text" }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      type={type}
      inputMode={type === "number" ? "decimal" : undefined}
      style={{
        border: `1px solid ${LINE}`, borderRadius: 4, padding: "4px 6px", fontSize: 12.5,
        fontFamily: type === "number" ? MONO : SANS, color: INK, width: width || 90, background: BG,
      }}
    />
  );
}
function SectionTitle({ children, note }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "30px 0 8px", gap: 10, flexWrap: "wrap" }}>
      <h2 style={{ fontFamily: SANS, fontSize: 15, fontWeight: 700, color: INK, margin: 0, textTransform: "uppercase", letterSpacing: "0.03em" }}>{children}</h2>
      {note && <span style={{ fontFamily: MONO, fontSize: 11.5, color: MUTE }}>{note}</span>}
    </div>
  );
}

// Hand-rolled SVG chart, same approach as App.jsx's TrendChart — no chart library.
function PlanChart({ rows, whatIfRows }) {
  const W = 700, H = 230, PAD_L = 58, PAD_R = 14, PAD_T = 14, PAD_B = 26;
  const innerW = W - PAD_L - PAD_R, innerH = H - PAD_T - PAD_B;
  const all = [...rows.map((r) => r.debt), ...(whatIfRows ? whatIfRows.map((r) => r.debt) : [])];
  const max = Math.max(...all, 1);
  const n = Math.max(rows.length, whatIfRows ? whatIfRows.length : 0);
  const x = (i) => PAD_L + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v) => PAD_T + innerH - (v / max) * innerH;
  const path = (arr) => arr.map((r, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(r.debt).toFixed(1)}`).join(" ");
  const gridLines = 4;
  const step = Math.max(1, Math.ceil(n / 8));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 460, display: "block" }}>
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
      {rows.map((r, i) => i % step === 0 || i === rows.length - 1 ? (
        <text key={i} x={x(i)} y={H - 7} textAnchor="middle" fontFamily={MONO} fontSize="9.5" fill={MUTE}>{fmtDate(r.date)}</text>
      ) : null)}
      <path d={path(rows)} fill="none" stroke={TEAL} strokeWidth="2" />
      {whatIfRows && <path d={path(whatIfRows)} fill="none" stroke={GOLD} strokeWidth="2" strokeDasharray="4 3" />}
    </svg>
  );
}

export default function Plan({ data, save }) {
  const assumptions = { ...DEFAULT_ASSUMPTIONS, ...(data.assumptions || {}) };
  const [whatIf, setWhatIf] = useState(assumptions);

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
    save({ ...data, assumptions: whatIf });
  };
  const resetWhatIf = () => setWhatIf(assumptions);

  const downloadReport = () => {
    const md = buildReport({ data, plan, whatIfPlan, changed, assumptions, whatIf });
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `household-ledger-report-${todayStr()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Btn small onClick={downloadReport}>Generate Report</Btn>
      </div>
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
      <div style={{ marginTop: 12 }}>
        <PlanChart rows={plan.rows} whatIfRows={changed ? whatIfPlan.rows : null} />
      </div>
      <p style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, margin: "6px 0 0" }}>
        <span style={{ color: TEAL }}>■</span> saved plan
        {changed && <> &nbsp; <span style={{ color: GOLD }}>■</span> what-if (not saved)</>}
      </p>

      <SectionTitle note="adjust and preview before saving — this is a scratch preview, not saved until you click below">What-if</SectionTitle>
      <div style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, textTransform: "uppercase", letterSpacing: "0.03em", margin: "0 0 6px" }}>Pay</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 14 }}>
        {field("baseHourlyRate", "Base rate ($/hr)", 80)}
        {field("takeHomeRate", "Take-home rate (0-1)", 90)}
        {field("otHoursPerPeriod", "OT hrs/pay period", 80)}
        {field("otNetPerHour", "OT rate ($/hr)", 80)}
        {field("certCadenceDays", "Cert cadence (days)")}
        {field("certRaiseMonthly", "Cert raise ($/mo)", 90)}
        {field("certBonusAmount", "Cert bonus ($)", 90)}
      </div>
      <div style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, textTransform: "uppercase", letterSpacing: "0.03em", margin: "0 0 6px" }}>Debt &amp; Bills</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 14 }}>
        {field("fixedBillsMonthly", "Fixed bills ($/mo)", 100)}
        {field("extraDebtPaymentPerPeriod", "Extra debt pmt ($/period)", 100)}
        {field("allocationSplit", "Split to debt (0-1)", 80)}
      </div>

      <SectionTitle note="how net pay per period is actually calculated — no black boxing">Pay Calculation</SectionTitle>
      <Table>
        <thead><tr>
          <Th> </Th><Th align="right">Gross (rate × 80hr)</Th><Th align="right">Take-home rate</Th>
          <Th align="right">Net baseline</Th><Th align="right">+ OT</Th><Th align="right">+ Cert raise</Th><Th align="right">= Total</Th>
        </tr></thead>
        <tbody>
          <tr>
            <Td muted>Now</Td>
            <Td align="right" mono muted>{fmt(grossNow)}</Td>
            <Td align="right" mono muted>{Math.round(Number(whatIf.takeHomeRate) * 100)}%</Td>
            <Td align="right" mono>{fmt(payNow.baseline)}</Td>
            <Td align="right" mono>{fmt(payNow.ot)}</Td>
            <Td align="right" mono>{fmt(payNow.certRaise)}</Td>
            <Td align="right" mono style={{ color: TEAL }}>{fmt(payNow.total)}</Td>
          </tr>
          <tr>
            <Td muted>After next cert</Td>
            <Td align="right" mono muted>{fmt(grossNow)}</Td>
            <Td align="right" mono muted>{Math.round(Number(whatIf.takeHomeRate) * 100)}%</Td>
            <Td align="right" mono>{fmt(payAfterNextCert.baseline)}</Td>
            <Td align="right" mono>{fmt(payAfterNextCert.ot)}</Td>
            <Td align="right" mono>{fmt(payAfterNextCert.certRaise)}</Td>
            <Td align="right" mono style={{ color: TEAL }}>{fmt(payAfterNextCert.total)}</Td>
          </tr>
        </tbody>
      </Table>
      <p style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, margin: "6px 0 14px" }}>
        Doesn't include on-call pay, which cycles per period (250/250/125/250/125, a placeholder) rather than
        being a flat rate. Every number above comes from the What-if fields — change one and this recalculates.
      </p>

      {changed && (
        <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 14, fontFamily: MONO, fontSize: 12.5 }}>
          <span style={{ color: MUTE }}>vs. saved plan:</span>
          <span style={{ color: payoffDeltaPeriods > 0 ? BRICK : TEAL }}>
            payoff {payoffDeltaPeriods === null ? "—" : payoffDeltaPeriods === 0 ? "unchanged" : `${payoffDeltaPeriods > 0 ? "+" : ""}${(payoffDeltaPeriods / 2.17).toFixed(1)} mo`}
          </span>
          <span style={{ color: interestDelta > 0 ? BRICK : TEAL }}>
            interest {interestDelta >= 0 ? "+" : ""}{fmt(interestDelta)}
          </span>
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <Btn onClick={saveAssumptions} color={TEAL}>Save as plan</Btn>
        <Btn onClick={resetWhatIf} color={MUTE} small>reset</Btn>
      </div>
      <p style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, marginTop: 10 }}>
        "Save as plan" replaces Current Plan (saved) above with this what-if — that becomes the new committed
        baseline everyone sees. This projection models future interest on a bi-weekly schedule; it doesn't
        touch your real debt balances, which accrue interest daily on their own — see the Debts page.
      </p>
    </>
  );
}
