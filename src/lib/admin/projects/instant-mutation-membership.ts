import type { AdminInstantMutationPatch } from "../entity-list/data-engine/instant-mutation";
import type { ProjectFilters } from "./entity-list-contract";
import type { ProjectEntityListRow } from "./entity-list-types";

function includesSearch(row: ProjectEntityListRow, search: string) {
  const needle = search.trim().toLocaleLowerCase();
  if (!needle) return true;
  return [
    row.arabic_name,
    row.code,
    row.location_label,
    row.map_area,
    row.slug,
  ].some((value) => value?.toLocaleLowerCase().includes(needle));
}

export function projectRowMatchesDataset(
  row: ProjectEntityListRow,
  search: string,
  filters: ProjectFilters,
) {
  if (!includesSearch(row, search)) return false;
  if (
    filters.publicationStatus !== "all" &&
    row.publication_status !== filters.publicationStatus
  ) {
    return false;
  }
  if (
    filters.implementationStatus !== "all" &&
    row.status !== filters.implementationStatus
  ) {
    return false;
  }
  if (
    filters.featured !== "all" &&
    row.featured !== (filters.featured === "yes")
  ) {
    return false;
  }
  if (
    filters.listMode === "active" &&
    row.publication_status === "archived"
  ) {
    return false;
  }
  if (
    filters.listMode === "archived" &&
    row.publication_status !== "archived"
  ) {
    return false;
  }
  return true;
}

export function applyProjectPublicationMutation(
  cache: AdminInstantMutationPatch<ProjectEntityListRow>,
  sourceRows: readonly ProjectEntityListRow[],
  ids: ReadonlySet<number>,
  publicationStatus: string,
  search: string,
  filters: ProjectFilters,
) {
  const sourceById = new Map(sourceRows.map((row) => [row.id, row]));
  const leavingIds = new Set<number>();
  const remainingIds = new Set<number>();

  ids.forEach((id) => {
    const source = sourceById.get(id);
    if (!source) return;
    const updated = { ...source, publication_status: publicationStatus };
    if (projectRowMatchesDataset(updated, search, filters)) {
      remainingIds.add(id);
    } else {
      leavingIds.add(id);
    }
  });

  if (leavingIds.size) cache.removeRows(leavingIds);
  if (remainingIds.size) {
    cache.patchRows((row) =>
      remainingIds.has(row.id)
        ? { ...row, publication_status: publicationStatus }
        : row,
    );
  }
}
