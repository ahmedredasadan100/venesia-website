"use client";

import { createContext, useContext } from "react";
import type { PublicNavigationItem } from "../lib/public-navigation";

const PublicNavigationContext = createContext<PublicNavigationItem[]>([]);

type PublicNavigationProviderProps = {
  items: PublicNavigationItem[];
  children: React.ReactNode;
};

export function PublicNavigationProvider({ items, children }: PublicNavigationProviderProps) {
  return <PublicNavigationContext.Provider value={items}>{children}</PublicNavigationContext.Provider>;
}

export function usePublicNavigation() {
  return useContext(PublicNavigationContext);
}
