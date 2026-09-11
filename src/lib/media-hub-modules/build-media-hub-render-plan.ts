import type { MediaHubModuleState } from "./types";
import { comparePageAssignmentOrder } from "../page-composition/page-assignment-contract";

export function buildMediaHubRenderPlan(modules: MediaHubModuleState[]): MediaHubModuleState[] {
  return [...modules]
    .filter((module) => module.isVisible)
    .sort(
      (left, right) => comparePageAssignmentOrder(
        {
          sortOrder: left.sortOrder,
          moduleKind: "media-hub",
          assignmentId: left.assignmentId,
        },
        {
          sortOrder: right.sortOrder,
          moduleKind: "media-hub",
          assignmentId: right.assignmentId,
        },
      ),
    );
}
