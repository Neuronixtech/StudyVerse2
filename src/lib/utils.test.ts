import { describe, expect, it } from "vitest";
import {
  clamp,
  daysUntil,
  formatClock,
  formatDate,
  formatDateTime,
  formatDuration,
  formatHoursMinutes,
  formatINR,
  formatTimer,
  greetingFor,
  initials,
  isValidEmail,
  isValidIndianPhone,
  moveItem,
  percent,
  plural,
  relativeTime,
  slugify,
} from "./utils";
import { DAY, FIXED_NOW, HOUR, MINUTE } from "@/test/fixtures/time";

describe("EXAM-019 — exam timer formatting", () => {
  it("always renders HH:MM:SS", () => {
    expect(formatTimer(3600)).toBe("01:00:00");
    expect(formatTimer(1199.9)).toBe("00:19:59");
    expect(formatTimer(59)).toBe("00:00:59");
  });

  it("never displays negative time", () => {
    expect(formatTimer(-1)).toBe("00:00:00");
    expect(formatTimer(-3600)).toBe("00:00:00");
  });
});

describe("duration formatting", () => {
  it("formatClock pads like a media player", () => {
    expect(formatClock(754)).toBe("12:34");
    expect(formatClock(3754)).toBe("1:02:34");
    expect(formatClock(5)).toBe("0:05");
    expect(formatClock(-5)).toBe("0:00");
  });

  it("formatDuration chooses the largest sensible unit", () => {
    expect(formatDuration(1520)).toBe("25m 20s");
    expect(formatDuration(4000)).toBe("1h 06m");
    expect(formatDuration(42)).toBe("42s");
  });

  it("formatHoursMinutes rounds to whole minutes", () => {
    expect(formatHoursMinutes(3000)).toBe("50m");
    expect(formatHoursMinutes(7200)).toBe("2h");
    expect(formatHoursMinutes(15_600)).toBe("4h 20m");
  });
});

describe("India-specific display (Asia/Kolkata, INR)", () => {
  it("formats rupees without decimals", () => {
    expect(formatINR(1299)).toBe("₹1,299");
    expect(formatINR(125000)).toBe("₹1,25,000");
  });

  it("displays dates in IST regardless of the machine time zone", () => {
    // 20:00 UTC on 19 Nov is already 20 Nov in India
    const lateUtc = Date.UTC(2026, 10, 19, 20, 0);
    expect(formatDate(lateUtc)).toBe("20 Nov 2026");
    expect(formatDateTime(FIXED_NOW)).toMatch(/^20 Nov 2026, 10:00\s?am$/i);
  });

  it("greets using IST hours", () => {
    expect(greetingFor(FIXED_NOW)).toBe("Good morning"); // 10:00 IST
    expect(greetingFor(FIXED_NOW + 5 * HOUR)).toBe("Good afternoon"); // 15:00 IST
    expect(greetingFor(FIXED_NOW + 9 * HOUR)).toBe("Good evening"); // 19:00 IST
  });
});

describe("dates and relative time", () => {
  it("daysUntil rounds partial days up and never goes negative", () => {
    expect(daysUntil(FIXED_NOW + 64 * DAY, FIXED_NOW)).toBe(64);
    expect(daysUntil(FIXED_NOW + 1.2 * DAY, FIXED_NOW)).toBe(2);
    expect(daysUntil(FIXED_NOW - DAY, FIXED_NOW)).toBe(0);
  });

  it("relativeTime reads naturally in both directions", () => {
    expect(relativeTime(FIXED_NOW - 30_000, FIXED_NOW)).toBe("just now");
    expect(relativeTime(FIXED_NOW - 5 * MINUTE, FIXED_NOW)).toBe("5 mins ago");
    expect(relativeTime(FIXED_NOW - HOUR, FIXED_NOW)).toBe("1 hour ago");
    expect(relativeTime(FIXED_NOW + 3 * DAY, FIXED_NOW)).toBe("in 3 days");
    expect(relativeTime(FIXED_NOW - 60 * DAY, FIXED_NOW)).toBe(formatDate(FIXED_NOW - 60 * DAY));
  });
});

describe("AUTH-003 / AUTH-005 — validation helpers", () => {
  it.each(["aarav@example.com", "  a.b+c@school.co.in  "])("accepts email %j", (email) => expect(isValidEmail(email)).toBe(true));
  it.each(["", "aarav", "aarav@", "aarav@example", "a b@example.com", "aarav@example.c"])("rejects email %j", (email) => expect(isValidEmail(email)).toBe(false));

  it.each(["9876543210", "+91 98765 43210", "+91-9876543210", "98765 43210"])("accepts Indian mobile %j", (phone) => expect(isValidIndianPhone(phone)).toBe(true));
  it.each(["5876543210", "987654321", "98765432100", "+1 9876543210"])("rejects mobile %j", (phone) => expect(isValidIndianPhone(phone)).toBe(false));
});

describe("ADMIN-004 / ADMIN-005 — reordering", () => {
  it("moves an item without mutating the original list", () => {
    const list = ["a", "b", "c", "d"];
    expect(moveItem(list, 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveItem(list, 3, 0)).toEqual(["d", "a", "b", "c"]);
    expect(list).toEqual(["a", "b", "c", "d"]);
  });

  it("ignores moves past either end", () => {
    const list = ["a", "b"];
    expect(moveItem(list, 0, -1)).toBe(list);
    expect(moveItem(list, 1, 2)).toBe(list);
  });
});

describe("small helpers", () => {
  it("percent handles zero totals", () => {
    expect(percent(1, 3)).toBe(33);
    expect(percent(2, 0)).toBe(0);
  });

  it("clamp, plural, initials and slugify", () => {
    expect(clamp(15, 0, 10)).toBe(10);
    expect(plural(1, "book")).toBe("1 book");
    expect(plural(2, "book")).toBe("2 books");
    expect(initials("Rohan  Iyer Kumar")).toBe("RI");
    expect(slugify("  JEE Physics: Mechanics!  ")).toBe("jee-physics-mechanics");
  });
});
