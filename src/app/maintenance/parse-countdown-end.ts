export function parseMaintenanceCountdownEnd(): string | null {
  const raw = process.env.MAINTENANCE_COUNTDOWN_END?.trim();
  if (!raw) return null;

  const timestamp = Date.parse(raw);
  if (Number.isNaN(timestamp)) return null;

  return new Date(timestamp).toISOString();
}
