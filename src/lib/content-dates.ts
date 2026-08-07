export function getTodayInputValue() {
  const date = new Date();
  const timezoneOffset = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

export function getDateInputValue(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const timezoneOffset = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

export function parseFormPublishedDate(formData: FormData, field = "published_at") {
  const value = formData.get(field);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

export function normalizePublishedAtStorage(dateValue: string) {
  return `${dateValue}T12:00:00.000Z`;
}

export function formatArabicContentDate(value?: string | null) {
  if (!value) return "";

  try {
    const parsed = value.includes("T") ? new Date(value) : new Date(`${value}T12:00:00`);
    if (Number.isNaN(parsed.getTime())) return value;

    return new Intl.DateTimeFormat("ar-EG", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(parsed);
  } catch {
    return value;
  }
}

export function resolveTopicPublishedAt(options: {
  formPublishedDate: string | null;
  currentPublishedAt: string | null;
  status: "published" | "unpublished";
  nowIso: string;
}) {
  if (options.currentPublishedAt) {
    return options.currentPublishedAt;
  }

  if (options.status !== "published") {
    return null;
  }

  return options.formPublishedDate
    ? normalizePublishedAtStorage(options.formPublishedDate)
    : options.nowIso;
}

export const ADMIN_TIME_ZONE = "Africa/Cairo";
export const ADMIN_DATE_TIME_PATTERN = "DD MMM YYYY, hh:mm A";
export const ADMIN_DATE_ONLY_PATTERN = "DD MMM YYYY";

const ADMIN_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  timeZone: ADMIN_TIME_ZONE,
});

const ADMIN_DATE_ONLY_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function adminDateTimePart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
) {
  return parts.find((part) => part.type === type)?.value ?? "";
}

export function formatAdminDateTime(value?: string | null) {
  if (!value) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatAdminDateOnly(value);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const parts = ADMIN_DATE_TIME_FORMATTER.formatToParts(date);
  const day = adminDateTimePart(parts, "day");
  const month = adminDateTimePart(parts, "month");
  const year = adminDateTimePart(parts, "year");
  const hour = adminDateTimePart(parts, "hour");
  const minute = adminDateTimePart(parts, "minute");
  const dayPeriod = adminDateTimePart(parts, "dayPeriod").toUpperCase();

  if (!day || !month || !year || !hour || !minute || !dayPeriod) return "—";

  return `${day} ${month} ${year}, ${hour}:${minute} ${dayPeriod}`;
}

export function formatAdminDateOnly(value?: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "—";
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return "—";
  }

  return ADMIN_DATE_ONLY_FORMATTER.format(date);
}
