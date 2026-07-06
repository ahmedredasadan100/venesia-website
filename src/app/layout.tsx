import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic, Inter } from "next/font/google";
import { buildMetadata } from "../lib/seo/build-metadata";
import { SEO_SITE } from "../config/seo/seo-site";
import { PWA_CONFIG } from "../config/pwa";
import "./globals.css";

const ibmArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-arabic",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  ...buildMetadata({ path: "/" }),
  appleWebApp: {
    capable: true,
    title: PWA_CONFIG.shortName,
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: SEO_SITE.themeColor,
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang={SEO_SITE.language} dir={SEO_SITE.direction}>
      <body
        className={`${ibmArabic.variable} ${inter.variable} overflow-x-hidden antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
