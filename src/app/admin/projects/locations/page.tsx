import Link from "next/link";

import {
  AdminCard,
  AdminPageContextHeader,
  AdminPageExperience,
} from "../../../../components/admin/ui";
import {
  PROJECT_LOCATION_LEVEL_CONFIG,
  PROJECT_LOCATION_LEVELS,
  projectLocationManagementPath,
} from "../../../../lib/admin/projects/location-management-contract";

export const dynamic = "force-dynamic";

export default function ProjectLocationsPage() {
  return (
    <AdminPageExperience dir="rtl">
      <AdminPageContextHeader
        eyebrow="PROJECT LOCATION DOMAIN"
        title="إدارة مواقع المشاريع"
        description="إدارة المحافظات والمدن والمناطق الرئيسية والفرعية داخل تسلسل واحد معتمد للمشاريع."
      />
      <section className="grid gap-5 md:grid-cols-2">
        {PROJECT_LOCATION_LEVELS.map((level) => {
          const config = PROJECT_LOCATION_LEVEL_CONFIG[level];
          return (
            <Link
              key={level}
              href={projectLocationManagementPath(level)}
              className="block h-full"
            >
              <AdminCard interactive className="h-full p-6">
                <h2 className="text-xl font-semibold text-white">
                  {config.label}
                </h2>
                <p className="mt-3 text-sm leading-7 text-white/52">
                  إدارة العلاقات والحالة والترتيب لهذا المستوى.
                </p>
              </AdminCard>
            </Link>
          );
        })}
      </section>
    </AdminPageExperience>
  );
}
