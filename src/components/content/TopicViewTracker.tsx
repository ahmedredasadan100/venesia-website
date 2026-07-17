"use client";

import { useEffect } from "react";

export default function TopicViewTracker({ topicId }: { topicId: number }) {
  useEffect(() => {
    if (!Number.isInteger(topicId) || topicId <= 0) return;
    const key = `venesia:topic-view:${topicId}`;
    let canPersistSessionView = true;
    try {
      if (window.sessionStorage.getItem(key)) return;
    } catch {
      canPersistSessionView = false;
    }

    const controller = new AbortController();
    void fetch(`/api/content/topics/${topicId}/view`, {
      method: "POST",
      signal: controller.signal,
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      keepalive: true,
    })
      .then((response) => {
        if (!response.ok) return;
        if (canPersistSessionView) {
          try {
            window.sessionStorage.setItem(key, "1");
          } catch {
            // The view is still valid when browser storage is unavailable.
          }
        }
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, [topicId]);

  return null;
}
