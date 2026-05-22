"use client";

/*
  COMPONENT: BackToTopButton
  PURPOSE: Premium floating navigation shortcut to return to the top of the
           Venesia website. Appears after the user scrolls past the hero.
  MOTION: Subtle fade + 12px upward slide on appearance (threshold: 500px).
          Calm 2px lift on hover. No bounce, spin, scale pulse, or glow flash.
  VISUAL RULES:
    · Dark glassmorphism — matches body card style (bg-[#05070B]/70, backdrop-blur)
    · Soft gold border that brightens slightly on hover
    · Rounded pill shape, minimal SVG arrow icon
    · pointer-events-none while hidden so it never blocks underlying content
    · Positioned bottom-left — RTL-appropriate (end of reading flow)
*/

import { useEffect, useState } from "react";

export default function BackToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 500);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <button
      onClick={scrollToTop}
      aria-label="Back to top"
      className={`fixed bottom-8 left-6 z-40 flex h-11 w-11 items-center justify-center rounded-full border bg-[#05070B]/72 text-white/52 backdrop-blur-md transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:text-white/80 lg:left-8 ${
        visible
          ? "pointer-events-auto translate-y-0 opacity-100"
          : "pointer-events-none translate-y-3 opacity-0"
      } border-[#D8B87A]/18 shadow-[0_4px_20px_rgba(0,0,0,0.16)] hover:border-[#D8B87A]/38 hover:shadow-[0_6px_26px_rgba(0,0,0,0.20),0_0_0_1px_rgba(216,184,122,0.06)]`}
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 15 15"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M7.5 11.5V3.5M4 7l3.5-3.5L11 7"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
