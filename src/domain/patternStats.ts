// src/domain/patternStats.ts
/** Small statistics kit for Patterns: Welch's t-test, Cohen's d, Student-t p-values. */

export const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

const variance = (xs: number[]): number => {
  // identical decimals (7.1, 7.1, ...) leave float noise in the mean; call them exactly constant
  if (xs.every((x) => x === xs[0])) return 0;
  const m = mean(xs);
  return xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1);
};

// ln Γ(x), Lanczos approximation (Numerical Recipes), ~1e-10 accurate.
function lgamma(x: number): number {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (const cj of c) ser += cj / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

// Continued fraction for the incomplete beta function (Lentz's method).
function betacf(a: number, b: number, x: number): number {
  const FPMIN = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 3e-14) break;
  }
  return h;
}

// Regularised incomplete beta I_x(a, b).
function betai(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? (bt * betacf(a, b, x)) / a : 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** Two-sided p-value of Student's t with `df` degrees of freedom. */
export function tTwoSidedP(t: number, df: number): number {
  return betai(df / (df + t * t), df / 2, 0.5);
}

export interface Welch { t: number; df: number; p: number; d: number }

/**
 * welch compares the means of two groups (a minus b). `d` is Cohen's d with the
 * pooled SD. Null when either group has fewer than two values or when neither
 * group varies at all (nothing to compare against).
 */
export function welch(a: number[], b: number[]): Welch | null {
  if (a.length < 2 || b.length < 2) return null;
  const va = variance(a);
  const vb = variance(b);
  if (va === 0 && vb === 0) return null;
  const se2 = va / a.length + vb / b.length;
  const diff = mean(a) - mean(b);
  const t = diff / Math.sqrt(se2);
  const df = se2 ** 2 / ((va / a.length) ** 2 / (a.length - 1) + (vb / b.length) ** 2 / (b.length - 1));
  const pooled = Math.sqrt(((a.length - 1) * va + (b.length - 1) * vb) / (a.length + b.length - 2));
  return { t, df, p: tTwoSidedP(t, df), d: diff / pooled };
}
