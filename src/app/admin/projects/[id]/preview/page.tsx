import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  AdminPageHeader,
  AdminStatusPill,
} from "../../../../../components/admin/ui";
import CommercialProjectDetails from "../../../../../components/projects/details/CommercialProjectDetails";
import ResidentialProjectDetails from "../../../../../components/projects/details/ResidentialProjectDetails";
import { requireAdminSession } from "../../../../../lib/admin/auth/require-admin-session";
import { getProjectPublicationMetadata } from "../../../../../lib/admin/projects/project-publishing-capability";
import { loadProjectForAdminPreviewResult } from "../../../../../lib/projects/load-published-projects";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "معاينة المشروع | لوحة الإدارة",
  robots: { index: false, follow: false },
};

export default async function ProjectAdminPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminSession();
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();

  const projectId = Number(id);
  const result = await loadProjectForAdminPreviewResult(projectId);
  if (!result.project) notFound();

  const { project, publicationStatus } = result;
  const publication = getProjectPublicationMetadata(publicationStatus);

  return (
    <div className="space-y-7">
      <AdminPageHeader
        eyebrow="INTERNAL PROJECT PREVIEW"
        title={project.arabicName}
        description="معاينة إدارية تستخدم مكوّن العرض العام نفسه دون تجاوز سياسة النشر على المسار العام."
        actions={
          <>
            <AdminStatusPill tone={publication.tone}>
              {publication.label}
            </AdminStatusPill>
            <Link
              href={`/admin/projects/${projectId}`}
              className="rounded-full border border-white/15 px-5 py-3 text-sm font-medium text-white/65 transition hover:border-[#D8B87A]/40 hover:text-[#D8B87A]"
            >
              رجوع للمحرر
            </Link>
          </>
        }
      />
      <div className="overflow-hidden rounded-[28px] border border-white/10">
        {project.category === "commercial" ? (
          <CommercialProjectDetails project={project} />
        ) : (
          <ResidentialProjectDetails project={project} />
        )}
      </div>
    </div>
  );
}
