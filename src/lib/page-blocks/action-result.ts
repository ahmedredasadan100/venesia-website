export type PageBlockActionResult = {
  ok: boolean;
  message: string | null;
  /** Optional post-action navigation (e.g. open duplicated module editor). */
  redirectTo?: string | null;
};

export const PAGE_BLOCK_ACTION_INITIAL: PageBlockActionResult = {
  ok: true,
  message: null,
};
