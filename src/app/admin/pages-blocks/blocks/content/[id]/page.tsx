export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "../../../../../../lib/supabase-admin";
import { getModuleAssignmentContext } from "../../../../../../lib/page-blocks/module-assignments-query";
import ContentModuleEditClient from "../../../../../../components/admin/page-blocks/ContentModuleEditClient";
import { updateContentBlock } from "../actions";
import { isRetiredContentBlockTemplateSlug } from "../../../../../../lib/page-blocks/deprecated-block-modules";
import { resolveContentModuleEditorConfig } from "../../../../../../lib/page-blocks/module-edit-registry";

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

  if (error) throw new Error(`Content template read failed: ${error.message}`);
  if (!block || isRetiredContentBlockTemplateSlug(block.slug)) notFound();

  const config = resolveContentModuleEditorConfig({
    slug: block.slug,
    variant: block.variant,
    config: block.config,
  });

  return (
    <ContentModuleEditClient
      block={{
        id: block.id,
        name: block.name,
        slug: block.slug,
        description: block.description,
        variant: block.variant,
        style_preset: block.style_preset,
        status: block.status,
        updated_at: block.updated_at,
      }}
      config={config}
      assignmentContext={assignmentContext}
      saved={Boolean(resolvedSearch.saved)}
      updateAction={updateContentBlock}
    />
  );
}
