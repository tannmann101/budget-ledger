// icons.jsx
// A handful of minimal stroke icons for tab nav -- hand-drawn rather than an
// icon library dependency, since the app has none today and these three
// glyphs are all the nav needs.

const base = { width: 15, height: 15, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };

export function IconLedger() {
  return (
    <svg {...base}>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <circle cx="16.5" cy="14.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconDebts() {
  return (
    <svg {...base}>
      <rect x="2.5" y="5.5" width="19" height="13" rx="2" />
      <path d="M2.5 9.5h19" />
      <path d="M5.5 14.5h5" />
    </svg>
  );
}

export function IconPlan() {
  return (
    <svg {...base}>
      <path d="M4 20V10M11 20V4M18 20v-7" />
      <path d="M2 20h20" />
    </svg>
  );
}
