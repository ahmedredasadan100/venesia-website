"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  RefObject,
} from "react";
import { createPortal } from "react-dom";

import { useClientMounted } from "../../../hooks/use-client-mounted";
import {
  ADMIN_ROW_ACTION_MORE_ORDER,
  type AdminRowActionAllowedCommand,
  type AdminRowActionAllowedLink,
  type AdminRowActionInformation,
  type AdminRowActionMoreKind,
  type AdminRowActionsCapability,
  type AdminRowActionTarget,
} from "../../../lib/admin/interaction-system/admin-row-actions-capability";
import {
  useAdminFloatingLayer,
  type AdminEntityListConfirmationSnapshot,
} from "../entity-list/AdminFloatingLayerContext";
import {
  AdminDataGridActionButton,
  AdminDataGridActionIcon,
  AdminDataGridActionsCell,
  type AdminDataGridAction,
} from "./AdminDataGrid";
import { AdminActivityContent } from "./AdminActivityPopover";
import AdminConfirmDialog from "./AdminConfirmDialog";
import { ADMIN_SCROLLBAR_VISUAL_CLASSES } from "./admin-scrollbar-styles";
import { useAdminFloatingMenuPosition } from "./useAdminFloatingMenuPosition";

export {
  ADMIN_ROW_ACTION_MORE_ORDER,
  ADMIN_ROW_ACTION_PRIMARY_ORDER,
} from "../../../lib/admin/interaction-system/admin-row-actions-capability";
export type {
  AdminRowActionAllowed,
  AdminRowActionArchive,
  AdminRowActionDisabled,
  AdminRowActionFeatured,
  AdminRowActionHidden,
  AdminRowActionInformation,
  AdminRowActionInformationItem,
  AdminRowActionMoreKind,
  AdminRowActionPrimaryKind,
  AdminRowActionsCapability,
  AdminRowActionTarget,
  AdminRowActionVisibility,
} from "../../../lib/admin/interaction-system/admin-row-actions-capability";

export type AdminDataGridRowActionsProps = {
  capability: AdminRowActionsCapability;
  size?: "default" | "compact";
  display?: "menu" | "visibility" | "featured";
  sticky?: boolean;
  moreButtonRef?: RefObject<HTMLButtonElement | null>;
};

type MenuTone = "neutral" | "green" | "gold" | "blue" | "red";

type ResolvedMenuItem = {
  kind: AdminRowActionMoreKind;
  target: AdminRowActionTarget | AdminRowActionInformation;
  dataGridAction: AdminDataGridAction;
  label: string;
  tone: MenuTone;
  active?: boolean;
  isCurrentlyHidden?: boolean;
};

type PanelFocusIntent =
  | "first"
  | "last"
  | "information-menu-item"
  | "information-panel";

const MENU_TONE_CLASSES: Record<
  MenuTone,
  { base: string; interactive: string }
> = {
  neutral: {
    base: "text-white/76",
    interactive:
      "hover:border-white/10 hover:bg-white/[0.055] hover:text-[#F4E7C5]",
  },
  green: {
    base: "text-emerald-100",
    interactive:
      "hover:border-emerald-300/20 hover:bg-emerald-500/12",
  },
  gold: {
    base: "text-[#F1C668]",
    interactive: "hover:border-[#D8B87A]/22 hover:bg-[#D8B87A]/10",
  },
  blue: {
    base: "text-sky-100",
    interactive: "hover:border-sky-300/18 hover:bg-sky-500/10",
  },
  red: {
    base: "text-red-200",
    interactive:
      "hover:border-red-300/20 hover:bg-red-500/12 hover:text-red-100",
  },
};

const DOCUMENT_TABBABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const ROW_ACTION_MENU_ESTIMATED_HEIGHT = 328;
const ROW_ACTION_INFORMATION_ESTIMATED_HEIGHT = 460;
type ResolvedFocusRestoreHandle = {
  cancel: () => void;
  isPending: () => boolean;
};

let activeResolvedFocusRestore: ResolvedFocusRestoreHandle | null = null;

function cancelPendingResolvedFocus() {
  activeResolvedFocusRestore?.cancel();
}

function resolveMenuItems(
  capability: AdminRowActionsCapability,
): ResolvedMenuItem[] {
  const { actions } = capability;
  const isVisible =
    actions.visibility.access === "hidden"
      ? false
      : actions.visibility.isVisible;
  const isFeatured =
    actions.featured.access === "hidden"
      ? false
      : actions.featured.isFeatured;
  const isArchived =
    actions.archive.access === "hidden" ? false : actions.archive.isArchived;

  const items: Record<AdminRowActionMoreKind, ResolvedMenuItem> = {
    information: {
      kind: "information",
      target: actions.information,
      dataGridAction: "activity",
      label: "معلومات",
      tone: "neutral",
    },
    copyPublicLink: {
      kind: "copyPublicLink",
      target: actions.copyPublicLink,
      dataGridAction: "copy-link",
      label: "نسخ الرابط العام",
      tone: "neutral",
    },
    visibility: {
      kind: "visibility",
      target: actions.visibility,
      dataGridAction: "visibility",
      label: isVisible ? "إخفاء" : "إظهار",
      tone: isVisible ? "green" : "neutral",
      isCurrentlyHidden: !isVisible,
    },
    featured: {
      kind: "featured",
      target: actions.featured,
      dataGridAction: "feature",
      label: isFeatured ? "إلغاء التمييز" : "تمييز",
      tone: "gold",
      active: isFeatured,
    },
    duplicate: {
      kind: "duplicate",
      target: actions.duplicate,
      dataGridAction: "duplicate",
      label: "نسخ",
      tone: "blue",
    },
    archive: {
      kind: "archive",
      target: actions.archive,
      dataGridAction: isArchived ? "restore" : "archive",
      label: actions.archive.label ?? (isArchived ? "استعادة" : "أرشفة"),
      tone: "neutral",
    },
    delete: {
      kind: "delete",
      target: actions.delete,
      dataGridAction: "delete",
      label: actions.delete.label ?? "حذف",
      tone: "red",
    },
  };

  return ADMIN_ROW_ACTION_MORE_ORDER.map((kind) => items[kind]).filter(
    (item) => item.target.access !== "hidden",
  );
}

function actionState(
  target: AdminRowActionTarget | AdminRowActionInformation,
) {
  if (target.access === "hidden") return "hidden";
  if (target.pending) return "pending";
  return target.access === "allowed" ? "enabled" : "disabled";
}

function isAllowedCommand(
  target: AdminRowActionTarget | AdminRowActionInformation,
): target is AdminRowActionAllowedCommand {
  return (
    target.access === "allowed" &&
    "onSelect" in target &&
    typeof target.onSelect === "function"
  );
}

function isAllowedLink(
  target: AdminRowActionTarget | AdminRowActionInformation,
): target is AdminRowActionAllowedLink {
  return (
    target.access === "allowed" &&
    "href" in target &&
    typeof target.href === "string"
  );
}

function AdminDataGridRowActionMenuItem({
  item,
  onCommand,
  onNavigate,
}: {
  item: ResolvedMenuItem;
  onCommand: (item: ResolvedMenuItem) => void;
  onNavigate: () => void;
}) {
  const { target } = item;
  const enabled = target.access === "allowed" && !target.pending;
  const title = target.disabledReason ?? item.label;
  const ariaLabel = target.disabledReason
    ? `${item.label}: ${target.disabledReason}`
    : item.label;
  const classes = `flex min-h-10 w-full items-center gap-3 rounded-[9px] border border-transparent px-3 py-2 text-right text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A]/70 ${MENU_TONE_CLASSES[item.tone].base}`;
  const content = (
    <>
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
        {target.pending ? (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <AdminDataGridActionIcon
            action={item.dataGridAction}
            active={item.active}
            isCurrentlyHidden={item.isCurrentlyHidden}
          />
        )}
      </span>
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
    </>
  );

  if (enabled && isAllowedLink(target)) {
    return (
      <Link
        href={target.href}
        prefetch={false}
        target={target.target}
        rel={
          target.rel ?? (target.target === "_blank" ? "noopener noreferrer" : undefined)
        }
        role="menuitem"
        tabIndex={-1}
        title={title}
        aria-label={ariaLabel}
        data-admin-row-action-menu-item={item.kind}
        data-admin-row-action-state={actionState(target)}
        onClick={onNavigate}
        className={`${classes} cursor-pointer ${MENU_TONE_CLASSES[item.tone].interactive}`}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      title={title}
      aria-label={ariaLabel}
      aria-disabled={!enabled}
      aria-busy={target.pending || undefined}
      disabled={!enabled}
      data-admin-row-action-menu-item={item.kind}
      data-admin-row-action-state={actionState(target)}
      onClick={() => onCommand(item)}
      className={`${classes} ${
        enabled
          ? `cursor-pointer ${MENU_TONE_CLASSES[item.tone].interactive}`
          : "cursor-not-allowed opacity-45"
      }`}
    >
      {content}
    </button>
  );
}

function isDocumentTabbable(element: HTMLElement) {
  return (
    element.getClientRects().length > 0 &&
    element.getAttribute("aria-hidden") !== "true" &&
    !element.closest("[inert]")
  );
}

function isVisibleFocusTarget(element: HTMLElement) {
  if (!element.isConnected || !isDocumentTabbable(element)) return false;
  const rect = element.getBoundingClientRect();
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < window.innerHeight &&
    rect.left < window.innerWidth
  );
}

function getDocumentTabbables(excludedPanel?: HTMLElement | null) {
  return Array.from(
    document.querySelectorAll<HTMLElement>(DOCUMENT_TABBABLE_SELECTOR),
  ).filter(
    (element) =>
      !excludedPanel?.contains(element) && isDocumentTabbable(element),
  );
}

function restoreResolvedFocus(
  resolveReturnFocus: (() => HTMLElement | null) | null,
) {
  cancelPendingResolvedFocus();
  let framesRemaining = 3;
  let animationFrameId: number | null = null;
  let pending = true;

  const handle: ResolvedFocusRestoreHandle = {
    cancel() {
      if (!pending) return;
      pending = false;
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      if (activeResolvedFocusRestore === handle) {
        activeResolvedFocusRestore = null;
      }
    },
    isPending() {
      return pending;
    },
  };

  activeResolvedFocusRestore = handle;

  function restoreOnFrame() {
    animationFrameId = window.requestAnimationFrame(() => {
      animationFrameId = null;
      if (!pending || activeResolvedFocusRestore !== handle) return;
      const focusTarget = resolveReturnFocus?.() ?? null;
      if (
        focusTarget &&
        isDocumentTabbable(focusTarget) &&
        document.activeElement !== focusTarget
      ) {
        focusTarget.focus();
      }
      framesRemaining -= 1;
      if (framesRemaining > 0) {
        restoreOnFrame();
        return;
      }
      pending = false;
      if (activeResolvedFocusRestore === handle) {
        activeResolvedFocusRestore = null;
      }
    });
  }

  restoreOnFrame();
  return handle;
}

export default function AdminDataGridRowActions({
  capability,
  size = "default",
  display = "menu",
  sticky = false,
  moreButtonRef,
}: AdminDataGridRowActionsProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const informationBackRef = useRef<HTMLButtonElement>(null);
  const informationTitleRef = useRef<HTMLParagraphElement>(null);
  const panelFocusIntentRef = useRef<PanelFocusIntent | null>(null);
  const focusRestoreHandleRef = useRef<ResolvedFocusRestoreHandle | null>(null);
  const returnFocusResolverRef = useRef<(() => HTMLElement | null) | null>(
    null,
  );
  const menuId = useId();
  const layerId = `entity-row-actions:${menuId}`;
  const floating = useAdminFloatingLayer();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [panelView, setPanelView] = useState<"menu" | "information">(
    "menu",
  );
  const [localConfirmation, setLocalConfirmation] =
    useState<AdminEntityListConfirmationSnapshot | null>(null);
  const isOpen = floating
    ? floating.openLayerId === layerId
    : uncontrolledOpen;
  const isOpenRef = useRef(isOpen);
  const isMounted = useClientMounted();
  const menuItems = resolveMenuItems(capability);
  const information = capability.actions.information;

  const setIsOpen = useCallback(
    (next: boolean) => {
      if (floating) {
        floating.setOpenLayerId(next ? layerId : null);
        return;
      }
      setUncontrolledOpen(next);
    },
    [floating, layerId],
  );

  const setTriggerNode = useCallback(
    (node: HTMLButtonElement | null) => {
      triggerRef.current = node;
      if (moreButtonRef) moreButtonRef.current = node;
    },
    [moreButtonRef],
  );

  const createReturnFocusResolver = useCallback(() => {
    const trigger = triggerRef.current;
    const surface = trigger?.closest<HTMLElement>(
      "[data-admin-entity-list-surface]",
    );
    const tabbable = getDocumentTabbables(panelRef.current);
    const triggerIndex = trigger ? tabbable.indexOf(trigger) : -1;
    const adjacent =
      triggerIndex >= 0
        ? (tabbable[triggerIndex + 1] ?? tabbable[triggerIndex - 1] ?? null)
        : null;
    const entityType = capability.entityType;
    const entityId = String(capability.entityId);

    return () => {
      if (trigger?.isConnected && isDocumentTabbable(trigger)) return trigger;

      const searchRoot = surface?.isConnected ? surface : document;

      const replacementWrapper = Array.from(
        searchRoot.querySelectorAll<HTMLElement>(
          '[data-admin-row-action="more"]',
        ),
      ).find(
        (element) =>
          element.dataset.adminEntityType === entityType &&
          element.dataset.adminEntityId === entityId,
      );
      const replacementTrigger =
        replacementWrapper?.querySelector<HTMLElement>(
          "button:not([disabled])",
        ) ?? null;
      if (replacementTrigger && isDocumentTabbable(replacementTrigger)) {
        return replacementTrigger;
      }

      if (adjacent && isVisibleFocusTarget(adjacent)) {
        return adjacent;
      }

      const firstVisibleMore = Array.from(
        searchRoot.querySelectorAll<HTMLElement>(
          '[data-admin-row-action="more"] button:not([disabled])',
        ),
      ).find(isVisibleFocusTarget);
      if (firstVisibleMore) return firstVisibleMore;

      if (surface && isVisibleFocusTarget(surface)) return surface;

      return getDocumentTabbables(panelRef.current).find(
        isVisibleFocusTarget,
      ) ?? null;
    };
  }, [capability.entityId, capability.entityType]);

  const closeAndReturnFocus = useCallback(() => {
    const currentResolver = createReturnFocusResolver();
    const openingResolver = returnFocusResolverRef.current;
    const resolveReturnFocus = () =>
      currentResolver() ?? openingResolver?.() ?? null;
    returnFocusResolverRef.current = resolveReturnFocus;
    const immediateFocusTarget = resolveReturnFocus();
    if (immediateFocusTarget && isDocumentTabbable(immediateFocusTarget)) {
      immediateFocusTarget.focus();
    }
    focusRestoreHandleRef.current?.cancel();
    panelFocusIntentRef.current = null;
    setIsOpen(false);
    setPanelView("menu");
    focusRestoreHandleRef.current =
      restoreResolvedFocus(resolveReturnFocus);
  }, [createReturnFocusResolver, setIsOpen]);

  const position = useAdminFloatingMenuPosition(isOpen, triggerRef, {
    minWidth: 236,
    preferredWidth: 260,
    offset: 8,
    align: "right",
    collisionPadding: 12,
    estimatedHeight:
      panelView === "information"
        ? ROW_ACTION_INFORMATION_ESTIMATED_HEIGHT
        : ROW_ACTION_MENU_ESTIMATED_HEIGHT,
    floatingRef: panelRef,
    onAnchorInvalid: closeAndReturnFocus,
    repositionKey: panelView,
    zIndex: 10000,
  });
  const isPositioned = position !== null;

  useLayoutEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function close(event: MouseEvent) {
      const target = event.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      const outsideElement =
        event.target instanceof Element ? event.target : null;
      const nextRowActionsTrigger = outsideElement?.closest(
        '[data-admin-row-action="more"] button',
      );
      if (
        nextRowActionsTrigger instanceof HTMLElement &&
        nextRowActionsTrigger !== triggerRef.current
      ) {
        panelFocusIntentRef.current = null;
        setIsOpen(false);
        setPanelView("menu");
        return;
      }
      closeAndReturnFocus();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      closeAndReturnFocus();
    }

    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [closeAndReturnFocus, isOpen, setIsOpen]);

  useEffect(
    () => () => {
      const pendingRestore = focusRestoreHandleRef.current;
      const needsImmediateFallback =
        isOpenRef.current || Boolean(pendingRestore?.isPending());
      pendingRestore?.cancel();
      focusRestoreHandleRef.current = null;
      if (!needsImmediateFallback) return;
      const activeElement =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      if (
        activeElement &&
        activeElement !== document.body &&
        isVisibleFocusTarget(activeElement)
      ) {
        return;
      }
      const resolveReturnFocus = returnFocusResolverRef.current;
      const immediateFocusTarget = resolveReturnFocus?.() ?? null;
      if (
        immediateFocusTarget &&
        isDocumentTabbable(immediateFocusTarget)
      ) {
        immediateFocusTarget.focus();
      }
    },
    [],
  );

  useEffect(() => {
    if (!isOpen || panelView !== "information") return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, panelView]);

  useLayoutEffect(() => {
    const focusIntent = panelFocusIntentRef.current;
    const panel = panelRef.current;
    if (!isOpen || !isPositioned || !panel || !focusIntent) return;

    let focusTarget: HTMLElement | null = null;
    if (panelView === "information") {
      if (focusIntent !== "information-panel") return;
      focusTarget =
        (informationBackRef.current &&
        isVisibleFocusTarget(informationBackRef.current)
          ? informationBackRef.current
          : null) ??
        Array.from(
          panel.querySelectorAll<HTMLElement>(DOCUMENT_TABBABLE_SELECTOR),
        ).find(isVisibleFocusTarget) ??
        (informationTitleRef.current &&
        isVisibleFocusTarget(informationTitleRef.current)
          ? informationTitleRef.current
          : null);
    } else {
      const enabledItems = Array.from(
        panel.querySelectorAll<HTMLElement>(
          '[data-admin-row-action-menu-item]:not([aria-disabled="true"])',
        ),
      ).filter(isVisibleFocusTarget);
      if (focusIntent === "information-menu-item") {
        focusTarget =
          panel.querySelector<HTMLElement>(
            '[data-admin-row-action-menu-item="information"]:not([aria-disabled="true"])',
          ) ?? null;
      } else {
        focusTarget =
          focusIntent === "last" ? enabledItems.at(-1) ?? null : enabledItems[0] ?? null;
      }
    }

    if (!focusTarget || !isVisibleFocusTarget(focusTarget)) return;
    focusTarget.focus({ preventScroll: true });
    if (document.activeElement === focusTarget) {
      panelFocusIntentRef.current = null;
    }
  }, [isOpen, isPositioned, panelView]);

  function openWithFocus(focusTarget: "first" | "last") {
    focusRestoreHandleRef.current?.cancel();
    focusRestoreHandleRef.current = null;
    cancelPendingResolvedFocus();
    returnFocusResolverRef.current = createReturnFocusResolver();
    panelFocusIntentRef.current = focusTarget;
    setPanelView("menu");
    setIsOpen(true);
  }

  function focusAdjacentToTrigger(backwards: boolean) {
    const trigger = triggerRef.current;
    const tabbable = getDocumentTabbables(panelRef.current);
    const triggerIndex = trigger ? tabbable.indexOf(trigger) : -1;
    const next =
      triggerIndex >= 0
        ? tabbable[triggerIndex + (backwards ? -1 : 1)]
        : null;
    const wrapped = backwards ? tabbable.at(-1) : tabbable[0];
    const fallback = returnFocusResolverRef.current?.() ?? null;
    const focusTarget = next ?? wrapped ?? fallback;
    if (focusTarget && isDocumentTabbable(focusTarget)) {
      focusTarget.focus();
    }
  }

  function handleMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeAndReturnFocus();
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      const backwards = event.shiftKey;
      panelFocusIntentRef.current = null;
      setIsOpen(false);
      setPanelView("menu");
      window.requestAnimationFrame(() =>
        focusAdjacentToTrigger(backwards),
      );
      return;
    }

    if (panelView !== "menu") return;

    if (
      event.key !== "ArrowDown" &&
      event.key !== "ArrowUp" &&
      event.key !== "Home" &&
      event.key !== "End"
    ) {
      return;
    }

    const enabledItems = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>(
        '[data-admin-row-action-menu-item]:not([aria-disabled="true"])',
      ) ?? [],
    );
    if (!enabledItems.length) return;
    event.preventDefault();
    const activeIndex = enabledItems.indexOf(document.activeElement as HTMLElement);
    let nextIndex = 0;
    if (event.key === "End") nextIndex = enabledItems.length - 1;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "ArrowDown")
      nextIndex = activeIndex < 0 ? 0 : (activeIndex + 1) % enabledItems.length;
    else
      nextIndex =
        activeIndex < 0
          ? enabledItems.length - 1
          : (activeIndex - 1 + enabledItems.length) % enabledItems.length;
    enabledItems[nextIndex]?.focus();
  }

  function renderPrimaryAction(
    kind: "edit" | "preview",
    target: AdminRowActionTarget,
  ) {
    if (target.access === "hidden") return null;
    const enabled = target.access === "allowed" && !target.pending;
    const label = target.label ?? (kind === "edit" ? "تعديل" : "معاينة");
    const title = target.disabledReason ?? label;
    return (
      <span
        className="contents"
        data-admin-row-action={kind}
        data-admin-row-action-state={actionState(target)}
      >
        <AdminDataGridActionButton
          action={kind}
          href={enabled ? target.href : undefined}
          target={
            enabled
              ? target.target ?? (kind === "preview" ? "_blank" : undefined)
              : undefined
          }
          rel={enabled ? target.rel : undefined}
          title={title}
          ariaLabel={
            target.disabledReason ? `${label}: ${target.disabledReason}` : label
          }
          disabled={!enabled}
          pending={target.pending}
          size={size}
          onClick={
            enabled && target.onSelect ? () => target.onSelect?.() : undefined
          }
        />
      </span>
    );
  }

  function runInlineAction(target: AdminRowActionTarget) {
    if (!isAllowedCommand(target) || target.pending) return;
    if (target.confirmation?.mode === "shared") {
      const snapshot: AdminEntityListConfirmationSnapshot = {
        ...target.confirmation,
        onConfirm: target.onSelect,
        returnFocusRef: triggerRef,
        resolveReturnFocus: createReturnFocusResolver(),
      };
      if (floating) floating.openConfirmation(snapshot);
      else setLocalConfirmation(snapshot);
      return;
    }
    void target.onSelect();
  }

  function renderInlineStatusAction() {
    const isVisibility = display === "visibility";
    const resolved = isVisibility
      ? (() => {
          const target = capability.actions.visibility;
          return target.access === "hidden"
            ? null
            : { target, active: target.isVisible };
        })()
      : (() => {
          const target = capability.actions.featured;
          return target.access === "hidden"
            ? null
            : { target, active: target.isFeatured };
        })();
    if (!resolved) return null;

    const { target, active } = resolved;
    const enabled = target.access === "allowed" && !target.pending;
    const actionLabel = isVisibility
      ? active
        ? `إخفاء ${capability.entityLabel}`
        : `إظهار ${capability.entityLabel}`
      : active
        ? `إلغاء تمييز ${capability.entityLabel}`
        : `تمييز ${capability.entityLabel}`;
    const reason = target.disabledReason;

    return (
      <span
        className="inline-flex items-center justify-center"
        data-admin-row-action={display}
        data-admin-entity-type={capability.entityType}
        data-admin-entity-id={String(capability.entityId)}
        data-admin-row-action-state={actionState(target)}
      >
        <AdminDataGridActionButton
          action={isVisibility ? "visibility" : "feature"}
          buttonRef={setTriggerNode}
          size="inline"
          tone={isVisibility ? undefined : active ? "gold" : "dark"}
          isCurrentlyHidden={isVisibility ? !active : false}
          visibilityEntityLabel={capability.entityLabel}
          active={!isVisibility && active}
          title={reason ?? actionLabel}
          ariaLabel={reason ? `${actionLabel}: ${reason}` : actionLabel}
          ariaPressed={active}
          disabled={!enabled}
          pending={target.pending}
          onClick={enabled ? () => runInlineAction(target) : undefined}
        />
      </span>
    );
  }

  const menu =
    isMounted && isOpen && position
      ? createPortal(
          <div
            ref={panelRef}
            id={menuId}
            role={panelView === "menu" ? "menu" : "dialog"}
            aria-label={
              panelView === "menu"
                ? `إجراءات ${capability.entityLabel}`
                : information.access === "hidden"
                  ? "معلومات"
                  : information.title
            }
            dir="rtl"
            data-admin-row-actions-menu={panelView === "menu" ? "" : undefined}
            data-admin-row-actions-information={
              panelView === "information" ? "" : undefined
            }
            data-admin-entity-type={capability.entityType}
            data-admin-entity-id={String(capability.entityId)}
            data-placement={position.placement}
            style={position.style}
            onKeyDown={handleMenuKeyDown}
            className={`flex max-w-[calc(100vw-24px)] flex-col gap-1 overflow-y-auto overflow-x-hidden overscroll-contain rounded-[16px] border border-[#D8B87A]/20 bg-[#080B10]/98 p-2 text-right shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl ${ADMIN_SCROLLBAR_VISUAL_CLASSES}`}
          >
            {panelView === "information" &&
            information.access !== "hidden" ? (
              <div className="min-w-0 p-2" data-admin-row-actions-information-content="">
                <div className="mb-3 flex items-center justify-between gap-3 border-b border-white/8 pb-3">
                  <p
                    ref={informationTitleRef}
                    tabIndex={-1}
                    data-admin-row-actions-information-title=""
                    className="min-w-0 truncate text-sm font-bold text-white"
                  >
                    {information.title}
                  </p>
                  <button
                    ref={informationBackRef}
                    type="button"
                    onClick={() => {
                      panelFocusIntentRef.current = "information-menu-item";
                      setPanelView("menu");
                    }}
                    className="shrink-0 cursor-pointer rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-semibold text-white/65 transition hover:border-[#D8B87A]/35 hover:text-[#D8B87A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A]/70"
                  >
                    رجوع
                  </button>
                </div>
                <AdminActivityContent
                  items={[...information.items]}
                  loading={information.loading}
                  errorMessage={information.errorMessage}
                  emptyMessage={information.emptyMessage}
                />
              </div>
            ) : (
              menuItems.map((item) => (
                <AdminDataGridRowActionMenuItem
                  key={item.kind}
                  item={item}
                  onNavigate={() => {
                    panelFocusIntentRef.current = null;
                    setPanelView("menu");
                    setIsOpen(false);
                  }}
                  onCommand={(selectedItem) => {
                    const target = selectedItem.target;
                    if (target.access !== "allowed" || target.pending) return;
                    if (selectedItem.kind === "information") {
                      panelFocusIntentRef.current = "information-panel";
                      setPanelView("information");
                      return;
                    }
                    if (!isAllowedCommand(target)) return;
                    panelFocusIntentRef.current = null;
                    setPanelView("menu");
                    setIsOpen(false);
                    if (target.confirmation?.mode === "shared") {
                      const snapshot: AdminEntityListConfirmationSnapshot = {
                        ...target.confirmation,
                        onConfirm: target.onSelect,
                        returnFocusRef: triggerRef,
                        resolveReturnFocus: createReturnFocusResolver(),
                      };
                      if (floating) floating.openConfirmation(snapshot);
                      else setLocalConfirmation(snapshot);
                      return;
                    }
                    triggerRef.current?.focus();
                    void target.onSelect();
                  }}
                />
              ))
            )}
          </div>,
          document.body,
        )
      : null;

  const confirmationDialog = (
    <AdminConfirmDialog
      open={Boolean(localConfirmation)}
      title={localConfirmation?.title ?? "تأكيد الإجراء"}
      description={localConfirmation?.description ?? ""}
      confirmLabel={localConfirmation?.confirmLabel ?? "تأكيد"}
      cancelLabel={localConfirmation?.cancelLabel}
      returnFocusRef={localConfirmation?.returnFocusRef}
      resolveReturnFocus={localConfirmation?.resolveReturnFocus}
      onCancel={() => setLocalConfirmation(null)}
      onConfirm={async () => {
        const activeConfirmation = localConfirmation;
        if (!activeConfirmation) return;
        await activeConfirmation.onConfirm();
        setLocalConfirmation((current) =>
          current === activeConfirmation ? null : current,
        );
      }}
    />
  );

  if (display !== "menu") {
    return (
      <>
        {renderInlineStatusAction()}
        {confirmationDialog}
      </>
    );
  }

  return (
    <>
      <AdminDataGridActionsCell
        compact={size === "compact"}
        sticky={sticky}
      >
        {renderPrimaryAction("edit", capability.actions.edit)}
        {renderPrimaryAction("preview", capability.actions.preview)}
        <span
          className="contents"
          data-admin-row-action="more"
          data-admin-entity-type={capability.entityType}
          data-admin-entity-id={String(capability.entityId)}
          data-admin-row-action-state={
            menuItems.length ? "enabled" : "disabled"
          }
        >
          <AdminDataGridActionButton
            action="more"
            buttonRef={setTriggerNode}
            size={size}
            title="المزيد"
            ariaLabel={`المزيد من إجراءات ${capability.entityLabel}`}
            ariaHasPopup="menu"
            ariaExpanded={isOpen}
            ariaControls={menuId}
            disabled={!menuItems.length}
            onClick={() => {
              if (isOpen) {
                panelFocusIntentRef.current = null;
                setIsOpen(false);
                setPanelView("menu");
                return;
              }
              openWithFocus("first");
            }}
            onKeyDown={(event) => {
              if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
              event.preventDefault();
              openWithFocus(event.key === "ArrowDown" ? "first" : "last");
            }}
          />
        </span>
        {menu}
      </AdminDataGridActionsCell>
      {confirmationDialog}
    </>
  );
}
