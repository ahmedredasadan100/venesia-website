export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "../../../../../../lib/supabase-admin";
import { asCtaConfig } from "../../../../../../lib/page-blocks/configs";
import { getModuleAssignmentContext } from "../../../../../../lib/page-blocks/module-assignments-query";
import CtaModuleEditClient from "../../../../../../components/admin/page-blocks/CtaModuleEditClient";
import { updateCtaBlock } from "../actions";

type PageProps = {
  params: Promise<{ id: string }> | { id: string };
  searchParams?: Promise<{ saved?: string }> | { saved?: string };
};

export default async function CtaBlockEditPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const resolvedSearch = searchParams ? await searchParams : {};
  const id = Number(resolvedParams.id);
  if (!id) notFound();

  const [{ data: block, error }, assignmentContext] = await Promise.all([
    getSupabaseAdmin().from("cta_block_templates").select("*").eq("id", id).maybeSingle(),
    getModuleAssignmentContext("cta", id),
  ]);

  if (error || !block) notFound();

  return (
    <CtaModuleEditClient
      block={block}
      config={asCtaConfig(block.config)}
      assignmentContext={assignmentContext}
      saved={Boolean(resolvedSearch.saved)}
      updateAction={updateCtaBlock}
    />
  );
}
