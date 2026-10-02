// theme.js
// Shared design tokens for the whole app — single source of truth so
// Ledger/Debts/Plan/AuthGate render as one consistent, professional system
// instead of four independently-drifting inline style sheets.
//
// Follows the thegardners.xyz hub's design language (dark surfaces, hairline
// borders, Instrument Sans + IBM Plex Mono, sticky blurred nav) so the app
// reads as part of the same network, but swaps the hub's blue accent for a
// deep forest-green wash so the finance tracker keeps its own identity.
// The hub site loads the two web fonts via index.html; the fallbacks below
// keep things legible if they ever fail to load.

export const MONO = "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
export const SANS = "'Instrument Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export const PAGE = "#0b110d";        // page background (hub: --bg, tinted green)
export const CARD = "#121a15";        // raised surface (hub: --surface)
export const BG = "#18221c";          // inset fields / secondary surface (hub: --surface-2)
export const HEAD_BG = "#18221c";     // table headers, tooltips, row hover
export const INK = "#e6ebe7";         // hub: --text
export const MUTE = "#9aa69e";        // hub: --muted
export const MUTE_SOFT = "#6b776f";   // hub: --faint
export const LINE = "rgba(255,255,255,0.07)";         // hub: --border
export const LINE_STRONG = "rgba(255,255,255,0.16)";  // hub: --border-strong
export const NAV_BG = "rgba(11,17,13,0.85)";

// Semantic colors, tuned to read on the dark surfaces above. TEAL is the
// app's green accent (positive balances, primary actions); the names are
// kept from the old light theme so every page keeps working unchanged.
export const TEAL = "#72b389";
export const TEAL_SOFT = "rgba(114,179,137,0.14)";
export const BRICK = "#d18b80";
export const BRICK_SOFT = "rgba(209,139,128,0.13)";
export const GOLD = "#d4b46c";
export const GOLD_SOFT = "rgba(212,180,108,0.12)";
export const GLOW = "rgba(114,179,137,0.12)";

// Text drawn on top of a filled accent (primary buttons, active chips).
export const ON_ACCENT = PAGE;

export const RADIUS = 10;
export const RADIUS_SM = 7;
export const SHADOW_CARD = "none";
export const TRANSITION = "150ms ease";

export const softTint = (color) => {
  if (color === TEAL) return TEAL_SOFT;
  if (color === BRICK) return BRICK_SOFT;
  if (color === GOLD) return GOLD_SOFT;
  return HEAD_BG;
};
