import { useState, Fragment } from "react";
import { accrueDebt } from "./debtAccrual";
import { MONO, MUTE, LINE, HEAD_BG, BRICK, GOLD } from "./theme";
import { Table, Th, Td, Btn, Input, Select, SectionTitle, Note } from "./ui";

const uid = () => Math.random().toString(36).slice(2, 10);
const todayStr = () => new Date().toISOString().slice(0, 10);

const fmt = (n) =>
  (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// One history doc per day (upserted by date) -- see App.jsx's historyEntry, same pattern.
function historyEntry(nextData) {
  const today = todayStr();
  const debtTotal = (nextData.debts || []).reduce((s, d) => s + accrueDebt(d, today).balance, 0);
  return { date: today, checking: Number(nextData.checking), savings: Number(nextData.savings), debt: debtTotal };
}
function sourceLabel(sourceId, options) {
  const opt = options.find((o) => o.id === sourceId);
  return opt ? opt.label : "Checking";
}

export default function Debts({ data, commit }) {
  const [newDebt, setNewDebt] = useState({ name: "", balance: "", rate: "", minPayment: "", creditLimit: "" });
  const [debtPay, setDebtPay] = useState({});
  const [debtCorrect, setDebtCorrect] = useState({});

  const totalDebt = data.debts.reduce((s, d) => s + accrueDebt(d, todayStr()).balance, 0);
  const sourceOptionsBase = [{ id: "checking", label: "Checking" }, ...data.debts.map((d) => ({ id: d.id, label: d.name }))];
  const debtNameById = (id) => (data.debts.find((d) => d.id === id) || {}).name || id;

  const addDebt = () => {
    if (!newDebt.name || !newDebt.balance) return;
    const debt = {
      id: uid(), name: newDebt.name, balance: Number(newDebt.balance),
      rate: newDebt.rate ? Number(newDebt.rate) : null,
      minPayment: newDebt.minPayment ? Number(newDebt.minPayment) : null,
      creditLimit: newDebt.creditLimit ? Number(newDebt.creditLimit) : null,
      lastUpdated: todayStr(), totalPaid: 0, totalCharged: 0,
    };
    const nextDebts = [...data.debts, debt];
    commit({ main: { debts: nextDebts }, add: { history: [historyEntry({ ...data, debts: nextDebts })] } });
    setNewDebt({ name: "", balance: "", rate: "", minPayment: "", creditLimit: "" });
  };
  const removeDebt = (id) => {
    if (!window.confirm(`Delete "${debtNameById(id)}"? This removes the account and its history from the ledger.`)) return;
    const nextDebts = data.debts.filter((d) => d.id !== id);
    commit({ main: { debts: nextDebts }, add: { history: [historyEntry({ ...data, debts: nextDebts })] } });
  };
  const payDebt = (id) => {
    const cfg = debtPay[id] || {};
    const amount = Number(cfg.amount);
    const source = cfg.source || "checking";
    if (!amount) return;
    const today = todayStr();
    let nextChecking = Number(data.checking);
    const nextDebts = data.debts.map((d) => {
      let nd = d;
      if (d.id === id) {
        nd = accrueDebt(nd, today);
        nd = { ...nd, balance: Math.max(0, nd.balance - amount), totalPaid: (nd.totalPaid || 0) + amount };
      }
      if (source !== "checking" && d.id === source) {
        nd = accrueDebt(nd, today);
        nd = { ...nd, balance: nd.balance + amount, totalCharged: (nd.totalCharged || 0) + amount };
      }
      return nd;
    });
    if (source === "checking") nextChecking -= amount;
    const next = { ...data, debts: nextDebts, checking: nextChecking };
    commit({
      main: { debts: nextDebts, checking: nextChecking },
      add: {
        transactions: [{ date: today, type: "debt-payment", description: debtNameById(id), amount, account: sourceLabel(source, sourceOptionsBase) }],
        history: [historyEntry(next)],
      },
    });
    setDebtPay({ ...debtPay, [id]: { ...cfg, amount: "" } });
  };
  const chargeDebt = (id) => {
    const cfg = debtPay[id] || {};
    const amount = Number(cfg.amount);
    if (!amount) return;
    const today = todayStr();
    const nextDebts = data.debts.map((d) => {
      if (d.id !== id) return d;
      const accrued = accrueDebt(d, today);
      return { ...accrued, balance: accrued.balance + amount, totalCharged: (d.totalCharged || 0) + amount };
    });
    const next = { ...data, debts: nextDebts };
    commit({
      main: { debts: nextDebts },
      add: {
        transactions: [{ date: today, type: "debt-charge", description: debtNameById(id), amount, account: debtNameById(id) }],
        history: [historyEntry(next)],
      },
    });
    setDebtPay({ ...debtPay, [id]: { ...cfg, amount: "" } });
  };
  const correctDebt = (id) => {
    const val = debtCorrect[id];
    if (val === undefined || val === "") return;
    const newBalance = Number(val);
    const old = (data.debts.find((d) => d.id === id) || {}).balance || 0;
    const nextDebts = data.debts.map((d) => d.id === id ? { ...d, balance: newBalance, lastUpdated: todayStr() } : d);
    const next = { ...data, debts: nextDebts };
    commit({
      main: { debts: nextDebts },
      add: {
        transactions: [{ date: todayStr(), type: "correction", description: `${debtNameById(id)} balance corrected`, amount: newBalance - old, account: debtNameById(id) }],
        history: [historyEntry(next)],
      },
    });
    setDebtCorrect({ ...debtCorrect, [id]: "" });
  };

  return (
    <>
      <SectionTitle note={`${fmt(totalDebt)} total owed`}>Debt Accounts</SectionTitle>
      <Table>
        <thead><tr>
          <Th>Account</Th><Th align="right">Balance</Th><Th align="right">Rate</Th>
          <Th align="right">Credit Limit</Th><Th align="right">Min Pmt</Th><Th align="right">Accrued</Th>
          <Th align="right">Paid to it</Th><Th align="right">Spent by it</Th><Th> </Th>
        </tr></thead>
        <tbody>
          {data.debts.map((d) => {
            const cfg = debtPay[d.id] || { amount: "", source: "checking" };
            const opts = sourceOptionsBase.filter((o) => o.id !== d.id);
            const accrued = accrueDebt(d, todayStr());
            const utilization = d.creditLimit ? Math.round((accrued.balance / d.creditLimit) * 100) : null;
            return (
              <Fragment key={d.id}>
                <tr>
                  <Td>{d.name}</Td>
                  <Td align="right" mono style={{ color: BRICK }}>{fmt(accrued.balance)}</Td>
                  <Td align="right" mono muted>{d.rate ? `${d.rate}%` : "—"}</Td>
                  <Td align="right" mono muted>{d.creditLimit ? `${fmt(d.creditLimit)}${utilization !== null ? ` (${utilization}%)` : ""}` : "—"}</Td>
                  <Td align="right" mono muted>{d.minPayment ? fmt(d.minPayment) : "—"}</Td>
                  <Td align="right" mono muted>{fmt(accrued.interestAccrued)}</Td>
                  <Td align="right" mono>{fmt(d.totalPaid || 0)}</Td>
                  <Td align="right" mono>{fmt(d.totalCharged || 0)}</Td>
                  <Td align="right"><Btn small color={BRICK} onClick={() => removeDebt(d.id)}>del</Btn></Td>
                </tr>
                <tr>
                  <Td colSpan={9} bg={HEAD_BG}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <Input value={cfg.amount} onChange={(v) => setDebtPay({ ...debtPay, [d.id]: { ...cfg, amount: v } })} placeholder="Amount" type="number" width={90} />
                      <Select value={cfg.source} onChange={(v) => setDebtPay({ ...debtPay, [d.id]: { ...cfg, source: v } })} options={opts} width={170} />
                      <Btn small onClick={() => payDebt(d.id)}>Payment −</Btn>
                      <Btn small color={BRICK} onClick={() => chargeDebt(d.id)}>Charge +</Btn>
                      <span style={{ color: LINE }}>|</span>
                      <Input value={debtCorrect[d.id] || ""} onChange={(v) => setDebtCorrect({ ...debtCorrect, [d.id]: v })} placeholder="Correct balance to…" type="number" width={130} onEnter={() => correctDebt(d.id)} />
                      <Btn small color={GOLD} onClick={() => correctDebt(d.id)}>set exact</Btn>
                      <span style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE }}>as of {d.lastUpdated || "—"}</span>
                    </div>
                  </Td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </Table>
      <Table>
        <thead><tr>
          <Th>New account</Th><Th align="right">Balance</Th><Th align="right">Rate %</Th>
          <Th align="right">Credit Limit</Th><Th align="right">Min Pmt</Th><Th align="right"> </Th>
        </tr></thead>
        <tbody>
          <tr>
            <Td><Input value={newDebt.name} onChange={(v) => setNewDebt({ ...newDebt, name: v })} placeholder="Account name" width={150} /></Td>
            <Td align="right"><Input value={newDebt.balance} onChange={(v) => setNewDebt({ ...newDebt, balance: v })} placeholder="Balance" type="number" width={90} /></Td>
            <Td align="right"><Input value={newDebt.rate} onChange={(v) => setNewDebt({ ...newDebt, rate: v })} placeholder="Rate %" type="number" width={70} /></Td>
            <Td align="right"><Input value={newDebt.creditLimit} onChange={(v) => setNewDebt({ ...newDebt, creditLimit: v })} placeholder="Limit" type="number" width={90} /></Td>
            <Td align="right"><Input value={newDebt.minPayment} onChange={(v) => setNewDebt({ ...newDebt, minPayment: v })} placeholder="Min pmt" type="number" width={80} /></Td>
            <Td align="right"><Btn small onClick={addDebt}>add</Btn></Td>
          </tr>
        </tbody>
      </Table>
      <Note>
        Balances accrue interest daily based on each account's rate since its last update — logging a payment or
        charge applies that accrual first, then the amount. "Set exact" treats your entry as ground truth from your
        statement instead, with no accrual added on top. Credit limit is informational only.
      </Note>
    </>
  );
}
