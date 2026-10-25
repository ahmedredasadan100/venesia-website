import "server-only";

type TopicWriteDatabaseError = {
  code?: string;
  constraint?: string;
  message?: string;
};

export function isTopicSlugUniqueViolation(
  error: TopicWriteDatabaseError | null,
) {
  if (!error || error.code !== "23505") return false;
  if (typeof error.constraint === "string") {
    return error.constraint === "topics_slug_key";
  }
  return /^duplicate key value violates unique constraint "topics_slug_key"$/.test(
    error.message ?? "",
  );
}

export class TopicSlugConflictError extends Error {
  readonly slug: string;

  constructor(slug: string, options?: ErrorOptions) {
    super(`Topic slug already exists: ${slug}`, options);
    this.name = "TopicSlugConflictError";
    this.slug = slug;
  }
}
