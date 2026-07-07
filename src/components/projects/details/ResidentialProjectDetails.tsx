import ProjectDetailsHero from "./ProjectDetailsHero";
import ProjectDistrictSection from "./ProjectDistrictSection";
import ProjectPlansAndAreasSection from "./ProjectPlansAndAreasSection";
import ProjectDeliverySpecsSection from "./ProjectDeliverySpecsSection";
import ResidentialExecutionJourney from "./ResidentialExecutionJourney";
import RichTextContent from "../../content/RichTextContent";
import { type PublicProject } from "../../../lib/projects/public-types";

type ResidentialProjectDetailsProps = {
  project: PublicProject;
};

const residentialTabs = [
  { id: "district", label: "عن الموقع" },
  { id: "overview", label: "نظرة عامة" },
  { id: "plans", label: "المساحات والمخططات" },
  { id: "delivery-specs", label: "مواصفات التنفيذ" },
  { id: "execution", label: "مراحل التنفيذ" },
  { id: "contact", label: "تواصل معنا" },
];

export default function ResidentialProjectDetails({
  project,
}: ResidentialProjectDetailsProps) {
  const details = project.residentialDetails;

  if (!details) {
    return (
      <main className="min-h-screen bg-[#05070B] px-6 py-32 text-white" dir="rtl">
        <div className="mx-auto max-w-4xl rounded-3xl border border-[#D8B87A]/20 bg-white/[0.03] p-10">
          <h1 className="text-3xl font-semibold text-[#D8B87A]">
            بيانات المشروع غير مكتملة
          </h1>
          <p className="mt-4 text-white/60">
            هذا المشروع لا يحتوي على بيانات تفاصيل سكنية داخل ملف الداتا.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#05070B] text-white" dir="rtl">
      <ProjectDetailsHero project={project} />

      <nav className="sticky top-0 z-30 border-b border-[#D8B87A]/15 bg-[#070A0F]/92 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-6 py-3">
          {residentialTabs.map((tab, index) => (
            <a
              key={tab.id}
              href={`#${tab.id}`}
              className={`shrink-0 cursor-pointer rounded-xl px-5 py-2.5 text-sm transition ${
                index === 0
                  ? "bg-[#D8B87A] text-[#111]"
                  : "text-white/60 hover:bg-white/[0.04] hover:text-[#D8B87A]"
              }`}
            >
              {tab.label}
            </a>
          ))}
        </div>
      </nav>

      <ProjectDistrictSection
        districtProfile={details.districtProfile}
        projectCode={project.code}
      />

      <section id="overview" className="scroll-mt-24 mx-auto max-w-7xl px-6 py-14">
        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-[26px] border border-white/10 bg-white/[0.025] p-8">
            <p className="mb-3 text-sm font-medium tracking-[0.28em] text-[#D8B87A]/70">
              نظرة عامة
            </p>

            <h2 className="text-2xl font-semibold text-[#D8B87A]">
              {details.overview.title}
            </h2>

            <RichTextContent
              value={details.overview.body}
              mode="rich"
              className="mt-5 text-sm leading-8 text-white/62"
            />

            <div className="mt-6 space-y-3">
              {details.overview.bullets.map((bullet) => (
                <div
                  key={bullet}
                  className="flex items-center gap-3 text-sm text-white/70"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[#D8B87A]" />
                  <span>{bullet}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative min-h-[320px] overflow-hidden rounded-[26px] border border-[#D8B87A]/20">
            <img
              src={details.overview.videoImage}
              alt={project.code}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-[#05070B]/75 via-[#05070B]/20 to-transparent" />

            <div className="absolute bottom-5 right-5 rounded-2xl border border-[#D8B87A]/25 bg-[#05070B]/70 px-5 py-4 backdrop-blur-md">
              <p className="text-xs tracking-[0.22em] text-[#D8B87A]/70">
                VENESIA DEVELOPMENTS
              </p>
              <p className="mt-1 font-en text-xl font-semibold text-white">
                {project.code}
              </p>
            </div>
          </div>
        </div>
      </section>

      <ProjectPlansAndAreasSection areas={details.availableAreas} />

      <ProjectDeliverySpecsSection deliverySpecs={details.deliverySpecs} />

      <ResidentialExecutionJourney stages={details.executionJourney} />

     </main>
  );
}