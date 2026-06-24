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
  status: "draft" | "published" | "unpublished" | "archived";
  nowIso: string;
}) {
  if (options.formPublishedDate) {
    return normalizePublishedAtStorage(options.formPublishedDate);
  }

  if (options.currentPublishedAt) {
    return options.currentPublishedAt;
  }

  if (options.status === "published") {
    return options.nowIso;
  }

  return null;
}

export function formatAdminListDate(value?: string | null) {
  if (!value) return "غير محدد";

  return new Intl.DateTimeFormat("ar-EG", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}
