// ui.jsx
// Shared visual primitives used by App/Plan/Debts/AuthGate — the single
// place the app's "look" lives, so every page renders as one consistent
// system instead of four copies that can drift out of sync.

import { MONO, SANS, BG, CARD, INK, MUTE, MUTE_SOFT, LINE, HEAD_BG, TEAL, TEAL_SOFT, RADIUS, RADIUS_SM, SHADOW_CARD, TRANSITION } from "./theme";

export function GlobalStyle() {
  return (
    <style>{`
      * { box-sizing: border-box; }
      body { -webkit-font-smoothing: antialiased; }
      input::placeholder, textarea::placeholder { color: ${MUTE_SOFT}; opacity: 1; }
      input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
      input[type=checkbox] { accent-color: ${TEAL}; }
      table tbody tr { transition: background ${TRANSITION}; }
      table tbody tr:hover td { background: ${HEAD_BG}; }
      .ui-field { transition: border-color ${TRANSITION}, box-shadow ${TRANSITION}; }
      .ui-field:focus { outline: none; border-color: ${TEAL}; box-shadow: 0 0 0 3px ${TEAL_SOFT}; }
      .ui-btn { transition: background ${TRANSITION}, border-color ${TRANSITION}, filter ${TRANSITION}, transform 60ms ease; }
      .ui-btn:hover:not(:disabled) { background: color-mix(in srgb, var(--btn-c) 14%, transparent); }
      .ui-btn-primary:hover:not(:disabled) { filter: brightness(0.93); }
      .ui-btn:active:not(:disabled) { transform: translateY(1px); }
      .ui-btn:focus-visible { outline: 2px solid var(--btn-c); outline-offset: 2px; }
      .ui-tab:hover { background: rgba(24,26,23,0.05); }
      ::selection { background: ${TEAL_SOFT}; }
    `}</style>
  );
}

export function Table({ children }) {
  return (
    <div style={{ overflowX: "auto", overflowY: "hidden", border: `1px solid ${LINE}`, borderRadius: RADIUS, boxShadow: SHADOW_CARD, background: CARD }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: SANS }}>
        {children}
      </table>
    </div>
  );
}

export function Th({ children, align }) {
  return (
    <th style={{
      textAlign: align || "left", padding: "9px 12px", background: HEAD_BG, borderBottom: `1px solid ${LINE}`,
      fontSize: 10.5, fontWeight: 600, letterSpacing: "0.04em", color: MUTE, textTransform: "uppercase", whiteSpace: "nowrap",
    }}>{children}</th>
  );
}

export function Td({ children, align, mono, muted, colSpan, bg, style }) {
  return (
    <td colSpan={colSpan} style={{
      textAlign: align || "left", padding: "8px 12px", borderBottom: `1px solid ${LINE}`,
      fontFamily: mono ? MONO : SANS, color: muted ? MUTE : INK, background: bg, whiteSpace: "nowrap",
      ...style,
    }}>{children}</td>
  );
}

export function SectionTitle({ children, note }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "36px 0 10px", gap: 10, flexWrap: "wrap" }}>
      <h2 style={{
        fontFamily: SANS, fontSize: 13.5, fontWeight: 700, color: INK, margin: 0,
        textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: TEAL, display: "inline-block", flex: "none" }} />
        {children}
      </h2>
      {note && <span style={{ fontFamily: MONO, fontSize: 11.5, color: MUTE }}>{note}</span>}
    </div>
  );
}

export function Btn({ onClick, children, color = TEAL, small, primary, disabled, type = "button" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={primary ? "ui-btn ui-btn-primary" : "ui-btn"}
      style={{
        "--btn-c": color,
        border: `1px solid ${color}`,
        background: primary ? color : "transparent",
        color: primary ? "#FFFFFF" : color,
        fontFamily: SANS,
        fontWeight: primary ? 600 : 500,
        fontSize: small ? 12 : 13,
        padding: small ? "5px 10px" : "7px 15px",
        borderRadius: RADIUS_SM,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        whiteSpace: "nowrap",
      }}
    >{children}</button>
  );
}

export function Input({ value, onChange, placeholder, width, type = "text", onEnter }) {
  return (
    <input
      className="ui-field"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => { if (e.key === "Enter" && onEnter) onEnter(); }}
      placeholder={placeholder}
      type={type}
      inputMode={type === "number" ? "decimal" : undefined}
      style={{
        border: `1px solid ${LINE}`, borderRadius: RADIUS_SM, padding: "6px 9px", fontSize: 12.5,
        fontFamily: type === "number" ? MONO : SANS, color: INK, width: width || 90, background: BG,
      }}
    />
  );
}

export function Select({ value, onChange, options, width }) {
  return (
    <select className="ui-field" value={value} onChange={(e) => onChange(e.target.value)} style={{
      border: `1px solid ${LINE}`, borderRadius: RADIUS_SM, padding: "6px 9px", fontSize: 12, fontFamily: MONO, background: BG, color: INK, width,
    }}>
      {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  );
}

// Pill-style page/view switcher -- rounded control on the colored page wash,
// with an optional per-tab icon so nav reads as a proper app shell rather
// than plain text links.
export function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{
      display: "inline-flex", gap: 3, padding: 4, background: HEAD_BG, borderRadius: 999,
      boxShadow: SHADOW_CARD, backdropFilter: "blur(6px)", maxWidth: "100%", overflowX: "auto",
    }}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          className="ui-tab"
          onClick={() => onChange(t.id)}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            border: "none", background: active === t.id ? BG : "transparent", color: active === t.id ? INK : MUTE,
            fontFamily: SANS, fontSize: 13, fontWeight: active === t.id ? 600 : 500, padding: "9px 14px",
            borderRadius: 999, cursor: "pointer", boxShadow: active === t.id ? "0 1px 4px rgba(24,26,23,0.16)" : "none",
            whiteSpace: "nowrap", transition: `background ${TRANSITION}, box-shadow ${TRANSITION}`,
          }}
        >{t.icon}{t.label}</button>
      ))}
    </div>
  );
}

// Elevated panel for chart insight boxes, callouts, and freeform content.
export function Card({ children, style, tint }) {
  return (
    <div style={{
      border: `1px solid ${LINE}`, borderRadius: RADIUS, background: tint || CARD,
      boxShadow: tint ? "none" : SHADOW_CARD, padding: 14, ...style,
    }}>{children}</div>
  );
}

export function Note({ children }) {
  return (
    <p style={{ fontFamily: MONO, fontSize: 11, color: MUTE, lineHeight: 1.65, margin: "10px 0 0" }}>
      {children}
    </p>
  );
}
