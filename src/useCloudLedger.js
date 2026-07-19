import { useState, useEffect, useCallback, useRef } from "react";
import { doc, onSnapshot, runTransaction } from "firebase/firestore";
import { db } from "./firebase";

const LEDGER_DOC = doc(db, "ledger", "shared");

// New fields added to the data model later will fall back to these
// defaults for documents written before the field existed.
export const DEFAULT_DATA = {
  income: [], checking: 0, savings: 0, debts: [], bills: [], categories: [], expenses: [], transactions: [], history: [], assumptions: {},
};

// household ledger is meant to be edited from two people's devices at once,
// so every save checks the document hasn't moved since we last saw it instead
// of blindly overwriting — an unconditional setDoc would silently discard
// whichever write lands second. The web SDK's DocumentSnapshot doesn't expose
// Firestore's server-side updateTime (that's Admin-SDK-only), so the check is
// done with our own "_rev" counter field instead, stripped back out of `data`
// before it's handed to the rest of the app.
export function useCloudLedger(enabled) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | error | conflict
  const lastSeenRevRef = useRef(0);
  const pendingRef = useRef(Promise.resolve());

  useEffect(() => {
    if (!enabled) return;
    setStatus("loading");
    const unsub = onSnapshot(
      LEDGER_DOC,
      (snap) => {
        if (snap.exists()) {
          const { _rev, ...rest } = snap.data();
          lastSeenRevRef.current = _rev || 0;
          setData({ ...DEFAULT_DATA, ...rest });
        } else {
          lastSeenRevRef.current = 0;
          setData(null);
        }
        setStatus("ready");
      },
      (err) => {
        console.error("Ledger sync error", err);
        setStatus(err.code === "permission-denied" ? "forbidden" : "error");
      }
    );
    return unsub;
  }, [enabled]);

  const save = useCallback((next) => {
    setData(next);
    setSaveStatus("saving");
    const seenRev = lastSeenRevRef.current;
    pendingRef.current = pendingRef.current
      .then(() => runTransaction(db, async (tx) => {
        const snap = await tx.get(LEDGER_DOC);
        const serverRev = snap.exists() ? (snap.data()._rev || 0) : 0;
        if (serverRev !== seenRev) throw new Error("conflict");
        tx.set(LEDGER_DOC, { ...next, _rev: serverRev + 1 });
      }))
      .then(() => setSaveStatus("idle"))
      .catch((err) => {
        console.error("Failed to save ledger", err);
        setSaveStatus(err.message === "conflict" ? "conflict" : "error");
      });
  }, []);

  return [data, save, status, saveStatus];
}
