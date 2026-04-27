export interface VariantStats {
  successes: number;
  failures: number;
}

function normalRandom(): number {
  let u1 = 0;
  let u2 = 0;
  while (u1 === 0) u1 = Math.random();
  while (u2 === 0) u2 = Math.random();
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}

function sampleGamma(alpha: number, scale: number): number {
  if (alpha < 1) {
    const u = Math.random();
    return sampleGamma(alpha + 1, scale) * Math.pow(u, 1 / alpha);
  }

  const d = alpha - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);

  while (true) {
    let x: number;
    let v: number;
    do {
      x = normalRandom();
      v = Math.pow(1 + c * x, 3);
    } while (v <= 0);

    const u = Math.random();
    const x2 = x * x;

    if (
      u < 1 - 0.0331 * x2 * x2 ||
      Math.log(u) < 0.5 * x2 + d * (1 - v + Math.log(v))
    ) {
      return d * v * scale;
    }
  }
}

function sampleBeta(alpha: number, beta: number): number {
  const x = sampleGamma(alpha, 1);
  const y = sampleGamma(beta, 1);
  return x / (x + y);
}

export function compareVariants(
  a: VariantStats,
  b: VariantStats,
  samples: number = 10000,
): number {
  const alphaA = a.successes + 1;
  const betaA = a.failures + 1;
  const alphaB = b.successes + 1;
  const betaB = b.failures + 1;

  let wins = 0;

  for (let i = 0; i < samples; i++) {
    const sampleA = sampleBeta(alphaA, betaA);
    const sampleB = sampleBeta(alphaB, betaB);
    if (sampleA > sampleB) wins++;
  }

  return wins / samples;
}

export function confidence(a: VariantStats, b: VariantStats): number {
  const p = compareVariants(a, b, 10000);
  return Math.max(p, 1 - p);
}

export function isWinner(
  a: VariantStats,
  b: VariantStats,
  thresholds: {
    confidence: number;
    minSampleSize: number;
    minImprovementMargin: number;
  },
): boolean {
  if (a.successes < 0 || a.failures < 0 || b.successes < 0 || b.failures < 0) {
    return false;
  }

  if (
    a.successes + a.failures < thresholds.minSampleSize ||
    b.successes + b.failures < thresholds.minSampleSize
  ) {
    return false;
  }

  const rateA = a.successes / (a.successes + a.failures);
  const rateB = b.successes / (b.successes + b.failures);

  if (rateA - rateB < thresholds.minImprovementMargin) {
    return false;
  }

  return compareVariants(a, b, 10000) >= thresholds.confidence;
}
