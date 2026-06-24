"use client";

import { useEffect } from "react";

export default function BulkMenuController() {
  useEffect(() => {
    function updateBulkMenusBar() {
      const items = Array.from(
        document.querySelectorAll<HTMLInputElement>('[data-bulk-item="menus"]')
      );
      const checked = items.filter((item) => item.checked).length;
      const bar = document.querySelector<HTMLElement>('[data-bulk-bar="menus"]');
      const counter = document.querySelector<HTMLElement>('[data-bulk-count="menus"]');
      const selectAll = document.querySelector<HTMLInputElement>('[data-bulk-select-all="menus"]');

      if (bar) bar.hidden = checked === 0;

      if (counter) counter.textContent = String(checked);

      if (selectAll) {
        selectAll.checked = items.length > 0 && items.every((item) => item.checked);
        selectAll.indeterminate = checked > 0 && checked < items.length;
      }
    }

    function clearSelection() {
      document
        .querySelectorAll<HTMLInputElement>('[data-bulk-item="menus"]')
        .forEach((item) => {
          item.checked = false;
        });
      updateBulkMenusBar();
    }

    function handleChange(event: Event) {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;

      if (target.matches('[data-bulk-select-all="menus"]')) {
        document
          .querySelectorAll<HTMLInputElement>('[data-bulk-item="menus"]')
          .forEach((item) => {
            item.checked = target.checked;
          });
        updateBulkMenusBar();
        return;
      }

      if (target.matches('[data-bulk-item="menus"]')) {
        updateBulkMenusBar();
      }
    }

    function handleClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-bulk-clear="menus"]')) {
        clearSelection();
      }
    }

    document.addEventListener("change", handleChange);
    document.addEventListener("click", handleClick);
    updateBulkMenusBar();

    return () => {
      document.removeEventListener("change", handleChange);
      document.removeEventListener("click", handleClick);
    };
  }, []);

  return null;
}
