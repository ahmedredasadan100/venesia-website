import ProjectLocationManagementPage from "../ProjectLocationManagementPage";

export const dynamic = "force-dynamic";

export default function DistrictsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  return <ProjectLocationManagementPage level="main_area" searchParams={searchParams} />;
}
