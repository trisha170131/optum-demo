// OPI (Optum Pricing Intelligence) Design System Tokens.
// Aligned with official OPI product design system (from Figma prototypes).
// Every component references these constants, so future brand updates are a one-file edit.
export const tokens = {
  // Primary: Optum Orange (#FF612B) — official brand color for alerts, deadlines, action items
  accent: '[#FF612B]', // optum-orange
  accentHover: '[#E85518]', // darker orange for hover states
  accentSoft: '[#FFF0E8]', // very light orange tint for backgrounds

  // Secondary: OPI Blue — for secondary actions, charts, secondary emphasis
  secondary: '[#5B7BFF]', // opi-blue (medium blue from OPI charts)
  secondaryHover: '[#4C6CE8]', // darker blue for hover
  secondarySoft: '[#EEF2FF]', // light blue tint

  // Neutrals: OPI gray palette
  surface: 'white', // card/container backgrounds
  page: '[#F9F8F6]', // opi-beige: warm, subtle page background (matches OPI aesthetic)
  border: '[#E5E7EB]', // light gray borders
  text: '[#374151]', // dark gray for body text (>5:1 contrast on white)
  textMuted: '[#6B7280]', // medium gray for secondary/helper text

  // Status colors (aligned with OPI's alert system)
  danger: '[#DC2626]', // red for critical/deadline alerts
  dangerSoft: '[#FEE2E2]', // light red background
  warn: '[#F59E0B]', // amber/gold for warning/detected states
  warnSoft: '[#FFFBEB]', // light amber background
  success: '[#10B981]', // emerald-green for positive/done states
  successSoft: '[#ECFDF5]', // light green background
  info: '[#3B82F6]', // blue for informational badges
  infoSoft: '[#EFF6FF]', // light blue background
};
