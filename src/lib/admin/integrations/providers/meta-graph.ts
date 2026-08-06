import "server-only";

import type { LiveIntegrationKey } from "../integrations-contract";
import { formBody, providerJson } from "../provider-http";
import {
  requireApplicationConfigurationValue,
  requireIntegrationApplicationConfiguration,
  resolveIntegrationApplicationConfiguration,
  resolveMetaGraphApiVersion,
} from "../server-configuration-resolver";
import type { IntegrationAppConfigurationTestResult } from "../server-configuration-contract";

type MetaCollection<T> = {
  data?: T[];
  paging?: {
    next?: string;
    cursors?: { after?: string };
  };
};

function pagingCursor(payload: MetaCollection<unknown>) {
  if (!payload.paging?.next) return null;
  if (payload.paging.cursors?.after) return payload.paging.cursors.after;
  try {
    return new URL(payload.paging.next).searchParams.get("after");
  } catch {
    return null;
  }
}

export function metaGraphBase() {
  return `https://graph.facebook.com/${resolveMetaGraphApiVersion()}`;
}

export async function requireMetaApplicationCredentials(integration: LiveIntegrationKey) {
  const configuration = await requireIntegrationApplicationConfiguration(integration);
  return {
    appId: requireApplicationConfigurationValue(configuration, "meta_app_id"),
    appSecret: requireApplicationConfigurationValue(configuration, "meta_app_secret"),
  };
}

export async function testMetaApplicationConfiguration(
  integration: "meta_business" | "whatsapp_business",
): Promise<IntegrationAppConfigurationTestResult> {
  const configuration = await resolveIntegrationApplicationConfiguration(integration, {
    includeSecrets: true,
    allowUntested: true,
  });
  if (configuration.missing.length) {
    return {
      status: "configuration_invalid",
      safeErrorCode: "integration_app_configuration_incomplete",
      message: "Required Meta application fields are missing.",
    };
  }
  const appId = requireApplicationConfigurationValue(configuration, "meta_app_id");
  const appSecret = requireApplicationConfigurationValue(configuration, "meta_app_secret");
  if (!/^\d{6,32}$/.test(appId) || appSecret.length < 16) {
    return {
      status: "configuration_invalid",
      safeErrorCode: "meta_app_credentials_format_invalid",
      message: "Meta application credential format is invalid.",
    };
  }
  try {
    const result = await providerJson<{ access_token?: string }>(
      `${metaGraphBase()}/oauth/access_token`,
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: formBody({
          client_id: appId,
          client_secret: appSecret,
          grant_type: "client_credentials",
        }),
      },
      "meta_app_credentials_test_failed",
    );
    if (!result.access_token) {
      return {
        status: "configuration_invalid",
        safeErrorCode: "meta_app_access_token_missing",
        message: "Meta did not confirm the application credentials.",
      };
    }
    return {
      status: "ready_to_connect",
      safeErrorCode: null,
      message: "Meta confirmed the App ID and App Secret using the official app-token endpoint.",
    };
  } catch {
    return {
      status: "configuration_invalid",
      safeErrorCode: "meta_app_credentials_test_failed",
      message: "Meta rejected the application credential test.",
    };
  }
}

export async function collectMetaGraphPages<T>(
  initialUrl: string,
  accessToken: string,
  errorCode: string,
) {
  const rows: T[] = [];
  let after: string | null = null;
  for (let page = 0; page < 100; page += 1) {
    const url = new URL(initialUrl);
    if (after) url.searchParams.set("after", after);
    const payload = await providerJson<MetaCollection<T>>(url.toString(), {
      headers: { authorization: `Bearer ${accessToken}` },
    }, errorCode);
    rows.push(...(payload.data ?? []));
    const next = pagingCursor(payload);
    if (!next) return rows;
    if (next === after) throw new Error(`${errorCode}_pagination_stalled`);
    after = next;
  }
  throw new Error(`${errorCode}_pagination_limit_exceeded`);
}
