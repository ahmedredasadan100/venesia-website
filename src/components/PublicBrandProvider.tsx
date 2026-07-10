"use client";

import { createContext, useContext } from "react";
import type { GlobalOrganizationIdentity } from "../lib/seo/resolve-global-organization-identity";
import { getFallbackGlobalOrganizationIdentity } from "../lib/seo/resolve-global-organization-identity";

const PublicBrandContext = createContext<GlobalOrganizationIdentity>(
  getFallbackGlobalOrganizationIdentity(),
);

type PublicBrandProviderProps = {
  identity: GlobalOrganizationIdentity;
  children: React.ReactNode;
};

export function PublicBrandProvider({ identity, children }: PublicBrandProviderProps) {
  return <PublicBrandContext.Provider value={identity}>{children}</PublicBrandContext.Provider>;
}

export function usePublicBrand() {
  return useContext(PublicBrandContext);
}
