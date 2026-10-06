/**
 * EqDaily's colours as plain data (no React/Paper imports, so contrast can be
 * unit-tested). Built around the icon: vivid indigo primary, with the icon's
 * amber as the accent (tertiary). Merged over Paper's Material 3 themes in
 * src/theme.ts; anything not listed here keeps Paper's default.
 */
export interface PaletteColors {
  primary: string; onPrimary: string; primaryContainer: string; onPrimaryContainer: string;
  secondary: string; onSecondary: string; secondaryContainer: string; onSecondaryContainer: string;
  tertiary: string; onTertiary: string; tertiaryContainer: string; onTertiaryContainer: string;
  background: string; onBackground: string; surface: string; onSurface: string;
  surfaceVariant: string; onSurfaceVariant: string; outline: string; outlineVariant: string;
  elevation: { level1: string; level2: string; level3: string; level4: string; level5: string };
}

export const LIGHT: PaletteColors = {
  primary: '#4326D9', onPrimary: '#FFFFFF', primaryContainer: '#E3DFFF', onPrimaryContainer: '#0E0066',
  secondary: '#5D5C72', onSecondary: '#FFFFFF', secondaryContainer: '#E2E0F9', onSecondaryContainer: '#1A1A2C',
  tertiary: '#7A5900', onTertiary: '#FFFFFF', tertiaryContainer: '#FFDEA1', onTertiaryContainer: '#261900',
  background: '#FCF8FF', onBackground: '#1B1B21', surface: '#FCF8FF', onSurface: '#1B1B21',
  surfaceVariant: '#E4E1EC', onSurfaceVariant: '#46464F', outline: '#777680', outlineVariant: '#C7C5D0',
  elevation: { level1: '#F5F2FC', level2: '#F0EDF8', level3: '#EBE8F4', level4: '#E9E6F2', level5: '#E5E2EF' },
};

export const DARK: PaletteColors = {
  primary: '#C6BFFF', onPrimary: '#20009E', primaryContainer: '#3A1FC8', onPrimaryContainer: '#E3DFFF',
  secondary: '#C6C4DD', onSecondary: '#2E2F42', secondaryContainer: '#444559', onSecondaryContainer: '#E2E0F9',
  tertiary: '#FFC83D', onTertiary: '#402D00', tertiaryContainer: '#5C4300', onTertiaryContainer: '#FFDEA1',
  background: '#121318', onBackground: '#E4E1E9', surface: '#121318', onSurface: '#E4E1E9',
  surfaceVariant: '#46464F', onSurfaceVariant: '#C7C5D0', outline: '#918F9A', outlineVariant: '#46464F',
  elevation: { level1: '#1B1B22', level2: '#1F1F27', level3: '#24242C', level4: '#26262E', level5: '#292931' },
};
