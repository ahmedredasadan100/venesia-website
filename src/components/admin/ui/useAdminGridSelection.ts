"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type AdminGridId = string | number;

export function useAdminGridSelection<T extends AdminGridId>(visibleIds: T[]) {
  const [selectedIds, setSelectedIds] = useState<T[]>([]);
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  const selectedSet = useMemo(() => new Set<T>(selectedIds), [selectedIds]);
  const selectedVisibleCount = useMemo(
    () => visibleIds.filter((id) => selectedSet.has(id)).length,
    [visibleIds, selectedSet],
  );

  const allSelected = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;
  const isPartiallySelected = selectedVisibleCount > 0 && !allSelected;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = isPartiallySelected;
    }
  }, [isPartiallySelected]);

  function toggleOne(id: T, checked: boolean) {
    setSelectedIds((current) => {
      if (checked) {
        return current.includes(id) ? current : [...current, id];
      }

      return current.filter((item) => item !== id);
    });
  }

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? visibleIds : []);
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  return {
    selectedIds,
    selectedSet,
    selectedCount: selectedIds.length,
    selectedVisibleCount,
    selectAllRef,
    allSelected,
    isPartiallySelected,
    hasSelection: selectedIds.length > 0,
    toggleOne,
    toggleAll,
    clearSelection,
  };
}
