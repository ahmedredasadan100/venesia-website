import type { AdminEntityListEmptyState } from "./types";

/** Resolves consumer copy without embedding entity-specific language in core. */
export function resolveAdminEntityListEmptyState(
  state: AdminEntityListEmptyState,
) {
  return state.mode === "system" ? state.systemEmpty : state.filteredEmpty;
}
