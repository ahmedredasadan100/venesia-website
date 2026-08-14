import ProjectLocationManagementPage from "../ProjectLocationManagementPage";

export const dynamic = "force-dynamic";

export default function CitiesPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  return <ProjectLocationManagementPage level="city" searchParams={searchParams} />;
}
