/**
 * The fixed "now" every deterministic test runs at: 20 Nov 2026, 10:00 IST.
 * Seed data is generated relative to this anchor, so subscription expiry,
 * reservation windows and "days left" are identical on every machine.
 */
export const FIXED_NOW = Date.UTC(2026, 10, 20, 4, 30);

export const SECOND = 1_000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
