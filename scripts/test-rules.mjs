import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, onSnapshot } from "firebase/firestore";

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

// 1. Allowed account can write the shared ledger doc
try {
  await assertSucceeds(setDoc(doc(tannerDb, "ledger/shared"), { checking: 100, savings: 0 }));
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
  await assertSucceeds(setDoc(doc(rochelleDb, "ledger/shared"), { checking: 150, savings: 0 }));
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
  await assertFails(setDoc(doc(strangerDb, "ledger/shared"), { checking: 999999 }));
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

// 5. Live sync: a second allowed session should see the first session's write via onSnapshot
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
  setDoc(doc(tannerDb, "ledger/shared"), { checking: 4242, savings: 0 }).catch(reject);
});
check("second session receives live update via onSnapshot", liveUpdate === true);

await testEnv.cleanup();

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
} else {
  console.log("\nAll checks passed.");
}
