import type { MediaHubModuleState } from "./types";

export function resolveMediaListingConfig(
  module: MediaHubModuleState,
) {
  if (
    !module.isVisible ||
    module.config.placement !== "listing" ||
    !module.config.type ||
    !module.config.listing
  ) return null;

  return {
    assignmentId: module.assignmentId,
    contentType: module.config.type,
    presentation: module.config.listing,
  };
}
