export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "../../../../../../lib/supabase-admin";
import { asBreadcrumbConfig } from "../../../../../../lib/page-blocks/configs";
import { getModuleAssignmentContext } from "../../../../../../lib/page-blocks/module-assignments-query";
import BreadcrumbModuleEditClient from "../../../../../../components/admin/page-blocks/BreadcrumbModuleEditClient";
import { updateBreadcrumbBlock } from "../actions";

type PageProps = {
  params: Promise<{ id: string }> | { id: string };
  searchParams?: Promise<{ saved?: string }> | { saved?: string };
};

export default async function BreadcrumbBlockEditPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const resolvedSearch = searchParams ? await searchParams : {};
  const id = Number(resolvedParams.id);
  if (!id) notFound();

  const [{ data: block, error }, assignmentContext] = await Promise.all([
    getSupabaseAdmin().from("breadcrumb_block_templates").select("*").eq("id", id).maybeSingle(),
    getModuleAssignmentContext("breadcrumb", id),
  ]);

  if (error) throw new Error(`Breadcrumb template read failed: ${error.message}`);
  if (!block) notFound();

  const config = asBreadcrumbConfig(block.config);

  return (
    <BreadcrumbModuleEditClient
      block={block}
      config={config}
      assignmentContext={assignmentContext}
      saved={Boolean(resolvedSearch.saved)}
      updateAction={updateBreadcrumbBlock}
    />
  );
}
