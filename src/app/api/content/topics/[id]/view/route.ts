import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../../../lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "Invalid topic ID." }, { status: 400 });
  }

  const { data, error } = await getSupabaseAdmin().rpc("increment_topic_view", {
    p_topic_id: Number(id),
  });
  if (error) {
    return NextResponse.json({ error: "Unable to record view." }, { status: 500 });
  }
  if (data === null) {
    return NextResponse.json({ error: "Topic is not publicly viewable." }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
