"use client";

import { createContext, useContext } from "react";

import type { FooterSettings } from "../lib/footer/types";
import type { PublicNavigationItem } from "../lib/public-navigation";

type FooterSettingsContextValue = {
  settings: FooterSettings;
  footerNavItems: PublicNavigationItem[];
};

const FooterSettingsContext = createContext<FooterSettingsContextValue | null>(null);

type FooterSettingsProviderProps = {
  settings: FooterSettings;
  footerNavItems: PublicNavigationItem[];
  children: React.ReactNode;
};

export function FooterSettingsProvider({
  settings,
  footerNavItems,
  children,
}: FooterSettingsProviderProps) {
  return (
    <FooterSettingsContext.Provider value={{ settings, footerNavItems }}>
      {children}
    </FooterSettingsContext.Provider>
  );
}

export function useFooterSettings() {
  const context = useContext(FooterSettingsContext);
  if (!context) {
    throw new Error("useFooterSettings must be used within FooterSettingsProvider");
  }
  return context.settings;
}

export function useFooterNavigation() {
  const context = useContext(FooterSettingsContext);
  if (!context) {
    throw new Error("useFooterNavigation must be used within FooterSettingsProvider");
  }
  return context.footerNavItems;
}
