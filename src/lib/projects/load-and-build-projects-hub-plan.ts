import "server-only";

import {
  buildProjectsHubRenderPlan,
  type ProjectsHubLoadErrorReason,
  type ProjectsHubPlanResult,
} from "./build-projects-hub-render-plan";
import { loadProjectsHubComposition } from "./load-projects-hub-composition";

export class ProjectsHubPublicReadError extends Error {
  readonly reason: ProjectsHubLoadErrorReason;

  constructor(reason: ProjectsHubLoadErrorReason) {
    super(`Projects Hub public read failed: ${reason}`);
    this.name = "ProjectsHubPublicReadError";
    this.reason = reason;
  }
}

/** Loads the canonical composition and builds its typed render plan. */
export async function loadAndBuildProjectsHubPlan(): Promise<ProjectsHubPlanResult> {
  const loaded = await loadProjectsHubComposition();
  if (!loaded.ok) {
    if (loaded.status === "error") {
      return {
        status: "error",
        ready: false,
        reason: loaded.reason,
        modules: [],
        skipped: [],
      };
    }
    return {
      status: "unavailable",
      ready: false,
      reason: loaded.reason,
      modules: [],
      skipped: [],
    };
  }

  return buildProjectsHubRenderPlan(loaded.composition);
}
