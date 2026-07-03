import { useState, useEffect, useCallback } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase";

const LEDGER_DOC = doc(db, "ledger", "shared");

// New fields added to the data model later will fall back to these
// defaults for documents written before the field existed.
export const DEFAULT_DATA = {
  income: [], checking: 0, savings: 0, debts: [], bills: [], categories: [], expenses: [], transactions: [], history: [],
};

export function useCloudLedger(enabled) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    if (!enabled) return;
    setStatus("loading");
    const unsub = onSnapshot(
      LEDGER_DOC,
      (snap) => {
        setData(snap.exists() ? { ...DEFAULT_DATA, ...snap.data() } : null);
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
    setDoc(LEDGER_DOC, next).catch((err) => console.error("Failed to save ledger", err));
  }, []);

  return [data, save, status];
}
