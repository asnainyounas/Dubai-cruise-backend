// src/utils/schedule.js
'use strict';

// startsAt is the BOARDING time, in Dubai local time, stored as UTC.

/**
 * Generates a sorted, deduplicated array of Date objects representing
 * candidate departure times within the given date range.
 *
 * Dubai uses UTC+4 year-round (no DST).
 *
 * @param {object} params
 * @param {string}   params.startDate   - Calendar date, "YYYY-MM-DD"
 * @param {string}   params.endDate     - Calendar date, "YYYY-MM-DD"
 * @param {number[]} params.daysOfWeek  - 0 (Sun) – 6 (Sat)
 * @param {string[]} params.times       - "HH:mm" strings in Dubai local time
 * @returns {Date[]}
 */
function buildStartTimes({ startDate, endDate, daysOfWeek, times }) {
  const results = [];

  // Parse calendar date string into { year, month, day } using only the
  // date string itself, keeping calculations independent of the server timezone.
  function parseParts(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return { year, month, day };
  }

  // Compute the UTC day-of-week for a given calendar date.
  // Date.UTC treats the values as UTC calendar components, so the result
  // is the same regardless of the server's local timezone setting.
  function utcDayOfWeek(year, month, day) {
    return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  }

  const allowed = new Set(daysOfWeek);

  const start = parseParts(startDate);
  const end = parseParts(endDate);

  // Represent each date as a UTC millisecond epoch for iteration.
  // Using Date.UTC avoids any local-timezone influence.
  let cursor = Date.UTC(start.year, start.month - 1, start.day);
  const endMs = Date.UTC(end.year, end.month - 1, end.day);

  const ONE_DAY_MS = 86_400_000;

  while (cursor <= endMs) {
    const d = new Date(cursor);
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    const day = d.getUTCDate();

    if (allowed.has(utcDayOfWeek(year, month, day))) {
      for (const time of times) {
        // Convert Dubai local date+time to UTC using an explicit offset string.
        // "+04:00" is the fixed Dubai offset; no DST applies.
        const startsAt = new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${time}:00+04:00`);
        results.push(startsAt);
      }
    }

    cursor += ONE_DAY_MS;
  }

  // Sort ascending by UTC instant (Date objects sort by valueOf()).
  results.sort((a, b) => a - b);

  return results;
}

module.exports = { buildStartTimes };
