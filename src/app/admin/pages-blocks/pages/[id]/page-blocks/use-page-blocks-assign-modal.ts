"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminEntityListQueryKeys } from "../../../../../../lib/admin/entity-list/data-engine/query-keys";

import { PAGE_BLOCK_ACTION_INITIAL } from "../../../../../../lib/page-blocks/action-result";
import type {
  PageBlockAssignmentRow,
  PageModuleKind,
} from "../../../../../../lib/page-blocks/types";
import type { PageLayoutSlot } from "../../../../../../lib/page-blocks/layout-slots";
import {
  assignHeroModule,
  assignMediaHubModule,
  assignMediaSidebarModule,
  assignPageBlock,
  loadPageModuleTemplateOptions,
} from "../../actions";
import { getSlotOptions } from "./page-blocks-utils";

export type AssignableModuleKind = PageModuleKind;
export type InitialContentTemplateOptions = Awaited<ReturnType<typeof loadPageModuleTemplateOptions>>;

function templateQueryKey(kind: AssignableModuleKind) {
  return [
    ...adminEntityListQueryKeys.entity(
      kind === "hero" ? "hero-templates" : `${kind}-block-templates`,
    ),
    "assignment-options", kind,
  ] as const;
}

function sameTemplateOptions(left: InitialContentTemplateOptions, right: InitialContentTemplateOptions) {
  return left.length === right.length && left.every((row, index) => {
    const other = right[index];
    return row.id === other.id && row.name === other.name
      && row.slug === other.slug && row.status === other.status;
  });
}

type UsePageBlocksAssignModalOptions = {
  assignments: PageBlockAssignmentRow[];
  initialContentTemplates?: InitialContentTemplateOptions | null;
  setActionMessage: (message: string | null) => void;
};

export function usePageBlocksAssignModal({
  assignments,
  initialContentTemplates,
  setActionMessage,
}: UsePageBlocksAssignModalOptions) {
  const queryClient = useQueryClient();
  const initialContentActivation = useRef(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignModuleKind, setModuleKind] = useState<AssignableModuleKind>("content");
  const [assignTemplateId, setAssignTemplateId] = useState<number | null>(null);
  const [assignVisible, setAssignVisible] = useState(true);

  const [assignState, assignBlockAction, assignBlockPending] = useActionState(assignPageBlock, PAGE_BLOCK_ACTION_INITIAL);
  const [assignHeroState, assignHeroAction, assignHeroPending] = useActionState(assignHeroModule, PAGE_BLOCK_ACTION_INITIAL);
  const [assignMediaSidebarState, assignMediaSidebarAction, assignMediaSidebarPending] = useActionState(
    assignMediaSidebarModule,
    PAGE_BLOCK_ACTION_INITIAL,
  );
  const [assignMediaHubState, assignMediaHubAction, assignMediaHubPending] = useActionState(
    assignMediaHubModule,
    PAGE_BLOCK_ACTION_INITIAL,
  );
  const assignPending = assignBlockPending || assignHeroPending || assignMediaSidebarPending || assignMediaHubPending;
  const activeAssignState =
    assignModuleKind === "hero"
      ? assignHeroState
      : assignModuleKind === "media-sidebar"
        ? assignMediaSidebarState
        : assignModuleKind === "media-hub"
          ? assignMediaHubState
          : assignState;
  const [assignModalSession, setAssignModalSession] = useState(0);
  const [assignDismissSession, setAssignDismissSession] = useState<number | null>(null);
  const [assignSubmitSession, setAssignSubmitSession] = useState<number | null>(null);
  const [prevAssignPending, setPrevAssignPending] = useState(assignPending);
  const assignModalOpen = showAssignModal && assignDismissSession !== assignModalSession;
  const templateQuery = useQuery({
    queryKey: templateQueryKey(assignModuleKind),
    queryFn: () => loadPageModuleTemplateOptions(assignModuleKind),
    // Activation starts the query below. A terminal failure remains available
    // for explicit Retry instead of being fetched again when the observer opens.
    enabled: (query) => assignModalOpen && query.state.status !== "error",
  });
  const templatesLoading = templateQuery.isPending || templateQuery.isFetching;
  const templatesError = templateQuery.error
    ? "تعذر تحميل القوالب. حاول مرة أخرى."
    : null;

  useEffect(() => {
    initialContentActivation.current = false;
    if (!initialContentTemplates) return;
    const key = templateQueryKey("content");
    const state = queryClient.getQueryState<InitialContentTemplateOptions>(key);
    // Never replace an existing result, invalidation, pending read, or failure
    // with an RSC snapshot. Equal settled data can share the first activation.
    if (state?.isInvalidated || (state && state.fetchStatus !== "idle") || state?.status === "error") return;
    if (state?.data && !sameTemplateOptions(state.data, initialContentTemplates)) return;
    if (!state?.data) queryClient.setQueryData(key, initialContentTemplates);
    initialContentActivation.current = true;
  }, [initialContentTemplates, queryClient]);

  if (assignPending !== prevAssignPending) {
    setPrevAssignPending(assignPending);

      if (assignPending) {
      setAssignSubmitSession(assignModalSession);
    } else if (showAssignModal) {
      if (activeAssignState.ok) {
        setAssignDismissSession(assignModalSession);
        setAssignVisible(true);
        setActionMessage(null);
      } else if (assignSubmitSession === assignModalSession) {
        setActionMessage(activeAssignState.message);
      }
    }
  }

  // Old or failed results must not make a different kind's picker appear usable.
  const templateOptions = useMemo(
    () => templatesLoading || templatesError ? [] : templateQuery.data ?? [],
    [templateQuery.data, templatesLoading, templatesError],
  );

  const assignedTemplateIds = useMemo(() => {
    const ids = new Set<number>();
    for (const assignment of assignments) {
      if (assignModuleKind === "hero" && assignment.module_kind === "hero") {
        ids.add(assignment.template_id);
      } else if (assignModuleKind === "media-sidebar" && assignment.module_kind === "media-sidebar") {
        ids.add(assignment.template_id);
      } else if (assignModuleKind === "media-hub" && assignment.module_kind === "media-hub") {
        ids.add(assignment.template_id);
      } else if (assignment.block_type === assignModuleKind) {
        ids.add(assignment.template_id);
      }
    }
    return ids;
  }, [assignments, assignModuleKind]);

  const slotOptions = useMemo(
    (): PageLayoutSlot[] => getSlotOptions(assignModuleKind),
    [assignModuleKind],
  );

  const assignableTemplates = useMemo(
    () => assignModuleKind === "hero" && assignments.some(
      (assignment) => assignment.module_kind === "hero",
    )
      ? []
      : templateOptions.filter((template) => !assignedTemplateIds.has(template.id)),
    [assignModuleKind, assignments, templateOptions, assignedTemplateIds],
  );
  const heroAssignmentExists = assignments.some(
    (assignment) => assignment.module_kind === "hero",
  );

  function invalidateTemplateOptions(kind: AssignableModuleKind) {
    const state = queryClient.getQueryState<InitialContentTemplateOptions>(templateQueryKey(kind));
    const reuseInitial = kind === "content" && initialContentActivation.current
      && initialContentTemplates && state?.status === "success"
      && state.fetchStatus === "idle" && !state.isInvalidated
      && state.data && sameTemplateOptions(state.data, initialContentTemplates);
    if (kind === "content") initialContentActivation.current = false;
    // Cancel the prior activation before re-enabling: a Server Action response
    // cannot be aborted, but its cancelled query must not satisfy a fresh open.
    if (!reuseInitial) {
      void queryClient.cancelQueries({ queryKey: templateQueryKey(kind), exact: true });
      void queryClient.invalidateQueries({
        queryKey: templateQueryKey(kind), exact: true, refetchType: "none",
      });
    }
    // Begin the same query before rendering the modal or its next kind. The
    // enabled observer reuses this request instead of starting it after commit.
    void queryClient.prefetchQuery({
      queryKey: templateQueryKey(kind),
      queryFn: () => loadPageModuleTemplateOptions(kind),
    });
  }

  function openAssignModal() {
    invalidateTemplateOptions(assignModuleKind);
    setAssignTemplateId(null);
    setAssignModalSession((session) => session + 1);
    setShowAssignModal(true);
  }

  function closeAssignModal() {
    setShowAssignModal(false);
  }

  function setAssignModuleKind(kind: AssignableModuleKind) {
    if (kind === assignModuleKind) return;
    invalidateTemplateOptions(kind);
    setAssignTemplateId(null);
    setModuleKind(kind);
  }

  return {
    assignModalOpen,
    openAssignModal,
    closeAssignModal,
    assignModuleKind,
    setAssignModuleKind,
    assignTemplateId,
    setAssignTemplateId,
    assignVisible,
    setAssignVisible,
    assignPending,
    templateOptions,
    templatesLoading,
    templatesError,
    retryTemplates: () => { void templateQuery.refetch(); },
    assignableTemplates,
    heroAssignmentExists,
    slotOptions,
    assignState,
    assignHeroState,
    assignMediaSidebarState,
    assignMediaHubState,
    assignBlockAction,
    assignHeroAction,
    assignMediaSidebarAction,
    assignMediaHubAction,
  };
}
