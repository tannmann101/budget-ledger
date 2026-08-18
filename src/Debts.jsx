import { useState } from "react";
import { accrueDebt } from "./debtAccrual";
import { BRICK } from "./theme";
import { Table, Th, Td, Btn, Input, SectionTitle, Note } from "./ui";

const uid = () => Math.random().toString(36).slice(2, 10);
const todayStr = () => new Date().toISOString().slice(0, 10);

const fmt = (n) =>
  (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// One history doc per day (upserted by date) -- see App.jsx's historyEntry, same pattern.
// Takes the fresh server main doc (not React's possibly-stale `data` prop)
// so a history write always reflects the debts array this same commit just
// wrote, not whatever the client had cached before the transaction ran.
function historyEntry(serverMain, debts) {
  const today = todayStr();
  const debtTotal = (debts || []).reduce((s, d) => s + accrueDebt(d, today).balance, 0);
  return { date: today, checking: Number(serverMain.checking), savings: Number(serverMain.savings), debt: debtTotal };
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
    commit({
      main: (serverMain) => ({ debts: [...(serverMain.debts || []), debt] }),
      add: { history: (serverMain) => [historyEntry(serverMain, [...(serverMain.debts || []), debt])] },
    });
    setNewDebt({ name: "", balance: "", rate: "", minPayment: "", creditLimit: "" });
  };
  const removeDebt = (id) => {
    if (!window.confirm(`Delete "${debtNameById(id)}"? This removes the account and its history from the ledger.`)) return;
    commit({
      main: (serverMain) => ({ debts: (serverMain.debts || []).filter((d) => d.id !== id) }),
      add: { history: (serverMain) => [historyEntry(serverMain, (serverMain.debts || []).filter((d) => d.id !== id))] },
    });
  };
  const commitDebt = (id) => {
    const dr = draft[id];
    if (!dr) return;
    commit({
      main: (serverMain) => {
        const nextDebts = (serverMain.debts || []).map((x) => {
          if (x.id !== id) return x;
          const accrued = accrueDebt(x, todayStr());
          return {
            ...x,
            name: dr.name === "" || dr.name === undefined ? x.name : dr.name,
            balance: dr.balance === "" || dr.balance === undefined ? accrued.balance : Number(dr.balance),
            rate: dr.rate === "" || dr.rate === undefined ? x.rate : (dr.rate === null ? null : Number(dr.rate)),
            creditLimit: dr.creditLimit === "" || dr.creditLimit === undefined ? x.creditLimit : (dr.creditLimit === null ? null : Number(dr.creditLimit)),
            minPayment: dr.minPayment === "" || dr.minPayment === undefined ? x.minPayment : (dr.minPayment === null ? null : Number(dr.minPayment)),
            lastUpdated: todayStr(),
          };
        });
        return { debts: nextDebts };
      },
      add: {
        history: (serverMain) => {
          const nextDebts = (serverMain.debts || []).map((x) => x.id === id ? { ...x, lastUpdated: todayStr() } : x);
          return [historyEntry(serverMain, nextDebts)];
        },
      },
    });
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
                <Td>
                  <Input value={dr.name ?? d.name} onChange={(v) => setDraft({ ...draft, [d.id]: { ...dr, name: v } })} width={130} onEnter={() => commitDebt(d.id)} />
                </Td>
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
