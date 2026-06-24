"use client";

import { useEffect } from "react";

function getCheckboxes() {
  return Array.from(document.querySelectorAll<HTMLInputElement>("[data-media-checkbox]"));
}

function updateBulkBar() {
  const checkboxes = getCheckboxes();
  const selected = checkboxes.filter((checkbox) => checkbox.checked);
  const bar = document.querySelector<HTMLElement>("[data-media-bulk-bar]");
  const count = document.querySelector<HTMLElement>("[data-media-bulk-count]");
  const selectAll = document.querySelector<HTMLInputElement>("[data-media-select-all]");

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

export default function MediaListControls() {
  useEffect(() => {
    function handleChange(event: Event) {
      const target = event.target as HTMLElement | null;

      if (target?.matches("[data-media-select-all]")) {
        const selectAll = target as HTMLInputElement;
        getCheckboxes().forEach((checkbox) => {
          checkbox.checked = selectAll.checked;
        });
        updateBulkBar();
        return;
      }

      if (target?.matches("[data-media-checkbox]")) {
        updateBulkBar();
      }
    }

    function handleClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-media-clear-selection]")) {
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
