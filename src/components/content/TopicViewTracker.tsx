"use client";

import { useEffect } from "react";

// Coalesce StrictMode/in-flight mounts only. All view history and throttling
// remain server-owned, including when storage/cookies are blocked.
const pending = new Map<number, Promise<void>>();

async function recordView(topicId: number) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch(`/api/content/topics/${topicId}/view`, {
      method: "POST", credentials: "same-origin", keepalive: true,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return;
    const result: unknown = await response.json();
    if (!result || typeof result !== "object" || !("outcome" in result) ||
        result.outcome !== "identity_required") return;
    // Retry once to echo the server-issued HttpOnly cookie. If cookies are
    // unavailable, the second request still cannot count and the page works.
  }
}

export default function TopicViewTracker({ topicId }: { topicId: number }) {
  useEffect(() => {
    if (!Number.isSafeInteger(topicId) || topicId <= 0 || pending.has(topicId)) return;
    const request = recordView(topicId).catch(() => undefined).finally(() => {
      pending.delete(topicId);
    });
    pending.set(topicId, request);
  }, [topicId]);

  return null;
}
