export type PageBlockActionResult = {
  ok: boolean;
  message: string | null;
};

export const PAGE_BLOCK_ACTION_INITIAL: PageBlockActionResult = {
  ok: true,
  message: null,
};
