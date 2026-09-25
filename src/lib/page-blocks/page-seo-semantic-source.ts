import { comparePageAssignmentOrder } from "../page-composition/page-assignment-contract";
import type { PageModuleKind } from "./types";

export type PageSeoSemanticPart = Readonly<{
  content: string;
  slot: string;
  sortOrder: number;
  moduleKind: PageModuleKind;
  assignmentId: number;
}>;

/**
 * Canonical Page semantic-content assembly shared by interactive Page saves
 * and the bounded persisted-score backfill. The Layout owns Region order;
 * Page Composition owns assignment order inside a Region.
 */
export function buildPageSeoSemanticContent(
  parts: readonly PageSeoSemanticPart[],
  regionKeys: readonly string[],
): string {
  const regionOrder = new Map(regionKeys.map((key, index) => [key, index]));
  return [...parts]
    .sort((first, second) =>
      (regionOrder.get(first.slot) ?? Number.MAX_SAFE_INTEGER)
        - (regionOrder.get(second.slot) ?? Number.MAX_SAFE_INTEGER)
      || comparePageAssignmentOrder(first, second),
    )
    .map((entry) => entry.content)
    .join("\n");
}
