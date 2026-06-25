export function parseMaintenanceModeValue(value: unknown) {
  if (value === true) return true;
  if (value === false) return false;

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1";
  }

  if (typeof value === "object" && value !== null && "enabled" in value) {
    return Boolean((value as { enabled?: unknown }).enabled);
  }

  return false;
}
