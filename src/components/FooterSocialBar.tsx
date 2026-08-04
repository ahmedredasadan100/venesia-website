"use client";

import type { ReactNode } from "react";

import { useFooterSettings } from "./FooterSettingsProvider";
import type { FooterSocialLink, FooterSocialPlatform } from "../lib/footer/types";

type FooterSocialBarProps = {
  immediateReveal?: boolean;
};

const platformIcons: Record<FooterSocialPlatform, ReactNode> = {
  facebook: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" strokeWidth="2.2" />
    </svg>
  ),
  tiktok: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
    </svg>
  ),
  youtube: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
      <path d="m10 15 5-3-5-3z" fill="currentColor" stroke="none" />
    </svg>
  ),
  whatsapp: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  ),
  location: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
};

export default function FooterSocialBar({ immediateReveal = false }: FooterSocialBarProps) {
  const settings = useFooterSettings();
  const links: FooterSocialLink[] = settings.socialLinks
    .filter((item) => item.visible !== false);

  return (
    <>
      <div
        data-reveal="fade-up"
        data-delay="320"
        className={immediateReveal ? "is-revealed" : undefined}
      >
        <div className="mt-6 flex items-center justify-center gap-2">
          {links.map(({ platform, label, href }) => (
            <a
              key={`${platform}-${href}`}
              href={href}
              target="_blank"
              rel="noreferrer"
              aria-label={label}
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-[#D8B87A]/14 bg-[#05070B]/65 text-white/46 backdrop-blur-md transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:border-[#D8B87A]/38 hover:bg-[#05070B]/80 hover:text-white/78 hover:shadow-[0_0_18px_rgba(216,184,122,0.07),0_4px_20px_rgba(0,0,0,0.18)]"
            >
              {platformIcons[platform]}
            </a>
          ))}
        </div>

        <div className="mt-4 border-t border-white/[0.05] pt-4">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
            <p className="text-[12px] text-white/25">
              © {new Date().getFullYear()} {settings.legal.copyright}
            </p>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-[#D8B87A]/40">◆</span>

              <p className="text-[12px] text-white/20">
                {settings.legal.tagline}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
