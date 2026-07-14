"use client";

import { SpeedInsights } from "@vercel/speed-insights/next";
import SiteNavbar from "./SiteNavbar";
import SiteFooter from "./SiteFooter";
import BackToTopButton from "./BackToTopButton";
import PwaShell from "./pwa/PwaShell";

export default function AppChrome({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteNavbar />

      {children}

      <SiteFooter />
      <BackToTopButton />
      <PwaShell />

      <SpeedInsights />
    </>
  );
}
