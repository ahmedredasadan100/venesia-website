"use client";

import { useEffect } from "react";

function getCheckboxes() {
  return Array.from(document.querySelectorAll<HTMLInputElement>("[data-topic-checkbox]"));
}

function updateBulkBar() {
  const checkboxes = getCheckboxes();
  const selected = checkboxes.filter((checkbox) => checkbox.checked);
  const bar = document.querySelector<HTMLElement>("[data-topic-bulk-bar]");
  const count = document.querySelector<HTMLElement>("[data-topic-bulk-count]");
  const selectAll = document.querySelector<HTMLInputElement>("[data-topic-select-all]");

  if (bar) bar.hidden = selected.length === 0;
  if (count) count.textContent = String(selected.length);

  if (selectAll) {
    selectAll.checked = checkboxes.length > 0 && selected.length === checkboxes.length;
    selectAll.indeterminate = selected.length > 0 && selected.length < checkboxes.length;
  }
}

function clearSelection() {
  getCheckboxes().forEach((checkbox) => {
    checkbox.checked = false;
  });
  updateBulkBar();
}

function closeOpenDetails(target: HTMLElement | null) {
  const closeButton = target?.closest<HTMLElement>("[data-details-close]");
  if (!closeButton) return false;

  closeButton.closest<HTMLDetailsElement>("details")?.removeAttribute("open");
  return true;
}

export default function TopicListControls() {
  useEffect(() => {
    function handleChange(event: Event) {
      const target = event.target as HTMLElement | null;

      if (target?.matches("[data-topic-select-all]")) {
        const selectAll = target as HTMLInputElement;
        getCheckboxes().forEach((checkbox) => {
          checkbox.checked = selectAll.checked;
        });
        updateBulkBar();
        return;
      }

      if (target?.matches("[data-topic-checkbox]")) {
        updateBulkBar();
      }
    }

    function handleClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;

      if (closeOpenDetails(target)) return;

      if (target?.closest("[data-topic-clear-selection]")) {
        clearSelection();
      }
    }

    document.addEventListener("change", handleChange);
    document.addEventListener("click", handleClick);
    updateBulkBar();

    return () => {
      document.removeEventListener("change", handleChange);
      document.removeEventListener("click", handleClick);
    };
  }, []);

  return null;
}
