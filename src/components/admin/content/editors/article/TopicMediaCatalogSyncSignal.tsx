"use client";

import { useEffect } from "react";

export const TOPIC_MEDIA_CATALOG_SYNC_STORAGE_KEY = "venisia:admin:topic-media-catalog-sync";

export default function TopicMediaCatalogSyncSignal({ formId }: { formId: string }) {
  useEffect(() => {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;

    const notifyMediaLibrary = (event: Event) => {
      const detail = event instanceof CustomEvent && event.detail && typeof event.detail === "object"
        ? event.detail as { entityId?: unknown; savedRevision?: unknown }
        : {};
      try {
        window.localStorage.setItem(
          TOPIC_MEDIA_CATALOG_SYNC_STORAGE_KEY,
          JSON.stringify({
            entityType: "topic",
            entityId: detail.entityId ?? null,
            savedRevision: detail.savedRevision ?? null,
            emittedAt: Date.now(),
          }),
        );
      } catch {
        // The Topic mutation has already succeeded. Browser storage
        // availability must not turn it into a false form failure.
      }
    };

    form.addEventListener("admin-form-saved", notifyMediaLibrary);
    return () => form.removeEventListener("admin-form-saved", notifyMediaLibrary);
  }, [formId]);

  return null;
}
