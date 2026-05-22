"use client";

/*
  COMPONENT: FooterSocialBar
  PURPOSE: Premium footer social/contact shortcut icons for Venesia Developments.
           Centered row of glass icon buttons providing direct access to all
           social platforms, WhatsApp, and the office location.
  INTERACTION: Clickable links with cursor-pointer. Subtle −2px hover lift and
               gentle gold border/glow on hover. No permanent arrow decorations.
  VISUAL RULES:
    · Dark glass circles — bg-[#05070B]/65 + backdrop-blur-md
    · Thin gold border that brightens on hover (not on resting state)
    · Icon opacity improves on hover — not full white at rest
    · No flashy colors, no social-media brand colors
    · Keep cinematic luxury direction — calm, premium, minimal
*/

import type { ReactNode } from "react";

interface SocialLink {
  label: string;
  href: string;
  icon: ReactNode;
}

const links: SocialLink[] = [
  {
    label: "Facebook",
    href: "https://facebook.com/venesia-developments",
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
        stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
      </svg>
    ),
  },
  {
    label: "Instagram",
    href: "https://instagram.com/venesia_developments",
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
        stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" strokeWidth="2.2" />
      </svg>
    ),
  },
  {
    label: "TikTok",
    href: "https://tiktok.com/@venesiadevelopments",
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
        stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
      </svg>
    ),
  },
  {
    label: "YouTube",
    href: "https://youtube.com/@venesia",
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
        stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
        <path d="m10 15 5-3-5-3z" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: "WhatsApp",
    href: "https://wa.me/201000000000",
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
        stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
    ),
  },
  {
    label: "Location",
    href: "https://maps.google.com/?q=Street+12,New+Cairo+1,Cairo+Governorate",
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
        stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
  },
];

export default function FooterSocialBar() {
  return (
    <div
      data-reveal
      data-delay="220"
      className="mt-10 flex items-center justify-center gap-3"
    >
      {links.map(({ label, href, icon }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noreferrer"
          aria-label={label}
          className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-[#D8B87A]/14 bg-[#05070B]/65 text-white/46 backdrop-blur-md transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:border-[#D8B87A]/38 hover:bg-[#05070B]/80 hover:text-white/78 hover:shadow-[0_0_18px_rgba(216,184,122,0.07),0_4px_20px_rgba(0,0,0,0.18)]"
        >
          {icon}
        </a>
      ))}
    </div>
  );
}
