import { useState, useEffect } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "./firebase";

const SANS = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const PAGE = "#F6F6F4";
const INK = "#1A1A1A";
const MUTE = "#6B6B68";
const TEAL = "#2E6F62";
const BRICK = "#B3432B";

export function Centered({ children }) {
  return (
    <div style={{ minHeight: "100vh", background: PAGE, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, padding: 20 }}>
      <div style={{ maxWidth: 360, textAlign: "center" }}>{children}</div>
    </div>
  );
}

function GoogleButton({ onClick, label = "Sign in with Google" }) {
  return (
    <button
      onClick={onClick}
      style={{
        border: `1px solid ${INK}`, background: INK, color: "#fff", fontFamily: SANS, fontWeight: 600,
        fontSize: 14, padding: "10px 18px", borderRadius: 6, cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

export function useAuthUser() {
  const [user, setUser] = useState(undefined); // undefined = still checking, null = signed out
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  return user;
}

export default function AuthGate({ user, forbidden, children }) {
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState("");

  const doSignIn = async () => {
    setSigningIn(true);
    setError("");
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError(err.message || "Sign-in failed.");
    } finally {
      setSigningIn(false);
    }
  };

  if (user === undefined) {
    return <Centered><span style={{ fontFamily: MONO, color: MUTE, fontSize: 13 }}>loading…</span></Centered>;
  }

  if (!user) {
    return (
      <Centered>
        <h1 style={{ fontFamily: SANS, fontSize: 20, fontWeight: 800, margin: "0 0 6px" }}>Household Ledger</h1>
        <p style={{ fontFamily: MONO, fontSize: 12.5, color: MUTE, margin: "0 0 20px" }}>Sign in to see your shared ledger.</p>
        <GoogleButton onClick={doSignIn} label={signingIn ? "Signing in…" : "Sign in with Google"} />
        {error && <p style={{ fontFamily: MONO, fontSize: 11.5, color: BRICK, marginTop: 14 }}>{error}</p>}
      </Centered>
    );
  }

  if (forbidden) {
    return (
      <Centered>
        <h1 style={{ fontFamily: SANS, fontSize: 20, fontWeight: 800, margin: "0 0 6px" }}>Not authorized</h1>
        <p style={{ fontFamily: MONO, fontSize: 12.5, color: MUTE, margin: "0 0 6px" }}>
          Signed in as <strong style={{ color: INK }}>{user.email}</strong>
        </p>
        <p style={{ fontFamily: MONO, fontSize: 12.5, color: MUTE, margin: "0 0 20px" }}>
          This ledger is restricted to specific accounts. Sign out and try a different one.
        </p>
        <button
          onClick={() => signOut(auth)}
          style={{ border: `1px solid ${TEAL}`, background: "transparent", color: TEAL, fontFamily: MONO, fontSize: 12, padding: "6px 12px", borderRadius: 4, cursor: "pointer" }}
        >
          sign out
        </button>
      </Centered>
    );
  }

  return children;
}
