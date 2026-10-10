/** Presentation-owned guidance, never an upload validation or asset metadata. */
export type MediaSlotContract = {
  owner: string;
  slot: string;
  evidence: readonly string[];
  device?: "desktop" | "mobile" | "all";
  display: { kind: "ratio"; ratio: readonly [number, number] } | { kind: "responsive"; description: string };
  fit?: "cover" | "contain";
  note?: string;
};

export function mediaSlotGuidance(slot: MediaSlotContract): string[] {
  return [
    slot.display.kind === "ratio"
      ? `نسبة حاوية العرض: ${slot.display.ratio[0]}:${slot.display.ratio[1]} — إرشاد للتصميم، وليس شرطًا للرفع.`
      : slot.display.description,
    slot.fit === "cover" ? "تملأ الصورة الحاوية؛ قد تُقص الجوانب أو أعلى وأسفل حسب نسبة الأصل ومساحة العرض." : slot.fit === "contain" ? "تظهر الصورة كاملة داخل الحاوية مع الحفاظ على نسبتها." : "",
    slot.note ?? "",
  ].filter(Boolean);
}
