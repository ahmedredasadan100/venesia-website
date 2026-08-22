import "server-only";

import { buildProjectsHubRenderPlan, type ProjectsHubPlanResult } from "./build-projects-hub-render-plan";
import { loadProjectsHubComposition } from "./load-projects-hub-composition";

/** Loads the canonical composition and builds its typed render plan. */
export async function loadAndBuildProjectsHubPlan(): Promise<ProjectsHubPlanResult> {
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
