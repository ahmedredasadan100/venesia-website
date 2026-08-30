"use client";

import { useActionState, useEffect, useMemo, useState } from "react";

import { PAGE_BLOCK_ACTION_INITIAL } from "../../../../../../lib/page-blocks/action-result";
import type { PageBlockAssignmentRow, PageBlockType } from "../../../../../../lib/page-blocks/types";
import type { PageLayoutSlot } from "../../../../../../lib/page-blocks/layout-slots";
import {
  assignHeroModule,
  assignMediaHubModule,
  assignMediaSidebarModule,
  assignPageBlock,
} from "../../actions";
import { getSlotOptions } from "./page-blocks-utils";

export type AssignableModuleKind = PageBlockType | "hero" | "media-sidebar" | "media-hub";

type TemplateOption = { id: number; name: string; slug: string; status: string };

export type PageBlocksAssignTemplates = {
  content: TemplateOption[];
  cta: TemplateOption[];
  cards: TemplateOption[];
  breadcrumb: TemplateOption[];
  feed: TemplateOption[];
  featured: TemplateOption[];
  hero: TemplateOption[];
  mediaSidebar: TemplateOption[];
  mediaHub: TemplateOption[];
};

type UsePageBlocksAssignModalOptions = {
  pageId: number;
  assignments: PageBlockAssignmentRow[];
  templates: PageBlocksAssignTemplates;
  setActionMessage: (message: string | null) => void;
  router: { refresh: () => void };
};

export function usePageBlocksAssignModal({
  pageId,
  assignments,
  templates,
  setActionMessage,
  router,
}: UsePageBlocksAssignModalOptions) {
  void pageId;
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignModuleKind, setAssignModuleKind] = useState<AssignableModuleKind>("content");
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
  const [assignRefreshNonce, setAssignRefreshNonce] = useState(0);
  const assignModalOpen = showAssignModal && assignDismissSession !== assignModalSession;

  if (assignPending !== prevAssignPending) {
    setPrevAssignPending(assignPending);

      if (assignPending) {
      setAssignSubmitSession(assignModalSession);
    } else if (showAssignModal) {
      if (activeAssignState.ok) {
        setAssignDismissSession(assignModalSession);
        setAssignVisible(true);
        setActionMessage(null);
        setAssignRefreshNonce((value) => value + 1);
      } else if (assignSubmitSession === assignModalSession) {
        setActionMessage(activeAssignState.message);
      }
    }
  }

  useEffect(() => {
    if (assignRefreshNonce === 0) return;
    router.refresh();
  }, [assignRefreshNonce, router]);

  const templateOptions = useMemo(
    () =>
      assignModuleKind === "hero"
        ? templates.hero
        : assignModuleKind === "media-sidebar"
          ? templates.mediaSidebar
          : assignModuleKind === "media-hub"
            ? templates.mediaHub
            : templates[assignModuleKind as PageBlockType] ?? [],
    [assignModuleKind, templates],
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
    () => templateOptions.filter((template) => !assignedTemplateIds.has(template.id)),
    [templateOptions, assignedTemplateIds],
  );

  function openAssignModal() {
    setAssignTemplateId(null);
    setAssignModalSession((session) => session + 1);
    setShowAssignModal(true);
  }

  function closeAssignModal() {
    setShowAssignModal(false);
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
    assignableTemplates,
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
