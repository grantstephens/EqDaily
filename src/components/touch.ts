/** Android's minimum comfortable touch target, in dp. */
export const TOUCH = 48;

/**
 * Props that make a Paper Button at least TOUCH tall and wide. Paper's compact
 * and default buttons are 40 tall (and the compact ones as narrow as 25), which
 * is easy to miss with a thumb. Spread onto <Button>.
 */
export const touchButton = {
  style: { minWidth: TOUCH },
  contentStyle: { minHeight: TOUCH },
} as const;

/** Chips are 32 tall by default; 44 keeps them chips rather than big pills while staying easy to hit. */
export const CHIP_TOUCH = 46; // renders ~44 tall once Paper's border is taken off
export const touchChip = { style: { minHeight: CHIP_TOUCH } } as const;
