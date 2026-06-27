import type { AdminLinkProvider, LinkedResourceType } from "./types";

const providers = new Map<LinkedResourceType, AdminLinkProvider>();

export function registerAdminLinkProvider(provider: AdminLinkProvider) {
  providers.set(provider.type, provider);
}

export function getAdminLinkProvider(type: LinkedResourceType) {
  return providers.get(type) ?? null;
}

export function listAdminLinkProviders() {
  return Array.from(providers.values());
}

export function getRegisteredProviderTypes() {
  return Array.from(providers.keys());
}
