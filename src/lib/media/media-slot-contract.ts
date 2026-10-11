/** Presentation-owned guidance, never an upload validation or asset metadata. */
export type MediaSlotContract = {
  /** Geometry decision belongs to the presentation, independently of asset availability. */
  presence?: "RESERVED" | "COLLAPSIBLE";
  owner: string;
  slot: string;
  evidence: readonly string[];
  device?: "desktop" | "mobile" | "all";
  display: { kind: "ratio"; ratio: readonly [number, number] } | { kind: "responsive"; description: string };
  fit?: "cover" | "contain";
  note?: string;
  design?: { kind: "recommended"; width: number; height: number; rationale: string; composition: string } | { kind: "no-single-size"; rationale: string; composition: string };
};

export function mediaSlotGuidance(slot: MediaSlotContract): string[] {
  const design = slot.design;
  return [
    design?.kind === "recommended" ? `المقاس التصميمي الموصى به: \u2066${design.width} × ${design.height} px\u2069 — توصية للتصميم وليست شرطًا للرفع.` : design ? "لا يوجد مقاس تصميم واحد آمن لهذا الحقل." : "",
    design?.rationale ?? "",
    design?.composition ?? "",
    slot.display.kind === "ratio"
      ? `نسبة حاوية العرض: ${slot.display.ratio[0]}:${slot.display.ratio[1]} — إرشاد للتصميم، وليس شرطًا للرفع.`
      : slot.display.description,
    slot.fit === "cover" ? "تملأ الصورة الحاوية؛ قد تُقص الجوانب أو أعلى وأسفل حسب نسبة الأصل ومساحة العرض." : slot.fit === "contain" ? "تظهر الصورة كاملة داخل الحاوية مع الحفاظ على نسبتها." : "",
    slot.note ?? "",
  ].filter(Boolean);
}

export function isMediaSlotPresent(presence: "RESERVED" | "COLLAPSIBLE", renderable: boolean): boolean {
  return presence === "RESERVED" || renderable;
}
