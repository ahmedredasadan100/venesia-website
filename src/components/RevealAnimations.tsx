"use client";

import { useEffect } from "react";

export default function RevealAnimations() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          const delay = parseInt(
            entry.target.getAttribute("data-delay") ?? "0",
            10
          );

          window.setTimeout(() => {
            entry.target.classList.add("is-revealed");
          }, delay);

          observer.unobserve(entry.target);
        });
      },
      {
        threshold: 0.08,
        rootMargin: "0px 0px -48px 0px",
      }
    );

    const revealElements = document.querySelectorAll("[data-reveal]");

    revealElements.forEach((element) => {
      observer.observe(element);
    });

    return () => observer.disconnect();
  }, []);

  return null;
}