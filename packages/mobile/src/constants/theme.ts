// ── Design Tokens ────────────────────────────────
// Keep in sync with tailwind.config.js

export const COLORS = {
  background: '#0f172a',
  card: '#1e293b',
  accent: '#7c3aed',
  accentLight: '#8b5cf6',
  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  border: '#334155',
  success: '#22c55e',
  danger: '#ef4444',
  warning: '#f59e0b',
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const FONT_SIZE = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
} as const;
