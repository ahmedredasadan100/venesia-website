export type FloorPlanSpec = {
  label: string;
  value: string;
};

/** Parses legacy display strings such as "3 غرف" into label/value pairs. */
export function parseLegacySpecString(text: string): FloorPlanSpec {
  const trimmed = text.trim();
  if (!trimmed) return { label: "", value: "" };

  const numbered = /^(\d+)\s+(.+)$/.exec(trimmed);
  if (numbered) {
    return { value: numbered[1], label: numbered[2].trim() };
  }

  return { label: trimmed, value: "" };
}

export function normalizeFloorPlanSpecs(raw: unknown): FloorPlanSpec[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      if (typeof item === "string") return parseLegacySpecString(item);
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        return {
          label: String(record.label ?? "").trim(),
          value: String(record.value ?? "").trim(),
        };
      }
      return { label: "", value: "" };
    })
    .filter((item) => item.label || item.value);
}

/** Public-facing display format: "3 غرف" */
export function formatFloorPlanSpecDisplay(spec: FloorPlanSpec) {
  if (spec.value && spec.label) return `${spec.value} ${spec.label}`;
  return spec.label || spec.value;
}

export function parseFloorPlanSpecsFromForm(formData: FormData, planIndex: number): FloorPlanSpec[] {
  const labels = formData.getAll(`floor_plan_${planIndex}_spec_label`).map(String);
  const values = formData.getAll(`floor_plan_${planIndex}_spec_value`).map(String);

  return labels
    .map((label, index) => ({
      label: label.trim(),
      value: (values[index] ?? "").trim(),
    }))
    .filter((item) => item.label || item.value);
}
