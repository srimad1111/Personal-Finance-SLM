export interface ColorTheme {
  isDark: boolean;
  background: string;
  surface: string;
  surfaceElevated: string;
  card: string;
  border: string;
  borderSubtle: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentLight: string;
  accentDark: string;
  success: string;
  successLight: string;
  warning: string;
  warningLight: string;
  danger: string;
  dangerLight: string;
  aiAccent: string;
  aiAccentLight: string;
  aiAccentGlow: string;
  chipBackground: string;
  overlay: string;
  shadowColor: string;
}

export const darkColors: ColorTheme = {
  isDark: true,
  background: '#090D16', // Deep obsidian navy
  surface: '#0F1523',    // Rich dark slate
  surfaceElevated: '#161F32', // Elevated interactive surface
  card: '#111828',       // Crisp card base
  border: '#1E293D',     // Hairline border
  borderSubtle: '#141D2D', // Very subtle internal divider
  textPrimary: '#F8FAFC', // Ultra-clear white
  textSecondary: '#94A3B8', // Neutral secondary
  textMuted: '#64748B',  // Muted caption/metadata
  accent: '#3B82F6',     // Premium fintech blue
  accentLight: '#60A5FA',
  accentDark: '#1D4ED8',
  success: '#10B981',    // Restrained emerald (positive / income)
  successLight: 'rgba(16, 185, 129, 0.12)',
  warning: '#F59E0B',    // Amber
  warningLight: 'rgba(245, 158, 11, 0.12)',
  danger: '#F43F5E',     // Rose crimson (negative / expense)
  dangerLight: 'rgba(244, 63, 94, 0.12)',
  aiAccent: '#6366F1',   // Refined indigo for SLM features
  aiAccentLight: 'rgba(99, 102, 241, 0.14)',
  aiAccentGlow: '#818CF8',
  chipBackground: '#161F32',
  overlay: 'rgba(9, 13, 22, 0.85)',
  shadowColor: '#000000',
};

export const lightColors: ColorTheme = {
  isDark: false,
  background: '#F8FAFC', // Soft crisp off-white
  surface: '#FFFFFF',    // Pure white surface
  surfaceElevated: '#F1F5F9', // Elevated clean surface
  card: '#FFFFFF',
  border: '#E2E8F0',     // Subtle 1px hairline border
  borderSubtle: '#F1F5F9',
  textPrimary: '#0F172A', // Deep slate neutral foreground
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  accent: '#2563EB',     // High-contrast primary blue
  accentLight: '#3B82F6',
  accentDark: '#1D4ED8',
  success: '#059669',    // Deep emerald
  successLight: 'rgba(5, 150, 105, 0.10)',
  warning: '#D97706',
  warningLight: 'rgba(217, 119, 6, 0.10)',
  danger: '#E11D48',     // Clear crimson
  dangerLight: 'rgba(225, 29, 72, 0.10)',
  aiAccent: '#4F46E5',   // Deep indigo
  aiAccentLight: 'rgba(79, 70, 229, 0.10)',
  aiAccentGlow: '#6366F1',
  chipBackground: '#F1F5F9',
  overlay: 'rgba(15, 23, 42, 0.60)',
  shadowColor: '#0F172A',
};
