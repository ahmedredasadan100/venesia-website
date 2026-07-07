"use client";

import { useEffect, useState } from "react";

import { validateBulkMediaPublish, type BulkMediaPublishValidationFailure } from "../../../app/admin/content/media/actions";
import BulkPublishValidationModal from "./BulkPublishValidationModal";

type MediaBulkPublishGateProps = {
  formId: string;
};

function getSelectedMediaIds(form: HTMLFormElement) {
  return Array.from(form.querySelectorAll<HTMLInputElement>('input[name="media_ids"]'))
    .map((input) => Number(input.value))
    .filter((id) => Number.isFinite(id) && id > 0);
}

export default function MediaBulkPublishGate({ formId }: MediaBulkPublishGateProps) {
  const [open, setOpen] = useState(false);
  const [failures, setFailures] = useState<BulkMediaPublishValidationFailure[]>([]);
  const [validIds, setValidIds] = useState<number[]>([]);
  const [pendingForm, setPendingForm] = useState<HTMLFormElement | null>(null);

  useEffect(() => {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;

    async function handleSubmit(event: Event) {
      const target = event.target;
      if (!(target instanceof HTMLFormElement) || target.id !== formId) return;

      const bulkAction = target.elements.namedItem("bulk_action");
      if (!(bulkAction instanceof HTMLSelectElement) || bulkAction.value !== "publish") return;

      const ids = getSelectedMediaIds(target);
      if (!ids.length) return;

      event.preventDefault();
      event.stopPropagation();

      const result = await validateBulkMediaPublish(ids);
      if (!result.failures.length) {
        target.submit();
        return;
      }

      setFailures(result.failures);
      setValidIds(result.validIds);
      setPendingForm(target);
      setOpen(true);
    }

    form.addEventListener("submit", handleSubmit, true);
    return () => form.removeEventListener("submit", handleSubmit, true);
  }, [formId]);

  function confirmValidOnly() {
    if (!pendingForm || !validIds.length) return;

    const validSet = new Set(validIds);
    pendingForm.querySelectorAll<HTMLInputElement>('input[name="media_ids"]').forEach((input) => {
      if (!validSet.has(Number(input.value))) {
        input.remove();
      }
    });

    setOpen(false);
    pendingForm.submit();
    setPendingForm(null);
  }

  return (
    <BulkPublishValidationModal
      open={open}
      resourceLabel="محتوى"
      validCount={validIds.length}
      failures={failures}
      onClose={() => {
        setOpen(false);
        setPendingForm(null);
      }}
      onConfirmValidOnly={confirmValidOnly}
    />
  );
}
