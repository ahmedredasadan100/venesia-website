import "server-only";

import { unstable_cache } from "next/cache";
import { cache } from "react";

import { logError } from "../logging";
import {
  DEFAULT_PROJECT_LOCATION_SECTION_PRESENTATION,
  resolveProjectLocationSectionPresentation,
  type ProjectLocationSectionPresentation,
} from "./project-location-presentation";
import { getSupabaseAdmin } from "../supabase-admin";

async function queryProjectLocationSectionPresentation(
  projectId: number,
): Promise<ProjectLocationSectionPresentation> {
  const { data, error } = await getSupabaseAdmin()
    .from("projects")
    .select("show_location_label,show_location_tags")
    .eq("id", projectId)
    .maybeSingle();

  if (error) {
    logError("Project Location Section presentation read failed", error, {
      projectId,
    });
    throw new Error(error.message);
  }
  if (!data) return DEFAULT_PROJECT_LOCATION_SECTION_PRESENTATION;

  return resolveProjectLocationSectionPresentation(data);
}

export const loadProjectLocationSectionPresentation = cache(
  async function loadProjectLocationSectionPresentation(projectId: number) {
    if (!Number.isSafeInteger(projectId) || projectId <= 0) {
      return DEFAULT_PROJECT_LOCATION_SECTION_PRESENTATION;
    }
    try {
      return await unstable_cache(
        () => queryProjectLocationSectionPresentation(projectId),
        ["project-location-section-presentation-v2", String(projectId)],
        {
          revalidate: 300,
          tags: ["projects", "project"],
        },
      )();
    } catch (error) {
      logError("Project location safe rendering after source failure", error, { projectId });
      return DEFAULT_PROJECT_LOCATION_SECTION_PRESENTATION;
    }
  },
);
