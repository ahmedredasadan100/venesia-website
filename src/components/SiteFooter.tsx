"use client";

import FooterSocialBar from "./FooterSocialBar";
import { useFooterNavigation, useFooterSettings } from "./FooterSettingsProvider";
import { usePublicNavigation } from "./PublicNavigationProvider";

type SiteFooterProps = {
  immediateReveal?: boolean;
};

export default function SiteFooter({ immediateReveal = false }: SiteFooterProps) {
  const revealClass = immediateReveal ? "is-revealed" : "";
  const settings = useFooterSettings();
  const footerNavItems = useFooterNavigation();
  const mainNavItems = usePublicNavigation();

  const quickLinks =
    footerNavItems.length > 0
      ? footerNavItems.map(({ label, href, target }) => ({ label, href, target }))
      : mainNavItems.map(({ label, href, target }) => ({ label, href, target }));

  const mediaCenterLinks =
    mainNavItems.find((item) => item.href === "/media-center")?.submenu ?? [];

  return (
    <footer className="relative z-10 mt-13 border-t border-white/[0.06] bg-[#05070B]">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(to right,transparent,rgba(216,184,122,0.35) 35%,rgba(216,184,122,0.35) 65%,transparent)",
        }}
      />

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_40%_at_50%_0%,rgba(30,58,95,0.18),transparent)]" />

      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div
            data-reveal
            data-delay="0"
            className={`group rounded-[1.75rem] border border-white/[0.07] bg-white/[0.03] p-7 backdrop-blur-md transition-colors duration-500 hover:border-[#D8B87A]/20 hover:bg-white/[0.05] ${revealClass}`}
          >
            <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl border border-[#D8B87A]/25 bg-[#D8B87A]/[0.06]">
              <span className="text-xs text-[#D8B87A]">◆</span>
            </div>

            <h3 className="text-base font-medium tracking-wide text-white/90">
              {settings.brand.title}
            </h3>

            <p className="mt-3 text-[13px] leading-6 text-white/40">
              {settings.brand.tagline}
            </p>

            <div className="mt-6 h-px w-10 bg-[#D8B87A]/30" />
          </div>

          <div
            data-reveal
            data-delay="60"
            className={`group rounded-[1.75rem] border border-white/[0.07] bg-white/[0.03] p-7 backdrop-blur-md transition-colors duration-500 hover:border-[#D8B87A]/20 hover:bg-white/[0.05] ${revealClass}`}
          >
            <p className="mb-5 text-[12px] font-medium text-[#D8B87A]/80">
              {settings.brand.contactHeading}
            </p>

            <ul className="space-y-3 text-[13px] text-white/50">
              {settings.contactItems
                .filter((item) => item.visible !== false)
                .map(({ icon, label, value, href }) => (
                <li key={`${label}-${value}`} className="flex items-start gap-2.5">
                  <span className="mt-0.5 shrink-0 text-[#D8B87A]/50">{icon ?? "•"}</span>

                  {href ? (
                    <a
                      href={href}
                      target={href.startsWith("http") ? "_blank" : undefined}
                      rel={href.startsWith("http") ? "noreferrer" : undefined}
                      className="cursor-pointer transition-colors duration-300 hover:text-[#D8B87A]"
                      dir={label.includes("رقم") || label.includes("موبايل") ? "ltr" : undefined}
                    >
                      <span className="block text-[11px] text-white/30">{label}</span>
                      <span className="break-all">{value}</span>
                    </a>
                  ) : (
                    <div dir={label.includes("رقم") || label.includes("موبايل") ? "ltr" : undefined}>
                      <span className="block text-[11px] text-white/30">{label}</span>
                      <span className="break-all">{value}</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div
            data-reveal
            data-delay="120"
            className={`group rounded-[1.75rem] border border-white/[0.07] bg-white/[0.03] p-7 backdrop-blur-md transition-colors duration-500 hover:border-[#D8B87A]/20 hover:bg-white/[0.05] ${revealClass}`}
          >
            <ul className="-mt-1 space-y-3">
              {quickLinks.map(({ label, href, target }) => (
                <li key={href}>
                  <a
                    href={href}
                    target={target === "_blank" ? "_blank" : undefined}
                    rel={target === "_blank" ? "noreferrer" : undefined}
                    className="group/link flex cursor-pointer items-center gap-2 text-[13px] text-white/45 transition-colors duration-300 hover:text-white/80"
                  >
                    <span className="h-px w-3 shrink-0 bg-white/20 transition-all duration-300 group-hover/link:w-5 group-hover/link:bg-[#D8B87A]/60" />
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div
            data-reveal
            data-delay="180"
            className={`group rounded-[1.75rem] border border-white/[0.07] bg-white/[0.03] p-7 backdrop-blur-md transition-colors duration-500 hover:border-[#D8B87A]/20 hover:bg-white/[0.05] ${revealClass}`}
          >
            <p className="mb-5 text-[12px] font-medium text-[#D8B87A]/80">
              {settings.brand.mediaHeading}
            </p>

            <ul className="space-y-3 text-[13px] text-white/45">
              {mediaCenterLinks.map(({ label, href, target }) => (
                <li key={href}>
                  <a
                    href={href}
                    target={target === "_blank" ? "_blank" : undefined}
                    rel={target === "_blank" ? "noreferrer" : undefined}
                    className="flex cursor-pointer items-center gap-2 transition-colors duration-300 hover:text-white/80"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.04] text-[9px] text-[#D8B87A]">
                      ◆
                    </span>
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <FooterSocialBar immediateReveal={immediateReveal} />
      </div>
    </footer>
  );
}
