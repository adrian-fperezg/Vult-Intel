import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DateTime } from 'luxon';
import { parseAllowedDays, calculateSendingDelay, getNextBusinessSlot } from './sequenceUtils.js';

describe('sequenceUtils', () => {
  describe('parseAllowedDays', () => {
    it('returns default allowed days (Mon-Fri) for null or undefined input', () => {
      const resultNull = parseAllowedDays(null);
      const resultUndef = parseAllowedDays(undefined);
      assert.deepEqual(resultNull, [true, true, true, true, true, false, false]);
      assert.deepEqual(resultUndef, [true, true, true, true, true, false, false]);
    });

    it('parses Postgres array format string correctly', () => {
      const pgString = '{true,true,true,false,false,false,false}';
      const result = parseAllowedDays(pgString);
      assert.deepEqual(result, [true, true, true, false, false, false, false]);
    });

    it('parses JSON array format string correctly', () => {
      const jsonString = JSON.stringify([false, true, true, true, true, false, false]);
      const result = parseAllowedDays(jsonString);
      assert.deepEqual(result, [false, true, true, true, true, false, false]);
    });

    it('handles raw boolean array', () => {
      const arrayInput = [true, false, true, false, true, false, true];
      const result = parseAllowedDays(arrayInput);
      assert.deepEqual(result, [true, false, true, false, true, false, true]);
    });

    it('falls back to default on invalid string', () => {
      const invalid = 'invalid_format';
      const result = parseAllowedDays(invalid);
      assert.deepEqual(result, [true, true, true, true, true, false, false]);
    });
  });

  describe('calculateSendingDelay', () => {
    const tz = 'America/New_York';
    const weekdays = [true, true, true, true, true, false, false]; // Mon-Fri

    it('returns 0 if current time is inside the allowed window on a weekday', () => {
      // Wednesday at 11:00 AM NY
      const midDay = DateTime.fromISO('2026-04-15T11:00:00', { zone: tz });
      const delay = calculateSendingDelay(midDay, '09:00', '17:00', tz, weekdays);
      assert.equal(delay, 0);
    });

    it('returns exact delay to window start if current time is before window', () => {
      // Wednesday at 07:00 AM NY -> window starts at 09:00 AM (2 hours = 7,200,000 ms)
      const earlyMorning = DateTime.fromISO('2026-04-15T07:00:00', { zone: tz });
      const delay = calculateSendingDelay(earlyMorning, '09:00', '17:00', tz, weekdays);
      assert.equal(delay, 2 * 60 * 60 * 1000);
    });

    it('returns delay to next allowed day if current time is on a weekend', () => {
      // Saturday at 12:00 PM NY -> next window is Monday 09:00 AM
      const saturdayNoon = DateTime.fromISO('2026-04-18T12:00:00', { zone: tz });
      const delay = calculateSendingDelay(saturdayNoon, '09:00', '17:00', tz, weekdays);
      assert.ok(delay > 0);

      // Verify that adding delay lands on Monday at 09:00 AM
      const nextTime = saturdayNoon.plus({ milliseconds: delay }).setZone(tz);
      assert.equal(nextTime.weekday, 1); // Monday
      assert.equal(nextTime.hour, 9);
      assert.equal(nextTime.minute, 0);
    });

    it('returns safety 24h delay when no days are allowed', () => {
      const time = DateTime.fromISO('2026-04-15T11:00:00', { zone: tz });
      const allFalse = [false, false, false, false, false, false, false];
      const delay = calculateSendingDelay(time, '09:00', '17:00', tz, allFalse);
      assert.equal(delay, 24 * 60 * 60 * 1000);
    });
  });

  describe('getNextBusinessSlot', () => {
    it('returns baseTime unchanged when restrict_sending_hours is false', () => {
      const baseTime = DateTime.fromISO('2026-04-18T23:00:00', { zone: 'UTC' });
      const sequence = { restrict_sending_hours: false };
      const nextSlot = getNextBusinessSlot(baseTime, sequence);
      assert.equal(nextSlot.toISO(), baseTime.toISO());
    });
  });
});
