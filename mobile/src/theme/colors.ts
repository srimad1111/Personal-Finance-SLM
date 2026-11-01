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
  background: '#0B0F19',
  surface: '#111827',
  surfaceElevated: '#1A2234',
  card: '#141D2E',
  border: '#1E293B',
  borderSubtle: '#26334D',
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  accent: '#3B82F6',
  accentLight: '#60A5FA',
  accentDark: '#1D4ED8',
  success: '#10B981',
  successLight: 'rgba(16, 185, 129, 0.15)',
  warning: '#F59E0B',
  warningLight: 'rgba(245, 158, 11, 0.15)',
  danger: '#F43F5E',
  dangerLight: 'rgba(244, 63, 94, 0.15)',
  aiAccent: '#8B5CF6',
  aiAccentLight: 'rgba(139, 92, 246, 0.18)',
  aiAccentGlow: '#A78BFA',
  chipBackground: '#1E293B',
  overlay: 'rgba(0, 0, 0, 0.75)',
  shadowColor: '#000000',
};

export const lightColors: ColorTheme = {
  isDark: false,
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceElevated: '#F1F5F9',
  card: '#FFFFFF',
  border: '#E2E8F0',
  borderSubtle: '#CBD5E1',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  accent: '#2563EB',
  accentLight: '#3B82F6',
  accentDark: '#1D4ED8',
  success: '#059669',
  successLight: 'rgba(5, 150, 105, 0.12)',
  warning: '#D97706',
  warningLight: 'rgba(217, 119, 6, 0.12)',
  danger: '#E11D48',
  dangerLight: 'rgba(225, 29, 72, 0.12)',
  aiAccent: '#7C3AED',
  aiAccentLight: 'rgba(124, 58, 237, 0.12)',
  aiAccentGlow: '#8B5CF6',
  chipBackground: '#E2E8F0',
  overlay: 'rgba(15, 23, 42, 0.6)',
  shadowColor: '#0F172A',
};

