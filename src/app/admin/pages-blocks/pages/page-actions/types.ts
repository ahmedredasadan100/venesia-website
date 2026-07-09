export type { PagesTableRow } from "../../../../../lib/admin/pages/load-pages-table-rows";

export type PagesTableResult = {
  ok: boolean;
  message?: string;
  rows?: import("../../../../../lib/admin/pages/load-pages-table-rows").PagesTableRow[];
};

export type ParsedAssignmentKey = {
  moduleKind: import("../../../../../lib/page-blocks/types").PageModuleKind;
  blockType: import("../../../../../lib/page-blocks/types").PageBlockType | null;
  assignmentId: number;
};
