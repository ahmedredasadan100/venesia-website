import type { MediaTopicPayload } from "../../../../../lib/admin/media-topic-payload";

export const VALID_STATUSES = ["draft", "published", "unpublished", "archived"] as const;

export type MediaStatus = (typeof VALID_STATUSES)[number];

export type CategoryRow = {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  is_active: boolean | null;
};

export type MediaTopicRow = {
  id: number;
  title: string | null;
  slug: string | null;
  excerpt: string | null;
  content: string | null;
  image: string | null;
  image_alt: string | null;
  category_slug: string | null;
  content_type: string | null;
  status: MediaStatus | string | null;
  is_featured: boolean | null;
  published_at: string | null;
  media_payload: MediaTopicPayload | null;
};

export type BulkMediaPublishValidationFailure = {
  id: number;
  title: string;
  reason: string;
};

export type BulkMediaPublishValidationResult = {
  validIds: number[];
  failures: BulkMediaPublishValidationFailure[];
};
