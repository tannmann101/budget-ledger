import { useState } from "react";
import { accrueDebt } from "./debtAccrual";
import { BRICK, TEAL } from "./theme";
import { Table, Th, Td, Btn, Input, SectionTitle, Note } from "./ui";

const uid = () => Math.random().toString(36).slice(2, 10);
const todayStr = () => new Date().toISOString().slice(0, 10);

const fmt = (n) =>
  (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Dashboard({ data, commit }) {
  const [newBill, setNewBill] = useState({ name: "", amount: "", day: "" });
  const [draft, setDraft] = useState({});

  const totalDebt = data.debts.reduce((s, d) => s + accrueDebt(d, todayStr()).balance, 0);
  const netWorth = Number(data.checking) + Number(data.savings) - totalDebt;
  const staticBills = data.staticBills || [];
  const totalStaticBills = staticBills.reduce((s, b) => s + Number(b.amount || 0), 0);
  const projectedRemaining = Number(data.checking) - totalStaticBills;

  const addBill = () => {
    if (!newBill.name || !newBill.amount) return;
    const nextBills = [...staticBills, { id: uid(), name: newBill.name, amount: Number(newBill.amount), day: newBill.day }];
    commit({ main: { staticBills: nextBills } });
    setNewBill({ name: "", amount: "", day: "" });
  };
  const removeBill = (id) => {
    commit({ main: { staticBills: staticBills.filter((b) => b.id !== id) } });
  };
  const commitBill = (id) => {
    const d = draft[id];
    if (!d) return;
    const nextBills = staticBills.map((b) => b.id === id
      ? { ...b, amount: d.amount === "" || d.amount === undefined ? b.amount : Number(d.amount), day: d.day ?? b.day }
      : b);
    commit({ main: { staticBills: nextBills } });
    setDraft({ ...draft, [id]: undefined });
  };

  return (
    <>
      <SectionTitle>Current Balances</SectionTitle>
      <Table>
        <thead><tr>
          <Th align="right">Checking</Th><Th align="right">Savings</Th><Th align="right">Total Debt</Th><Th align="right">Net Worth</Th>
        </tr></thead>
        <tbody><tr>
          <Td align="right" mono>{fmt(Number(data.checking))}</Td>
          <Td align="right" mono>{fmt(Number(data.savings))}</Td>
          <Td align="right" mono>{fmt(totalDebt)}</Td>
          <Td align="right" mono>{fmt(netWorth)}</Td>
        </tr></tbody>
      </Table>

      <SectionTitle note={`${fmt(totalStaticBills)} / cycle`}>Static Bills</SectionTitle>
      <Note>
        Editable snapshot of your recurring bills for reference — amount and timeframe are freely adjustable. This
        list doesn't pay anything, track paid/unpaid status, or touch your checking, savings, or debt balances.
      </Note>
      <Table>
        <thead><tr><Th>Bill</Th><Th align="right">Amount</Th><Th>Timeframe</Th><Th align="right"> </Th></tr></thead>
        <tbody>
          {staticBills.map((b) => {
            const d = draft[b.id] || {};
            return (
              <tr key={b.id}>
                <Td>{b.name}</Td>
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

      <SectionTitle>Current Plan Projection</SectionTitle>
      <Table>
        <thead><tr><Th align="right">Checking</Th><Th align="right">Static Bills</Th><Th align="right">Projected Remaining</Th></tr></thead>
        <tbody><tr>
          <Td align="right" mono>{fmt(Number(data.checking))}</Td>
          <Td align="right" mono>{fmt(totalStaticBills)}</Td>
          <Td align="right" mono style={{ color: projectedRemaining < 0 ? BRICK : TEAL }}>{fmt(projectedRemaining)}</Td>
        </tr></tbody>
      </Table>
    </>
  );
}
