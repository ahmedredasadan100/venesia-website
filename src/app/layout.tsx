import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { buildMetadata } from "../lib/seo/build-metadata";
import { SEO_SITE } from "../config/seo/seo-site";
import { PWA_CONFIG } from "../config/pwa";
import "./globals.css";

const ibmArabic = localFont({
  src: [
    {
      path: "../assets/fonts/ibm-plex-sans-arabic-300.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "../assets/fonts/ibm-plex-sans-arabic-400.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../assets/fonts/ibm-plex-sans-arabic-500.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../assets/fonts/ibm-plex-sans-arabic-600.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../assets/fonts/ibm-plex-sans-arabic-700.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-arabic",
});

const inter = localFont({
  src: "../assets/fonts/inter-variable.woff2",
  weight: "100 900",
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
