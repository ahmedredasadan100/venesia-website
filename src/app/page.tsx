"use client";

import React, { useEffect, useRef, useState } from "react";
import BackToTopButton from "../components/BackToTopButton";
import FooterSocialBar from "../components/FooterSocialBar";

const heroSlides = [
  "/images/venesia-1.png",
  "/images/venesia-2.png",
  "/images/venesia-3.png",
  "/images/venesia-4.png",
];

const projects = [
  {
    name: "B84",
    location: "الحي الأول",
    area: "القاهرة الجديدة",
    status: "متابعة الإنشاء",
    metric: "تقدم مستمر",
    image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1400&auto=format&fit=crop",
  },
  {
    name: "C35",
    location: "بيت الوطن",
    area: "الحي الأول",
    status: "متابعة الإنشاء",
    metric: "موقع مميز",
    image: "https://images.unsplash.com/photo-1494526585095-c41746248156?q=80&w=1400&auto=format&fit=crop",
  },
  {
    name: "J191",
    location: "الحي الثاني",
    area: "التجمع الخامس",
    status: "بدأ الحفر",
    metric: "تنفيذ فعلي",
    image: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?q=80&w=1400&auto=format&fit=crop",
  },
  {
    name: "F92",
    location: "الحي الرابع",
    area: "القاهرة الجديدة",
    status: "متابعة الإنشاء",
    metric: "مراحل موثقة",
    image: "https://images.unsplash.com/photo-1460317442991-0ec209397118?q=80&w=1400&auto=format&fit=crop",
  },
];

const proof = [
  { title: "أراضي مملوكة", text: "بداية أي ثقة حقيقية تبدأ من أصل واضح ومدفوع." },
  { title: "إدارة هندسية", text: "متابعة تنفيذ مش مجرد صور… ده نظام بيشتغل على الأرض." },
  { title: "مراحل موثقة", text: "كل مرحلة ليها معنى، وكل خطوة بتثبت إن الوعد بيتحول لحقيقة." },
  { title: "رسالة طمأنة", text: "العميل مش محتاج يسمع وعود كتير… محتاج يشوف تنفيذ حقيقي." },
];

const contactItems: { icon: React.ReactNode; label: string; value: string; href: string | null }[] = [
  {
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
    ),
    label: "تواصل عبر واتساب",
    value: "+20 10 1234 5678",
    href: "https://wa.me/201012345678",
  },
  {
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m22 16.92-.04 3.03a2 2 0 0 1-2.19 1.98 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.17 12 19.79 19.79 0 0 1 1.1 3.38a2 2 0 0 1 1.97-2.18l3.04-.04a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.14 8.74a16 16 0 0 0 6.12 6.12l1.13-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7a2 2 0 0 1 1.72 2.03z" />
      </svg>
    ),
    label: "الخط الساخن",
    value: "15875",
    href: "tel:15875",
  },
  {
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect width="20" height="16" x="2" y="4" rx="2" />
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
      </svg>
    ),
    label: "البريد الإلكتروني",
    value: "info@venesia-developments.com",
    href: "mailto:info@venesia-developments.com",
  },
  {
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    label: "ساعات العمل",
    value: "السبت – الخميس ٩ص – ٦م",
    href: null,
  },
];

export default function HomePage() {
  const [heroSlideIndex, setHeroSlideIndex] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [navScrolled, setNavScrolled] = useState(false);

  // Stable refs — mutated directly, no re-render needed
  const heroTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heroSliderRef = useRef<HTMLDivElement | null>(null);

  // Autoplay — controlled via ref so drag handlers can pause/resume it
  const startHeroAutoplay = () => {
    if (heroTimerRef.current) clearInterval(heroTimerRef.current);
    heroTimerRef.current = setInterval(() => {
      setHeroSlideIndex((prev) => (prev + 1) % heroSlides.length);
    }, 8000);
  };

  useEffect(() => {
    startHeroAutoplay();
    return () => {
      if (heroTimerRef.current) clearInterval(heroTimerRef.current);
    };
  // startHeroAutoplay only uses stable refs/setState
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Hero drag / swipe — attached ONLY to the main background slider layer.
  // Decorative overlays use pointer-events-none so they never become event targets.
  // pointerup on window ensures fast releases are always captured.
  useEffect(() => {
    const slider = heroSliderRef.current;
    if (!slider) return;

    const THRESHOLD = 52;
    let startX = 0;
    let active = false;
    let resumeTimer: ReturnType<typeof setTimeout> | null = null;

    const resumeAutoplay = () => {
      if (heroTimerRef.current) clearInterval(heroTimerRef.current);
      heroTimerRef.current = setInterval(() => {
        setHeroSlideIndex((prev) => (prev + 1) % heroSlides.length);
      }, 8000);
    };

    const scheduleResume = () => {
      if (resumeTimer) clearTimeout(resumeTimer);
      resumeTimer = setTimeout(resumeAutoplay, 1500);
    };

    const onDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest("button, a")) return;
      startX = e.clientX;
      active = true;
      slider.style.cursor = "grabbing";
      if (heroTimerRef.current) {
        clearInterval(heroTimerRef.current);
        heroTimerRef.current = null;
      }
    };

    const onUp = (e: PointerEvent) => {
      if (!active) return;
      const delta = startX - e.clientX;
      active = false;
      slider.style.cursor = "grab";
      if (Math.abs(delta) >= THRESHOLD) {
        setHeroSlideIndex((prev) =>
          delta > 0
            ? (prev + 1) % heroSlides.length
            : (prev - 1 + heroSlides.length) % heroSlides.length
        );
      }
      scheduleResume();
    };

    const onCancel = () => {
      if (!active) return;
      active = false;
      slider.style.cursor = "grab";
      scheduleResume();
    };

    slider.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    window.addEventListener("pointercancel", onCancel, { passive: true });

    return () => {
      if (resumeTimer) clearTimeout(resumeTimer);
      slider.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
  // heroTimerRef and setHeroSlideIndex are stable
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let ticking = false;
    const update = () => {
      ticking = false;
      const y = window.scrollY;
      setNavScrolled((prev) => (prev ? y > 20 : y > 40));
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    // Reveal fires once per element — never replays on scroll up/down.
    // rootMargin: trigger when element is 48px inside the viewport bottom,
    // giving the animation a moment to land before the eye fully reaches it.
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const delay = parseInt(entry.target.getAttribute("data-delay") ?? "0", 10);
            setTimeout(() => entry.target.classList.add("is-revealed"), delay);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -48px 0px" }
    );
    document.querySelectorAll("[data-reveal]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const visibleProjects = [0, 1, 2].map(
    (offset) => projects[(currentIndex + offset) % projects.length]
  );

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % projects.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + projects.length) % projects.length);
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#05070B] text-white" dir="rtl">
      {/* film grain — unified micro-texture across all sections */}
      <div aria-hidden className="venesia-grain pointer-events-none fixed inset-0 z-[4]" />

      {/*
        ══════════════════════════════════════════════════════════════════
        SECTION: Navbar
        PURPOSE: Global navigation with two cinematic states.
        STATE 1 — DORMANT (top of page):
          Subtle architectural glass frame — always present, never loud.
          Champagne/gold border, feather-light background, soft blur.
          Feels integrated with the hero atmosphere, not added on top.
        STATE 2 — ACTIVE (on scroll):
          Capsule hardens into a stronger floating glass panel.
          Deeper background, more visible border, stronger blur/shadow.
        MOTION:  700 ms CSS transition, spring-easing. No scroll-reveal.
        VISUAL RULES:
          · Both states use rounded-2xl capsule — no abrupt shape change
          · Gold CTA button always visible; do not hide on scroll
          · Nav links collapse below lg — mobile menu not yet implemented
        ══════════════════════════════════════════════════════════════════
      */}
<header
  className="fixed inset-x-0 top-0 z-50 px-5 py-5 transition-[background-color,backdrop-filter,border-color,box-shadow] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] sm:px-8 sm:py-5 md:px-10 md:py-5"
>
  <div
    className={`mx-auto flex max-w-6xl items-center justify-between rounded-2xl border px-5 py-3 shadow-[0_1px_0_0_rgba(216,184,122,0.07)_inset,0_2px_18px_rgba(0,0,0,0.12)] transition-[background-color,backdrop-filter,border-color,box-shadow] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] backdrop-saturate-[1.6] sm:px-6 sm:py-3 md:px-8 ${
      navScrolled
        ? "border-[#D8B87A]/[0.14] bg-[#05070B]/55 shadow-[0_4px_28px_rgba(0,0,0,0.24),0_0_16px_rgba(216,184,122,0.06),0_1px_0_0_rgba(216,184,122,0.22)_inset,1px_0_0_0_rgba(216,184,122,0.09)_inset,-1px_0_0_0_rgba(216,184,122,0.09)_inset,0_-1px_0_0_rgba(216,184,122,0.04)_inset] backdrop-blur-[22px]"
        : "border-[#D8B87A]/[0.13] bg-[#05070B]/[0.08] backdrop-blur-[8px]"
    }`}
  >
    {/* Brand */}
    <div className="flex h-10 min-w-0 shrink-0 items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#D8B87A]/25 bg-white/[0.03]">
          <span className="text-xs leading-none text-[#D8B87A]">◆</span>
        </div>
      </div>

      <div className="min-h-10 min-w-[10.5rem] shrink-0">
        <p className="truncate whitespace-nowrap text-[15px] font-medium leading-5 tracking-wide text-white/90">
          Venesia Developments
        </p>
        <p className="truncate whitespace-nowrap text-[11px] leading-4 tracking-wide text-white/35">
          Trust Built On Ground
        </p>
      </div>
    </div>

    {/* Nav links */}
    <nav className="hidden items-center gap-4 text-[13px] font-medium tracking-wide text-white/45 lg:flex xl:gap-6">
      {["الرئيسية", "من نحن", "المشروعات السكنية", "المشروعات التجارية", "تابع مشروعك", "المركز الإعلامي", "تواصل معنا"].map((link) => (
        <a
          key={link}
          className="group/link relative cursor-pointer transition-colors duration-500 ease-out hover:text-white/85"
        >
          {link}
          <span className="absolute -bottom-0.5 right-0 h-px w-0 bg-gradient-to-l from-[#D8B87A]/55 to-transparent transition-[width] duration-500 ease-out group-hover/link:w-full" />
        </a>
      ))}
    </nav>

    {/* CTA */}
    <button className="shrink-0 rounded-full bg-[#D8B87A] px-5 py-2 text-sm font-medium text-[#06101C] transition-[background-color] duration-300 ease-out hover:bg-[#cca85a] active:bg-[#c09540] sm:px-6 sm:py-2.5">
      واتساب ↗
    </button>
  </div>
</header>
      {/*
        ══════════════════════════════════════════════════════════════════
        SECTION: Hero
        PURPOSE: Full-viewport cinematic slider. The dominant visual
                 anchor of the entire page — sets brand tone instantly.
        MOTION:  Ken Burns slow zoom / drift on slider images (CSS
                 keyframes). Hero text and card are visible on load with
                 NO reveal animation — they must be immediate and stable.
                 Slider cross-fades every 8 s with a 3.2 s opacity blend.
        VISUAL RULES:
          · Preserve h-screen / min-h-screen — never reduce hero height
          · Do not animate hero headline, paragraph, or visual card
          · Maintain multi-layer dark overlay for readability
          · Keep melt + diagonal cut layers for clean join with Projects
        ══════════════════════════════════════════════════════════════════
      */}
      <section
        className="relative isolate h-screen min-h-screen touch-pan-y overflow-hidden bg-[#05070B]"
      >
        <div
          ref={heroSliderRef}
          className="absolute inset-0 z-0 cursor-grab touch-pan-y overflow-hidden select-none"
          aria-hidden
        >
          {heroSlides.map((src, index) => (
            <div
              key={src}
              className={`absolute inset-0 overflow-hidden transition-opacity duration-[3200ms] ease-in-out ${
                index === heroSlideIndex ? "opacity-100" : "opacity-0"
              }`}
            >
              <img
                src={src}
                alt=""
                draggable={false}
                className={`pointer-events-none absolute left-1/2 top-1/2 min-h-full min-w-full object-cover ${
                  index % 2 === 0 ? "hero-slide-ken-burns" : "hero-slide-ken-burns-alt"
                }`}
                style={{
                  animationPlayState:
                    index === heroSlideIndex ? "running" : "paused",
                  filter: "brightness(1.12) contrast(1.08) saturate(1.04)",
                }}
              />
            </div>
          ))}

          {/* BASE EXPOSURE — gentle uniform layer to bring overall exposure into
               luxury-cinematic range. Low enough that detail is preserved. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[#05070B]/14" />
          {/* SKY / TOP VIGNETTE — calms bright sky areas without touching the building mid. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(5,7,11,0.32)_0%,rgba(5,7,11,0.10)_18%,transparent_38%)]" />
          {/* TEXT-ZONE MASK — directional fade protects the right (RTL text column) */}
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_left,rgba(5,7,11,0.58)_0%,rgba(5,7,11,0.28)_22%,rgba(5,7,11,0.07)_45%,transparent_62%)]" />
          {/* TEXT-ZONE CINEMATIC HAZE — soft feathered radial behind headline/paragraph only */}
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_65%_at_87%_44%,rgba(5,7,11,0.32),transparent_74%)]" />
          {/* BOTTOM SEAL — feeds the venesia-hero-melt; transparent until 55 % down */}
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,transparent_0%,transparent_55%,rgba(5,7,11,0.24)_80%,rgba(5,7,11,0.54)_100%)]" />
          {/* ATMOSPHERE — gold warmth top-left, navy depth top-right, centre bloom */}
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_12%,rgba(192,143,62,0.14),transparent_30%),radial-gradient(circle_at_84%_8%,rgba(30,58,95,0.22),transparent_36%),radial-gradient(ellipse_58%_52%_at_58%_44%,rgba(216,184,122,0.05),transparent_65%)]" />
          {/* DEPTH + LEFT BALANCE — edge vignette (perimeter shadow) + left gold ambient */}
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_88%_78%_at_50%_50%,transparent_40%,rgba(5,7,11,0.13)_78%,rgba(5,7,11,0.22)_100%),radial-gradient(ellipse_44%_55%_at_14%_54%,rgba(192,143,62,0.07),transparent_68%)]" />
        </div>

        <div className="venesia-hero-melt pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-[min(42vh,360px)] min-h-[210px] opacity-90" />

<div
  aria-hidden
  className="pointer-events-none absolute inset-x-0 bottom-0 z-[6] h-40 bg-[linear-gradient(to_top,#05070B_0%,rgba(5,7,11,0.72)_28%,rgba(5,7,11,0.32)_62%,transparent_100%)]"
/>

<div
  aria-hidden
  className="pointer-events-none absolute inset-x-0 -bottom-16 z-[7] h-40 bg-[radial-gradient(ellipse_at_50%_100%,rgba(216,184,122,0.10),transparent_58%)] blur-2xl"
/>

        <div className="relative z-10 flex h-full min-h-0 flex-col">
          <div className="mx-auto flex w-full max-w-7xl flex-1 min-h-0 items-center px-6 lg:px-6">
            <div className="grid w-full translate-y-3 items-center gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
              <div>
              <div className="mb-5 inline-flex translate-y-2 rounded-full border border-white/10 bg-[#0B1220]/30 px-4 py-2 text-sm tracking-wide text-[#D8B87A] backdrop-blur-md sm:translate-y-3 md:mb-6">
  من المخطط إلى التنفيذ… الحكاية بتتشاف على الأرض
</div>
                <h1 className="max-w-[12ch] text-4xl font-bold leading-[1.06] tracking-[-0.045em] sm:text-5xl md:text-6xl lg:text-7xl">                  الثقة مش وعد…
                  <span className="mt-2 block bg-gradient-to-l from-[#D8B87A] to-white bg-clip-text text-transparent md:mt-3">
                    الثقة فعل.
                  </span>
                </h1>

                <p className="mt-5 max-w-2xl text-base leading-8 text-white/65 md:mt-7 md:text-lg md:leading-9">
                فى فنيسيا للتطوير العقارى  </p>
                <p>
                إحنا مش بنعرض مشروع وبس.
                إحنا بنوثّق رحلة تنفيذ كاملة، ونحوّل كل مرحلة على الأرض إلى دليل ثقة يطمن العميل والمستثمر.        
                         </p>
         



                <div className="mt-7 flex flex-wrap gap-3 md:mt-9 md:gap-4">
  <button className="h-11 shrink-0 rounded-full bg-white px-6 font-medium text-[#05070B] shadow-[0_8px_30px_rgba(255,255,255,0.08)] transition-[transform,box-shadow,background-color] duration-300 will-change-transform hover:-translate-y-0.5 hover:bg-white/90 hover:shadow-[0_10px_34px_rgba(255,255,255,0.16)] active:translate-y-px md:h-12 md:px-7">
    استكشف المشاريع
  </button>

  <button className="h-11 shrink-0 rounded-full border border-white/15 bg-white/5 px-6 font-medium text-white shadow-[0_8px_24px_rgba(0,0,0,0.12)] backdrop-blur-md transition-[transform,box-shadow,background-color,border-color] duration-300 will-change-transform hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/10 hover:shadow-[0_12px_34px_rgba(0,0,0,0.18)] active:translate-y-px md:h-12 md:px-7">
    شاهد مراحل التنفيذ
  </button>
</div>              </div>

              <div className="group relative min-w-0 translate-y-2 sm:translate-y-3 lg:translate-y-7 xl:translate-y-9">
                <div className="pointer-events-none absolute -inset-6 rounded-[3rem] bg-[#D8B87A]/8 blur-[72px] lg:-inset-8" />

                <div className="relative overflow-hidden rounded-[2rem] border border-white/[0.14] bg-white/[0.05] p-2.5 shadow-[0_20px_50px_rgba(0,0,0,0.22)] ring-1 ring-white/[0.08] backdrop-blur-md transition-shadow duration-700 group-hover:shadow-[0_28px_64px_rgba(0,0,0,0.32)] lg:rounded-[2.5rem] lg:p-3.5">
                  <div className="relative h-[clamp(322px,44vh,483px)] overflow-hidden rounded-[1.5rem] lg:rounded-[2rem]">
                    <div aria-hidden className="venesia-gold-sweep pointer-events-none" />
                    <img
                      src={heroSlides[heroSlideIndex]}
                      alt="مشروع فينسيا قيد التنفيذ"
                      draggable={false}
                      className="pointer-events-none h-full w-full object-cover transition-opacity duration-[3200ms] ease-in-out"
                    />

                    <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#05070B] via-[#05070B]/35 to-[#05070B]/10" />
                    <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(11,20,32,0.45),transparent_50%)]" />

                    <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full border border-white/10 bg-black/45 px-3 py-1.5 text-[11px] text-white/80 backdrop-blur-md md:left-5 md:top-5 md:px-4 md:py-2 md:text-xs">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                      </span>
                      موقع نشط — متابعة يومية
                    </div>

                    <div className="absolute right-4 top-4 rounded-full bg-[#D8B87A] px-3 py-1.5 text-[11px] font-bold text-[#06101C] md:right-5 md:top-5 md:px-4 md:py-2 md:text-xs">
                      B84 · الحي الأول
                    </div>

                    <div className="absolute bottom-[7.5rem] right-4 left-4 md:bottom-28 md:right-6 md:left-6">
                      <div className="mb-2 flex items-center justify-between text-[11px] text-white/55 md:mb-3 md:text-xs">
                        <span>تقدم الإنشاء</span>
                        <span className="font-semibold text-[#D8B87A]">68%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-l from-[#D8B87A] to-[#c9a760] transition-all duration-[3200ms] ease-out"
                          style={{ width: heroSlideIndex % 2 === 0 ? "68%" : "54%" }}
                        />
                      </div>
                    </div>

                    <div className="absolute bottom-4 right-4 left-4 rounded-2xl border border-white/10 bg-black/40 p-4 backdrop-blur-xl md:bottom-6 md:right-6 md:left-6 md:rounded-3xl md:p-6">
                      <p className="mb-1 text-xs text-[#D8B87A] md:mb-2 md:text-sm">Engineering Proof</p>
                      <h2 className="text-lg font-bold md:text-2xl lg:text-3xl">مشروع بيتكلم قبل ما يتباع</h2>
                      <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-white/60 md:mt-3 md:line-clamp-none md:text-base md:leading-7">
                        لقطات موقع، مراحل تنفيذ، وتوثيق حقيقي يبني ثقة قبل أي مكالمة بيع.
                      </p>

                      <div className="mt-3 hidden flex-wrap gap-2 md:mt-4 md:flex">
                        {["هيكل خرساني", "تشطيب واجهات", "توثيق أسبوعي"].map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/65"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-20 flex shrink-0 translate-y-2.5 justify-center gap-1.5 pb-10 pt-4">
            {heroSlides.map((_, index) => (
              <button
                key={index}
                type="button"
                aria-label={`الشريحة ${index + 1}`}
                onClick={() => setHeroSlideIndex(index)}
                className="group inline-flex h-11 min-w-11 cursor-pointer items-center justify-center px-1.5"
              >
                <span
                  aria-hidden="true"
                  className={`block h-1.5 rounded-full transition-all duration-500 ${
                    index === heroSlideIndex
                      ? "w-8 bg-[#D8B87A]"
                      : "w-3 bg-white/25 group-hover:bg-white/45"
                  }`}
                />
              </button>
            ))}
          </div>
</div>

{/* diagonal cinematic melt */}
<div
  aria-hidden
  className="pointer-events-none absolute inset-x-0 bottom-0 z-[8] h-[115px] bg-[linear-gradient(to_top,#05070B_0%,rgba(5,7,11,0.72)_55%,transparent_100%)] [clip-path:polygon(0_68%,100%_38%,100%_100%,0_100%)]"
/>

<div
  aria-hidden
  className="pointer-events-none absolute inset-x-0 bottom-0 z-[9] h-[150px] bg-[linear-gradient(135deg,transparent_0%,rgba(216,184,122,0.045)_46%,transparent_78%)] blur-2xl [clip-path:polygon(0_72%,100%_42%,100%_100%,0_100%)]"
/>
</section>

{/*
  ══════════════════════════════════════════════════════════════════
  HERO → PROJECTS TRANSITION
  PURPOSE: Seamless atmospheric join between the hero slider and the
           main content. The diagonal clip-path cut + gold radial glow
           dissolve the hard section boundary into a cinematic wipe.
  MOTION:  Pure CSS, no JS. z-index layers [8] and [9] inside hero.
  VISUAL RULES:
    · Do not add margin or padding between hero and main
    · The bg-[#05070B] on both elements ensures colour continuity
    · venesia-main-canvas provides ambient gold/navy atmosphere for
      the entire content area — do not remove or reduce it
  ══════════════════════════════════════════════════════════════════
*/}
<main className="relative z-10 bg-[#05070B]">
  <div className="venesia-main-canvas pointer-events-none absolute inset-0 -z-10 overflow-hidden" />

  {/*
    ══════════════════════════════════════════════════════════════════
    SECTION: Projects
    PURPOSE: Showcase active Venesia projects using premium cinematic
             glass cards. Builds tangible trust through documented
             construction progress.
    MOTION:  Section header (label + h2 + meta) fades up first.
             Card grid fades up 120 ms after the header.
             Individual card hover: lift −8px + gold border + image scale.
             Slider arrows navigate between project sets; no re-reveal.
    VISUAL RULES:
      · Card height is fixed at 360px — do not reduce
      · Glassmorphism info panel padding must not be tightened
      · Arrows float at −5px outside the grid (−left-5 / −right-5)
      · Preserve spacing rhythm (gap-5 grid, px-6 section padding)
    ══════════════════════════════════════════════════════════════════
  */}
  <section className="mx-auto max-w-7xl px-6 pb-20 pt-20 md:pt-24">          <div data-reveal className="mb-10 flex items-end justify-between gap-6">
            <div>
              <div className="mb-3 flex items-center gap-3">
                <div className="h-px w-8 shrink-0 bg-gradient-to-r from-[#D8B87A]/55 to-transparent" />
                <p className="text-sm tracking-wider text-[#D8B87A]">مشاريع قيد المتابعة</p>
              </div>
              <h2 className="text-4xl font-bold">مشاريع فينسيا</h2>
            </div>

            <div className="hidden flex-col items-end gap-3 text-right md:flex">
              <p className="max-w-xs text-sm leading-7 text-white/50">
                كل مشروع مش مجرد اسم… ده نقطة ثقة جديدة في خريطة الشركة، ومتابعة حقيقية للتنفيذ على الأرض.
              </p>
              <div className="flex items-center gap-2.5">
                <span className="text-[11px] tracking-[0.18em] text-white/25">مشاريع نشطة</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[#D8B87A]/25 bg-[#D8B87A]/[0.07] text-xs font-bold text-[#D8B87A]">
                  {projects.length}
                </span>
              </div>
            </div>
          </div>

          <div className="relative">
            {/* arrows float slightly outside the card grid */}
            <button
              onClick={nextSlide}
              className="absolute -right-5 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-[#05070B]/70 text-lg text-white/70 backdrop-blur-md transition hover:border-[#D8B87A]/35 hover:bg-[#D8B87A]/90 hover:text-[#06101C] md:flex"
            >
              ›
            </button>

            <button
              onClick={prevSlide}
              className="absolute -left-5 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-[#05070B]/70 text-lg text-white/70 backdrop-blur-md transition hover:border-[#D8B87A]/35 hover:bg-[#D8B87A]/90 hover:text-[#06101C] md:flex"
            >
              ‹
            </button>

            <div data-reveal data-delay="120" className="grid gap-5 md:grid-cols-3">
              {visibleProjects.map((project) => (
                <div
                  key={project.name}
                  className="group relative cursor-pointer overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] text-white shadow-2xl backdrop-blur transition-all duration-500 hover:-translate-y-2 hover:border-[#D8B87A]/40 hover:bg-white/[0.07] hover:shadow-[0_20px_56px_rgba(0,0,0,0.42),0_0_0_1px_rgba(216,184,122,0.06)]"
                >
                  {/* gold reveal line */}
                  <div aria-hidden className="absolute inset-x-0 top-0 z-10 h-px origin-right scale-x-0 bg-gradient-to-l from-[#D8B87A]/70 via-[#D8B87A]/30 to-transparent transition-transform duration-500 ease-out group-hover:scale-x-100" />
                  <div className="relative h-[360px] overflow-hidden">
                    <div aria-hidden className="venesia-gold-sweep" />
                    <img
                      src={project.image}
                      alt={project.name}
                      className="h-full w-full object-cover opacity-75 transition-[transform,opacity] duration-700 will-change-transform group-hover:scale-110 group-hover:opacity-90"
                    />

                    <div className="absolute inset-0 bg-gradient-to-t from-[#05070B] via-[#05070B]/20 to-transparent" />

                    <div className="absolute left-4 top-4 rounded-full border border-white/10 bg-black/35 px-3.5 py-1.5 text-[11px] text-white/70 backdrop-blur">
                      {project.status}
                    </div>

                    <div className="absolute right-4 top-4 rounded-full bg-[#D8B87A] px-3.5 py-1.5 text-[11px] font-medium text-[#06101C]">
                      {project.metric}
                    </div>

                    <div className="absolute bottom-0 right-0 left-0 p-5">
                      <div className="rounded-[1.5rem] border border-white/10 bg-black/40 px-5 py-4 backdrop-blur-xl">

                        {/* Title row: مشروع + project code on one line */}
                        <div className="flex items-baseline gap-2.5">
                          <span className="text-[10px] font-medium uppercase tracking-[0.13em] text-[#D8B87A]/55">
                            مشروع
                          </span>
                          <h3 className="text-[2.25rem] font-bold leading-none tracking-tight">
                            {project.name}
                          </h3>
                        </div>

                        {/* Metadata row: two location items inline */}
                        <div className="mt-2.5 flex items-center gap-4 text-xs text-white/45">
                          <span className="flex items-center gap-1.5">
                            <span className="text-[13px] text-[#D8B87A]/50">⌖</span>
                            {project.location}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="text-[11px] text-[#D8B87A]/38">⌖</span>
                            {project.area}
                          </span>
                        </div>

                        {/* Soft fading separator */}
                        <div className="my-3 h-px bg-gradient-to-l from-white/[0.09] via-white/[0.05] to-transparent" />

                        {/* Description + arrow */}
                        <div className="flex items-end justify-between gap-3">
                          <p className="max-w-[68%] text-[11px] leading-[1.7] text-white/42">
                            اضغط لمتابعة<br />تفاصيل المشروع
                          </p>
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.04] text-[13px] text-white/38 transition group-hover:border-[#D8B87A]/30 group-hover:bg-[#D8B87A]/85 group-hover:text-[#06101C]">
                            ↗
                          </span>
                        </div>

                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/*
          ══════════════════════════════════════════════════════════════════
          SECTION: Why Trust
          PURPOSE: Four proof-point cards establishing engineering credibility.
                   Converts premium aesthetics into concrete trust signals.
          MOTION:  Left column (heading + body) fades up first.
                   Four cards stagger in at 80 ms intervals.
                   Icon container blooms on hover (gold bg + subtle glow).
          VISUAL RULES:
            · Preserve 2-column grid at lg breakpoint
            · Card lift on hover is −1 (translateY(−4px)) — keep minimal
            · Do not reduce proof card internal padding (p-6)
            · Gold reveal line sweeps in from right on hover — keep it
          ══════════════════════════════════════════════════════════════════
        */}
        <section className="mx-auto max-w-7xl px-6 py-20">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div data-reveal>
              <p className="text-sm text-[#D8B87A]">Why Trust Venesia</p>
              <h2 className="mt-3 text-4xl font-bold leading-tight">
                مش بنبيع كلام… التنفيذ بيتكلم.
              </h2>
              <p className="mt-5 leading-8 text-white/55">
                الموقع هنا لازم يشتغل كدليل ثقة بصري، مش بروشور. كل جزء فيه يقول إن الشركة موجودة، شغالة، وبتبني بجد.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {proof.map((item, idx) => (
                <div
                  key={item.title}
                  data-reveal
                  data-delay={String(idx * 80)}
                  className="group relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 text-white backdrop-blur transition-all duration-500 hover:-translate-y-1 hover:border-white/[0.17] hover:shadow-[0_8px_40px_rgba(0,0,0,0.28)]"
                >
                  {/* gold reveal line */}
                  <div aria-hidden className="absolute inset-x-0 top-0 z-10 h-px origin-right scale-x-0 bg-gradient-to-l from-[#D8B87A]/60 via-[#D8B87A]/25 to-transparent transition-transform duration-500 ease-out group-hover:scale-x-100" />

                  <div className="flex items-start gap-4">
  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#D8B87A]/12 text-[#D8B87A] transition-all duration-500 group-hover:bg-[#D8B87A]/[0.22] group-hover:shadow-[0_0_20px_rgba(216,184,122,0.14)]">
    ◆
  </div>

  <div className="min-w-0">
    <h3 className="text-xl font-bold leading-none">
      {item.title}
    </h3>

    <p className="mt-3 leading-7 text-white/52">
      {item.text}
    </p>
  </div>
</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/*
          ══════════════════════════════════════════════════════════════════
          SECTION: Final Conversion CTA
          PURPOSE: Cinematic luxury conversion section before footer.
                   2-area panel: large main area (headline + building image)
                   and a fixed-width contact stack sidebar.
          VISUAL STYLE: dark glass panel, soft gold atmosphere,
                        building image fades from far right toward left.
          MOTION: single fade-up reveal; contact items stagger 80 ms apart.
          OVERFLOW: all absolute layers inside overflow-hidden parents.
          ══════════════════════════════════════════════════════════════════
        */}
        <section className="relative mx-auto max-w-7xl overflow-hidden px-6 pb-14 pt-2">

          {/* outer ambient glow — contained by section overflow-hidden */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_50%_at_50%_100%,rgba(192,143,62,0.06),transparent_70%)]"
          />

          {/* ── CTA panel ── */}
          <div
            data-reveal
            className="group relative overflow-hidden rounded-[2.5rem] border border-[#D8B87A]/[0.11] bg-[#07090E] shadow-[0_0_0_1px_rgba(216,184,122,0.05),0_32px_80px_rgba(0,0,0,0.45)]"
          >
            {/* premium moving gold frame — sweeps full width on hover */}
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 z-10 h-px origin-right scale-x-0 bg-gradient-to-l from-transparent via-[#D8B87A]/55 to-transparent transition-transform duration-700 ease-out group-hover:scale-x-100"
            />

            {/* panel ambient — warm gold bloom biased toward the building side */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_72%_50%,rgba(192,143,62,0.06),transparent_68%)]"
            />

            {/*
              2-area layout
              DOM order: [MAIN AREA] [CONTACT STACK]
              RTL render: main → physical RIGHT (dominant)
                          contact → physical LEFT (sidebar)
            */}
            <div className="grid lg:grid-cols-[1fr_288px]">

              {/* ══ MAIN AREA (DOM first → physical RIGHT in RTL) ══ */}
              <div className="relative overflow-hidden border-b border-white/[0.05] lg:border-b-0 lg:border-l lg:border-l-white/[0.06]">

                {/* building image — anchored far right, strong & clearly visible */}
                <img
                  src="/images/cta-building-night.png"
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-y-0 right-0 h-full w-[55%] object-cover object-[right_center] opacity-[1]"
                  style={{ filter: "brightness(1.08) contrast(1.12)" }}
                />
                {/* cinematic dissolve — text area protected left; fade begins near center, clears right */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#07090E_0%,rgba(7,9,14,0.82)_22%,rgba(7,9,14,0.35)_42%,rgba(7,9,14,0.08)_65%,rgba(7,9,14,0.02)_100%)]"
                />
                {/* warm gold atmosphere — facade highlights and window glow */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_52%_70%_at_84%_50%,rgba(216,184,122,0.14),transparent_62%)]"
                />
                {/* top + bottom edge softening */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(7,9,14,0.30)_0%,transparent_20%,transparent_80%,rgba(7,9,14,0.40)_100%)]"
                />

                {/* content — headline, description, CTA */}
                <div
                  data-reveal
                  data-delay="60"
                  className="relative z-10 flex flex-col justify-center px-10 py-10 pr-[50%] lg:px-12 lg:py-12 lg:pr-[52%]"
                >
                  {/* micro label + gold rule */}
                  <div className="mb-4 flex items-center gap-3">
                    <div className="h-px w-7 shrink-0 bg-gradient-to-r from-[#D8B87A]/55 to-transparent" />
                    <p className="text-[10px] font-medium uppercase tracking-[0.20em] text-[#D8B87A]/52">
                      Venesia Developments
                    </p>
                  </div>

                  <h2 className="text-[1.72rem] font-bold leading-[1.42] tracking-[-0.02em] text-white md:text-[1.88rem]">
                    تبحث عن وحدة تناسب<br />
                    خطتك القادمة؟
                  </h2>

                  <p className="mt-4 text-[12.5px] leading-[1.9] text-white/55">
                    فريقنا الاستشاري جاهز لمساعدتك في اختيار المشروع الأنسب
                    حسب موقعك، ميزانيتك، وهدفك الاستثماري.
                  </p>

                  <div className="mt-6 flex flex-col items-center gap-2.5">
                    <a
                      href="https://wa.me/201000000000"
                      target="_blank"
                      rel="noreferrer"
                      className="flex cursor-pointer items-center gap-2.5 rounded-xl bg-[#D8B87A] px-5 py-3 text-sm font-medium text-[#06101C] shadow-[0_8px_24px_rgba(216,184,122,0.20)] transition-[transform,box-shadow,background-color] duration-300 will-change-transform hover:-translate-y-0.5 hover:bg-[#c9a760] hover:shadow-[0_10px_30px_rgba(216,184,122,0.30)] active:scale-[0.97]"
                    >
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                        <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z" />
                        <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
                      </svg>
                      <span className="text-sm">تحدث مع مستشار الآن</span>
                    </a>
                    <p className="text-[11px] tracking-wide text-white/30">
                      احجز استشارتك المجانية
                    </p>
                  </div>
                </div>
              </div>

              {/* ══ CONTACT STACK (DOM second → physical LEFT in RTL) ══ */}
              <div className="flex flex-col justify-center divide-y divide-white/[0.05] border-t border-white/[0.05] lg:border-t-0 lg:border-r lg:border-r-white/[0.06]">
                {contactItems.map(({ icon, label, value, href }, idx) => (
                  <div
                    key={label}
                    data-reveal
                    data-delay={String(idx * 80)}
                    className="flex items-center gap-3.5 px-6 py-[1.1rem]"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#D8B87A]/22 bg-[#D8B87A]/[0.07] text-[#D8B87A]/75 transition-all duration-300 hover:border-[#D8B87A]/40 hover:bg-[#D8B87A]/[0.14] hover:text-[#D8B87A]">
                      {icon}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium uppercase tracking-[0.11em] text-[#D8B87A]/48">
                        {label}
                      </p>
                      {href ? (
                        <a
                          href={href}
                          target={href.startsWith("http") ? "_blank" : undefined}
                          rel={href.startsWith("http") ? "noreferrer" : undefined}
                          className="mt-0.5 block cursor-pointer break-all text-[12.5px] text-white/70 transition-colors duration-300 hover:text-[#D8B87A]"
                        >
                          {value}
                        </a>
                      ) : (
                        <p className="mt-0.5 text-[12.5px] text-white/70">{value}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

            </div>{/* end 2-area layout */}
          </div>{/* end CTA panel */}

        </section>

        {/*
          ══════════════════════════════════════════════════════════════════
          SECTION: CTA
          PURPOSE: Primary conversion block — invite to begin the first
                   static version of the Venesia website.
          MOTION:  Entire section fades up as one unit.
                   Gold top line sweeps in on card hover.
                   Button lifts −0.5px on hover; no bounce or scale pulse.
          VISUAL RULES:
            · Preserve gradient fill (gold → white → navy 135°)
            · Keep backdrop blur on the card
            · Ambient glow behind the card stays at blur-2xl opacity
            · Do not add a second CTA or additional copy
          ══════════════════════════════════════════════════════════════════
        */}
        {/* overflow-hidden contains the -inset-8 ambient glow within section bounds */}
       
      </main>

      {/*
        ══════════════════════════════════════════════════════════════════
        SECTION: Footer
        PURPOSE: Premium brand footer with navigation, projects, contact
                 info, and social icon shortcuts.
        VISUAL STYLE: dark cinematic footer with subtle gold accents.
        INTERACTION: all links use cursor-pointer and calm hover states.
        RULES:
          · no permanent arrows beside normal links
          · no colorful social buttons
          · no heavy redesign outside the footer section
        ══════════════════════════════════════════════════════════════════
      */}
      <footer className="relative z-10 border-t border-white/[0.06] bg-[#05070B]">
        {/* ambient glow */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{
            background:
              "linear-gradient(to right,transparent,rgba(216,184,122,0.35) 35%,rgba(216,184,122,0.35) 65%,transparent)",
          }}
        />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_40%_at_50%_0%,rgba(30,58,95,0.18),transparent)]" />

        <div className="mx-auto max-w-7xl px-6 py-20">
          {/* 4-column grid */}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">

            {/* ── 1. Brand ── */}
            <div data-reveal data-delay="0" className="group rounded-[1.75rem] border border-white/[0.07] bg-white/[0.03] p-7 backdrop-blur-md transition-colors duration-500 hover:border-[#D8B87A]/20 hover:bg-white/[0.05]">
              <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl border border-[#D8B87A]/25 bg-[#D8B87A]/[0.06]">
                <span className="text-xs text-[#D8B87A]">◆</span>
              </div>
              <h3 className="text-base font-medium tracking-wide text-white/90">
                Venesia Developments
              </h3>
              <p className="mt-3 text-[13px] leading-6 text-white/40">
                A unique real estate product with sustainable value development.
              </p>
              <div className="mt-6 h-px w-10 bg-[#D8B87A]/30" />
            </div>

            {/* ── 2. Find Us ── */}
            <div data-reveal data-delay="60" className="group rounded-[1.75rem] border border-white/[0.07] bg-white/[0.03] p-7 backdrop-blur-md transition-colors duration-500 hover:border-[#D8B87A]/20 hover:bg-white/[0.05]">
              <p className="mb-5 text-[11px] font-medium uppercase tracking-[0.14em] text-[#D8B87A]/80">
                Find us through
              </p>
              <ul className="space-y-3 text-[13px] text-white/50">
                <li className="flex items-start gap-2.5">
                  <span className="mt-0.5 shrink-0 text-[#D8B87A]/50">⌖</span>
                  <a
                    href="https://maps.google.com/?q=Street+12,New+Cairo+1,Cairo+Governorate"
                    target="_blank"
                    rel="noreferrer"
                    className="cursor-pointer transition-colors duration-300 hover:text-[#D8B87A]"
                  >
                    Street 12, New Cairo 1, Cairo Governorate
                  </a>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="shrink-0 text-[#D8B87A]/50">✆</span>
                  <a
                    href="tel:15875"
                    className="cursor-pointer transition-colors duration-300 hover:text-[#D8B87A]"
                    dir="ltr"
                  >
                    15875
                  </a>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="shrink-0 text-[#D8B87A]/50">✉</span>
                  <a
                    href="mailto:info@venesia-developments.com"
                    className="cursor-pointer break-all transition-colors duration-300 hover:text-[#D8B87A]"
                  >
                    info@venesia-developments.com
                  </a>
                </li>
              </ul>
            </div>

            {/* ── 3. Links ── */}
            <div data-reveal data-delay="120" className="group rounded-[1.75rem] border border-white/[0.07] bg-white/[0.03] p-7 backdrop-blur-md transition-colors duration-500 hover:border-[#D8B87A]/20 hover:bg-white/[0.05]">
              <p className="mb-5 text-[11px] font-medium uppercase tracking-[0.14em] text-[#D8B87A]/80">
                Quick Links
              </p>
              <ul className="space-y-3">
                {[
                  "About Us",
                  "Our Projects",
                  "Follow Your Project",
                  "Media Center",
                  "Contact Us",
                ].map((link) => (
                  <li key={link}>
                    <a className="group/link flex cursor-pointer items-center gap-2 text-[13px] text-white/45 transition-colors duration-300 hover:text-white/80">
                      <span className="h-px w-3 shrink-0 bg-white/20 transition-all duration-300 group-hover/link:w-5 group-hover/link:bg-[#D8B87A]/60" />
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* ── 4. Social ── */}
            <div data-reveal data-delay="180" className="group rounded-[1.75rem] border border-white/[0.07] bg-white/[0.03] p-7 backdrop-blur-md transition-colors duration-500 hover:border-[#D8B87A]/20 hover:bg-white/[0.05]">
              <p className="mb-5 text-[11px] font-medium uppercase tracking-[0.14em] text-[#D8B87A]/80">
                Social Media
              </p>
              <ul className="space-y-3 text-[13px] text-white/45">
                {[
                  { handle: "Venesia Developments", href: "https://facebook.com/venesia-developments" },
                  { handle: "venesia_developments", href: "https://instagram.com/venesia_developments" },
                  { handle: "@venesiadevelopments", href: "https://tiktok.com/@venesiadevelopments" },
                ].map(({ handle, href }) => (
                  <li key={handle}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="flex cursor-pointer items-center gap-2 transition-colors duration-300 hover:text-white/80"
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.04] text-[9px] text-[#D8B87A]">
                        ◆
                      </span>
                      {handle}
                    </a>
                  </li>
                ))}
              </ul>

              <a
                href="https://wa.me/201000000000"
                target="_blank"
                rel="noreferrer"
                className="mt-6 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#D8B87A]/20 bg-[#D8B87A]/[0.07] px-4 py-2.5 text-[13px] font-medium text-[#D8B87A] transition-all duration-400 hover:border-[#D8B87A]/40 hover:bg-[#D8B87A]/[0.14]"
              >
                Or Via WhatsApp
              </a>
            </div>
          </div>

          {/* ── social icons bar ── */}
          <FooterSocialBar />

          {/* ── copyright ── */}
          <div data-reveal data-delay="300" className="mt-8 flex flex-col items-center gap-3 border-t border-white/[0.05] pt-8 sm:flex-row sm:justify-between">
            <p className="text-[12px] text-white/25">
              © {new Date().getFullYear()} Venesia Developments. All rights reserved.
            </p>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-[#D8B87A]/40">◆</span>
              <p className="text-[12px] text-white/20">Trust Built On Ground</p>
            </div>
          </div>
        </div>
      </footer>

      {/* ── BackToTopButton — fixed floating utility, appears after 500px scroll ── */}
      <BackToTopButton />
    </div>
  );
}
