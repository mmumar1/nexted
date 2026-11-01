import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createEventIcs,
  createGoogleCalendarUrl,
  formatDateTimeForZone,
  isValidTimeZone,
  localDateTimeToUtc,
} from "./event-utils.js";
import type { EventRecord } from "./schema.js";

const event: EventRecord = {
  id: "123",
  title: "Orientation, welcome",
  description: "Meet the teachers;\nbring notes",
  startsAt: new Date("2026-11-02T09:00:00.000Z"),
  endsAt: new Date("2026-11-02T10:00:00.000Z"),
  timezone: "Africa/Lagos",
  location: "Main hall",
  meetingUrl: "https://example.com/meet",
  status: "published",
  revision: 1,
  authorId: "teacher",
  authorName: "Teacher",
  publishedAt: new Date("2026-11-01T10:00:00.000Z"),
  createdAt: new Date("2026-11-01T10:00:00.000Z"),
  updatedAt: new Date("2026-11-01T10:00:00.000Z"),
  rsvpCount: 0,
  rsvpStatus: null,
};

describe("event utilities", () => {
  it("accepts valid IANA timezone names and rejects invalid ones", () => {
    assert.equal(isValidTimeZone("Africa/Lagos"), true);
    assert.equal(isValidTimeZone("not/a-zone"), false);
  });

  it("creates an escaped calendar file with UTC event dates", () => {
    const ics = createEventIcs(event);
    assert.match(ics, /DTSTART:20261102T090000Z/);
    assert.match(ics, /SUMMARY:Orientation\\, welcome/);
    assert.match(ics, /DESCRIPTION:Meet the teachers\\;\\nbring notes/);
    assert.match(ics, /URL:https:\/\/example\.com\/meet/);
    assert.ok(ics.endsWith("\r\n"));
  });

  it("creates a Google Calendar template link", () => {
    const url = new URL(createGoogleCalendarUrl(event));
    assert.equal(url.hostname, "calendar.google.com");
    assert.equal(url.searchParams.get("ctz"), "Africa/Lagos");
    assert.equal(url.searchParams.get("dates"), "20261102T090000Z/20261102T100000Z");
  });

  it("converts and formats event wall times using the selected timezone", () => {
    const startsAt = localDateTimeToUtc("2026-11-02T10:00", "Africa/Lagos");
    assert.equal(startsAt.toISOString(), "2026-11-02T09:00:00.000Z");
    assert.equal(formatDateTimeForZone(startsAt, "Africa/Lagos"), "2026-11-02T10:00");
  });

  it("uses the earlier instant for repeated daylight-saving times", () => {
    assert.equal(
      localDateTimeToUtc("2026-11-01T01:30", "America/New_York").toISOString(),
      "2026-11-01T05:30:00.000Z",
    );
  });

  it("rejects local times skipped by daylight-saving transitions", () => {
    assert.throws(
      () => localDateTimeToUtc("2026-03-08T02:30", "America/New_York"),
      /does not exist/,
    );
  });
});
