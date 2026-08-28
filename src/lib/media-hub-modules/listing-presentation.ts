import type { MediaContentType } from "../media-center/types";
import {
  getDefaultMediaListingPresentation,
  type MediaListingPresentationConfig,
} from "./parse-config";
import type { MediaHubModulesState } from "./types";

function findAssignedMediaListing(state: MediaHubModulesState | null) {
  return state?.modules.find(
    (module) =>
      module.isVisible &&
      module.config.placement === "listing" &&
      module.config.type &&
      module.config.listing,
  );
}

export function resolveMediaListingConfig(
  state: MediaHubModulesState | null,
  fallbackMediaType: MediaContentType,
) {
  const configuredModule = findAssignedMediaListing(state);

  return {
    contentType: configuredModule?.config.type ?? fallbackMediaType,
    presentation:
      configuredModule?.config.listing ??
      getDefaultMediaListingPresentation(),
  };
}

export function resolveMediaListingPresentation(
  state: MediaHubModulesState | null,
  mediaType: MediaContentType,
): MediaListingPresentationConfig {
  return resolveMediaListingConfig(state, mediaType).presentation;
}
