/**
 * Project Domain owns location data and these presentation decisions.
 * Consumers may adopt the decisions later; they must never copy the data or
 * persist a parallel visibility source.
 */
export type ProjectLocationPresentationStorage = {
  show_location_label: boolean;
  show_location_tags: boolean;
};

export type ProjectLocationPresentation = {
  showDetailedAddress: boolean;
  showLocationTags: boolean;
};

export const DEFAULT_PROJECT_LOCATION_PRESENTATION = {
  showDetailedAddress: true,
  showLocationTags: true,
} as const satisfies ProjectLocationPresentation;

export function resolveProjectLocationPresentation(
  source: Partial<ProjectLocationPresentationStorage> | null | undefined,
): ProjectLocationPresentation {
  return {
    showDetailedAddress: source?.show_location_label !== false,
    showLocationTags: source?.show_location_tags !== false,
  };
}

type ProjectLocationLabelSource = {
  label: string | null | undefined;
  presentation: ProjectLocationPresentation;
};

/**
 * Project owns the global presentation decision; an individual Consumer may
 * additionally opt out, but it cannot override a Project-level hide decision.
 */
export function resolveVisibleProjectLocationLabel(
  source: ProjectLocationLabelSource,
  consumerVisible = true,
) {
  if (!consumerVisible || !source.presentation.showDetailedAddress) return null;
  const label = source.label?.trim();
  return label || null;
}

export function resolveVisibleProjectLocationTags<Item>(
  presentation: ProjectLocationPresentation,
  tags: readonly Item[],
  consumerVisible = true,
): Item[] {
  return consumerVisible && presentation.showLocationTags ? [...tags] : [];
}
