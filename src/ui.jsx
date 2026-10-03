// ui.jsx
// Shared visual primitives used by App/Plan/Debts/AuthGate — the single
// place the app's "look" lives, so every page renders as one consistent
// system instead of four copies that can drift out of sync.

import { useRef, useLayoutEffect } from "react";
import { MONO, SANS, PAGE, BG, CARD, INK, MUTE, MUTE_SOFT, LINE, LINE_STRONG, NAV_BG, HEAD_BG, TEAL, TEAL_SOFT, BRICK, GLOW, ON_ACCENT, RADIUS, RADIUS_SM, SHADOW_CARD, TRANSITION } from "./theme";

// Where the "← Home" link in the nav goes -- the household hub site.
export const HUB_URL = "https://thegardners.xyz/#apps";

export function GlobalStyle() {
  return (
    <style>{`
      * { box-sizing: border-box; }
      :root { color-scheme: dark; }
      body { background: ${PAGE}; color: ${INK}; font-family: ${SANS}; -webkit-font-smoothing: antialiased; }
      input::placeholder, textarea::placeholder { color: ${MUTE_SOFT}; opacity: 1; }
      input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
      input[type=checkbox] { accent-color: ${TEAL}; }
      select option { background: ${CARD}; color: ${INK}; }
      table tbody tr { transition: background ${TRANSITION}; }
      table tbody tr:hover td { background: ${HEAD_BG}; }
      .ui-field { transition: border-color ${TRANSITION}, box-shadow ${TRANSITION}; }
      .ui-field:focus { outline: none; border-color: ${TEAL}; box-shadow: 0 0 0 3px ${TEAL_SOFT}; }
      .ui-btn { transition: background ${TRANSITION}, border-color ${TRANSITION}, filter ${TRANSITION}, transform 60ms ease; }
      .ui-btn:hover:not(:disabled) { background: color-mix(in srgb, var(--btn-c) 14%, transparent); }
      .ui-btn-primary:hover:not(:disabled) { background: var(--btn-c); filter: brightness(1.1); }
      .ui-btn:active:not(:disabled) { transform: translateY(1px); }
      .ui-btn:focus-visible { outline: 2px solid var(--btn-c); outline-offset: 2px; }
      .ui-tab:hover { border-color: ${LINE_STRONG} !important; color: ${INK} !important; }
      .ui-tab:focus-visible, .ui-link:focus-visible { outline: 2px solid ${TEAL}; outline-offset: 2px; }
      .ui-link { color: ${MUTE_SOFT}; text-decoration: none; transition: color ${TRANSITION}; }
      .ui-link:hover { color: ${MUTE}; }
      ::selection { background: ${TEAL_SOFT}; }

      /* App shell, mirroring the hub site's .app-nav / .app-main */
      .ui-nav {
        position: sticky; top: 0; z-index: 10;
        display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 16px;
        padding: 0 20px; height: 60px;
        background: ${NAV_BG}; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
        border-bottom: 1px solid ${LINE};
      }
      .ui-body { position: relative; overflow-x: clip; }
      .ui-main { max-width: 1000px; margin: 0 auto; padding: 40px 20px 96px; position: relative; z-index: 1; }
      .ui-glow {
        position: absolute; inset: 0 0 auto 0; height: 420px; pointer-events: none; z-index: 0;
        background: radial-gradient(ellipse 720px 320px at 50% 0%, ${GLOW}, transparent 70%);
      }
      @media (min-width: 900px) {
        .ui-nav { padding: 0 44px; height: 64px; }
        .ui-main { padding: 56px 44px 120px; }
      }
      /* Phone-width tables: each row becomes a small card of labeled lines
         (label left, value right) with its action buttons along the bottom,
         instead of a wide grid you'd have to scroll sideways. Labels come
         from the column headers -- see Table below. */
      @media (max-width: 640px) {
        .ui-stack table, .ui-stack tbody { display: block; }
        .ui-stack thead { display: none; }
        .ui-stack tr { display: flex; flex-direction: column; gap: 8px; padding: 14px 14px 12px; border-bottom: 1px solid ${LINE}; }
        .ui-stack tbody tr:last-child { border-bottom: none; }
        .ui-stack tbody tr:hover td { background: transparent; }
        .ui-stack td {
          display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
          padding: 0 !important; border: none !important; background: transparent !important;
          white-space: normal !important; text-align: right !important; min-height: 30px;
        }
        .ui-stack td::before {
          content: attr(data-label); margin-right: auto; text-align: left;
          font-family: ${MONO}; font-size: 10.5px; font-weight: 400; letter-spacing: 0.08em; text-transform: uppercase; color: ${MUTE_SOFT};
        }
        .ui-stack td[data-label=""]::before { display: none; }
        .ui-stack td[data-label=""] { justify-content: flex-end; gap: 6px; }
        .ui-stack td[data-label=""]:only-child { justify-content: flex-start; text-align: left !important; font-weight: 400; }
        .ui-stack td[data-label=""]:not(:first-child) { padding-top: 4px !important; }
        .ui-stack td .ui-field { width: 58% !important; }
        /* A plain-text first cell (an account or row name) becomes the card's title. */
        .ui-stack td[data-title] { justify-content: flex-start; text-align: left !important; font-weight: 600; font-size: 14px; color: ${INK}; }
      }
      /* Cert page "How It Works" strip: a vertical flow on phones. */
      .ui-flow { display: flex; gap: 6px; }
      @media (max-width: 640px) {
        .ui-flow { flex-direction: column; }
        .ui-flow > .ui-flow-step { max-width: none !important; flex: 1 1 auto !important; }
        .ui-flow > .ui-flow-arrow { transform: rotate(90deg); padding: 0 !important; }
      }
      .ui-header-side { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; }
      @media (max-width: 600px) {
        .ui-header-side { align-items: flex-start; }
      }
      @media (max-width: 480px) {
        .ui-nav { padding: 0 14px; gap: 10px; }
        .ui-nav-status-label { display: none; }
      }
      @media (prefers-reduced-motion: reduce) {
        * { transition: none !important; }
      }
    `}</style>
  );
}

// Uppercase IBM Plex Mono label -- the hub site's ".mono" style.
const monoLabel = { fontFamily: MONO, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase" };

// Full-page frame: sticky nav (back to the hub, page title, sync status)
// above a centered main column. status = { label, tone: "ok" | "pending" | "err" }.
export function AppShell({ title, status, children }) {
  const dotColor = !status ? null : status.tone === "err" ? BRICK : status.tone === "pending" ? MUTE_SOFT : TEAL;
  return (
    <div style={{ minHeight: "100vh", background: PAGE, color: INK, fontFamily: SANS }}>
      <GlobalStyle />
      <nav className="ui-nav">
        <a className="ui-link" href={HUB_URL} style={{ ...monoLabel, whiteSpace: "nowrap", justifySelf: "start" }}>&larr; Home</a>
        <span style={{ fontWeight: 700, fontSize: "0.95rem", letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</span>
        <div style={{ justifySelf: "end", display: "flex", alignItems: "center", gap: 8 }}>
          {status && (
            <>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
              <span className="ui-nav-status-label" style={{ ...monoLabel, color: status.tone === "err" ? BRICK : MUTE }}>{status.label}</span>
            </>
          )}
        </div>
      </nav>
      <div className="ui-body">
        <div className="ui-glow" aria-hidden="true" />
        <main className="ui-main">{children}</main>
      </div>
    </div>
  );
}

// Page heading in the hub site's header style: accent mono eyebrow, bold
// title, muted subline, with page actions and the signed-in account on the right.
export function PageHeader({ eyebrow, accent = TEAL, title, subline, actions, userEmail, onSignOut }) {
  return (
    <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16, borderBottom: `1px solid ${LINE}`, paddingBottom: 24, marginBottom: 4 }}>
      <div style={{ minWidth: 0 }}>
        {eyebrow && <span style={{ ...monoLabel, color: accent }}>{eyebrow}</span>}
        <h1 style={{ fontFamily: SANS, fontSize: "clamp(1.8rem, 4.5vw, 2.6rem)", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.05, margin: "12px 0 0", color: INK }}>{title}</h1>
        {subline && <p style={{ fontSize: "1rem", color: MUTE, margin: "10px 0 0", maxWidth: "52ch", lineHeight: 1.45 }}>{subline}</p>}
      </div>
      <div className="ui-header-side">
        {actions && <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{actions}</div>}
        {userEmail && (
          <div style={{ fontFamily: MONO, fontSize: 11, color: MUTE_SOFT }}>
            {userEmail} · <span className="ui-link" onClick={onSignOut} style={{ cursor: "pointer", textDecoration: "underline" }}>sign out</span>
          </div>
        )}
      </div>
    </header>
  );
}

// Hub-style footer rule: page notes on the left, the domain on the right.
export function Footer({ children }) {
  return (
    <footer style={{ marginTop: 72, paddingTop: 20, borderTop: `1px solid ${LINE}`, display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap", color: MUTE_SOFT, fontSize: "0.85rem" }}>
      <span style={{ fontFamily: MONO, fontSize: 11 }}>{children}</span>
      <span>thegardners.xyz</span>
    </footer>
  );
}

// stack: on phone widths, re-flow each row into a labeled card (see the
// .ui-stack rules in GlobalStyle). Pass stack={false} for narrow two-column
// tables that already fit a phone as-is.
export function Table({ children, stack = true }) {
  const ref = useRef(null);
  // Copy each column's header text onto its body cells as data-label, so the
  // stacked layout can show "Amount  $12.00" without every table having to
  // pass labels by hand. Runs after each render to pick up added rows.
  useLayoutEffect(() => {
    const table = ref.current;
    if (!stack || !table || !table.tHead || !table.tHead.rows[0]) return;
    const headers = [];
    for (const th of table.tHead.rows[0].cells) {
      for (let k = 0; k < th.colSpan; k++) headers.push(th.textContent.trim());
    }
    for (const body of table.tBodies) {
      for (const row of body.rows) {
        let col = 0;
        for (const cell of row.cells) {
          // A cell spanning the whole row (e.g. "Nothing logged yet") gets no label.
          // A plain-text first cell (no inputs) is the row's name: shown as the card title.
          const isTitle = col === 0 && row.cells.length > 1 && !cell.querySelector("input, select, button");
          const label = isTitle || (row.cells.length === 1 && cell.colSpan > 1) ? "" : headers[col] || "";
          if (cell.dataset.label !== label) cell.dataset.label = label;
          if (isTitle) cell.dataset.title = "";
          else delete cell.dataset.title;
          col += cell.colSpan;
        }
      }
    }
  });
  return (
    <div className={stack ? "ui-stack" : undefined} style={{ overflowX: "auto", overflowY: "hidden", border: `1px solid ${LINE}`, borderRadius: RADIUS, boxShadow: SHADOW_CARD, background: CARD }}>
      <table ref={ref} style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: SANS }}>
        {children}
      </table>
    </div>
  );
}

export function Th({ children, align }) {
  return (
    <th style={{
      textAlign: align || "left", padding: "10px 12px", background: HEAD_BG, borderBottom: `1px solid ${LINE}`,
      fontFamily: MONO, fontSize: 10.5, fontWeight: 500, letterSpacing: "0.1em", color: MUTE_SOFT, textTransform: "uppercase", whiteSpace: "nowrap",
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
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "44px 0 14px", gap: 10, flexWrap: "wrap" }}>
      <h2 style={{
        fontFamily: SANS, fontSize: "1.2rem", fontWeight: 600, color: INK, margin: 0,
        letterSpacing: "-0.01em", display: "flex", alignItems: "center", gap: 8,
      }}>
        {children}
      </h2>
      {note && <span style={{ ...monoLabel, fontSize: 10.5, letterSpacing: "0.08em", color: MUTE_SOFT }}>{note}</span>}
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
        color: primary ? ON_ACCENT : color,
        fontFamily: SANS,
        fontWeight: primary ? 600 : 500,
        fontSize: small ? 12 : 13.5,
        padding: small ? "5px 10px" : "9px 16px",
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

// Page/view switcher in the hub site's tab style: bordered mono-uppercase
// chips, with the active one raised and its icon picking up the accent.
export function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", maxWidth: "100%" }}>
      {tabs.map((t) => {
        const on = active === t.id;
        return (
          <button
            key={t.id}
            type="button"
            className="ui-tab"
            onClick={() => onChange(t.id)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              border: `1px solid ${on ? LINE_STRONG : LINE}`, background: on ? CARD : "transparent", color: on ? INK : MUTE,
              ...monoLabel, letterSpacing: "0.06em", padding: "10px 14px",
              borderRadius: 8, cursor: "pointer", whiteSpace: "nowrap",
              transition: `background ${TRANSITION}, border-color ${TRANSITION}, color ${TRANSITION}`,
            }}
          ><span style={{ display: "flex", color: on ? TEAL : "inherit", opacity: on ? 1 : 0.8 }}>{t.icon}</span>{t.label}</button>
        );
      })}
    </div>
  );
}

// Grid of KPI tiles for headline numbers (balances, projections) that
// deserve real visual weight instead of disappearing into another table row.
export function StatRow({ stats }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
      {stats.map((s, i) => (
        <div key={i} style={{
          border: `1px solid ${LINE}`, borderRadius: RADIUS, background: CARD,
          boxShadow: SHADOW_CARD, padding: "16px 18px",
        }}>
          <div style={{
            ...monoLabel, fontSize: 10.5, letterSpacing: "0.08em", color: MUTE_SOFT, marginBottom: 8, whiteSpace: "nowrap",
          }}>{s.label}</div>
          <div style={{
            fontFamily: SANS, fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums",
            color: s.color || INK, whiteSpace: "nowrap",
          }}>{s.value}</div>
          {s.sub && <div style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, marginTop: 4 }}>{s.sub}</div>}
        </div>
      ))}
    </div>
  );
}

// Elevated panel for chart insight boxes, callouts, and freeform content.
export function Card({ children, style, tint }) {
  return (
    <div style={{
      border: `1px solid ${LINE}`, borderRadius: RADIUS, background: tint || CARD,
      boxShadow: tint ? "none" : SHADOW_CARD, padding: 16, ...style,
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
