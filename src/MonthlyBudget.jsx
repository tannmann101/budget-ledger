import { useState, useMemo } from "react";
import { useMonthlyBudget } from "./useMonthlyBudget";
import { MONO, SANS, PAGE, INK, MUTE, LINE, BRICK, GOLD, GOLD_SOFT } from "./theme";
import { GlobalStyle, Table, Th, Td, Btn, Input, Select, SectionTitle, Card, Note } from "./ui";

// Fixed for now -- change these three numbers (they don't have to sum to any
// particular total) if the real split changes; there's no edit UI for them
// since the split itself is expected to stay stable month to month.
const BUDGET_CATEGORIES = [
  { id: "groceries", label: "Groceries", cap: 1000 },
  { id: "gas", label: "Gas", cap: 150 },
  { id: "toiletries", label: "Toiletries", cap: 250 },
];
const TOTAL_BUDGET = BUDGET_CATEGORIES.reduce((s, c) => s + c.cap, 0);
const LOW_THRESHOLD = 400;
// Test run starts in August; flip to "2026-09-01" once this is the real start.
const TRACKING_START = "2026-08-01";

const todayStr = () => new Date().toISOString().slice(0, 10);
const fmt = (n) =>
  (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const monthKeyOf = (dateStr) => dateStr.slice(0, 7);
const weekKeyOf = (dateStr) => {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().slice(0, 10);
};
const monthLabelOf = (monthKey) => {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
};
const categoryLabel = (id) => (BUDGET_CATEGORIES.find((c) => c.id === id) || {}).label || id;

export default function MonthlyBudget({ onBack, userEmail, onSignOut }) {
  const { entries, status, addEntry, removeEntry } = useMonthlyBudget(true);
  const [spendForm, setSpendForm] = useState({ categoryId: BUDGET_CATEGORIES[0].id, amount: "" });
  const [showAllLog, setShowAllLog] = useState(false);
  const [aggView, setAggView] = useState("month"); // "week" | "month" | "all"

  const now = new Date();
  const monthKey = monthKeyOf(todayStr());
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - now.getDate() + 1;
  const monthLabel = monthLabelOf(monthKey);
  const weekStart = weekKeyOf(todayStr());

  const thisMonthEntries = useMemo(() => entries.filter((e) => monthKeyOf(e.date) === monthKey), [entries, monthKey]);
  const spentByCategoryThisMonth = useMemo(() => {
    const totals = {};
    for (const c of BUDGET_CATEGORIES) totals[c.id] = 0;
    for (const e of thisMonthEntries) totals[e.category] = (totals[e.category] || 0) + Number(e.amount || 0);
    return totals;
  }, [thisMonthEntries]);
  const totalSpentThisMonth = Object.values(spentByCategoryThisMonth).reduce((s, v) => s + v, 0);
  const totalRemaining = TOTAL_BUDGET - totalSpentThisMonth;

  const thisWeekEntries = useMemo(() => entries.filter((e) => weekKeyOf(e.date) === weekStart), [entries, weekStart]);
  const totalSpentThisWeek = thisWeekEntries.reduce((s, e) => s + Number(e.amount || 0), 0);
  const weekByCategory = useMemo(() => {
    const totals = {};
    for (const c of BUDGET_CATEGORIES) totals[c.id] = 0;
    for (const e of thisWeekEntries) totals[e.category] = (totals[e.category] || 0) + Number(e.amount || 0);
    return totals;
  }, [thisWeekEntries]);

  const allTimeEntries = useMemo(() => entries.filter((e) => e.date >= TRACKING_START), [entries]);
  const allTimeTotal = allTimeEntries.reduce((s, e) => s + Number(e.amount || 0), 0);
  const allTimeByMonth = useMemo(() => {
    const totals = new Map();
    for (const e of allTimeEntries) {
      const mk = monthKeyOf(e.date);
      if (!totals.has(mk)) totals.set(mk, { month: mk, total: 0, byCategory: {} });
      const row = totals.get(mk);
      row.total += Number(e.amount || 0);
      row.byCategory[e.category] = (row.byCategory[e.category] || 0) + Number(e.amount || 0);
    }
    return [...totals.values()].sort((a, b) => b.month.localeCompare(a.month));
  }, [allTimeEntries]);

  const logSpend = () => {
    const amt = Number(spendForm.amount);
    if (!amt || !spendForm.categoryId) return;
    addEntry({ date: todayStr(), amount: amt, category: spendForm.categoryId });
    setSpendForm({ ...spendForm, amount: "" });
  };
  const deleteEntry = (id) => {
    if (!window.confirm("Delete this logged spend?")) return;
    removeEntry(id);
  };

  const sortedEntries = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  const visibleEntries = showAllLog ? sortedEntries : sortedEntries.slice(0, 30);

  return (
    <div style={{ minHeight: "100vh", background: PAGE, fontFamily: SANS }}>
      <GlobalStyle />
      <div style={{ maxWidth: 920, margin: "0 auto", padding: "32px 20px 80px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 8, borderBottom: `1px solid ${LINE}`, paddingBottom: 16, marginBottom: 4 }}>
          <div>
            <h1 style={{ fontFamily: SANS, fontSize: 21, fontWeight: 700, letterSpacing: "-0.01em", margin: 0, color: GOLD }}>Monthly Budget</h1>
            <div style={{ fontFamily: MONO, fontSize: 11.5, color: MUTE, marginTop: 3 }}>{monthLabel}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
            <Btn small color={GOLD} onClick={onBack}>&larr; Household Ledger</Btn>
            <div style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE }}>
              {userEmail} · <span onClick={onSignOut} style={{ cursor: "pointer", textDecoration: "underline" }}>sign out</span>
            </div>
          </div>
        </div>

        {status === "forbidden" && (
          <p style={{ fontFamily: MONO, fontSize: 12.5, color: BRICK, marginTop: 16 }}>
            Access denied. The Firestore rules for this feature may not be deployed yet.
          </p>
        )}

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start", marginTop: 18 }}>
          <div style={{ flex: "1 1 320px" }}>
            <SectionTitle>Log a Spend</SectionTitle>
            <Table>
              <thead><tr><Th>Category</Th><Th align="right">Amount</Th><Th align="right"> </Th></tr></thead>
              <tbody>
                <tr>
                  <Td>
                    <Select
                      value={spendForm.categoryId}
                      onChange={(v) => setSpendForm({ ...spendForm, categoryId: v })}
                      options={BUDGET_CATEGORIES.map((c) => ({ id: c.id, label: c.label }))}
                      width={150}
                    />
                  </Td>
                  <Td align="right"><Input value={spendForm.amount} onChange={(v) => setSpendForm({ ...spendForm, amount: v })} placeholder="0.00" type="number" width={90} onEnter={logSpend} /></Td>
                  <Td align="right"><Btn small color={GOLD} onClick={logSpend}>log</Btn></Td>
                </tr>
              </tbody>
            </Table>
          </div>

          <div style={{ flex: "1 1 260px" }}>
            <SectionTitle note={`${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}>This Month</SectionTitle>
            <Card tint={GOLD_SOFT}>
              <div style={{ fontFamily: MONO, fontSize: 11, color: MUTE }}>Remaining of {fmt(TOTAL_BUDGET)}</div>
              <div style={{ fontFamily: MONO, fontSize: 32, fontWeight: 700, color: totalRemaining < LOW_THRESHOLD ? BRICK : INK, marginTop: 2 }}>
                {fmt(totalRemaining)}
              </div>
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 5 }}>
                {BUDGET_CATEGORIES.map((c) => {
                  const spent = spentByCategoryThisMonth[c.id] || 0;
                  const left = c.cap - spent;
                  return (
                    <div key={c.id} style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 12.5 }}>
                      <span style={{ color: MUTE }}>{c.label}</span>
                      <span style={{ color: left < 0 ? BRICK : INK }}>{fmt(left)} / {fmt(c.cap)}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start", marginTop: 22 }}>
          <div style={{ flex: "1 1 320px" }}>
            <SectionTitle note={showAllLog ? `showing ${visibleEntries.length} of ${sortedEntries.length}` : `${sortedEntries.length} entries`}>Log</SectionTitle>
            {sortedEntries.length === 0 ? (
              <p style={{ color: MUTE, fontSize: 12.5, fontFamily: MONO }}>No spends logged yet.</p>
            ) : (
              <>
                <Table>
                  <thead><tr><Th>Date</Th><Th>Category</Th><Th align="right">Amount</Th><Th align="right"> </Th></tr></thead>
                  <tbody>
                    {visibleEntries.map((e) => (
                      <tr key={e.id}>
                        <Td mono muted>{e.date}</Td>
                        <Td>{categoryLabel(e.category)}</Td>
                        <Td align="right" mono>{fmt(Number(e.amount))}</Td>
                        <Td align="right"><Btn small color={BRICK} onClick={() => deleteEntry(e.id)}>del</Btn></Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                {sortedEntries.length > 30 && (
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                    <Btn small color={MUTE} onClick={() => setShowAllLog((v) => !v)}>
                      {showAllLog ? "show recent 30" : `show all ${sortedEntries.length}`}
                    </Btn>
                  </div>
                )}
              </>
            )}
          </div>

          <div style={{ flex: "1 1 260px" }}>
            <SectionTitle>Totals Over Time</SectionTitle>
            <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
              <Btn small color={aggView === "week" ? INK : MUTE} onClick={() => setAggView("week")}>This Week</Btn>
              <Btn small color={aggView === "month" ? INK : MUTE} onClick={() => setAggView("month")}>This Month</Btn>
              <Btn small color={aggView === "all" ? INK : MUTE} onClick={() => setAggView("all")}>All Time</Btn>
            </div>

            {aggView === "week" && (
              <Card>
                <div style={{ fontFamily: MONO, fontSize: 11, color: MUTE }}>Spent this week</div>
                <div style={{ fontFamily: MONO, fontSize: 24, fontWeight: 700, color: INK, marginTop: 2 }}>{fmt(totalSpentThisWeek)}</div>
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 5 }}>
                  {BUDGET_CATEGORIES.map((c) => (
                    <div key={c.id} style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 12.5 }}>
                      <span style={{ color: MUTE }}>{c.label}</span>
                      <span>{fmt(weekByCategory[c.id] || 0)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {aggView === "month" && (
              <Card>
                <div style={{ fontFamily: MONO, fontSize: 11, color: MUTE }}>Spent this month</div>
                <div style={{ fontFamily: MONO, fontSize: 24, fontWeight: 700, color: INK, marginTop: 2 }}>{fmt(totalSpentThisMonth)}</div>
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 5 }}>
                  {BUDGET_CATEGORIES.map((c) => (
                    <div key={c.id} style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 12.5 }}>
                      <span style={{ color: MUTE }}>{c.label}</span>
                      <span>{fmt(spentByCategoryThisMonth[c.id] || 0)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {aggView === "all" && (
              allTimeByMonth.length === 0 ? (
                <p style={{ color: MUTE, fontSize: 12.5, fontFamily: MONO }}>No spends logged since tracking began ({TRACKING_START}).</p>
              ) : (
                <>
                  <div style={{ fontFamily: MONO, fontSize: 11, color: MUTE, marginBottom: 8 }}>
                    {fmt(allTimeTotal)} total since {TRACKING_START}
                  </div>
                  <Table>
                    <thead><tr><Th>Month</Th><Th align="right">Total</Th></tr></thead>
                    <tbody>
                      {allTimeByMonth.map((row) => (
                        <tr key={row.month}>
                          <Td>{monthLabelOf(row.month)}</Td>
                          <Td align="right" mono>{fmt(row.total)}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </>
              )
            )}
          </div>
        </div>

        <Note>
          Separate from the household ledger — this budget resets to fresh category caps every month; the log itself
          keeps every entry forever so Totals Over Time can track trends across weeks and months.
        </Note>
      </div>
    </div>
  );
}
