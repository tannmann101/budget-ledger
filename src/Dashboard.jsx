import { useState, useMemo } from "react";
import { accrueDebt } from "./debtAccrual";
import { DEFAULT_ASSUMPTIONS, payBreakdown } from "./simulationEngine";
import { MONO, INK, MUTE, LINE, HEAD_BG, TEAL, GOLD, BRICK, RADIUS_SM } from "./theme";
import { Table, Th, Td, Btn, Input, SectionTitle, Card, Note, StatRow } from "./ui";

const uid = () => Math.random().toString(36).slice(2, 10);
const todayStr = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };

const fmt = (n) =>
  (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtShort = (n) => (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 });

/* ---------- balance / net worth trend ---------- */

const SERIES = [
  { key: "checking", label: "Checking", color: TEAL },
  { key: "savings", label: "Savings", color: GOLD },
  { key: "debt", label: "Debt", color: BRICK },
  { key: "netWorth", label: "Net worth", color: MUTE },
];
const RANGE_DAYS = { day: 60, week: 182, month: 730, quarter: 1095, year: 1825 };

function addPeriod(date, granularity) {
  const d = new Date(date);
  if (granularity === "day") d.setDate(d.getDate() + 1);
  else if (granularity === "week") d.setDate(d.getDate() + 7);
  else if (granularity === "month") d.setMonth(d.getMonth() + 1);
  else if (granularity === "quarter") d.setMonth(d.getMonth() + 3);
  else if (granularity === "year") d.setFullYear(d.getFullYear() + 1);
  return d;
}
function labelFor(date, granularity) {
  if (granularity === "day" || granularity === "week") return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (granularity === "month") return date.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
  if (granularity === "quarter") return `Q${Math.floor(date.getMonth() / 3) + 1} '${String(date.getFullYear()).slice(2)}`;
  return String(date.getFullYear());
}
function buildTrendPoints(history, granularity) {
  if (!history || history.length === 0) return [];
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const cutoff = daysAgo(RANGE_DAYS[granularity]);
  const firstDate = new Date(sorted[0].date);
  const start = firstDate > cutoff ? firstDate : cutoff;
  const today = new Date();
  const points = [];
  let cursor = new Date(start);
  let guard = 0;
  while (cursor <= today && guard < 600) {
    guard++;
    const dateStr = cursor.toISOString().slice(0, 10);
    let entry = null;
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (sorted[i].date <= dateStr) { entry = sorted[i]; break; }
    }
    if (entry) {
      points.push({
        date: dateStr, checking: entry.checking, savings: entry.savings, debt: entry.debt || 0,
        netWorth: entry.checking + entry.savings - (entry.debt || 0), label: labelFor(cursor, granularity),
      });
    }
    cursor = addPeriod(cursor, granularity);
  }
  return points;
}

function TrendChart({ data, activeSeries }) {
  const W = 700, H = 230, PAD_L = 58, PAD_R = 14, PAD_T = 14, PAD_B = 26;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  const allVals = data.flatMap((d) => activeSeries.map((s) => d[s.key]));
  const max = Math.max(...allVals, 1);
  const min = Math.min(...allVals, 0);
  const span = max - min || 1;
  const x = (i) => PAD_L + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v) => PAD_T + innerH - ((v - min) / span) * innerH;
  const path = (key) => data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(d[key]).toFixed(1)}`).join(" ");
  const [hover, setHover] = useState(null);
  const gridLines = 4;
  const step = Math.max(1, Math.ceil(data.length / 7));

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 460, display: "block" }} onMouseLeave={() => setHover(null)}>
        {Array.from({ length: gridLines + 1 }).map((_, i) => {
          const gy = PAD_T + (innerH / gridLines) * i;
          const val = max - (span / gridLines) * i;
          return (
            <g key={i}>
              <line x1={PAD_L} x2={W - PAD_R} y1={gy} y2={gy} stroke={LINE} />
              <text x={PAD_L - 6} y={gy + 3} textAnchor="end" fontFamily={MONO} fontSize="10" fill={MUTE}>{fmtShort(val)}</text>
            </g>
          );
        })}
        {data.map((d, i) => i % step === 0 || i === data.length - 1 ? (
          <text key={i} x={x(i)} y={H - 7} textAnchor="middle" fontFamily={MONO} fontSize="9.5" fill={MUTE}>{d.label}</text>
        ) : null)}
        {activeSeries.map((s) => <path key={s.key} d={path(s.key)} fill="none" stroke={s.color} strokeWidth="2" />)}
        {data.map((d, i) => (
          <rect key={i} x={x(i) - innerW / Math.max(data.length - 1, 1) / 2} y={PAD_T}
            width={innerW / Math.max(data.length - 1, 1)} height={innerH} fill="transparent" onMouseEnter={() => setHover(i)} />
        ))}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={PAD_T} y2={PAD_T + innerH} stroke={INK} strokeOpacity="0.2" />
            {activeSeries.map((s) => <circle key={s.key} cx={x(hover)} cy={y(data[hover][s.key])} r="3.5" fill={s.color} />)}
          </g>
        )}
      </svg>
      {hover !== null && (
        <Card tint={HEAD_BG} style={{ marginTop: 8, display: "flex", gap: 12, flexWrap: "wrap", fontFamily: MONO, fontSize: 11.5, color: INK, padding: "8px 12px" }}>
          <span style={{ color: MUTE }}>{data[hover].label}</span>
          {activeSeries.map((s) => <span key={s.key} style={{ color: s.color }}>{s.label} {fmt(data[hover][s.key])}</span>)}
        </Card>
      )}
    </div>
  );
}

/* ---------- category spending trend (interactive, "so far" for the current period) ---------- */

function periodKey(dateStr, granularity) {
  if (granularity === "day") return dateStr;
  if (granularity === "week") {
    const d = new Date(dateStr + "T00:00:00");
    d.setDate(d.getDate() - d.getDay());
    return d.toISOString().slice(0, 10);
  }
  if (granularity === "month") return dateStr.slice(0, 7);
  if (granularity === "quarter") {
    const [y, m] = dateStr.split("-").map(Number);
    return `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
  }
  return dateStr.slice(0, 4);
}
function periodLabel(key, granularity) {
  if (granularity === "day") return new Date(key + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (granularity === "week") return `wk of ${new Date(key + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  if (granularity === "month") {
    const [y, m] = key.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "short", year: "2-digit" });
  }
  if (granularity === "quarter") {
    const [y, q] = key.split("-Q");
    return `${q}Q '${y.slice(2)}`;
  }
  return key;
}
// categoryId is stamped on transactions logged going forward; older entries
// only carry the category's name as free-text description, so fall back to
// matching on that for full historical coverage.
function buildCategoryTrend(data, granularity, categories) {
  const catByName = new Map(categories.map((c) => [c.name, c.id]));
  const cutoff = daysAgo(RANGE_DAYS[granularity]);
  const buckets = new Map();
  for (const t of data.transactions || []) {
    if (t.type !== "expense" || !t.date) continue;
    if (new Date(t.date) < cutoff) continue;
    const catId = t.categoryId || catByName.get(t.description);
    if (!catId) continue;
    const key = periodKey(t.date, granularity);
    if (!buckets.has(key)) buckets.set(key, { key, label: periodLabel(key, granularity) });
    const bucket = buckets.get(key);
    bucket[catId] = (bucket[catId] || 0) + Math.abs(Number(t.amount || 0));
  }
  return [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key));
}
// A curated cycle rather than raw HSL rotation -- every hue sits at the same
// muted saturation/lightness as the theme's own TEAL/BRICK/GOLD, so any mix
// of active categories still reads as one coherent palette instead of a
// clashing rainbow.
const CATEGORY_PALETTE = [
  TEAL, BRICK, GOLD, "#3A5A8C", "#7A3B69", "#5B6B2E", "#8C4B2E", "#2E6B6B", "#6B4423", "#4A5568",
];
function categoryColor(index) {
  return CATEGORY_PALETTE[index % CATEGORY_PALETTE.length];
}
function topCategoriesByRecentSpend(data, categories, n) {
  const totals = new Map();
  for (const t of data.transactions || []) {
    if (t.type !== "expense") continue;
    const catByName = new Map(categories.map((c) => [c.name, c.id]));
    const catId = t.categoryId || catByName.get(t.description);
    if (!catId) continue;
    totals.set(catId, (totals.get(catId) || 0) + Math.abs(Number(t.amount || 0)));
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([id]) => id);
}

function CategoryTrendChart({ data, categories }) {
  const W = 700, H = 240, PAD_L = 58, PAD_R = 14, PAD_T = 14, PAD_B = 34;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  const totals = data.map((d) => categories.reduce((s, c) => s + (d[c.id] || 0), 0));
  const max = Math.max(...totals, 1);
  const groupW = innerW / data.length;
  const barW = Math.min(34, groupW * 0.6);
  const x = (i) => PAD_L + groupW * i + groupW / 2;
  const y = (v) => PAD_T + innerH - (v / max) * innerH;
  const [hover, setHover] = useState(null);
  const gridLines = 4;

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 460, display: "block" }} onMouseLeave={() => setHover(null)}>
        {Array.from({ length: gridLines + 1 }).map((_, i) => {
          const gy = PAD_T + (innerH / gridLines) * i;
          const val = max - (max / gridLines) * i;
          return (
            <g key={i}>
              <line x1={PAD_L} x2={W - PAD_R} y1={gy} y2={gy} stroke={LINE} />
              <text x={PAD_L - 6} y={gy + 3} textAnchor="end" fontFamily={MONO} fontSize="10" fill={MUTE}>{fmtShort(val)}</text>
            </g>
          );
        })}
        {data.map((d, i) => {
          let yCursor = y(0);
          return (
            <g key={d.key} onMouseEnter={() => setHover(i)}>
              {categories.map((c) => {
                const v = d[c.id] || 0;
                if (v <= 0) return null;
                const h = (v / max) * innerH;
                yCursor -= h;
                return <rect key={c.id} x={x(i) - barW / 2} y={yCursor} width={barW} height={h} rx={2} fill={c.color} />;
              })}
              <rect x={x(i) - groupW / 2} y={PAD_T} width={groupW} height={innerH} fill="transparent" />
              <text x={x(i)} y={H - 14} textAnchor="middle" fontFamily={MONO} fontSize="9.5" fill={MUTE}>{d.label}</text>
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <Card tint={HEAD_BG} style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap", fontFamily: MONO, fontSize: 11.5, color: INK, padding: "8px 12px" }}>
          <span style={{ color: MUTE }}>{data[hover].label}</span>
          {categories.filter((c) => data[hover][c.id]).map((c) => (
            <span key={c.id} style={{ color: c.color }}>{c.name} {fmt(data[hover][c.id])}</span>
          ))}
        </Card>
      )}
    </div>
  );
}

/* ---------- monthly income vs spending ---------- */

function buildMonthlySummary(data) {
  const totals = new Map();
  const bump = (month, key, amount) => {
    if (!month) return;
    if (!totals.has(month)) totals.set(month, { month, income: 0, spending: 0 });
    // Math.abs sidesteps inconsistent sign conventions between historical and
    // live-logged transactions — safe here since we only need spend magnitude.
    totals.get(month)[key] += Math.abs(Number(amount || 0));
  };
  for (const p of data.income || []) bump(p.date?.slice(0, 7), "income", p.amount);
  for (const t of data.transactions || []) {
    if (t.type === "expense" || t.type === "bill") bump(t.date?.slice(0, 7), "spending", t.amount);
  }
  return [...totals.values()].sort((a, b) => a.month.localeCompare(b.month));
}
function monthLabel(monthStr) {
  const [y, m] = monthStr.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}
function MonthlyBarChart({ data }) {
  const W = 700, H = 220, PAD_L = 58, PAD_R = 14, PAD_T = 14, PAD_B = 34;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  const max = Math.max(...data.flatMap((d) => [d.income, d.spending]), 1);
  const groupW = innerW / data.length;
  const barW = Math.min(20, groupW * 0.32);
  const x = (i) => PAD_L + groupW * i + groupW / 2;
  const y = (v) => PAD_T + innerH - (v / max) * innerH;
  const barH = (v) => (v / max) * innerH;
  const [hover, setHover] = useState(null);
  const gridLines = 4;

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 460, display: "block" }} onMouseLeave={() => setHover(null)}>
        {Array.from({ length: gridLines + 1 }).map((_, i) => {
          const gy = PAD_T + (innerH / gridLines) * i;
          const val = max - (max / gridLines) * i;
          return (
            <g key={i}>
              <line x1={PAD_L} x2={W - PAD_R} y1={gy} y2={gy} stroke={LINE} />
              <text x={PAD_L - 6} y={gy + 3} textAnchor="end" fontFamily={MONO} fontSize="10" fill={MUTE}>{fmtShort(val)}</text>
            </g>
          );
        })}
        {data.map((d, i) => (
          <g key={d.month} onMouseEnter={() => setHover(i)}>
            <rect x={x(i) - barW - 2} y={y(d.income)} width={barW} height={Math.max(barH(d.income), 0)} rx={2} fill={TEAL} />
            <rect x={x(i) + 2} y={y(d.spending)} width={barW} height={Math.max(barH(d.spending), 0)} rx={2} fill={BRICK} />
            <rect x={x(i) - groupW / 2} y={PAD_T} width={groupW} height={innerH} fill="transparent" />
            <text x={x(i)} y={H - 14} textAnchor="middle" fontFamily={MONO} fontSize="9.5" fill={MUTE}>{monthLabel(d.month)}</text>
          </g>
        ))}
      </svg>
      {hover !== null && (
        <Card tint={HEAD_BG} style={{ marginTop: 8, display: "flex", gap: 12, flexWrap: "wrap", fontFamily: MONO, fontSize: 11.5, color: INK, padding: "8px 12px" }}>
          <span style={{ color: MUTE }}>{monthLabel(data[hover].month)}</span>
          <span style={{ color: TEAL }}>Income {fmt(data[hover].income)}</span>
          <span style={{ color: BRICK }}>Spending {fmt(data[hover].spending)}</span>
        </Card>
      )}
    </div>
  );
}

/* ---------- main ---------- */

const PAY_FIELDS = [
  { key: "baseHourlyRate", label: "Base hourly rate" },
  { key: "takeHomeRate", label: "Take-home rate (0–1)" },
  { key: "otHoursPerPeriod", label: "OT hours / period" },
  { key: "otHourlyRate", label: "OT hourly rate" },
  { key: "onCallEventsPerMonth", label: "On-call / Sat shift events per month" },
];

export default function Dashboard({ data, commit }) {
  const [newBill, setNewBill] = useState({ name: "", amount: "", day: "" });
  const [draft, setDraft] = useState({});
  const [payDraft, setPayDraft] = useState({});
  const [payView, setPayView] = useState("period");
  const [granularity, setGranularity] = useState("week");
  const [activeKeys, setActiveKeys] = useState(["checking", "savings", "netWorth"]);
  const [catGranularity, setCatGranularity] = useState("month");
  // null = no manual selection yet, fall back to the computed default below.
  // Transactions load asynchronously via a separate subcollection listener,
  // so a plain useState(() => topCategories...) lazy initializer can run
  // before that data arrives and get stuck on an empty result forever.
  const [activeCatIds, setActiveCatIds] = useState(null);

  const totalDebt = data.debts.reduce((s, d) => s + accrueDebt(d, todayStr()).balance, 0);
  const netWorth = Number(data.checking) + Number(data.savings) - totalDebt;
  const staticBills = data.staticBills || [];
  const totalStaticBills = staticBills.reduce((s, b) => s + Number(b.amount || 0), 0);

  const chartData = useMemo(() => buildTrendPoints(data.history, granularity), [data, granularity]);
  const toggleSeries = (key) => setActiveKeys((k) => k.includes(key) ? k.filter((x) => x !== key) : [...k, key]);
  const activeSeries = SERIES.filter((s) => activeKeys.includes(s.key));

  const categoryTrend = useMemo(() => buildCategoryTrend(data, catGranularity, data.categories), [data, catGranularity]);
  const defaultCatIds = useMemo(() => topCategoriesByRecentSpend(data, data.categories, 5), [data]);
  const effectiveCatIds = activeCatIds ?? defaultCatIds;
  const toggleCat = (id) => setActiveCatIds((k) => (k ?? defaultCatIds).includes(id) ? (k ?? defaultCatIds).filter((x) => x !== id) : [...(k ?? defaultCatIds), id]);
  const activeCategories = data.categories
    .map((c, i) => ({ ...c, color: categoryColor(i) }))
    .filter((c) => effectiveCatIds.includes(c.id));

  const monthlySummary = useMemo(() => buildMonthlySummary(data), [data]);

  const assumptions = { ...DEFAULT_ASSUMPTIONS, ...(data.assumptions || {}) };
  const pay = payBreakdown(assumptions);
  const payScale = payView === "month" ? 26 / 12 : 1;

  const addBill = () => {
    if (!newBill.name || !newBill.amount) return;
    const bill = { id: uid(), name: newBill.name, amount: Number(newBill.amount), day: newBill.day };
    commit({ main: (serverMain) => ({ staticBills: [...(serverMain.staticBills || []), bill] }) });
    setNewBill({ name: "", amount: "", day: "" });
  };
  const removeBill = (id) => {
    commit({ main: (serverMain) => ({ staticBills: (serverMain.staticBills || []).filter((b) => b.id !== id) }) });
  };
  const commitBill = (id) => {
    const d = draft[id];
    if (!d) return;
    commit({
      main: (serverMain) => ({
        staticBills: (serverMain.staticBills || []).map((b) => b.id === id
          ? {
              ...b,
              name: d.name === "" || d.name === undefined ? b.name : d.name,
              amount: d.amount === "" || d.amount === undefined ? b.amount : Number(d.amount),
              day: d.day ?? b.day,
            }
          : b),
      }),
    });
    setDraft({ ...draft, [id]: undefined });
  };

  const commitPay = () => {
    if (Object.keys(payDraft).length === 0) return;
    commit({
      main: (serverMain) => {
        const serverAssumptions = { ...DEFAULT_ASSUMPTIONS, ...(serverMain.assumptions || {}) };
        const next = { ...serverAssumptions };
        for (const [k, v] of Object.entries(payDraft)) {
          if (v === "" || v === undefined) continue;
          next[k] = Number(v);
        }
        return { assumptions: next };
      },
    });
    setPayDraft({});
  };

  return (
    <>
      <SectionTitle>Current Balances</SectionTitle>
      <StatRow stats={[
        { label: "Checking", value: fmt(Number(data.checking)), color: TEAL },
        { label: "Savings", value: fmt(Number(data.savings)), color: TEAL },
        { label: "Total Debt", value: fmt(totalDebt), color: BRICK },
        { label: "Net Worth", value: fmt(netWorth), color: netWorth < 0 ? BRICK : TEAL },
      ]} />

      {/* Pay reference */}
      <SectionTitle note="editable — enter your current numbers straight from your paystub">Pay Reference</SectionTitle>
      <Table>
        <thead><tr><Th>Field</Th><Th align="right">Value</Th></tr></thead>
        <tbody>
          {PAY_FIELDS.map((f) => (
            <tr key={f.key}>
              <Td>{f.label}</Td>
              <Td align="right">
                <Input
                  value={payDraft[f.key] ?? String(assumptions[f.key])}
                  onChange={(v) => setPayDraft({ ...payDraft, [f.key]: v })}
                  type="number" width={90} onEnter={commitPay}
                />
              </Td>
            </tr>
          ))}
          <tr>
            <Td muted>Fixed bills (from Static Bills, below)</Td>
            <Td align="right" mono muted>{fmt(totalStaticBills)}</Td>
          </tr>
        </tbody>
      </Table>
      <div style={{ margin: "8px 0 18px" }}>
        <Btn small primary onClick={commitPay}>save pay info</Btn>
      </div>

      <SectionTitle note="today's actual pay rate and on-call schedule, no assumed raises">Pay Calculation</SectionTitle>
      <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
        <Btn small color={payView === "period" ? INK : MUTE} onClick={() => setPayView("period")}>Per Period</Btn>
        <Btn small color={payView === "month" ? INK : MUTE} onClick={() => setPayView("month")}>Per Month</Btn>
      </div>
      <Table>
        <thead><tr><Th>Row</Th><Th align="right">Baseline</Th><Th align="right">OT</Th><Th align="right">On-call</Th><Th align="right">Total</Th></tr></thead>
        <tbody>
          <tr>
            <Td>Now</Td>
            <Td align="right" mono>{fmt(pay.baseline * payScale)}</Td>
            <Td align="right" mono>{fmt(pay.ot * payScale)}</Td>
            <Td align="right" mono>{fmt(pay.onCall * payScale)}</Td>
            <Td align="right" mono>{fmt(pay.total * payScale)}</Td>
          </tr>
        </tbody>
      </Table>

      {/* Balance & net worth trend */}
      <SectionTitle>Balance &amp; Net Worth Trend</SectionTitle>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {["day", "week", "month", "quarter", "year"].map((g) => (
            <Btn key={g} small color={granularity === g ? INK : MUTE} onClick={() => setGranularity(g)}>{g}</Btn>
          ))}
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {SERIES.map((s) => (
            <span key={s.key} onClick={() => toggleSeries(s.key)} style={{
              cursor: "pointer", fontFamily: MONO, fontSize: 11, padding: "4px 9px", borderRadius: RADIUS_SM,
              border: `1px solid ${s.color}`, color: activeKeys.includes(s.key) ? "#FFF" : s.color,
              background: activeKeys.includes(s.key) ? s.color : "transparent", transition: "120ms ease",
            }}>{s.label}</span>
          ))}
        </div>
      </div>
      {chartData.length < 2 || activeSeries.length === 0 ? (
        <p style={{ color: MUTE, fontSize: 12.5, fontFamily: MONO }}>{activeSeries.length === 0 ? "Pick at least one series above." : "This needs at least 2 different days of activity to draw a line — check back tomorrow."}</p>
      ) : (
        <Card><TrendChart data={chartData} activeSeries={activeSeries} /></Card>
      )}

      {/* Category spending trend */}
      <SectionTitle note="includes the current period so far, not just completed ones">Category Spending</SectionTitle>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
        {["day", "week", "month", "quarter", "year"].map((g) => (
          <Btn key={g} small color={catGranularity === g ? INK : MUTE} onClick={() => setCatGranularity(g)}>{g}</Btn>
        ))}
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
        {data.categories.map((c, i) => {
          const color = categoryColor(i);
          const active = effectiveCatIds.includes(c.id);
          return (
            <span key={c.id} onClick={() => toggleCat(c.id)} style={{
              cursor: "pointer", fontFamily: MONO, fontSize: 10.5, padding: "3px 8px", borderRadius: RADIUS_SM,
              border: `1px solid ${color}`, color: active ? "#FFF" : color,
              background: active ? color : "transparent", transition: "120ms ease",
            }}>{c.name}</span>
          );
        })}
      </div>
      {categoryTrend.length === 0 || activeCategories.length === 0 ? (
        <p style={{ color: MUTE, fontSize: 12.5, fontFamily: MONO }}>{activeCategories.length === 0 ? "Pick at least one category above." : "Log some category spending to see this."}</p>
      ) : (
        <Card><CategoryTrendChart data={categoryTrend} categories={activeCategories} /></Card>
      )}

      {/* Monthly income vs spending */}
      <SectionTitle note="from logged income, expenses & paid bills">Income vs Spending</SectionTitle>
      {monthlySummary.length === 0 ? (
        <p style={{ color: MUTE, fontSize: 12.5, fontFamily: MONO }}>Log some income or expenses to see this.</p>
      ) : (
        <Card><MonthlyBarChart data={monthlySummary} /></Card>
      )}

      {/* Static bills reference */}
      <SectionTitle note={`${fmt(totalStaticBills)} / cycle`}>Static Bills</SectionTitle>
      <Note>
        Editable snapshot of your recurring bills for reference — amount and timeframe are freely adjustable. This
        list doesn't pay anything, track paid/unpaid status, or touch your checking, savings, or debt balances. It
        also feeds the Plan page's "Fixed bills" figure, so the debt-free projection below always matches what's here.
      </Note>
      <Table>
        <thead><tr><Th>Bill</Th><Th align="right">Amount</Th><Th>Timeframe</Th><Th align="right"> </Th></tr></thead>
        <tbody>
          {staticBills.map((b) => {
            const d = draft[b.id] || {};
            return (
              <tr key={b.id}>
                <Td>
                  <Input value={d.name ?? b.name} onChange={(v) => setDraft({ ...draft, [b.id]: { ...d, name: v } })} width={130} onEnter={() => commitBill(b.id)} />
                </Td>
                <Td align="right">
                  <Input
                    value={d.amount ?? String(b.amount)}
                    onChange={(v) => setDraft({ ...draft, [b.id]: { ...d, amount: v } })}
                    type="number" width={80} onEnter={() => commitBill(b.id)}
                  />
                </Td>
                <Td>
                  <Input
                    value={d.day ?? b.day}
                    onChange={(v) => setDraft({ ...draft, [b.id]: { ...d, day: v } })}
                    width={130} onEnter={() => commitBill(b.id)}
                  />
                </Td>
                <Td align="right">
                  <Btn small onClick={() => commitBill(b.id)}>save</Btn>{" "}
                  <Btn small color={BRICK} onClick={() => removeBill(b.id)}>del</Btn>
                </Td>
              </tr>
            );
          })}
          <tr>
            <Td><Input value={newBill.name} onChange={(v) => setNewBill({ ...newBill, name: v })} placeholder="New bill name" width={150} /></Td>
            <Td align="right"><Input value={newBill.amount} onChange={(v) => setNewBill({ ...newBill, amount: v })} placeholder="0.00" type="number" width={80} /></Td>
            <Td><Input value={newBill.day} onChange={(v) => setNewBill({ ...newBill, day: v })} placeholder="e.g. around 15th" width={130} /></Td>
            <Td align="right"><Btn small onClick={addBill}>add</Btn></Td>
          </tr>
        </tbody>
      </Table>

    </>
  );
}
