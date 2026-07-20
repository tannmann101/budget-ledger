// theme.js
// Shared design tokens for the whole app — single source of truth so
// Ledger/Debts/Plan/AuthGate render as one consistent, professional system
// instead of four independently-drifting inline style sheets.
//
// PAGE is this app's sage-green wash -- the plan tracker app uses the same
// card-on-colored-wash system with a terracotta wash instead, so the two
// apps read as one family while staying visually distinct at a glance.

export const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
export const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, Helvetica, Arial, sans-serif";

export const BG = "#FFFFFF";
export const CARD = "#FFFFFF";
export const PAGE = "#C7CEB2";
export const INK = "#181A17";
export const MUTE = "#68685F";
export const MUTE_SOFT = "#9A9A90";
export const LINE = "#E3E2D9";
export const HEAD_BG = "rgba(255,255,255,0.55)";

export const TEAL = "#1F5C4F";
export const TEAL_SOFT = "#E2EEE9";
export const BRICK = "#A23F2A";
export const BRICK_SOFT = "#F4E4DE";
export const GOLD = "#8C6410";
export const GOLD_SOFT = "#F1E7D0";

export const RADIUS = 16;
export const RADIUS_SM = 10;
export const SHADOW_CARD = "0 2px 6px rgba(24,26,23,0.06), 0 14px 32px rgba(24,26,23,0.10)";
export const TRANSITION = "120ms ease";

export const softTint = (color) => {
  if (color === TEAL) return TEAL_SOFT;
  if (color === BRICK) return BRICK_SOFT;
  if (color === GOLD) return GOLD_SOFT;
  return HEAD_BG;
};
