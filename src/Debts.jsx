import { useState } from "react";
import { accrueDebt } from "./debtAccrual";
import { BRICK } from "./theme";
import { Table, Th, Td, Btn, Input, SectionTitle, Note } from "./ui";

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

export default function Debts({ data, commit }) {
  const [newDebt, setNewDebt] = useState({ name: "", balance: "", rate: "", minPayment: "", creditLimit: "" });
  const [draft, setDraft] = useState({});

  const totalDebt = data.debts.reduce((s, d) => s + accrueDebt(d, todayStr()).balance, 0);
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
  const commitDebt = (id) => {
    const d = draft[id];
    if (!d) return;
    const accrued = accrueDebt(data.debts.find((x) => x.id === id), todayStr());
    const nextDebts = data.debts.map((x) => x.id === id
      ? {
          ...x,
          balance: d.balance === "" || d.balance === undefined ? accrued.balance : Number(d.balance),
          rate: d.rate === "" || d.rate === undefined ? x.rate : (d.rate === null ? null : Number(d.rate)),
          creditLimit: d.creditLimit === "" || d.creditLimit === undefined ? x.creditLimit : (d.creditLimit === null ? null : Number(d.creditLimit)),
          minPayment: d.minPayment === "" || d.minPayment === undefined ? x.minPayment : (d.minPayment === null ? null : Number(d.minPayment)),
          lastUpdated: todayStr(),
        }
      : x);
    commit({ main: { debts: nextDebts }, add: { history: [historyEntry({ ...data, debts: nextDebts })] } });
    setDraft({ ...draft, [id]: undefined });
  };

  return (
    <>
      <SectionTitle note={`${fmt(totalDebt)} total owed`}>Debt Accounts</SectionTitle>
      <Table>
        <thead><tr>
          <Th>Account</Th><Th align="right">Balance</Th><Th align="right">Rate %</Th>
          <Th align="right">Credit Limit</Th><Th align="right">Min Pmt</Th><Th align="right">Accrued</Th><Th> </Th>
        </tr></thead>
        <tbody>
          {data.debts.map((d) => {
            const dr = draft[d.id] || {};
            const accrued = accrueDebt(d, todayStr());
            return (
              <tr key={d.id}>
                <Td>{d.name}</Td>
                <Td align="right">
                  <Input value={dr.balance ?? String(accrued.balance.toFixed(2))} onChange={(v) => setDraft({ ...draft, [d.id]: { ...dr, balance: v } })} type="number" width={90} onEnter={() => commitDebt(d.id)} />
                </Td>
                <Td align="right">
                  <Input value={dr.rate ?? (d.rate ?? "")} onChange={(v) => setDraft({ ...draft, [d.id]: { ...dr, rate: v } })} type="number" width={70} onEnter={() => commitDebt(d.id)} />
                </Td>
                <Td align="right">
                  <Input value={dr.creditLimit ?? (d.creditLimit ?? "")} onChange={(v) => setDraft({ ...draft, [d.id]: { ...dr, creditLimit: v } })} type="number" width={90} onEnter={() => commitDebt(d.id)} />
                </Td>
                <Td align="right">
                  <Input value={dr.minPayment ?? (d.minPayment ?? "")} onChange={(v) => setDraft({ ...draft, [d.id]: { ...dr, minPayment: v } })} type="number" width={80} onEnter={() => commitDebt(d.id)} />
                </Td>
                <Td align="right" mono muted>{fmt(accrued.interestAccrued)}</Td>
                <Td align="right">
                  <Btn small onClick={() => commitDebt(d.id)}>save</Btn>{" "}
                  <Btn small color={BRICK} onClick={() => removeDebt(d.id)}>del</Btn>
                </Td>
              </tr>
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
        A static, editable reference — enter the current numbers straight from your statement and hit save. Balance
        still accrues interest daily in the background based on rate and days since last saved (shown under
        "Accrued"), so "save" is you confirming the true current balance, not logging a transaction.
      </Note>
    </>
  );
}
