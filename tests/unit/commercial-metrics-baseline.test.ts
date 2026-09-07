import { expect, test } from 'vitest';
import {
  clampMetricsCutoff,
  CommercialMetricsBaselineError,
  readCommercialMetricsBaseline,
} from '@/server/ops/commercialMetricsBaseline';

test('missing baseline is null', () => {
  expect(readCommercialMetricsBaseline({} as NodeJS.ProcessEnv)).toBeNull();
});

test('valid baseline is midnight UTC', () => {
  expect(readCommercialMetricsBaseline({ COMMERCIAL_METRICS_BASELINE_DATE: '2026-09-07' } as NodeJS.ProcessEnv)?.toISOString())
    .toBe('2026-09-07T00:00:00.000Z');
});

test.each(['2026-9-7', '2026-02-30', 'not-a-date'])('invalid baseline %s fails closed', (value) => {
  expect(() => readCommercialMetricsBaseline({ COMMERCIAL_METRICS_BASELINE_DATE: value } as NodeJS.ProcessEnv))
    .toThrow(CommercialMetricsBaselineError);
});

test('clamp chooses the later boundary', () => {
  const baseline = new Date('2026-09-07T00:00:00.000Z');
  expect(clampMetricsCutoff(new Date('2026-08-01T00:00:00.000Z'), baseline)?.toISOString())
    .toBe('2026-09-07T00:00:00.000Z');
  expect(clampMetricsCutoff(new Date('2026-09-10T00:00:00.000Z'), baseline)?.toISOString())
    .toBe('2026-09-10T00:00:00.000Z');
});
