"use client";

import { usePathname } from "next/navigation";
import { SpeedInsights } from "@vercel/speed-insights/next";
import SiteNavbar from "./SiteNavbar";
import SiteFooter from "./SiteFooter";
import BackToTopButton from "./BackToTopButton";

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");

  return (
    <>
      {!isAdmin ? <SiteNavbar /> : null}

      {children}

      {!isAdmin ? <SiteFooter immediateReveal /> : null}
      {!isAdmin ? <BackToTopButton /> : null}

      <SpeedInsights />
    </>
  );
}