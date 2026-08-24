/**
 * Persistence for the Project Location Section presentation is co-located with
 * the Project row so each Project page can make an independent decision. The
 * Location Section is the only presentation owner; Project location values and
 * every other Consumer remain outside this contract.
 */
export type ProjectLocationSectionPresentationStorage = {
  show_location_label: boolean;
  show_location_tags: boolean;
};

export type ProjectLocationSectionPresentation = {
  showLocationLabel: boolean;
  showLocationTags: boolean;
};

export const DEFAULT_PROJECT_LOCATION_SECTION_PRESENTATION = {
  showLocationLabel: true,
  showLocationTags: true,
} as const satisfies ProjectLocationSectionPresentation;

export function resolveProjectLocationSectionPresentation(
  source:
    | Partial<ProjectLocationSectionPresentationStorage>
    | null
    | undefined,
): ProjectLocationSectionPresentation {
  return {
    showLocationLabel: source?.show_location_label !== false,
    showLocationTags: source?.show_location_tags !== false,
  };
}
