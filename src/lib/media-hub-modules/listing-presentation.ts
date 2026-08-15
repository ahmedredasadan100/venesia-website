import type { MediaContentType } from "../media-center/types";
import {
  getDefaultMediaListingPresentation,
  type MediaListingPresentationConfig,
} from "./parse-config";
import type { MediaHubModulesState } from "./types";

export function resolveMediaListingPresentation(
  state: MediaHubModulesState | null,
  mediaType: MediaContentType,
): MediaListingPresentationConfig {
  const configuredModule = state?.modules.find(
    (module) =>
      module.isVisible &&
      module.config.placement === "listing" &&
      module.config.type === mediaType &&
      module.config.listing,
  );

  if (configuredModule?.config.listing) return configuredModule.config.listing;

  return {
    ...getDefaultMediaListingPresentation(mediaType),
    featuredMode: "disabled",
    manualTopicId: null,
  };
}
