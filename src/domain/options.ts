/**
 * rankOptions orders a checkbox/choice question's options for display: most
 * used first, ties in configured order, learned options (used, but not in the
 * config) after the configured ones they outrank. Options with no uses are
 * only shown if configured.
 */
export function rankOptions(
  configOptions: string[],
  usage: { option: string; count: number }[],
  limit = 8,
): { shown: string[]; more: string[] } {
  const count = new Map(usage.map((u) => [u.option, u.count]));
  const all: string[] = [...configOptions];
  for (const u of usage) if (u.count > 0 && !all.includes(u.option)) all.push(u.option);
  const ranked = all
    .map((option, i) => ({ option, i, c: count.get(option) ?? 0 }))
    .sort((a, b) => b.c - a.c || a.i - b.i)
    .map((r) => r.option);
  return { shown: ranked.slice(0, limit), more: ranked.slice(limit) };
}
