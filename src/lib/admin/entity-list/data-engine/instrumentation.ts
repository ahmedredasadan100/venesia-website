export type AdminEntityListTiming = {
  label: string;
  durationMs: number;
};

export async function measureAdminEntityListOperation<T>(
  label: string,
  operation: () => Promise<T>,
): Promise<{ value: T; timing: AdminEntityListTiming }> {
  const startedAt = performance.now();
  const value = await operation();
  return {
    value,
    timing: {
      label,
      durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
    },
  };
}

export function toServerTimingHeader(timings: readonly AdminEntityListTiming[]) {
  return timings
    .map(
      ({ label, durationMs }) =>
        `${label.replace(/[^a-zA-Z0-9_-]/g, "_")};dur=${durationMs}`,
    )
    .join(", ");
}
