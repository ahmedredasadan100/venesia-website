export type PageBlockActionResult = {
  ok: boolean;
  message: string | null;
  /** Optional post-action navigation (e.g. open duplicated module editor). */
  redirectTo?: string | null;
  /** Exact aggregate-write revision used for targeted client reconciliation. */
  updatedAt?: string;
};

export const PAGE_BLOCK_ACTION_INITIAL: PageBlockActionResult = {
  ok: true,
  message: null,
};
