"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo } from "react";
import { usePathname } from "next/navigation";

import { buildBreadcrumbsFromNavigation } from "../lib/public-navigation";
import { usePublicNavigation } from "./PublicNavigationProvider";
import type { HeroSectionData } from "../lib/page-sections";
import DynamicHeroSection from "./sections/DynamicHeroSection";

type InternalPageLayoutProps = {
  title: string;
  heroImage?: string;
  eyebrow?: string;
  subtitle?: string;
  breadcrumbCurrentLabel?: string;
  heroHeightClassName?: string;
  heroImagePositionClassName?: string;
  mainClassName?: string;
  children?: React.ReactNode;
  dynamicHero?: HeroSectionData | null;
  heroBelowTitle?: React.ReactNode;
  /** When false and dynamicHero is absent, static hero section is omitted (Home/Media CMS hide rule). */
  allowStaticHeroFallback?: boolean;
};

export default function InternalPageLayout({
  title,
  heroImage,
  eyebrow,
  subtitle,
  breadcrumbCurrentLabel,
  heroHeightClassName,
  heroImagePositionClassName,
  mainClassName,
  children,
  dynamicHero,
  heroBelowTitle,
  allowStaticHeroFallback = true,
}: InternalPageLayoutProps) {
  const pathname = usePathname();
  const navItems = usePublicNavigation();

  const breadcrumbs = useMemo(
    () => buildBreadcrumbsFromNavigation(pathname ?? "/", navItems),
    [pathname, navItems],
  );

  const resolvedBreadcrumbs =
    breadcrumbCurrentLabel && breadcrumbs.length > 0
      ? [...breadcrumbs.slice(0, -1), { label: breadcrumbCurrentLabel }]
      : breadcrumbs;

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#05070B] text-white" dir="rtl">
      <div aria-hidden className="venesia-grain pointer-events-none fixed inset-0 z-[4]" />

      <main className={`relative z-10 min-h-[50vh] pb-20 ${mainClassName ?? ""}`.trim()}>
        {dynamicHero ? (
          <DynamicHeroSection
            hero={dynamicHero}
            fallbackTitle={title}
            fallbackEyebrow={eyebrow}
            fallbackSubtitle={subtitle}
            fallbackImage={heroImage}
            belowTitle={heroBelowTitle}
          />
        ) : allowStaticHeroFallback ? (
        <section
          className={`relative isolate overflow-hidden bg-[#05070B] ${
            heroHeightClassName ?? "h-[min(62vh,580px)] min-h-[440px]"
          }`}
        >
          {heroImage ? (
            <>
              <div className="absolute inset-0 z-0 overflow-hidden">
                <Image
                  src={heroImage}
                  alt=""
                  fill
                  priority
                  sizes="100vw"
                  className={`hero-slide-ken-burns pointer-events-none !left-1/2 !top-1/2 !right-auto !bottom-auto h-auto w-auto min-h-full min-w-full object-cover ${
                    heroImagePositionClassName ?? "object-center"
                  }`}
                  style={{ filter: "brightness(1.04) contrast(1.04) saturate(1.02)" }}
                />
              </div>

              <div aria-hidden className="pointer-events-none absolute inset-0 bg-[#05070B]/20" />

              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_left,rgba(5,7,11,0.52)_0%,rgba(5,7,11,0.20)_26%,rgba(5,7,11,0.06)_44%,transparent_64%)]"
              />

              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(5,7,11,0.24)_0%,transparent_34%,rgba(5,7,11,0.68)_100%)]"
              />

              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-px bg-[linear-gradient(to_right,transparent,rgba(255,196,92,0.82)_50%,transparent)]"
              />
            </>
          ) : (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_75%_70%_at_18%_22%,rgba(192,143,62,0.11),transparent_64%),radial-gradient(ellipse_95%_74%_at_84%_18%,rgba(18,36,78,0.22),transparent_68%)]"
            />
          )}

          <div className="relative z-10 flex h-full min-h-0 flex-col">
            <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col justify-end px-6 pb-10 pt-20 sm:pb-12 sm:pt-24 md:pb-14 md:pt-28 lg:px-6 lg:pb-16">
              <div className="grid w-full items-end gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
                <div className="min-w-0">
                  <p className="mb-5 flex items-center gap-3 font-en text-[10px] uppercase tracking-[0.2em] text-[#D8B87A]/55">
                    <span className="h-px w-8 shrink-0 bg-gradient-to-r from-[#D8B87A]/60 to-transparent" />
                    {eyebrow ?? "Internal Page"}
                  </p>

                  <h1 className="max-w-[14ch] text-[2rem] font-bold leading-[1.2] tracking-[-0.02em] text-white sm:text-4xl md:text-[2.5rem]">
                    {title}
                  </h1>

                  {subtitle ? (
                    <p className="mt-4 max-w-2xl text-[15px] leading-8 text-white/60 md:text-base md:leading-9">
                      {subtitle}
                    </p>
                  ) : null}

                  <nav className="mt-6" aria-label="Breadcrumb">
                    <ol className="flex flex-wrap items-center gap-2 text-sm text-white/62">
                      {resolvedBreadcrumbs.map((item, index) => (
                        <li key={`${item.label}-${index}`} className="flex items-center gap-2">
                          {item.href ? (
                            <Link
                              href={item.href}
                              className="transition-colors duration-300 hover:text-white/88"
                            >
                              {item.label}
                            </Link>
                          ) : (
                            <span className="text-[#D8B87A]/90">{item.label}</span>
                          )}

                          {index < resolvedBreadcrumbs.length - 1 ? (
                            <span className="text-[#D8B87A]/45">•</span>
                          ) : null}
                        </li>
                      ))}
                    </ol>
                  </nav>
                </div>

                <div aria-hidden className="hidden min-w-0 lg:block" />
              </div>
            </div>
          </div>
        </section>
        ) : null}

        <section className="mx-auto max-w-7xl px-6 pt-10">
          {children ?? (
            <>
              <h2 className="text-2xl font-medium tracking-wide text-white/90 md:text-3xl">
                {title}
              </h2>

              <p className="mt-4 max-w-2xl text-[15px] leading-7 text-white/50">
                المحتوى قيد الإعداد.
              </p>
            </>
          )}
        </section>
      </main>
    </div>
  );
}