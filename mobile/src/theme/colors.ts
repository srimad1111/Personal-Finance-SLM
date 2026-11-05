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
  background: '#090D16',       // Main background - Deep obsidian
  surface: '#111827',          // Card & Container background - Rich dark slate
  surfaceElevated: '#172033',  // Secondary surface - Interactive tiles, inputs, chips
  card: '#111827',             // Primary card surface
  border: '#263247',           // Clean restrained border
  borderSubtle: 'rgba(38, 50, 71, 0.5)', // Subtle internal dividers
  textPrimary: '#F8FAFC',      // Crisp white foreground
  textSecondary: '#94A3B8',    // Neutral slate secondary
  textMuted: '#64748B',        // Muted captions & labels
  accent: '#3B82F6',           // Primary fintech blue
  accentLight: '#60A5FA',
  accentDark: '#2563EB',
  success: '#10B981',          // Positive green / income
  successLight: 'rgba(16, 185, 129, 0.12)',
  warning: '#F59E0B',          // Warning amber
  warningLight: 'rgba(245, 158, 11, 0.12)',
  danger: '#F43F5E',           // Negative red / expense
  dangerLight: 'rgba(244, 63, 94, 0.12)',
  aiAccent: '#6366F1',         // AI / SLM indigo accent
  aiAccentLight: 'rgba(99, 102, 241, 0.14)',
  aiAccentGlow: '#818CF8',
  chipBackground: '#172033',
  overlay: 'rgba(9, 13, 22, 0.88)',
  shadowColor: '#000000',
};

export const lightColors: ColorTheme = {
  isDark: false,
  background: '#F8FAFC',       // Clean light background
  surface: '#FFFFFF',          // Card surface
  surfaceElevated: '#F1F5F9',  // Elevated secondary surface
  card: '#FFFFFF',
  border: '#E2E8F0',           // 1px hairline border
  borderSubtle: '#F1F5F9',
  textPrimary: '#0F172A',      // Slate foreground
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  accent: '#2563EB',           // Primary blue
  accentLight: '#3B82F6',
  accentDark: '#1D4ED8',
  success: '#059669',          // Positive emerald
  successLight: 'rgba(5, 150, 105, 0.10)',
  warning: '#D97706',
  warningLight: 'rgba(217, 119, 6, 0.10)',
  danger: '#E11D48',           // Rose crimson
  dangerLight: 'rgba(225, 29, 72, 0.10)',
  aiAccent: '#4F46E5',         // Indigo
  aiAccentLight: 'rgba(79, 70, 229, 0.10)',
  aiAccentGlow: '#6366F1',
  chipBackground: '#F1F5F9',
  overlay: 'rgba(15, 23, 42, 0.60)',
  shadowColor: '#0F172A',
};
