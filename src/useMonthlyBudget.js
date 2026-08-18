import { useState, useEffect, useCallback } from "react";
import { collection, doc, onSnapshot, addDoc, deleteDoc, query, orderBy, limit } from "firebase/firestore";
import { db } from "./firebase";

// Its own top-level collection, independent of the main ledger doc -- see
// firestore.rules. Each spend is its own document, so appends never
// conflict; no transaction or _rev bookkeeping needed, same as
// income/transactions/expenses/history in useCloudLedger.js.
const ENTRIES_REF = collection(db, "budgetEntries");
const LOAD_LIMIT = 3000; // generous multi-year ceiling, not a real limit for one household

export function useMonthlyBudget(enabled) {
  const [entries, setEntries] = useState([]);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    if (!enabled) return;
    setStatus("loading");
    const q = query(ENTRIES_REF, orderBy("date", "desc"), limit(LOAD_LIMIT));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setStatus("ready");
      },
      (err) => {
        console.error("Budget entries sync error", err);
        setStatus(err.code === "permission-denied" ? "forbidden" : "error");
      }
    );
    return unsub;
  }, [enabled]);

  const addEntry = useCallback((entry) => {
    addDoc(ENTRIES_REF, entry).catch((err) => console.error("Failed to log spend", err));
  }, []);

  const removeEntry = useCallback((id) => {
    deleteDoc(doc(ENTRIES_REF, id)).catch((err) => console.error("Failed to delete spend", err));
  }, []);

  return { entries, status, addEntry, removeEntry };
}
