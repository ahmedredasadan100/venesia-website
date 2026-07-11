import "server-only";

import { buildProjectsHubRenderPlan, type ProjectsHubPlanResult } from "./build-projects-hub-render-plan";
import { loadProjectsHubComposition } from "./load-projects-hub-composition";
import { isProjectsHubCmsEnabled } from "./projects-hub-cms-flag";

/**
 * Loads composition and builds a typed render plan.
 * Never throws. Callers must still gate on isProjectsHubCmsEnabled().
 */
export async function loadAndBuildProjectsHubPlan(): Promise<ProjectsHubPlanResult> {
  if (!isProjectsHubCmsEnabled()) {
    return {
      ready: false,
      reason: "feature_flag_disabled",
      modules: [],
      skipped: [],
    };
  }

  const loaded = await loadProjectsHubComposition();
  if (!loaded.ok) {
    return {
      ready: false,
      reason: loaded.reason,
      modules: [],
      skipped: [],
    };
  }

  return buildProjectsHubRenderPlan(loaded.composition);
}
