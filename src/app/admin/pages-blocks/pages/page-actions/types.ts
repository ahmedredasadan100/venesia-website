export type PageMutationResult =
  | { ok: true; message: string }
  | { ok: false; code: string; message: string };

export type PageDeleteResult =
  | { ok: true; message: string; deletedIds: number[]; blockedIds: number[]; blockedCount: number }
  | { ok: false; code: string; message: string; blockedIds?: number[]; blockedCount?: number };

export type PagesTableResult = PageDeleteResult;

export type ParsedAssignmentKey = {
  moduleKind: import("../../../../../lib/page-blocks/types").PageModuleKind;
  blockType: import("../../../../../lib/page-blocks/types").PageBlockType | null;
  assignmentId: number;
};
