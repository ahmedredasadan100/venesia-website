"use client";

import { useEffect, useRef, useState } from "react";

type ScrollRevealProps = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  once?: boolean;
  threshold?: number;
  rootMargin?: string;
  variant?: "fade-up" | "fade-in" | "soft-scale";
};

export default function ScrollReveal({
  children,
  className = "",
  delay = 0,
  once = true,
  threshold = 0.18,
  rootMargin = "0px 0px -80px 0px",
  variant = "fade-up",
}: ScrollRevealProps) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = elementRef.current;

    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);

          if (once) {
            observer.unobserve(element);
          }
        } else if (!once) {
          setIsVisible(false);
        }
      },
      {
        threshold,
        rootMargin,
      }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [once, threshold, rootMargin]);

  const variants = {
    "fade-up": {
      hidden: "translate-y-6 opacity-0 blur-[6px]",
      visible: "translate-y-0 opacity-100 blur-0",
    },
    "fade-in": {
      hidden: "opacity-0 blur-[4px]",
      visible: "opacity-100 blur-0",
    },
    "soft-scale": {
      hidden: "scale-[0.985] opacity-0 blur-[5px]",
      visible: "scale-100 opacity-100 blur-0",
    },
  };

  return (
    <div
      ref={elementRef}
      style={{ transitionDelay: `${delay}ms` }}
      className={[
        "transform-gpu transition-all duration-[850ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[opacity,transform,filter]",
        isVisible ? variants[variant].visible : variants[variant].hidden,
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}