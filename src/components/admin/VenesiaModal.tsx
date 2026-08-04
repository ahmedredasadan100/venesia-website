"use client";

import { useEffect, useId, useRef, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";

import {
  ADMIN_FORM,
  ADMIN_MODAL,
  ADMIN_MODAL_SIZES,
  adminFormFieldClassName,
  adminFormHintClassName,
  adminFormLabelClassName,
} from "../../lib/admin/admin-ui-styles";
import { AdminModalCancelButton, AdminModalDangerButton, AdminModalPrimaryButton } from "./ui/AdminModalButtons";
import { useClientMounted } from "../../hooks/use-client-mounted";

export type VenesiaModalSize = keyof typeof ADMIN_MODAL_SIZES;

export type VenesiaModalProps = {
  open: boolean;
  title: string;
  description?: string;
  eyebrow?: string;
  size?: VenesiaModalSize;
  closeOnEscape?: boolean;
  bodyClassName?: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
};

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button",
  'input:not([type="hidden"])',
  "select",
  "textarea",
  "iframe",
  "object",
  "embed",
  "audio[controls]",
  "video[controls]",
  "summary",
  "[contenteditable]",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function isVisibleAndEnabled(element: HTMLElement) {
  if (
    element.matches(":disabled") ||
    element.getAttribute("aria-disabled") === "true" ||
    element.closest('[hidden], [aria-hidden="true"], [inert]')
  ) {
    return false;
  }

  const style = window.getComputedStyle(element);
  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    element.getClientRects().length > 0
  );
}

function getFocusableElements(panel: HTMLElement) {
  return Array.from(
    panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter(
    (element) => element.tabIndex >= 0 && isVisibleAndEnabled(element),
  );
}

function focusFirstOrPanel(panel: HTMLElement) {
  const first = getFocusableElements(panel)[0];
  (first ?? panel).focus({ preventScroll: true });
}

function isTopmostDialog(panel: HTMLElement) {
  const openDialogs = Array.from(
    document.querySelectorAll<HTMLElement>(
      '[role="dialog"][aria-modal="true"]',
    ),
  ).filter(isVisibleAndEnabled);

  return openDialogs.at(-1) === panel;
}

type FocusReturnSnapshot = {
  element: HTMLElement;
  documentIndex: number;
  rect: { left: number; top: number; width: number; height: number };
  identity: {
    tagName: string;
    id: string;
    ariaLabel: string;
    title: string;
    name: string;
    href: string;
    action: string;
    testId: string;
    text: string;
  };
  contextText: string;
};

function normalizeFocusText(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, 240);
}

function focusContextText(element: HTMLElement) {
  return normalizeFocusText(
    element.closest<HTMLElement>(
      '[data-focus-return-context], article, tr, li, [role="row"]',
    )?.textContent,
  );
}

function getDocumentFocusableElements() {
  return Array.from(
    document.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter(
    (element) => element.tabIndex >= 0 && isVisibleAndEnabled(element),
  );
}

function captureFocusReturnSnapshot(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const documentFocusable = getDocumentFocusableElements();
  return {
    element,
    documentIndex: documentFocusable.indexOf(element),
    rect: {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    },
    identity: {
      tagName: element.tagName,
      id: element.id,
      ariaLabel: element.getAttribute("aria-label") ?? "",
      title: element.getAttribute("title") ?? "",
      name: element.getAttribute("name") ?? "",
      href: element.getAttribute("href") ?? "",
      action: element.getAttribute("data-admin-data-grid-action") ?? "",
      testId: element.getAttribute("data-testid") ?? "",
      text: normalizeFocusText(element.textContent),
    },
    contextText: focusContextText(element),
  } satisfies FocusReturnSnapshot;
}

function commonPrefixLength(left: string, right: string) {
  const limit = Math.min(left.length, right.length);
  let index = 0;
  while (index < limit && left[index] === right[index]) index += 1;
  return index;
}

function replacementFocusScore(
  candidate: HTMLElement,
  snapshot: FocusReturnSnapshot,
  documentIndex: number,
) {
  const identity = snapshot.identity;
  if (identity.id && candidate.id === identity.id) return 10_000;

  const candidateIdentity = {
    ariaLabel: candidate.getAttribute("aria-label") ?? "",
    title: candidate.getAttribute("title") ?? "",
    name: candidate.getAttribute("name") ?? "",
    href: candidate.getAttribute("href") ?? "",
    action: candidate.getAttribute("data-admin-data-grid-action") ?? "",
    testId: candidate.getAttribute("data-testid") ?? "",
    text: normalizeFocusText(candidate.textContent),
  };
  const semanticWeights = {
    ariaLabel: 80,
    title: 50,
    name: 60,
    href: 80,
    action: 40,
    testId: 100,
    text: 70,
  } as const;
  let semanticMatches = 0;
  let score = candidate.tagName === identity.tagName ? 20 : 0;

  for (const key of Object.keys(semanticWeights) as Array<
    keyof typeof semanticWeights
  >) {
    if (identity[key] && candidateIdentity[key] === identity[key]) {
      semanticMatches += 1;
      score += semanticWeights[key];
    }
  }
  if (!semanticMatches) return Number.NEGATIVE_INFINITY;

  const candidateContext = focusContextText(candidate);
  if (snapshot.contextText && candidateContext) {
    score += Math.min(
      commonPrefixLength(snapshot.contextText, candidateContext),
      160,
    );
  }

  const rect = candidate.getBoundingClientRect();
  const originalCenterX = snapshot.rect.left + snapshot.rect.width / 2;
  const originalCenterY = snapshot.rect.top + snapshot.rect.height / 2;
  const candidateCenterX = rect.left + rect.width / 2;
  const candidateCenterY = rect.top + rect.height / 2;
  score -=
    Math.hypot(
      originalCenterX - candidateCenterX,
      originalCenterY - candidateCenterY,
    ) / 100;
  if (snapshot.documentIndex >= 0) {
    score -= Math.abs(snapshot.documentIndex - documentIndex) / 10;
  }

  return score;
}

function resolveFocusReturnTarget(snapshot: FocusReturnSnapshot) {
  if (
    snapshot.element !== document.body &&
    snapshot.element !== document.documentElement &&
    snapshot.element.isConnected &&
    isVisibleAndEnabled(snapshot.element)
  ) {
    return snapshot.element;
  }

  const candidates = getDocumentFocusableElements();
  const scoredCandidates = candidates
    .map((candidate, documentIndex) => ({
      candidate,
      score: replacementFocusScore(candidate, snapshot, documentIndex),
    }))
    .filter(({ score }) => Number.isFinite(score))
    .sort((left, right) => right.score - left.score);

  return scoredCandidates[0]?.candidate ?? null;
}

function resolveDocumentFocusFallback(snapshot: FocusReturnSnapshot) {
  const candidates = getDocumentFocusableElements();
  if (!candidates.length) return null;
  if (snapshot.documentIndex < 0) return candidates[0];
  return candidates[Math.min(snapshot.documentIndex, candidates.length - 1)];
}

function focusSafely(element: HTMLElement | null) {
  if (!element?.isConnected || !isVisibleAndEnabled(element)) return false;
  element.focus({ preventScroll: true });
  return document.activeElement === element;
}

export default function VenesiaModal({
  open,
  title,
  description,
  eyebrow = "VENESIA CMS",
  size = "md",
  closeOnEscape = false,
  bodyClassName = "",
  initialFocusRef,
  children,
  footer,
  onClose,
}: VenesiaModalProps) {
  const mounted = useClientMounted();
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLElement | null>(null);
  const returnFocusFrameRef = useRef<number | null>(null);
  const focusReturnSnapshotRef = useRef<FocusReturnSnapshot | null>(null);
  const configuredInitialFocusRef = useRef(initialFocusRef);
  const closeRef = useRef(onClose);

  useEffect(() => {
    configuredInitialFocusRef.current = initialFocusRef;
  }, [initialFocusRef]);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open || !mounted) return;

    if (returnFocusFrameRef.current !== null) {
      window.cancelAnimationFrame(returnFocusFrameRef.current);
      returnFocusFrameRef.current = null;
    }

    focusReturnSnapshotRef.current =
      document.activeElement instanceof HTMLElement
        ? captureFocusReturnSnapshot(document.activeElement)
        : null;
    const root = document.documentElement;
    const previousRootOverflow = root.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    const scrollTop = document.scrollingElement?.scrollTop ?? 0;
    const scrollLeft = document.scrollingElement?.scrollLeft ?? 0;
    root.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    const focusFrame = window.requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;

      const configuredTarget = configuredInitialFocusRef.current?.current ?? null;
      if (
        configuredTarget &&
        panel.contains(configuredTarget) &&
        isVisibleAndEnabled(configuredTarget)
      ) {
        configuredTarget.focus({ preventScroll: true });
        if (document.activeElement === configuredTarget) return;
      }

      focusFirstOrPanel(panel);
    });

    function handleKeyDown(event: KeyboardEvent) {
      const panel = panelRef.current;
      if (!panel || !isTopmostDialog(panel)) return;
      if (event.key === "Escape" && closeOnEscape) {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = getFocusableElements(panel);
      if (!focusable.length) {
        event.preventDefault();
        panel.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement;

      if (!(activeElement instanceof Node) || !panel.contains(activeElement)) {
        event.preventDefault();
        if (event.shiftKey) {
          last.focus({ preventScroll: true });
        } else {
          first.focus({ preventScroll: true });
        }
        return;
      }

      if (!focusable.includes(activeElement as HTMLElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus({ preventScroll: true });
      } else if (event.shiftKey && activeElement === first) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      const focusReturnSnapshot = focusReturnSnapshotRef.current;
      focusReturnSnapshotRef.current = null;
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      root.style.overflow = previousRootOverflow;
      document.body.style.overflow = previousBodyOverflow;
      document.scrollingElement?.scrollTo({ top: scrollTop, left: scrollLeft });

      returnFocusFrameRef.current = window.requestAnimationFrame(() => {
        returnFocusFrameRef.current = null;
        if (
          focusReturnSnapshot &&
          focusSafely(resolveFocusReturnTarget(focusReturnSnapshot))
        ) {
          return;
        }

        const remainingDialogs = Array.from(
          document.querySelectorAll<HTMLElement>(
            '[role="dialog"][aria-modal="true"]',
          ),
        ).filter(isVisibleAndEnabled);
        const fallbackDialog = remainingDialogs.at(-1);
        if (fallbackDialog) {
          focusFirstOrPanel(fallbackDialog);
          return;
        }

        if (
          focusReturnSnapshot &&
          focusSafely(resolveDocumentFocusFallback(focusReturnSnapshot))
        ) {
          return;
        }

        document.body.focus({ preventScroll: true });
      });
    };
  }, [closeOnEscape, mounted, open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className={`fixed inset-0 ${ADMIN_MODAL.zIndex} flex items-center justify-center px-4 py-6`}
      dir="rtl"
      data-venesia-modal-root=""
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label="إغلاق النافذة"
        onClick={onClose}
        className={ADMIN_MODAL.backdrop}
      />
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        data-venesia-modal=""
        className={`${ADMIN_MODAL.panel} ${ADMIN_MODAL_SIZES[size]} flex max-h-[calc(100dvh-3rem)] flex-col`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={`${ADMIN_MODAL.header} shrink-0`}>
          <div className="text-right">
            <p className={ADMIN_MODAL.eyebrow}>{eyebrow}</p>
            <h2 id={titleId} className={ADMIN_MODAL.title}>
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className={ADMIN_MODAL.description}>
                {description}
              </p>
            ) : null}
          </div>
          <button type="button" onClick={onClose} className={ADMIN_MODAL.closeButton} aria-label="إغلاق">
            ×
          </button>
        </header>

        <div className={`${ADMIN_MODAL.body} min-h-0 flex-1 overflow-y-auto ${bodyClassName}`.trim()}>{children}</div>

        {footer ? <footer className={`${ADMIN_MODAL.footer} shrink-0`}>{footer}</footer> : null}
      </section>
    </div>,
    document.body,
  );
}

export {
  ADMIN_FORM,
  ADMIN_MODAL,
  ADMIN_MODAL_SIZES,
  AdminModalCancelButton,
  AdminModalDangerButton,
  AdminModalPrimaryButton,
  adminFormFieldClassName,
  adminFormHintClassName,
  adminFormLabelClassName,
};
