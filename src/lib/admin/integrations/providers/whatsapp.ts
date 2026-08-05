import "server-only";

import { assertRequiredAssets, type IntegrationAsset } from "../integrations-contract";
import type { IntegrationProviderAdapter, ProviderRuntimeContext, ProviderTokenSet } from "../provider-adapter-contract";
import { formBody, isoAfterSeconds, providerJson } from "../provider-http";
import { assertGrantedScopes, configuredEnvironment, requireAsset, requireConfigured, uniqueAssets } from "./shared";
import { collectMetaGraphPages } from "./meta-graph";

function config() {
  return configuredEnvironment(["META_APP_ID", "META_APP_SECRET", "META_GRAPH_API_VERSION", "INTEGRATIONS_OAUTH_BASE_URL"]);
}

function graphBase() {
  const version = process.env.META_GRAPH_API_VERSION!.trim();
  if (!/^v\d+\.\d+$/.test(version)) throw new Error("meta_graph_api_version_invalid");
  return `https://graph.facebook.com/${version}`;
}

function headers(token: string) {
  return { authorization: `Bearer ${token}` };
}

type MetaToken = { access_token?: string; expires_in?: number };

async function grantedPermissions(accessToken: string) {
  const rows = await collectMetaGraphPages<{ permission?: string; status?: string }>(
    `${graphBase()}/me/permissions?fields=permission,status&limit=100`,
    accessToken,
    "whatsapp_permission_discovery_failed",
  );
  return rows.filter((item) => item.status === "granted" && item.permission).map((item) => item.permission!);
}

async function discoverWhatsApp(input: ProviderRuntimeContext) {
  const businesses = await collectMetaGraphPages<{ id?: string; name?: string }>(`${graphBase()}/me/businesses?fields=id,name&limit=100`, input.accessToken, "whatsapp_business_discovery_failed");
  const assets: IntegrationAsset[] = [];
  for (const business of businesses) {
    if (!business.id) continue;
    assets.push({ type: "business", externalId: business.id, parentExternalId: null, displayName: business.name ?? business.id, permissions: ["business_management"], metadata: {} });
    const wabas = await collectMetaGraphPages<Record<string, unknown>>(`${graphBase()}/${business.id}/owned_whatsapp_business_accounts?fields=id,name,currency,timezone_id,message_template_namespace&limit=100`, input.accessToken, "whatsapp_waba_discovery_failed");
    for (const waba of wabas) {
      const wabaId = String(waba.id ?? "");
      if (!wabaId) continue;
      assets.push({ type: "waba", externalId: wabaId, parentExternalId: business.id, displayName: String(waba.name ?? wabaId), permissions: ["whatsapp_business_management"], metadata: { currency: String(waba.currency ?? ""), timeZoneId: String(waba.timezone_id ?? "") } });
      const phones = await collectMetaGraphPages<Record<string, unknown>>(`${graphBase()}/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,code_verification_status&limit=100`, input.accessToken, "whatsapp_phone_discovery_failed");
      for (const phone of phones) {
        const phoneId = String(phone.id ?? "");
        if (!phoneId) continue;
        assets.push({ type: "phone_number", externalId: phoneId, parentExternalId: wabaId, displayName: String(phone.verified_name ?? phone.display_phone_number ?? phoneId), permissions: ["whatsapp_business_management"], metadata: { displayPhoneNumber: String(phone.display_phone_number ?? ""), verifiedName: String(phone.verified_name ?? ""), qualityRating: String(phone.quality_rating ?? ""), verificationStatus: String(phone.code_verification_status ?? "") } });
      }
    }
  }
  return uniqueAssets(assets);
}

export const whatsappBusinessAdapter: IntegrationProviderAdapter = {
  integration: "whatsapp_business",
  analyticsProvider: null,
  configuration: config,
  buildAuthorizationRequest(context) {
    requireConfigured(config());
    const url = new URL(`https://www.facebook.com/${process.env.META_GRAPH_API_VERSION!.trim()}/dialog/oauth`);
    url.searchParams.set("client_id", process.env.META_APP_ID!.trim());
    url.searchParams.set("redirect_uri", context.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "business_management,whatsapp_business_management");
    url.searchParams.set("state", context.state);
    return { url: url.toString(), pkceVerifierRequired: false };
  },
  async exchangeAuthorizationCode(input): Promise<ProviderTokenSet> {
    requireConfigured(config());
    const tokenEndpoint = `${graphBase()}/oauth/access_token`;
    const short = await providerJson<MetaToken>(tokenEndpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: formBody({
        client_id: process.env.META_APP_ID!.trim(),
        client_secret: process.env.META_APP_SECRET!.trim(),
        redirect_uri: input.redirectUri,
        code: input.code,
      }),
    }, "whatsapp_oauth_exchange_failed");
    if (!short.access_token) throw new Error("whatsapp_access_token_missing");
    const long = await providerJson<MetaToken>(tokenEndpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: formBody({
        grant_type: "fb_exchange_token",
        client_id: process.env.META_APP_ID!.trim(),
        client_secret: process.env.META_APP_SECRET!.trim(),
        fb_exchange_token: short.access_token,
      }),
    }, "whatsapp_long_lived_token_exchange_failed");
    const accessToken = long.access_token ?? short.access_token;
    const grantedScopes = await grantedPermissions(accessToken);
    assertGrantedScopes(grantedScopes, ["business_management", "whatsapp_business_management"], "whatsapp_oauth_scope_missing");
    const me = await providerJson<{ id?: string }>(`${graphBase()}/me?fields=id`, { headers: headers(accessToken) }, "whatsapp_subject_lookup_failed");
    return {
      strategy: { kind: "meta_user", refreshSupported: false }, accessToken, refreshToken: null,
      accessExpiresAt: isoAfterSeconds(long.expires_in ?? short.expires_in), refreshExpiresAt: null,
      grantedScopes, externalSubjectId: me.id ?? null,
    };
  },
  async refreshCredential() { return null; },
  discoverAssets: discoverWhatsApp,
  validateAssetSelection(assets) {
    assertRequiredAssets("whatsapp_business", assets);
    const business = requireAsset(assets, "business");
    const waba = requireAsset(assets, "waba");
    const phone = requireAsset(assets, "phone_number");
    if (waba.parentExternalId !== business.externalId || phone.parentExternalId !== waba.externalId) {
      throw new Error("whatsapp_asset_relationship_invalid");
    }
  },
  async testConnection(input) {
    try {
      this.validateAssetSelection(input.assets);
      const phone = requireAsset(input.assets, "phone_number");
      await providerJson(`${graphBase()}/${phone.externalId}?fields=id,display_phone_number,verified_name,quality_rating,code_verification_status`, { headers: headers(input.accessToken) }, "whatsapp_connection_test_failed");
      return { ok: true, checkedAt: new Date().toISOString(), message: "WhatsApp Phone Number access verified without messaging permission.", requiresReauth: false, diagnosticCode: "integration_test_ok" };
    } catch (error) {
      const requiresReauth = Boolean(error && typeof error === "object" && "requiresReauth" in error && (error as { requiresReauth?: unknown }).requiresReauth);
      return { ok: false, checkedAt: new Date().toISOString(), message: error instanceof Error ? error.message : "WhatsApp test failed.", requiresReauth, diagnosticCode: "whatsapp_connection_test_failed" };
    }
  },
  async syncAnalytics(input) {
    const phone = requireAsset(input.assets, "phone_number");
    const payload = await providerJson<Record<string, unknown>>(`${graphBase()}/${phone.externalId}?fields=id,display_phone_number,verified_name,quality_rating,code_verification_status`, { headers: headers(input.accessToken) }, "whatsapp_health_sync_failed");
    return {
      status: "completed", message: "WhatsApp connection health read model synchronized without message or event writes.", recordsWritten: 1,
      watermark: { phoneNumberId: phone.externalId, qualityRating: String(payload.quality_rating ?? ""), checkedAt: new Date().toISOString() },
      analytics: [], connectionReadModelValid: true,
    };
  },
  async revokeConnection() {
    return {
      providerRevoked: false,
      message: "Local Vault credentials were deleted. Meta app-level deauthorization is intentionally external because it can revoke other independent Meta connections.",
    };
  },
  async diagnoseConnection(input) {
    const test = await this.testConnection(input);
    return { status: test.ok ? "ready" : "unavailable", code: test.diagnosticCode, message: test.message, checkedAt: test.checkedAt, requiresReauth: test.requiresReauth, metadata: { messagingEnabled: false, embeddedSignup: false, selectedAssets: input.assets.filter((asset) => asset.selected).length } };
  },
};
