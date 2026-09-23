import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildDateRange, splitRange, fillDailySeries, metaDayKey, rate, sumNullable, growth } from './analyticsUtils.js';

describe('analyticsUtils', () => {
  it('buildDateRange builds a current and an equally long previous period', () => {
    const now = new Date('2026-09-22T12:00:00Z');
    const r = buildDateRange(30, now);
    assert.equal(r.from.toISOString(), '2026-08-23T12:00:00.000Z');
    assert.equal(r.prevFrom.toISOString(), '2026-07-24T12:00:00.000Z');
    assert.equal(r.prevTo.getTime(), r.from.getTime());
  });

  it('splitRange respects the max window and covers the whole range', () => {
    const from = new Date('2026-01-01T00:00:00Z');
    const to = new Date('2026-03-31T00:00:00Z'); // 89 days
    const w = splitRange(from, to, 30);
    assert.equal(w.length, 3);
    assert.equal(w[0].since, from.getTime() / 1000);
    assert.equal(w[2].until, to.getTime() / 1000);
    for (let i = 1; i < w.length; i++) assert.equal(w[i].since, w[i - 1].until);
    assert.ok(w.every(x => x.until - x.since <= 30 * 86400));
  });

  it('fillDailySeries returns one UTC day per entry, keeping known values', () => {
    const series = fillDailySeries(new Date('2026-09-01T15:00:00Z'), new Date('2026-09-03T01:00:00Z'), {
      '2026-09-02': { date: '2026-09-02', impressions: 5, engagements: 1, reach: 3 },
    });
    assert.deepEqual(series.map(d => d.date), ['2026-09-01', '2026-09-02', '2026-09-03']);
    assert.equal(series[1].impressions, 5);
    assert.equal(series[0].impressions, 0);
  });

  it('metaDayKey maps the end-of-day stamp to the day it describes', () => {
    assert.equal(metaDayKey('2026-09-20T07:00:00+0000'), '2026-09-19');
  });

  it('rate handles zero denominators', () => {
    assert.equal(rate(5, 200), 2.5);
    assert.equal(rate(5, 0), 0);
  });

  it('sumNullable ignores unknown values and returns null when all are unknown', () => {
    assert.equal(sumNullable([1, null, 2, undefined]), 3);
    assert.equal(sumNullable([null, undefined]), null);
  });

  it('growth only compares accounts that report both periods', () => {
    assert.deepEqual(growth([[120, 100], [50, null]]), { value: 20, pct: 20 });
    assert.equal(growth([[120, null], [null, 10]]), null);
    assert.deepEqual(growth([[10, 0]]), { value: 10, pct: 100 });
  });
});
