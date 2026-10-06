/**
 * ThemeMode is the user's stored preference; 'system' follows the OS.
 *
 * Colors, typography and shape come from react-native-paper's Material 3
 * themes with EqDaily's palette (domain/palette.ts) merged over the colours,
 * selected in ThemeContext.tsx and provided to the app via PaperProvider. `Theme` is re-exported as an alias for Paper's MD3Theme so
 * every screen's `createStyles(theme: Theme)` signature keeps working
 * unchanged; only the token paths moved (e.g. `theme.text` -> `theme.colors.onBackground`,
 * `theme.accent` -> `theme.colors.primary`).
 */
export type ThemeMode = 'system' | 'light' | 'dark';

import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';

import { DARK, LIGHT, type PaletteColors } from './domain/palette';

export type { MD3Theme as Theme } from 'react-native-paper';

const withPalette = (base: MD3Theme, p: PaletteColors): MD3Theme => ({
  ...base,
  colors: { ...base.colors, ...p, elevation: { ...base.colors.elevation, ...p.elevation } },
});

export const LightTheme = withPalette(MD3LightTheme, LIGHT);
export const DarkTheme = withPalette(MD3DarkTheme, DARK);
