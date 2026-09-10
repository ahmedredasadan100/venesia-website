"use client";

import { useEffect, useRef, useState } from "react";

type TaxonomyFormSavedDetail = {
  savedRevision?: unknown;
};

type TaxonomyExpectedRevisionInputProps = {
  initialRevision?: string | null;
};

/**
 * Keeps the edit form's optimistic-concurrency token aligned with the latest
 * successful server response without parsing or reformatting PostgreSQL's raw
 * timestamp string.
 */
export default function TaxonomyExpectedRevisionInput({
  initialRevision,
}: TaxonomyExpectedRevisionInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [revision, setRevision] = useState(initialRevision ?? "");

  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;

    function acceptSavedRevision(event: Event) {
      const savedRevision = (event as CustomEvent<TaxonomyFormSavedDetail>)
        .detail?.savedRevision;
      if (typeof savedRevision === "string" && savedRevision.trim() !== "") {
        setRevision(savedRevision);
      }
    }

    form.addEventListener("admin-form-saved", acceptSavedRevision);
    return () => {
      form.removeEventListener("admin-form-saved", acceptSavedRevision);
    };
  }, []);

  return (
    <input
      ref={inputRef}
      type="hidden"
      name="expected_updated_at"
      value={revision}
      readOnly
      data-admin-form-server-owned=""
    />
  );
}
