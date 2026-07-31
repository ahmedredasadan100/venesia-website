"use client";

import {
  useCallback,
  useLayoutEffect,
  useState,
  type RefObject,
} from "react";
import {
  createAdminFloatingMenuStyle,
  type AdminFloatingMenuPosition,
} from "./admin-floating-position";

type UseAdminFloatingMenuPositionOptions = {
  minWidth?: number;
  offset?: number;
  preferredWidth?: number;
  align?: "left" | "right";
  collisionPadding?: number;
  estimatedHeight?: number;
  floatingRef?: RefObject<HTMLElement | null>;
  onAnchorInvalid?: () => void;
  repositionKey?: string | number;
  zIndex?: number;
};

function numericCssValue(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(minimum, value), Math.max(minimum, maximum));
}

export function useAdminFloatingMenuPosition(
  isOpen: boolean,
  anchorRef: React.RefObject<HTMLElement | null>,
  {
    minWidth = 220,
    offset = 6,
    preferredWidth,
    align = "left",
    collisionPadding,
    estimatedHeight,
    floatingRef,
    onAnchorInvalid,
    repositionKey,
    zIndex = 9999,
  }: UseAdminFloatingMenuPositionOptions = {},
) {
  const [position, setPosition] = useState<AdminFloatingMenuPosition | null>(null);

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    if (
      !anchor.isConnected ||
      anchor.getClientRects().length === 0 ||
      rect.width <= 0 ||
      rect.height <= 0
    ) {
      setPosition(null);
      onAnchorInvalid?.();
      return;
    }
    const requestedWidth = Math.max(
      rect.width,
      minWidth,
      preferredWidth ?? 0,
    );
    const hasCollisionBoundary = collisionPadding !== undefined;
    const viewportPadding = collisionPadding ?? 0;
    const width = hasCollisionBoundary
      ? Math.min(
          requestedWidth,
          Math.max(rect.width, window.innerWidth - viewportPadding * 2),
        )
      : requestedWidth;
    const requestedLeft = align === "right" ? rect.right - width : rect.left;
    const left = hasCollisionBoundary
      ? Math.min(
          Math.max(viewportPadding, requestedLeft),
          Math.max(
            viewportPadding,
            window.innerWidth - width - viewportPadding,
          ),
        )
      : requestedLeft;

    const floating = floatingRef?.current;
    const measuredHeight = floating
      ? (() => {
          const styles = window.getComputedStyle(floating);
          const borderBlockSize =
            numericCssValue(styles.borderTopWidth) +
            numericCssValue(styles.borderBottomWidth);
          const renderedBoxAdjustment = Math.max(
            0,
            floating.getBoundingClientRect().height - floating.clientHeight,
          );
          const boxAdjustment = Math.max(
            borderBlockSize,
            renderedBoxAdjustment,
          );
          return Math.ceil(floating.scrollHeight + boxAdjustment);
        })()
      : 0;
    const requestedHeight = measuredHeight || estimatedHeight;

    if (requestedHeight && hasCollisionBoundary) {
      const viewportHeight = Math.max(
        0,
        window.innerHeight - viewportPadding * 2,
      );
      const availableBelow = Math.max(
        0,
        window.innerHeight - rect.bottom - offset - viewportPadding,
      );
      const availableAbove = Math.max(
        0,
        rect.top - offset - viewportPadding,
      );
      const fitsBelow = requestedHeight <= availableBelow;
      const fitsAbove = requestedHeight <= availableAbove;

      if (requestedHeight <= viewportHeight) {
        const placement =
          fitsBelow
            ? "bottom"
            : fitsAbove
              ? "top"
              : availableBelow >= availableAbove
                ? "bottom"
                : "top";
        const maximumInset = Math.max(
          viewportPadding,
          window.innerHeight - viewportPadding - requestedHeight,
        );
        const top = clamp(
          rect.bottom + offset,
          viewportPadding,
          maximumInset,
        );
        const bottom = clamp(
          window.innerHeight - rect.top + offset,
          viewportPadding,
          maximumInset,
        );

        setPosition({
          placement,
          style: createAdminFloatingMenuStyle({
            placement,
            top,
            bottom,
            left,
            width,
            maxHeight: requestedHeight,
            zIndex,
          }),
        });
        return;
      }

      setPosition({
        placement: "bottom",
        style: createAdminFloatingMenuStyle({
          placement: "bottom",
          top: viewportPadding,
          left,
          width,
          maxHeight: viewportHeight,
          zIndex,
        }),
      });
      return;
    }

    setPosition({
      placement: "bottom",
      style: createAdminFloatingMenuStyle({
        placement: "bottom",
        top: rect.bottom + offset,
        left,
        width,
        zIndex,
      }),
    });
  }, [
    align,
    anchorRef,
    collisionPadding,
    estimatedHeight,
    floatingRef,
    minWidth,
    offset,
    onAnchorInvalid,
    preferredWidth,
    zIndex,
  ]);

  useLayoutEffect(() => {
    if (!isOpen || !anchorRef.current) {
      setPosition(null);
      return;
    }

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    window.visualViewport?.addEventListener("scroll", updatePosition);
    window.visualViewport?.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
      window.visualViewport?.removeEventListener("scroll", updatePosition);
      window.visualViewport?.removeEventListener("resize", updatePosition);
    };
  }, [anchorRef, isOpen, repositionKey, updatePosition]);

  const isPositioned = position !== null;

  useLayoutEffect(() => {
    const floating = floatingRef?.current;
    const anchor = anchorRef.current;
    if (!isOpen || !isPositioned || !floating) return;

    updatePosition();
    if (typeof ResizeObserver === "undefined") return;

    let frame = 0;
    const observer = new ResizeObserver(() => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(updatePosition);
    });
    const mutationRoot =
      anchor?.closest<HTMLElement>("[data-admin-entity-list-surface]") ??
      anchor?.parentElement ??
      null;
    const mutationObserver =
      anchor && mutationRoot && typeof MutationObserver !== "undefined"
        ? new MutationObserver(() => {
            if (!anchor.isConnected) updatePosition();
          })
        : null;

    observer.observe(floating);
    if (anchor) observer.observe(anchor);
    Array.from(floating.children).forEach((child) => observer.observe(child));
    if (mutationObserver && mutationRoot) {
      mutationObserver.observe(mutationRoot, {
        childList: true,
        subtree: true,
      });
    }

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      mutationObserver?.disconnect();
    };
  }, [
    floatingRef,
    anchorRef,
    isOpen,
    isPositioned,
    repositionKey,
    updatePosition,
  ]);

  return position;
}
