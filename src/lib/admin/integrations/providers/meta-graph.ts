import "server-only";

import { providerJson } from "../provider-http";

type MetaCollection<T> = {
  data?: T[];
  paging?: {
    next?: string;
    cursors?: { after?: string };
  };
};

function pagingCursor(payload: MetaCollection<unknown>) {
  if (!payload.paging?.next) return null;
  if (payload.paging.cursors?.after) return payload.paging.cursors.after;
  try {
    return new URL(payload.paging.next).searchParams.get("after");
  } catch {
    return null;
  }
}

export async function collectMetaGraphPages<T>(
  initialUrl: string,
  accessToken: string,
  errorCode: string,
) {
  const rows: T[] = [];
  let after: string | null = null;
  for (let page = 0; page < 100; page += 1) {
    const url = new URL(initialUrl);
    if (after) url.searchParams.set("after", after);
    const payload = await providerJson<MetaCollection<T>>(url.toString(), {
      headers: { authorization: `Bearer ${accessToken}` },
    }, errorCode);
    rows.push(...(payload.data ?? []));
    const next = pagingCursor(payload);
    if (!next) return rows;
    if (next === after) throw new Error(`${errorCode}_pagination_stalled`);
    after = next;
  }
  throw new Error(`${errorCode}_pagination_limit_exceeded`);
}
