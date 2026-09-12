import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../../../lib/supabase-admin";
import { logError } from "../../../../../../lib/logging";
import { draftMode } from "next/headers";
import {
  getTopicViewSigningSecret,
  isProductionTopicViewRequest,
  issueTopicViewVisitor,
  readTopicViewVisitor,
  TOPIC_VIEW_COOKIE,
  topicViewResultSchema,
  trustedTopicViewIpKey,
} from "../../../../../../lib/content/topic-view-security";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const topicId = Number(id);
  const validId = /^\d+$/.test(id) && Number.isSafeInteger(topicId) && topicId > 0;
  const headers = { "Cache-Control": "private, no-store" };
  try {
    if (!isProductionTopicViewRequest(request) || (await draftMode()).isEnabled) {
      return NextResponse.json({ outcome: "excluded" }, { headers });
    }
    const secret = getTopicViewSigningSecret();
    const visitorKey = readTopicViewVisitor(request, secret);
    const { data, error } = await getSupabaseAdmin().rpc("increment_topic_view", {
      p_topic_id: validId ? topicId : null,
      p_visitor_key: visitorKey,
      p_ip_key: trustedTopicViewIpKey(request, secret),
    });
    if (error) throw error;
    const result = topicViewResultSchema.parse(data);
    if (!visitorKey && (result.outcome === "counted" || result.outcome === "duplicate")) {
      throw new Error("Topic view identity contract mismatch.");
    }
    if (result.outcome === "rate_limited") {
      return NextResponse.json({ outcome: result.outcome }, {
        status: 429, headers: { ...headers, "Retry-After": String(result.retry_after_seconds) },
      });
    }
    if (result.outcome === "identity_required") {
      const response = NextResponse.json({ outcome: result.outcome }, { status: 202, headers });
      response.cookies.set(TOPIC_VIEW_COOKIE, issueTopicViewVisitor(secret, result.cookie_ttl_seconds), {
        httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: result.cookie_ttl_seconds,
      });
      return response;
    }
    return NextResponse.json({ outcome: result.outcome }, {
      status: result.outcome === "invalid" ? 400 : result.outcome === "not_viewable" ? 404 : 200,
      headers,
    });
  } catch (error) {
    logError("Unable to record topic view", error, { topicId: validId ? topicId : null });
    return NextResponse.json({ error: "Unable to record view." }, { status: 503, headers });
  }
}
