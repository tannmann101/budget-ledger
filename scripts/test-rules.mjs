import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, deleteDoc, onSnapshot } from "firebase/firestore";

const testEnv = await initializeTestEnvironment({
  projectId: "demo-budget-ledger",
  firestore: {
    rules: readFileSync("firestore.rules", "utf8"),
    host: "127.0.0.1",
    port: 8080,
  },
});

await testEnv.clearFirestore();

const tannerCtx = testEnv.authenticatedContext("uid-tanner", { email: "tannerwesgardner@gmail.com" });
const rochelleCtx = testEnv.authenticatedContext("uid-rochelle", { email: "rochelleygardner@gmail.com" });
const strangerCtx = testEnv.authenticatedContext("uid-stranger", { email: "stranger@example.com" });
const anonCtx = testEnv.unauthenticatedContext();

const tannerDb = tannerCtx.firestore();
const rochelleDb = rochelleCtx.firestore();
const strangerDb = strangerCtx.firestore();
const anonDb = anonCtx.firestore();

let failures = 0;
const check = (label, ok) => {
  console.log(`${ok ? "PASS" : "FAIL"} - ${label}`);
  if (!ok) failures++;
};

// The minimal shape isValidLedger() in firestore.rules requires on every
// create/update -- mirrors DEFAULT_MAIN in useCloudLedger.js. income/
// transactions/expenses/history no longer live here -- they're in their own
// subcollections, tested separately below.
const validLedger = (overrides = {}) => ({
  checking: 0, savings: 0, debts: [], bills: [], categories: [],
  ...overrides,
});

// 1. Allowed account can write the shared ledger doc
try {
  await assertSucceeds(setDoc(doc(tannerDb, "ledger/shared"), validLedger({ checking: 100 })));
  check("allowed account can write", true);
} catch (e) {
  check("allowed account can write", false);
  console.error(e.message);
}

// 2. Allowed account can read it back
try {
  const snap = await assertSucceeds(getDoc(doc(tannerDb, "ledger/shared")));
  check("allowed account can read", snap.data()?.checking === 100);
} catch (e) {
  check("allowed account can read", false);
  console.error(e.message);
}

// 2b. The second allowed account (Rochelle) can also read and write
try {
  await assertSucceeds(setDoc(doc(rochelleDb, "ledger/shared"), validLedger({ checking: 150 })));
  const snap = await assertSucceeds(getDoc(doc(rochelleDb, "ledger/shared")));
  check("second allowed account (Rochelle) can read/write", snap.data()?.checking === 150);
} catch (e) {
  check("second allowed account (Rochelle) can read/write", false);
  console.error(e.message);
}

// 3. A signed-in but non-allow-listed email is rejected
try {
  await assertFails(getDoc(doc(strangerDb, "ledger/shared")));
  check("non-allow-listed account is rejected (read)", true);
} catch (e) {
  check("non-allow-listed account is rejected (read)", false);
}
try {
  await assertFails(setDoc(doc(strangerDb, "ledger/shared"), validLedger({ checking: 999999 })));
  check("non-allow-listed account is rejected (write)", true);
} catch (e) {
  check("non-allow-listed account is rejected (write)", false);
}

// 4. Fully unauthenticated access is rejected
try {
  await assertFails(getDoc(doc(anonDb, "ledger/shared")));
  check("unauthenticated access is rejected", true);
} catch (e) {
  check("unauthenticated access is rejected", false);
}

// 5. Schema validation: a write missing a required field is rejected
try {
  const { debts: _debts, ...missingDebts } = validLedger();
  await assertFails(setDoc(doc(tannerDb, "ledger/shared"), missingDebts));
  check("write missing a required field is rejected", true);
} catch (e) {
  check("write missing a required field is rejected", false);
}

// 6. Schema validation: a write with a wrong-typed field is rejected
try {
  await assertFails(setDoc(doc(tannerDb, "ledger/shared"), validLedger({ debts: "not-a-list" })));
  check("write with a wrong-typed field is rejected", true);
} catch (e) {
  check("write with a wrong-typed field is rejected", false);
}
try {
  await assertFails(setDoc(doc(tannerDb, "ledger/shared"), validLedger({ checking: "100" })));
  check("write with a numeric field sent as a string is rejected", true);
} catch (e) {
  check("write with a numeric field sent as a string is rejected", false);
}

// 7. Schema validation: assumptions is optional, but must be a map when present
try {
  await assertSucceeds(setDoc(doc(tannerDb, "ledger/shared"), validLedger()));
  check("write with assumptions omitted is allowed", true);
} catch (e) {
  check("write with assumptions omitted is allowed", false);
  console.error(e.message);
}
try {
  await assertSucceeds(setDoc(doc(tannerDb, "ledger/shared"), validLedger({ assumptions: { baseHourlyRate: 24.22 } })));
  check("write with a valid assumptions map is allowed", true);
} catch (e) {
  check("write with a valid assumptions map is allowed", false);
  console.error(e.message);
}
try {
  await assertFails(setDoc(doc(tannerDb, "ledger/shared"), validLedger({ assumptions: "not-a-map" })));
  check("write with a wrong-typed assumptions field is rejected", true);
} catch (e) {
  check("write with a wrong-typed assumptions field is rejected", false);
}

// 8. Deleting the shared ledger doc is never allowed, even for an allowed account
try {
  await assertFails(deleteDoc(doc(tannerDb, "ledger/shared")));
  check("deleting the shared ledger doc is rejected", true);
} catch (e) {
  check("deleting the shared ledger doc is rejected", false);
}

// 9. Subcollections: allowed accounts can add/read/delete items; wrong-typed
// items and non-allow-listed accounts are rejected -- same auth model as the
// main doc, plus light per-collection type validation.
const validTxn = { date: "2026-01-01", type: "expense", description: "Coffee", amount: 4.5, account: "Checking" };
const validIncome = { date: "2026-01-01", amount: 1500, note: "" };
const validExpense = { categoryId: "cat-coffee", amount: 4.5, month: "2026-01" };
const validHistory = { date: "2026-01-01", checking: 100, savings: 200, debt: 300 };

try {
  await assertSucceeds(setDoc(doc(tannerDb, "ledger/shared/transactions/t1"), validTxn));
  const snap = await assertSucceeds(getDoc(doc(tannerDb, "ledger/shared/transactions/t1")));
  check("allowed account can write and read a transaction item", snap.data()?.amount === 4.5);
} catch (e) {
  check("allowed account can write and read a transaction item", false);
  console.error(e.message);
}
try {
  await assertSucceeds(setDoc(doc(tannerDb, "ledger/shared/income/i1"), validIncome));
  await assertSucceeds(setDoc(doc(tannerDb, "ledger/shared/expenses/e1"), validExpense));
  await assertSucceeds(setDoc(doc(tannerDb, "ledger/shared/history/2026-01-01"), validHistory));
  check("allowed account can write income/expenses/history items", true);
} catch (e) {
  check("allowed account can write income/expenses/history items", false);
  console.error(e.message);
}
try {
  await assertFails(setDoc(doc(tannerDb, "ledger/shared/transactions/t2"), { ...validTxn, amount: "not-a-number" }));
  check("wrong-typed transaction item is rejected", true);
} catch (e) {
  check("wrong-typed transaction item is rejected", false);
}
try {
  await assertFails(setDoc(doc(strangerDb, "ledger/shared/transactions/t3"), validTxn));
  check("non-allow-listed account is rejected on a subcollection item", true);
} catch (e) {
  check("non-allow-listed account is rejected on a subcollection item", false);
}
try {
  await assertSucceeds(deleteDoc(doc(tannerDb, "ledger/shared/transactions/t1")));
  const snap = await getDoc(doc(rochelleDb, "ledger/shared/transactions/t1"));
  check("allowed account can delete a subcollection item", !snap.exists());
} catch (e) {
  check("allowed account can delete a subcollection item", false);
  console.error(e.message);
}

// 10. Live sync: a second allowed session should see the first session's write via onSnapshot
const secondSessionCtx = testEnv.authenticatedContext("uid-tanner-2", { email: "tannerwesgardner@gmail.com" });
const secondDb = secondSessionCtx.firestore();

const liveUpdate = await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error("timed out waiting for live update")), 5000);
  const unsub = onSnapshot(doc(secondDb, "ledger/shared"), (snap) => {
    if (snap.data()?.checking === 4242) {
      clearTimeout(timeout);
      unsub();
      resolve(true);
    }
  });
  setDoc(doc(tannerDb, "ledger/shared"), validLedger({ checking: 4242 })).catch(reject);
});
check("second session receives live update via onSnapshot", liveUpdate === true);

await testEnv.cleanup();

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
} else {
  console.log("\nAll checks passed.");
}
