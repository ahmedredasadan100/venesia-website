"use client";

import { useEffect } from "react";

const REVEAL_SELECTOR = "[data-reveal]";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia?.(REDUCED_MOTION_QUERY).matches
  );
}

function clearWillChange(element: Element) {
  if (element instanceof HTMLElement) {
    element.style.willChange = "auto";
  }
}

function markRevealed(element: Element) {
  element.classList.add("is-revealed");
  element.removeAttribute("data-reveal-pending");
  clearWillChange(element);
}

/**
 * Safe scroll reveal:
 * - Content is visible by default (no JS = readable).
 * - Hidden only after JS confirms IO + not reduced motion + element registered.
 * - Single shared IntersectionObserver for all [data-reveal] nodes.
 */
export default function RevealAnimations() {
  useEffect(() => {
    const delayTimers = new Set<ReturnType<typeof setTimeout>>();
    let observer: IntersectionObserver | null = null;
    let mutationObserver: MutationObserver | null = null;
    let reducedMotionMq: MediaQueryList | null = null;

    const clearTimers = () => {
      delayTimers.forEach((id) => clearTimeout(id));
      delayTimers.clear();
    };

    const revealNow = (element: Element) => {
      markRevealed(element);
      observer?.unobserve(element);
    };

    const scheduleReveal = (element: Element) => {
      const delay = parseInt(element.getAttribute("data-delay") ?? "0", 10);
      if (!Number.isFinite(delay) || delay <= 0) {
        revealNow(element);
        return;
      }
      const timer: ReturnType<typeof setTimeout> = setTimeout(() => {
        delayTimers.delete(timer);
        revealNow(element);
      }, delay);
      delayTimers.add(timer);
    };

    const armElement = (element: Element) => {
      if (element.classList.contains("is-revealed")) return;
      if (element.getAttribute("data-reveal-armed") === "true") return;

      element.setAttribute("data-reveal-armed", "true");

      if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") {
        revealNow(element);
        return;
      }

      // Off-screen / inert slider pages must stay readable when later activated.
      if (element.closest("[inert], [aria-hidden='true']")) {
        revealNow(element);
        return;
      }

      element.setAttribute("data-reveal-pending", "true");
      if (element instanceof HTMLElement) {
        element.style.willChange = "opacity, transform, translate, scale";
      }
      observer?.observe(element);
    };

    const armAll = (root: ParentNode = document) => {
      root.querySelectorAll(REVEAL_SELECTOR).forEach((element) => armElement(element));
    };

    const onReducedMotionChange = () => {
      if (!prefersReducedMotion()) return;
      clearTimers();
      document.querySelectorAll(REVEAL_SELECTOR).forEach((element) => revealNow(element));
    };

    try {
      if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") {
        armAll();
      } else {
        observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (!entry.isIntersecting) return;
              scheduleReveal(entry.target);
              observer?.unobserve(entry.target);
            });
          },
          {
            threshold: [0, 0.05, 0.1],
            // Slight negative bottom so reveal starts before elements hit the fold edge,
            // without being so aggressive that mid-page elements never latch.
            rootMargin: "0px 0px -8% 0px",
          },
        );
        armAll();

        mutationObserver = new MutationObserver((mutations) => {
          for (const mutation of mutations) {
            mutation.addedNodes.forEach((node) => {
              if (!(node instanceof Element)) return;
              if (node.matches(REVEAL_SELECTOR)) armElement(node);
              armAll(node);
            });
          }
        });
        mutationObserver.observe(document.body, { childList: true, subtree: true });
      }

      if (window.matchMedia) {
        reducedMotionMq = window.matchMedia(REDUCED_MOTION_QUERY);
        reducedMotionMq.addEventListener("change", onReducedMotionChange);
      }
    } catch {
      // Any runtime failure must leave content visible.
      clearTimers();
      document.querySelectorAll(REVEAL_SELECTOR).forEach((element) => {
        element.removeAttribute("data-reveal-pending");
        markRevealed(element);
      });
    }

    return () => {
      clearTimers();
      observer?.disconnect();
      mutationObserver?.disconnect();
      reducedMotionMq?.removeEventListener("change", onReducedMotionChange);
      document.querySelectorAll(REVEAL_SELECTOR).forEach((element) => {
        element.removeAttribute("data-reveal-pending");
        element.removeAttribute("data-reveal-armed");
        if (element instanceof HTMLElement) {
          element.style.willChange = "auto";
        }
      });
    };
  }, []);

  return null;
}
