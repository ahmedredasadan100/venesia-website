import ProjectLocationManagementPage from "../ProjectLocationManagementPage";

export const dynamic = "force-dynamic";

export default function GovernoratesPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  return <ProjectLocationManagementPage level="governorate" searchParams={searchParams} />;
}
