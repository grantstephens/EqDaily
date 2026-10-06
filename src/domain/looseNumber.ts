/**
 * parseLooseNumber reads what a person types into a number field: "1,000",
 * "2,5", "1.000,5". With both separators present the last one is the decimal
 * point. A lone comma is a thousands separator only for whole-number fields
 * and a well-formed group ("1,000"); otherwise it is a decimal comma.
 * Returns null for anything that is not a plain number.
 */
export function parseLooseNumber(text: string, decimals: number): number | null {
  let t = text.trim();
  if (!/^-?[\d.,]+$/.test(t)) return null;
  const dot = t.lastIndexOf('.');
  const comma = t.lastIndexOf(',');
  if (dot >= 0 && comma >= 0) {
    const decimal = dot > comma ? '.' : ',';
    const thousands = decimal === '.' ? ',' : '.';
    t = t.split(thousands).join('').replace(decimal, '.');
  } else if (comma >= 0) {
    t = decimals === 0 && /^-?\d{1,3}(,\d{3})+$/.test(t) ? t.replace(/,/g, '') : t.replace(',', '.');
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
