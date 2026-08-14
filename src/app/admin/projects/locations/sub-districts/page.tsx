import ProjectLocationManagementPage from "../ProjectLocationManagementPage";

export const dynamic = "force-dynamic";

export default function SubDistrictsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  return <ProjectLocationManagementPage level="sub_area" searchParams={searchParams} />;
}
