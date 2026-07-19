import { useState, useEffect, useCallback, useRef } from "react";
import {
  doc, collection, onSnapshot, runTransaction, query, orderBy, limit,
  deleteDoc, writeBatch, getDocs,
} from "firebase/firestore";
import { db } from "./firebase";

const LEDGER_REF = doc(db, "ledger", "shared");
// income/transactions/expenses/history used to live as flat arrays inside
// the one shared document -- every save rewrote the whole multi-year
// history, and Firestore caps a single document at 1MB. They now live in
// their own subcollections (one small document per item); the main doc
// only holds the small, slow-changing fields.
const GROWING_COLLECTIONS = ["income", "transactions", "expenses", "history"];
const ORDER_FIELD = { income: "date", transactions: "date", expenses: "month", history: "date" };
// Bounded, not truly "unlimited" -- generous enough that no realistic
// two-person household hits the ceiling for years, without ever risking
// an unbounded read. Revisit with real pagination if that ever changes.
const LOAD_LIMITS = { income: 500, transactions: 500, expenses: 500, history: 1825 };
const BATCH_SIZE = 400; // Firestore's batch/transaction op cap is 500; leave headroom

export const DEFAULT_DATA = {
  income: [], checking: 0, savings: 0, debts: [], bills: [], categories: [], expenses: [], transactions: [], history: [], assumptions: {},
};
const DEFAULT_MAIN = { checking: 0, savings: 0, debts: [], bills: [], categories: [], assumptions: {} };

const subCollectionRef = (name) => collection(db, "ledger", "shared", name);
const subDocRef = (name, id) => doc(db, "ledger", "shared", name, id);

async function chunkedWrite(items, name) {
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    for (const item of items.slice(i, i + BATCH_SIZE)) {
      const { id, ...rest } = item;
      const docId = name === "history" ? item.date : (id || doc(subCollectionRef(name)).id);
      batch.set(subDocRef(name, docId), rest);
    }
    await batch.commit();
  }
}

async function wipeCollection(name) {
  const snap = await getDocs(subCollectionRef(name));
  const ids = snap.docs.map((d) => d.id);
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    for (const id of ids.slice(i, i + BATCH_SIZE)) batch.delete(subDocRef(name, id));
    await batch.commit();
  }
}

// Self-healing migration: a document written before this subcollection
// split still has income/transactions/expenses/history as flat arrays.
// Moves each into its subcollection, then strips those fields from the
// main doc. Safe to re-run (re-writing the same doc IDs is a no-op
// overwrite) if it's ever interrupted partway through.
async function migrateLegacyDoc(raw) {
  for (const name of GROWING_COLLECTIONS) {
    await chunkedWrite(raw[name] || [], name);
  }
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(LEDGER_REF);
    const server = snap.data();
    const stillLegacy = GROWING_COLLECTIONS.some((k) => Array.isArray(server[k]));
    if (!stillLegacy) return; // another client already finished migrating it
    const { income: _i, transactions: _t, expenses: _e, history: _h, ...mainFields } = server;
    tx.set(LEDGER_REF, { ...DEFAULT_MAIN, ...mainFields, _rev: (server._rev || 0) + 1 });
  });
}

export function useCloudLedger(enabled) {
  const [main, setMain] = useState(null);
  const [subData, setSubData] = useState({ income: [], transactions: [], expenses: [], history: [] });
  const [status, setStatus] = useState("loading"); // loading | migrating | ready | forbidden | error
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | error | conflict
  const lastSeenRevRef = useRef(0);
  const pendingRef = useRef(Promise.resolve());
  const migratingRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    setStatus("loading");

    const unsubMain = onSnapshot(
      LEDGER_REF,
      async (snap) => {
        if (!snap.exists()) {
          lastSeenRevRef.current = 0;
          setMain(null);
          setStatus("ready");
          return;
        }
        const raw = snap.data();
        const isLegacyShape = GROWING_COLLECTIONS.some((k) => Array.isArray(raw[k]));
        if (isLegacyShape) {
          if (!migratingRef.current) {
            migratingRef.current = true;
            setStatus("migrating");
            try {
              await migrateLegacyDoc(raw);
            } catch (err) {
              console.error("Ledger migration failed", err);
              setStatus("error");
            }
            migratingRef.current = false;
          }
          return; // migration's own write re-triggers this listener with the clean shape
        }
        const { _rev, ...rest } = raw;
        lastSeenRevRef.current = _rev || 0;
        setMain({ ...DEFAULT_MAIN, ...rest });
        setStatus("ready");
      },
      (err) => {
        console.error("Ledger sync error", err);
        setStatus(err.code === "permission-denied" ? "forbidden" : "error");
      }
    );

    const unsubGrowing = GROWING_COLLECTIONS.map((name) => {
      const q = query(subCollectionRef(name), orderBy(ORDER_FIELD[name], "desc"), limit(LOAD_LIMITS[name]));
      return onSnapshot(q, (snap) => {
        setSubData((prev) => ({ ...prev, [name]: snap.docs.map((d) => ({ id: d.id, ...d.data() })) }));
      }, (err) => console.error(`Ledger ${name} sync error`, err));
    });

    return () => { unsubMain(); unsubGrowing.forEach((u) => u()); };
  }, [enabled]);

  const data = main === null ? null : { ...DEFAULT_DATA, ...main, ...subData };

  // Atomically patches the main doc (conflict-guarded exactly as before: a
  // write only lands if the doc hasn't moved since this client last saw it)
  // and/or appends brand-new documents to the growing subcollections. New
  // items never conflict with anything else -- each is its own document --
  // so the only real concurrency risk left is two edits to the same
  // main-doc field (e.g. the debts list) landing at once.
  const commit = useCallback(({ main: patch, add } = {}) => {
    setSaveStatus("saving");
    const seenRev = lastSeenRevRef.current;
    pendingRef.current = pendingRef.current
      .then(() => runTransaction(db, async (tx) => {
        if (patch) {
          const snap = await tx.get(LEDGER_REF);
          const serverMain = snap.exists() ? snap.data() : { ...DEFAULT_MAIN, _rev: 0 };
          const serverRev = serverMain._rev || 0;
          if (serverRev !== seenRev) throw new Error("conflict");
          tx.set(LEDGER_REF, { ...serverMain, ...patch, _rev: serverRev + 1 });
        }
        if (add) {
          for (const [name, items] of Object.entries(add)) {
            for (const item of items) {
              const { id, ...rest } = item;
              const docId = name === "history" ? item.date : (id || doc(subCollectionRef(name)).id);
              tx.set(subDocRef(name, docId), rest);
            }
          }
        }
      }))
      .then(() => setSaveStatus("idle"))
      .catch((err) => {
        console.error("Failed to save ledger", err);
        setSaveStatus(err.message === "conflict" ? "conflict" : "error");
      });
  }, []);

  const removeItem = useCallback((name, id) => {
    deleteDoc(subDocRef(name, id)).catch((err) => console.error(`Failed to delete ${name} item`, err));
  }, []);

  // Full reset/seed: wipes every growing subcollection and rewrites the
  // main doc from scratch (used by "Create ledger" and "Reset to starting
  // data" -- both hand this a complete, legacy-shaped data object).
  const replaceAll = useCallback(async (fullData) => {
    setSaveStatus("saving");
    try {
      for (const name of GROWING_COLLECTIONS) {
        await wipeCollection(name);
        await chunkedWrite(fullData[name] || [], name);
      }
      const { income: _i, transactions: _t, expenses: _e, history: _h, ...mainFields } = fullData;
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(LEDGER_REF);
        const serverRev = snap.exists() ? (snap.data()._rev || 0) : 0;
        tx.set(LEDGER_REF, { ...DEFAULT_MAIN, ...mainFields, _rev: serverRev + 1 });
      });
      setSaveStatus("idle");
    } catch (err) {
      console.error("Failed to write ledger", err);
      setSaveStatus("error");
    }
  }, []);

  return { data, status, saveStatus, commit, removeItem, replaceAll };
}
