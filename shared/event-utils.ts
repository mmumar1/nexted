import type { EventRecord } from "./schema.js";

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
    return true;
  } catch {
    return false;
  }
}

function escapeCalendarText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function toCalendarTimestamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

type ZonedDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function getZonedDateParts(date: Date, timeZone: string): ZonedDateParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function parseLocalDateTime(value: string): ZonedDateParts {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) throw new RangeError("Enter a valid local date and time.");
  const [, yearText, monthText, dayText, hourText, minuteText, secondText = "0"] = match;
  const parts = {
    year: Number(yearText),
    month: Number(monthText),
    day: Number(dayText),
    hour: Number(hourText),
    minute: Number(minuteText),
    second: Number(secondText),
  };
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second));
  if (
    date.getUTCFullYear() !== parts.year
    || date.getUTCMonth() + 1 !== parts.month
    || date.getUTCDate() !== parts.day
    || parts.hour > 23
    || parts.minute > 59
    || parts.second > 59
  ) {
    throw new RangeError("Enter a valid local date and time.");
  }
  return parts;
}

function datePartsMatch(left: ZonedDateParts, right: ZonedDateParts): boolean {
  return left.year === right.year
    && left.month === right.month
    && left.day === right.day
    && left.hour === right.hour
    && left.minute === right.minute
    && left.second === right.second;
}

export function localDateTimeToUtc(value: string, timeZone: string): Date {
  const localParts = parseLocalDateTime(value);
  const localTimestamp = Date.UTC(
    localParts.year,
    localParts.month - 1,
    localParts.day,
    localParts.hour,
    localParts.minute,
    localParts.second,
  );
  const offsets = new Set(
    [-24, 0, 24].map((hours) => {
      const probe = localTimestamp + hours * 60 * 60 * 1000;
      const zonedParts = getZonedDateParts(new Date(probe), timeZone);
      return Date.UTC(
        zonedParts.year,
        zonedParts.month - 1,
        zonedParts.day,
        zonedParts.hour,
        zonedParts.minute,
        zonedParts.second,
      ) - probe;
    }),
  );
  const matches = Array.from(offsets)
    .map((offset) => new Date(localTimestamp - offset))
    .filter((candidate) => datePartsMatch(getZonedDateParts(candidate, timeZone), localParts))
    .sort((left, right) => left.getTime() - right.getTime());
  if (matches.length === 0) {
    throw new RangeError(`That local time does not exist in ${timeZone}. Choose another time.`);
  }
  return matches[0];
}

export function formatDateTimeForZone(date: Date, timeZone: string): string {
  const parts = getZonedDateParts(date, timeZone);
  const twoDigits = (value: number) => String(value).padStart(2, "0");
  return `${String(parts.year).padStart(4, "0")}-${twoDigits(parts.month)}-${twoDigits(parts.day)}T${twoDigits(parts.hour)}:${twoDigits(parts.minute)}`;
}

export function createEventIcs(event: EventRecord): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Learnpedia//Events//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${event.id}@learnpedia`,
    `DTSTAMP:${toCalendarTimestamp(new Date())}`,
    `DTSTART:${toCalendarTimestamp(event.startsAt)}`,
    `DTEND:${toCalendarTimestamp(event.endsAt)}`,
    `SUMMARY:${escapeCalendarText(event.title)}`,
    `DESCRIPTION:${escapeCalendarText(event.description)}`,
    `X-WR-TIMEZONE:${escapeCalendarText(event.timezone)}`,
    ...(event.location ? [`LOCATION:${escapeCalendarText(event.location)}`] : []),
    ...(event.meetingUrl ? [`URL:${event.meetingUrl}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.join("\r\n")}\r\n`;
}

export function createGoogleCalendarUrl(event: EventRecord): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${toCalendarTimestamp(event.startsAt)}/${toCalendarTimestamp(event.endsAt)}`,
    details: `${event.description}${event.meetingUrl ? `\n\nJoin: ${event.meetingUrl}` : ""}`,
    ctz: event.timezone,
    ...(event.location ? { location: event.location } : {}),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
