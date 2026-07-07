"use client";

import { useEffect, useState } from "react";

import { validateBulkTopicPublish, type BulkPublishValidationFailure } from "../../../app/admin/topics/actions";
import BulkPublishValidationModal from "./BulkPublishValidationModal";

type TopicBulkPublishGateProps = {
  formId: string;
};

function getSelectedTopicIds(form: HTMLFormElement) {
  return Array.from(form.querySelectorAll<HTMLInputElement>("[data-topic-checkbox]:checked"))
    .map((input) => Number(input.value))
    .filter((id) => Number.isFinite(id) && id > 0);
}

export default function TopicBulkPublishGate({ formId }: TopicBulkPublishGateProps) {
  const [open, setOpen] = useState(false);
  const [failures, setFailures] = useState<BulkPublishValidationFailure[]>([]);
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

      const ids = getSelectedTopicIds(target);
      if (!ids.length) return;

      event.preventDefault();
      event.stopPropagation();

      const result = await validateBulkTopicPublish(ids);
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
    pendingForm.querySelectorAll<HTMLInputElement>("[data-topic-checkbox]").forEach((checkbox) => {
      checkbox.checked = validSet.has(Number(checkbox.value));
    });

    setOpen(false);
    pendingForm.submit();
    setPendingForm(null);
  }

  return (
    <BulkPublishValidationModal
      open={open}
      resourceLabel="موضوع"
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
