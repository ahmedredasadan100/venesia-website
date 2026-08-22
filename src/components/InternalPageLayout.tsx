import type { HeroSectionData } from "../lib/page-sections";
import BreadcrumbModuleSection from "./modules/BreadcrumbModuleSection";
import DynamicHeroSection from "./sections/DynamicHeroSection";

type InternalPageLayoutProps = {
  title: string;
  heroImage?: string;
  eyebrow?: string;
  subtitle?: string;
  breadcrumbCurrentLabel?: string;
  mainClassName?: string;
  children?: React.ReactNode;
  dynamicHero?: HeroSectionData | null;
  /** Page Composition-owned breadcrumb injected into the Standard Hero footer slot. */
  heroBreadcrumb?: React.ReactNode;
  /** When false and dynamicHero is absent, static hero section is omitted (Home/Media CMS hide rule). */
  allowStaticHeroFallback?: boolean;
  showTitle?: boolean;
  showHeroImage?: boolean;
  showSubtitle?: boolean;
};

export default function InternalPageLayout({
  title,
  heroImage,
  eyebrow,
  subtitle,
  breadcrumbCurrentLabel,
  mainClassName,
  children,
  dynamicHero,
  heroBreadcrumb,
  allowStaticHeroFallback = true,
  showTitle = true,
  showHeroImage = true,
  showSubtitle = true,
}: InternalPageLayoutProps) {
  const shouldRenderHero = Boolean(dynamicHero) || allowStaticHeroFallback;
  const heroCompositionFooter = shouldRenderHero
    ? heroBreadcrumb ?? (
        <BreadcrumbModuleSection currentLabelOverride={breadcrumbCurrentLabel} />
      )
    : null;

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#05070B] text-white" dir="rtl">
      <div aria-hidden className="venesia-grain pointer-events-none fixed inset-0 z-[4]" />

      <main className={`relative z-10 min-h-[50vh] pb-20 ${mainClassName ?? ""}`.trim()}>
        {shouldRenderHero ? (
          <DynamicHeroSection
            hero={dynamicHero}
            fallbackTitle={title}
            fallbackEyebrow={eyebrow}
            fallbackSubtitle={subtitle}
            fallbackImage={heroImage}
            compositionFooter={heroCompositionFooter}
            fallbackVisibility={{
              title: showTitle,
              image: showHeroImage,
              subtitle: showSubtitle,
            }}
          />
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
