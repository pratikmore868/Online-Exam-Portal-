import { test } from "node:test";
import assert from "node:assert/strict";
import { friendlyDateTime, friendlyDay } from "../lib/dates.ts";

const now = new Date(2026, 10, 2, 10, 0);

test("today includes the very start and end of the day", () => {
  assert.equal(friendlyDay(new Date(2026, 10, 2, 0, 0), now), "Today");
  assert.equal(friendlyDay(new Date(2026, 10, 2, 23, 59), now), "Today");
});

test("yesterday goes by calendar day, not 24 hours", () => {
  assert.equal(friendlyDay(new Date(2026, 10, 1, 23, 59), now), "Yesterday");
  assert.equal(friendlyDay(new Date(2026, 10, 1, 0, 0), now), "Yesterday");
});

test("older and future dates keep showing a real date", () => {
  assert.ok(friendlyDay(new Date(2026, 9, 31, 23, 0), now).includes("2026"));
  assert.ok(friendlyDay(new Date(2026, 10, 3, 9, 0), now).includes("2026"));
});

test("month and year boundaries work", () => {
  assert.equal(friendlyDay(new Date(2026, 11, 31, 20, 0), new Date(2027, 0, 1, 8, 0)), "Yesterday");
});

test("date and time together", () => {
  assert.ok(friendlyDateTime(new Date(2026, 10, 2, 9, 30), now).startsWith("Today, 9:30"));
});
