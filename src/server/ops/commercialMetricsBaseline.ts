export class CommercialMetricsBaselineError extends Error {
  constructor(message = 'Commercial metrics baseline date is invalid') {
    super(message);
    this.name = 'CommercialMetricsBaselineError';
  }
}

export function readCommercialMetricsBaseline(env: NodeJS.ProcessEnv = process.env): Date | null {
  const raw = env.COMMERCIAL_METRICS_BASELINE_DATE?.trim();
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new CommercialMetricsBaselineError();
  const value = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(value.getTime()) || value.toISOString().slice(0, 10) !== raw) {
    throw new CommercialMetricsBaselineError();
  }
  return value;
}

export function clampMetricsCutoff(requested: Date | null, baseline: Date | null): Date | null {
  if (!requested) return baseline;
  if (!baseline) return requested;
  return requested.getTime() >= baseline.getTime() ? requested : baseline;
}
