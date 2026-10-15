import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    // Official Website Palette (aquaplusrotech.shop)
    background: '#F8FAFC',       // Slate-50 clean background
    surface: '#FFFFFF',          // Card & sheet surface
    cardBackground: '#FFFFFF',
    text: '#0F172A',             // Slate-900 primary dark text
    textSecondary: '#475569',    // Slate-600 strong secondary text (high contrast on white)
    textTertiary: '#64748B',     // Slate-500 placeholder & microcopy (high contrast on white)
    textInverse: '#FFFFFF',
    
    // Brand Water-Tech Blues & Cyans
    oceanBlue: '#164E63',        // Deep Ocean Blue / Cyan-900
    deepTeal: '#0E7490',         // Deep Teal / Cyan-700
    aqua: '#06B6D4',             // Aqua / Cyan-500
    primary: '#0891B2',          // Primary Cyan Button / Brand Main (#0891b2)
    secondaryBlue: '#0369A1',    // Secondary Blue / Sky-700
    
    // Tints & Subtle Surfaces
    paleAqua: '#ECFEFF',         // Cyan-50 ultra-light tint
    paleBlue: '#F0F9FF',         // Sky-50 light tint
    backgroundElement: '#F1F5F9',// Slate-100 neutral element
    backgroundSelected: '#E2E8F0',
    border: '#E2E8F0',           // Slate-200 border
    borderSubtle: '#F1F5F9',     // Slate-100 subtle divider
    
    // Status Tones
    success: '#10B981',
    successLight: '#ECFDF5',
    warning: '#D97706',          // Amber-600 high-contrast status
    warningLight: '#FEF3C7',
    danger: '#EF4444',
    dangerLight: '#FEF2F2',
    info: '#0891B2',
    infoLight: '#ECFEFF',

    // Supporting Aliases
    primaryLight: '#E0F2FE',     // Light Sky tint
    accent: '#06B6D4',           // Aqua accent
    accentLight: '#ECFEFF',
    paleMint: '#E0F2FE',         // Cyan/Sky tint alias for backward compatibility
  },
  dark: {
    background: '#0B132B',
    surface: '#111D3D',
    cardBackground: '#111D3D',
    text: '#F1F5F9',
    textSecondary: '#94A3B8',
    textTertiary: '#64748B',
    textInverse: '#0B132B',

    oceanBlue: '#0E7490',
    deepTeal: '#06B6D4',
    aqua: '#22D3EE',
    primary: '#06B6D4',
    secondaryBlue: '#38BDF8',

    paleAqua: '#0C2338',
    paleBlue: '#0E2A47',
    backgroundElement: '#182747',
    backgroundSelected: '#1F335C',
    border: '#1E293B',
    borderSubtle: '#172033',

    success: '#34D399',
    successLight: '#0B2E21',
    warning: '#FBBF24',
    warningLight: '#33230A',
    danger: '#F87171',
    dangerLight: '#381616',
    info: '#22D3EE',
    infoLight: '#0E2838',

    primaryLight: '#0F2C47',
    accent: '#22D3EE',
    accentLight: '#0E2838',
    paleMint: '#0C2338',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Gradients = {
  // Deep ocean-blue gradient ONLY for selected hero elements
  hero: ['#0F172A', '#164E63', '#0E7490'] as const,
  heroDeep: ['#0A1322', '#164E63', '#0891B2'] as const,
  aquaFlux: ['#164E63', '#0891B2', '#06B6D4'] as const,
  buttonPrimary: ['#0891B2', '#0E7490'] as const,
  buttonSecondary: ['#0369A1', '#0284C7'] as const,
  cardHighlight: ['#FFFFFF', '#F8FAFC'] as const,
  cardAquaTint: ['rgba(236, 254, 255, 0.7)', 'rgba(255, 255, 255, 0.95)'] as const,
  statCyan: ['rgba(6, 182, 212, 0.1)', 'rgba(8, 145, 178, 0.02)'] as const,
  statBlue: ['rgba(3, 105, 161, 0.1)', 'rgba(3, 105, 161, 0.02)'] as const,
  statGreen: ['rgba(16, 185, 129, 0.1)', 'rgba(16, 185, 129, 0.02)'] as const,
  statAmber: ['rgba(245, 158, 11, 0.1)', 'rgba(245, 158, 11, 0.02)'] as const,
  statRed: ['rgba(239, 68, 68, 0.1)', 'rgba(239, 68, 68, 0.02)'] as const,
};

export const Radii = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  xxl: 28,
  full: 9999,
} as const;

export const Shadows = {
  sm: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  md: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  lg: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  float: {
    shadowColor: '#0E7490',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 6,
  },
  hero: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 6,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 60, android: 84 }) ?? 84;
export const MaxContentWidth = 800;
