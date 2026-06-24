export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "../../../../../../lib/supabase-admin";
import { getModuleAssignmentContext } from "../../../../../../lib/page-blocks/module-assignments-query";
import ContentModuleEditClient from "../../../../../../components/admin/page-blocks/ContentModuleEditClient";
import { updateContentBlock } from "../actions";

type PageProps = {
  params: Promise<{ id: string }> | { id: string };
  searchParams?: Promise<{ saved?: string }> | { saved?: string };
};

export default async function ContentBlockEditPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const resolvedSearch = searchParams ? await searchParams : {};
  const id = Number(resolvedParams.id);
  if (!id) notFound();

  const [{ data: block, error }, assignmentContext] = await Promise.all([
    getSupabaseAdmin().from("content_block_templates").select("*").eq("id", id).maybeSingle(),
    getModuleAssignmentContext("content", id),
  ]);

  if (error || !block) notFound();

  return (
    <ContentModuleEditClient
      block={block}
      assignmentContext={assignmentContext}
      saved={Boolean(resolvedSearch.saved)}
      updateAction={updateContentBlock}
    />
  );
}
