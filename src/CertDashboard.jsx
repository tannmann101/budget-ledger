import { useState, useMemo } from "react";
import { MONO, SANS, PAGE, INK, MUTE, LINE, CARD, HEAD_BG, TEAL, BRICK, GOLD, GOLD_SOFT, RADIUS_SM, SHADOW_CARD } from "./theme";
import { GlobalStyle, Table, Th, Td, Btn, Input, SectionTitle, Card, Note, StatRow } from "./ui";

// Local-only, on purpose: this is a scenario calculator ("what would this
// cert be worth"), not a ledger of real money -- it resets on reload just
// like the standalone page it was ported from. Finalized numbers still
// belong in the real Cert & Raise Tracker spreadsheet.
const uid = () => Math.random().toString(36).slice(2, 10);
const fmt = (n) =>
  (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const COMPONENTS = [
  { key: "exam", label: "Exam" },
  { key: "lab", label: "Skillable Lab" },
  { key: "project", label: "Project", optional: true },
];

const FLOW_STEPS = [
  { title: "Company Roadmap", sub: "certs tied to company metrics & needs" },
  { title: "Select Cert", sub: "discuss interest · 4th+ this year needs approval", decision: true },
  { title: "Cert Components", chips: ["Exam", "Skillable Lab", "Project*"] },
  { title: "Payout per component", chips: ["Raise", "Bonus"], sub: "set partly upfront, finalized at completion", decision: true },
  { title: "Cap Check", sub: "raises + bonuses vs. soft cap", decision: true },
];

const newComp = (type = "none", amount = "") => ({ type, amount });
const newCert = (name = "", comps) => ({
  id: uid(),
  name,
  comps: comps || { exam: newComp(), lab: newComp(), project: newComp() },
});

const seedCerts = () => [
  newCert("AWS Solutions Architect – Associate (example)", {
    exam: newComp("raise", "1500"),
    lab: newComp("bonus", "500"),
    project: newComp("raise", "750"),
  }),
  newCert(),
  newCert(),
];

function SegControl({ value, onChange }) {
  const opts = [["none", "—"], ["raise", "Raise"], ["bonus", "Bonus"]];
  return (
    <div style={{ display: "inline-flex", border: `1px solid ${LINE}`, borderRadius: RADIUS_SM, overflow: "hidden", flex: "0 0 auto" }}>
      {opts.map(([val, label], i) => {
        const active = value === val;
        const bg = active ? (val === "raise" ? TEAL : val === "bonus" ? GOLD : LINE) : "transparent";
        const color = active ? (val === "none" ? INK : "#FFFFFF") : MUTE;
        return (
          <button
            key={val} type="button" onClick={() => onChange(val)}
            style={{
              fontFamily: SANS, fontSize: 12, padding: "6px 12px", background: bg, color,
              border: "none", borderRight: i < opts.length - 1 ? `1px solid ${LINE}` : "none", cursor: "pointer",
            }}
          >{label}</button>
        );
      })}
    </div>
  );
}

export default function CertDashboard({ onBack, userEmail, onSignOut }) {
  const [certs, setCerts] = useState(seedCerts);
  const [baseSalary, setBaseSalary] = useState("55000");
  const [capAmount, setCapAmount] = useState("10000");
  const [approvalThreshold, setApprovalThreshold] = useState("3");

  const updateName = (id, name) => setCerts(certs.map((c) => (c.id === id ? { ...c, name } : c)));
  const updateComp = (id, key, patch) =>
    setCerts(certs.map((c) => (c.id === id ? { ...c, comps: { ...c.comps, [key]: { ...c.comps[key], ...patch } } } : c)));
  const addCert = () => setCerts([...certs, newCert()]);
  const removeCert = (id) => setCerts(certs.filter((c) => c.id !== id));

  const rows = useMemo(() => certs.map((c) => {
    let rowRaise = 0, rowBonus = 0;
    for (const comp of Object.values(c.comps)) {
      const amt = Number(comp.amount) || 0;
      if (comp.type === "raise") rowRaise += amt;
      if (comp.type === "bonus") rowBonus += amt;
    }
    return { ...c, rowRaise, rowBonus, counted: !!(c.name.trim() || rowRaise || rowBonus) };
  }), [certs]);

  const certCount = rows.filter((r) => r.counted).length;
  const totalRaise = rows.reduce((s, r) => s + r.rowRaise, 0);
  const totalBonus = rows.reduce((s, r) => s + r.rowBonus, 0);
  const combined = totalRaise + totalBonus;
  const cap = Number(capAmount) || 0;
  const remaining = cap - combined;
  const salary = Number(baseSalary) || 0;
  const threshold = Number(approvalThreshold) || 0;

  const pct = cap > 0 ? (combined / cap) * 100 : 0;
  const pctClamped = Math.max(0, Math.min(100, pct));
  let statusColor = TEAL, statusLabel = "On track";
  if (pct >= 100) { statusColor = BRICK; statusLabel = "At or over cap"; }
  else if (pct >= 80) { statusColor = GOLD; statusLabel = "Approaching cap"; }

  const showApproval = threshold > 0 && certCount > threshold;

  return (
    <div style={{ minHeight: "100vh", background: PAGE, fontFamily: SANS }}>
      <GlobalStyle />
      <div style={{ maxWidth: 920, margin: "0 auto", padding: "32px 20px 80px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 8, borderBottom: `1px solid ${LINE}`, paddingBottom: 16, marginBottom: 4 }}>
          <div>
            <h1 style={{ fontFamily: SANS, fontSize: 21, fontWeight: 700, letterSpacing: "-0.01em", margin: 0, color: TEAL }}>Cert &rarr; Raise Dashboard</h1>
            <div style={{ fontFamily: MONO, fontSize: 11.5, color: MUTE, marginTop: 3 }}>How the informal cert program pays out, and where you stand against the annual soft cap.</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
            <Btn small color={TEAL} onClick={onBack}>&larr; Household Ledger</Btn>
            <div style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE }}>
              {userEmail} · <span onClick={onSignOut} style={{ cursor: "pointer", textDecoration: "underline" }}>sign out</span>
            </div>
          </div>
        </div>

        <SectionTitle note="roadmap → cert → components → payout → cap check">How It Works</SectionTitle>
        <Card style={{ overflowX: "auto" }}>
          <div style={{ display: "flex", gap: 6, paddingBottom: 2 }}>
            {FLOW_STEPS.flatMap((step, i) => {
              const items = [
                <div key={`step-${i}`} style={{
                  flex: "1 1 170px", minWidth: 150, maxWidth: 190,
                  background: step.decision ? "transparent" : HEAD_BG,
                  border: `1px ${step.decision ? "dashed" : "solid"} ${LINE}`, borderRadius: RADIUS_SM,
                  padding: "10px 12px", fontSize: 12, lineHeight: 1.3,
                  display: "flex", flexDirection: "column", justifyContent: "center",
                }}>
                  <b style={{ display: "block", fontSize: 12.5, marginBottom: 2, color: INK }}>{step.title}</b>
                  {step.sub && <span style={{ color: MUTE, fontSize: 11.5 }}>{step.sub}</span>}
                  {step.chips && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                      {step.chips.map((chip) => (
                        <span key={chip} style={{ fontSize: 10.5, padding: "2px 7px", borderRadius: 999, background: CARD, border: `1px solid ${LINE}`, color: MUTE }}>{chip}</span>
                      ))}
                    </div>
                  )}
                </div>,
              ];
              if (i < FLOW_STEPS.length - 1) {
                items.push(<div key={`arrow-${i}`} style={{ flex: "0 0 auto", alignSelf: "center", color: MUTE, fontSize: 16, padding: "0 2px" }}>&rarr;</div>);
              }
              return items;
            })}
          </div>
        </Card>

        <SectionTitle>Settings</SectionTitle>
        <Table>
          <thead><tr><Th>Field</Th><Th align="right">Value</Th></tr></thead>
          <tbody>
            <tr>
              <Td>Base salary ($/yr)</Td>
              <Td align="right"><Input value={baseSalary} onChange={setBaseSalary} type="number" width={110} /></Td>
            </tr>
            <tr>
              <Td>Soft cap ($/yr, raises + bonuses)</Td>
              <Td align="right"><Input value={capAmount} onChange={setCapAmount} type="number" width={110} /></Td>
            </tr>
            <tr>
              <Td>Certs/yr before approval needed</Td>
              <Td align="right"><Input value={approvalThreshold} onChange={setApprovalThreshold} type="number" width={110} /></Td>
            </tr>
          </tbody>
        </Table>

        <SectionTitle>Annual Snapshot</SectionTitle>
        <StatRow stats={[
          { label: "Certs This Year", value: String(certCount) },
          { label: "Cumulative Raises", value: fmt(totalRaise), color: TEAL },
          { label: "Cumulative Bonuses", value: fmt(totalBonus), color: GOLD },
          { label: "Remaining Cap Room", value: fmt(remaining), color: remaining < 0 ? BRICK : INK },
          { label: "Projected Salary", value: fmt(salary + totalRaise) },
        ]} />

        <Card style={{ marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <span style={{ fontSize: 12.5, color: MUTE }}>Raises + bonuses vs. cap</span>
            <span style={{ fontSize: 13, color: MUTE, fontFamily: MONO }}>{fmt(combined)} of {fmt(cap)} ({Math.round(pct)}%)</span>
          </div>
          <div style={{ width: "100%", height: 14, borderRadius: 999, background: LINE, overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: "999px 0 0 999px", width: `${pctClamped}%`, background: statusColor, transition: "width 250ms ease, background 250ms ease" }} />
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, marginTop: 8, color: MUTE }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", display: "inline-block", background: statusColor }} />
            {statusLabel}
          </div>
          {showApproval && (
            <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: RADIUS_SM, fontSize: 12.5, display: "flex", alignItems: "center", gap: 8, background: GOLD_SOFT, border: `1px solid ${GOLD}`, color: INK }}>
              &#9888; Cert #{certCount} is past your informal {threshold}-cert norm for the year — confirm approval before starting it.
            </div>
          )}
        </Card>

        <SectionTitle note="add each cert as you take it on — mirrors the tracker spreadsheet">Cert Log</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 12 }}>
          {rows.map((cert) => (
            <Card key={cert.id} style={{ boxShadow: SHADOW_CARD }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                <Input value={cert.name} onChange={(v) => updateName(cert.id, v)} placeholder="e.g. CCNA" width={220} />
                <span style={{ fontSize: 11.5, padding: "5px 10px", borderRadius: 999, background: HEAD_BG, border: `1px solid ${LINE}`, color: MUTE, whiteSpace: "nowrap" }}>
                  Raise <b style={{ color: TEAL, marginLeft: 3, fontFamily: MONO }}>{fmt(cert.rowRaise)}</b>
                </span>
                <span style={{ fontSize: 11.5, padding: "5px 10px", borderRadius: 999, background: HEAD_BG, border: `1px solid ${LINE}`, color: MUTE, whiteSpace: "nowrap" }}>
                  Bonus <b style={{ color: GOLD, marginLeft: 3, fontFamily: MONO }}>{fmt(cert.rowBonus)}</b>
                </span>
                <Btn small color={BRICK} onClick={() => removeCert(cert.id)}>del</Btn>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {COMPONENTS.map((def) => (
                  <div key={def.key} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ flex: "0 0 112px", fontSize: 12.5, color: MUTE }}>
                      {def.label}
                      {def.optional && <span style={{ display: "block", fontSize: 10 }}>optional — not every cert has this</span>}
                    </span>
                    <SegControl value={cert.comps[def.key].type} onChange={(v) => updateComp(cert.id, def.key, { type: v })} />
                    <div style={{ display: "flex", alignItems: "center", gap: 4, flex: "1 1 90px", maxWidth: 130, background: CARD, border: `1px solid ${LINE}`, borderRadius: RADIUS_SM, padding: "0 8px" }}>
                      <span style={{ color: MUTE, fontSize: 12.5 }}>$</span>
                      <input
                        type="number" min="0" step="50" placeholder="0"
                        value={cert.comps[def.key].amount}
                        onChange={(e) => updateComp(cert.id, def.key, { amount: e.target.value })}
                        style={{ border: "none", background: "transparent", fontFamily: MONO, fontSize: 12.5, color: INK, padding: "6px 0", width: "100%", textAlign: "right", outline: "none" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
        <Btn small onClick={addCert}>+ Add cert</Btn>

        <Note>
          This page calculates live in your browser and resets when reopened — it's a scenario view, not a permanent
          record. Log finalized numbers in your Cert &amp; Raise Tracker spreadsheet for a lasting record.
        </Note>
      </div>
    </div>
  );
}
