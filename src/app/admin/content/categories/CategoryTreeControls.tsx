"use client";

import { useEffect } from "react";

const STORAGE_KEY = "venesia-admin-topic-categories-open";
const SORT_STORAGE_KEY = "venesia-admin-topic-categories-sort";

type StoredState = Record<string, boolean>;

function readStoredState(): StoredState {
  try {
    return JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) || "{}",
    ) as StoredState;
  } catch {
    return {};
  }
}

function writeStoredState(state: StoredState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

type SortState = {
  key: "sort_order" | "name" | "count" | "status";
  direction: "asc" | "desc";
};

function readSortState(): SortState {
  try {
    const value = JSON.parse(
      window.localStorage.getItem(SORT_STORAGE_KEY) || "null",
    ) as SortState | null;

    if (
      value &&
      ["sort_order", "name", "count", "status"].includes(value.key) &&
      ["asc", "desc"].includes(value.direction)
    ) {
      return value;
    }
  } catch {}

  return { key: "sort_order", direction: "asc" };
}

function writeSortState(state: SortState) {
  window.localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(state));
}

function getSortValue(row: HTMLElement, key: SortState["key"]) {
  if (key === "count") return Number(row.dataset.sortCount || 0);
  if (key === "sort_order") return Number(row.dataset.sortOrder || 0);
  return (row.dataset[`sort${key.charAt(0).toUpperCase()}${key.slice(1)}`] || "").toLowerCase();
}

function sortCategoryTree(sortState = readSortState()) {
  const containers = Array.from(
    document.querySelectorAll<HTMLElement>("[data-category-level-container]"),
  ).filter((container) => container.dataset.parentId === "root");

  containers.forEach((container) => {
    const items = Array.from(
      container.querySelectorAll<HTMLElement>(":scope > [data-category-item]"),
    );

    items
      .sort((a, b) => {
        const rowA = a.querySelector<HTMLElement>(":scope > [data-category-row]");
        const rowB = b.querySelector<HTMLElement>(":scope > [data-category-row]");
        if (!rowA || !rowB) return 0;

        const valueA = getSortValue(rowA, sortState.key);
        const valueB = getSortValue(rowB, sortState.key);

        let result = 0;
        if (typeof valueA === "number" && typeof valueB === "number") {
          result = valueA - valueB;
        } else {
          result = String(valueA).localeCompare(String(valueB), "ar");
        }

        return sortState.direction === "asc" ? result : -result;
      })
      .forEach((item) => container.appendChild(item));
  });

  document.querySelectorAll<HTMLElement>("[data-category-sort]").forEach((button) => {
    const key = button.dataset.categorySort;
    const isActive = key === sortState.key;
    button.dataset.active = isActive ? "true" : "false";
    button.dataset.direction = isActive ? sortState.direction : "";
  });
}

function getRows() {
  return Array.from(
    document.querySelectorAll<HTMLElement>("[data-category-row]"),
  );
}

function getSearchValue() {
  const input = document.querySelector<HTMLInputElement>("[data-category-search]");
  return (input?.value || "").trim().toLowerCase();
}

function getStatusValue() {
  const select = document.querySelector<HTMLSelectElement>("[data-category-status-filter]");
  return select?.value || "all";
}

function rowMatchesFilters(row: HTMLElement) {
  const search = getSearchValue();
  const status = getStatusValue();
  const searchable = (row.dataset.search || "").toLowerCase();
  const rowStatus = row.dataset.status || "";

  const matchesSearch = !search || searchable.includes(search);
  const matchesStatus = status === "all" || rowStatus === status;

  return matchesSearch && matchesStatus;
}

function getDescendants(rows: HTMLElement[], parentId: string) {
  const descendants: HTMLElement[] = [];
  const collect = (id: string) => {
    rows
      .filter((row) => row.dataset.parentId === id)
      .forEach((child) => {
        descendants.push(child);
        const childId = child.dataset.categoryId;
        if (childId) collect(childId);
      });
  };
  collect(parentId);
  return descendants;
}

function updateTree(state: StoredState) {
  const rows = getRows();
  const openMap = new Map<string, boolean>();
  const matchedMap = new Map<string, boolean>();

  rows.forEach((row) => {
    const id = row.dataset.categoryId;
    const hasChildren = row.dataset.hasChildren === "true";
    if (!id) return;
    openMap.set(id, hasChildren ? state[id] !== false : true);
    matchedMap.set(id, rowMatchesFilters(row));
  });

  rows.forEach((row) => {
    const id = row.dataset.categoryId || "";
    const hasChildren = row.dataset.hasChildren === "true";
    if (!id || !hasChildren) return;

    const descendants = getDescendants(rows, id);
    const hasMatchingDescendant = descendants.some((child) =>
      matchedMap.get(child.dataset.categoryId || ""),
    );

    if (getSearchValue() && hasMatchingDescendant) {
      matchedMap.set(id, true);
    }
  });

  rows.forEach((row) => {
    const id = row.dataset.categoryId || "";
    const parentId = row.dataset.parentId || "";
    const hasChildren = row.dataset.hasChildren === "true";
    let visible = matchedMap.get(id) ?? true;
    let currentParent = parentId;

    while (currentParent) {
      if (openMap.get(currentParent) === false && !getSearchValue()) {
        visible = false;
        break;
      }

      const parentRow = rows.find(
        (candidate) => candidate.dataset.categoryId === currentParent,
      );
      currentParent = parentRow?.dataset.parentId || "";
    }

    row.hidden = !visible;
    row.dataset.open =
      hasChildren && openMap.get(id) === false ? "false" : "true";

    const stateIcon = row.querySelector<HTMLElement>(
      "[data-category-state-icon]",
    );
    if (stateIcon)
      stateIcon.textContent = hasChildren
        ? openMap.get(id) === false
          ? "›"
          : "⌄"
        : "";

    const folder = row.querySelector<HTMLElement>("[data-category-folder]");
    if (folder)
      folder.dataset.open =
        hasChildren && openMap.get(id) === false ? "false" : "true";
  });

  const emptyState = document.querySelector<HTMLElement>("[data-category-empty-filter]");
  if (emptyState) emptyState.hidden = rows.some((row) => !row.hidden);
}

export default function CategoryTreeControls() {
  useEffect(() => {
    const rows = getRows();
    const state = readStoredState();

    rows.forEach((row) => {
      const id = row.dataset.categoryId;
      const hasChildren = row.dataset.hasChildren === "true";
      if (!id || !hasChildren) return;
      if (!(id in state)) state[id] = true;
    });

    writeStoredState(state);
    sortCategoryTree(readSortState());
    updateTree(state);

    function handleClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      const closeButton = target?.closest<HTMLElement>("[data-details-close]");
      if (closeButton) {
        closeButton.closest<HTMLDetailsElement>("details")?.removeAttribute("open");
        return;
      }

      const sortButton = target?.closest<HTMLElement>("[data-category-sort]");
      if (sortButton) {
        const key = sortButton.dataset.categorySort as SortState["key"] | undefined;
        if (!key) return;
        const current = readSortState();
        const nextState: SortState = {
          key,
          direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
        };
        writeSortState(nextState);
        sortCategoryTree(nextState);
        updateTree(readStoredState());
        return;
      }

      const toggle = target?.closest<HTMLElement>("[data-category-toggle]");
      if (!toggle) return;

      const row = toggle.closest<HTMLElement>("[data-category-row]");
      const id = row?.dataset.categoryId;
      const hasChildren = row?.dataset.hasChildren === "true";
      if (!id || !hasChildren) return;

      const nextState = readStoredState();
      nextState[id] = nextState[id] === false;
      writeStoredState(nextState);
      updateTree(nextState);
    }

    function handleInput(event: Event) {
      const target = event.target as HTMLElement | null;
      if (
        target?.matches("[data-category-search]") ||
        target?.matches("[data-category-status-filter]")
      ) {
        sortCategoryTree(readSortState());
        updateTree(readStoredState());
      }
    }

    document.addEventListener("click", handleClick);
    document.addEventListener("input", handleInput);
    document.addEventListener("change", handleInput);
    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("input", handleInput);
      document.removeEventListener("change", handleInput);
    };
  }, []);

  function expandAll() {
    const nextState: StoredState = {};
    getRows().forEach((row) => {
      const id = row.dataset.categoryId;
      if (id && row.dataset.hasChildren === "true") nextState[id] = true;
    });
    writeStoredState(nextState);
    updateTree(nextState);
  }

  function collapseAll() {
    const nextState: StoredState = {};
    getRows().forEach((row) => {
      const id = row.dataset.categoryId;
      if (id && row.dataset.hasChildren === "true") nextState[id] = false;
    });
    writeStoredState(nextState);
    updateTree(nextState);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={expandAll}
        className="flex h-12 items-center justify-center rounded-[8px] border border-white/10 bg-black/18 px-5 text-sm text-white/78 transition hover:border-[#D8B87A]/28 hover:text-white"
      >
        فتح الكل
      </button>
      <button
        type="button"
        onClick={collapseAll}
        className="flex h-12 items-center justify-center rounded-[8px] border border-white/10 bg-black/18 px-5 text-sm text-white/78 transition hover:border-[#D8B87A]/28 hover:text-white"
      >
        طي الكل
      </button>
    </div>
  );
}
