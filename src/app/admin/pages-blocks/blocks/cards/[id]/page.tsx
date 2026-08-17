export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "../../../../../../lib/supabase-admin";
import { asCardsConfig } from "../../../../../../lib/page-blocks/configs";
import { getModuleAssignmentContext } from "../../../../../../lib/page-blocks/module-assignments-query";
import CardsModuleEditClient from "../../../../../../components/admin/page-blocks/CardsModuleEditClient";
import { updateCardsBlock } from "../actions";

type PageProps = {
  params: Promise<{ id: string }> | { id: string };
  searchParams?: Promise<{ saved?: string }> | { saved?: string };
};

export default async function CardsBlockEditPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const resolvedSearch = searchParams ? await searchParams : {};
  const id = Number(resolvedParams.id);
  if (!id) notFound();

  const [{ data: block, error }, assignmentContext] = await Promise.all([
    getSupabaseAdmin().from("cards_block_templates").select("*").eq("id", id).maybeSingle(),
    getModuleAssignmentContext("cards", id),
  ]);

  if (error) throw new Error(`Cards template read failed: ${error.message}`);
  if (!block) notFound();

  return (
    <CardsModuleEditClient
      block={block}
      config={asCardsConfig(block.config)}
      assignmentContext={assignmentContext}
      saved={Boolean(resolvedSearch.saved)}
      updateAction={updateCardsBlock}
    />
  );
}
