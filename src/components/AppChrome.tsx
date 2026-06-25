"use client";

import { usePathname } from "next/navigation";
import { SpeedInsights } from "@vercel/speed-insights/next";
import SiteNavbar from "./SiteNavbar";
import SiteFooter from "./SiteFooter";
import BackToTopButton from "./BackToTopButton";

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isStandalone = pathname.startsWith("/admin") || pathname === "/maintenance";

  return (
    <>
      {!isStandalone ? <SiteNavbar /> : null}

      {children}

      {!isStandalone ? <SiteFooter immediateReveal /> : null}
      {!isStandalone ? <BackToTopButton /> : null}

      <SpeedInsights />
    </>
  );
}