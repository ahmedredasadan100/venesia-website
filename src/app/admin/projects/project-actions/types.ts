export const VALID_PUBLICATION_STATUSES = ["draft", "published", "unpublished", "archived"] as const;

export type PublicationStatus = (typeof VALID_PUBLICATION_STATUSES)[number];
