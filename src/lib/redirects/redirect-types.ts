export const REDIRECT_TYPES = ["301", "302"] as const;
export type RedirectType = (typeof REDIRECT_TYPES)[number];

export const REDIRECT_STATUSES = ["active", "inactive"] as const;
export type RedirectStatus = (typeof REDIRECT_STATUSES)[number];

export type UrlRedirectRecord = {
  id: number;
  source_path: string;
  destination_path: string;
  redirect_type: RedirectType;
  status: RedirectStatus;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type ActiveRedirectRule = {
  sourcePath: string;
  destinationPath: string;
  redirectType: RedirectType;
};
