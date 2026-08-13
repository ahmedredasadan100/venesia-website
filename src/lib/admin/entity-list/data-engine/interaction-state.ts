export type AdminInstantMutationPendingAction = {
  rowId: number | string;
  action: string;
};

export type AdminInstantMutationRowInteraction = {
  pendingAction: string | null;
  isPending: boolean;
};

export type AdminInstantMutationBulkInteraction = {
  pendingAction: string | null;
  isPending: boolean;
  isBlocked: boolean;
};

export function resolveAdminInstantMutationInteraction({
  rowId,
  rowPendingActions,
  bulkPendingAction,
}: {
  rowId: number | string;
  rowPendingActions: readonly AdminInstantMutationPendingAction[];
  bulkPendingAction: string | null;
}): {
  row: AdminInstantMutationRowInteraction;
  bulk: AdminInstantMutationBulkInteraction;
} {
  const pendingAction =
    rowPendingActions.find((pending) => pending.rowId === rowId)?.action ??
    null;
  return {
    row: {
      pendingAction,
      isPending: pendingAction !== null,
    },
    bulk: {
      pendingAction: bulkPendingAction,
      isPending: bulkPendingAction !== null,
      isBlocked:
        bulkPendingAction !== null || rowPendingActions.length > 0,
    },
  };
}

export type AdminEntityListInteractionState = {
  queryPending: boolean;
  revalidating: boolean;
};

export function resolveAdminEntityListInteractionState({
  isPending,
  isPlaceholderData,
  isFetching,
}: {
  isPending: boolean;
  isPlaceholderData: boolean;
  isFetching: boolean;
}): AdminEntityListInteractionState {
  const queryPending = isPending || isPlaceholderData;
  return {
    queryPending,
    revalidating: isFetching && !queryPending,
  };
}
