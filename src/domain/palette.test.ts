import { DARK, LIGHT, type PaletteColors } from './palette';

function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

const TEXT_PAIRS: [keyof PaletteColors, keyof PaletteColors][] = [
  ['onPrimary', 'primary'],
  ['onPrimaryContainer', 'primaryContainer'],
  ['onSecondary', 'secondary'],
  ['onSecondaryContainer', 'secondaryContainer'],
  ['onTertiary', 'tertiary'],
  ['onTertiaryContainer', 'tertiaryContainer'],
  ['onSurface', 'surface'],
  ['onBackground', 'background'],
  ['onSurfaceVariant', 'surfaceVariant'],
  ['onSurfaceVariant', 'background'],
  // text buttons and links draw primary on the page itself
  ['primary', 'background'],
  ['primary', 'surface'],
  // chips and the tab pill sit on top of the elevated tab bar
  ['onSecondaryContainer', 'secondaryContainer'],
];

describe.each([['light', LIGHT], ['dark', DARK]] as const)('%s palette', (_name, p) => {
  test.each(TEXT_PAIRS)('%s on %s has at least 4.5:1 contrast', (fg, bg) => {
    expect(contrast(p[fg] as string, p[bg] as string)).toBeGreaterThanOrEqual(4.5);
  });
  test('every colour is a 6-digit hex', () => {
    for (const [k, v] of Object.entries(p)) {
      if (typeof v === 'string') expect(v).toMatch(/^#[0-9A-Fa-f]{6}$/);
      else for (const [lk, lv] of Object.entries(v)) expect(`${k}.${lk}:${lv}`).toMatch(/#[0-9A-Fa-f]{6}$/);
    }
  });
});

test('the light primary is the icon indigo and the amber accent is the icon amber family', () => {
  expect(LIGHT.primary.toUpperCase()).toBe('#4326D9');
  expect(LIGHT.tertiaryContainer.toUpperCase()).toBe('#FFDEA1');
  expect(DARK.tertiary.toUpperCase()).toBe('#FFC83D');
});
