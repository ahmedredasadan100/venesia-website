import type { PublicProject } from "../../../lib/projects/public-types";
import type { ProjectLocationSectionPresentation } from "../../../lib/projects/project-location-presentation";
import RichTextContent from "../../content/RichTextContent";
import PublicMediaImage from "../../public/PublicMediaImage";
import ProjectDeliverySpecsSection from "./ProjectDeliverySpecsSection";
import ProjectDetailsHero, {
  projectDetailsMainClassName,
} from "./ProjectDetailsHero";
import ProjectDistrictSection from "./ProjectDistrictSection";
import ProjectPlansAndAreasSection from "./ProjectPlansAndAreasSection";
import { ProjectMainGallery } from "./ProjectImageGalleries";

type ResidentialProjectDetailsProps = {
  project: PublicProject;
  heroPresentation?: Parameters<typeof ProjectDetailsHero>[0]["presentation"];
  showProjectHero?: boolean;
  locationSectionPresentation: ProjectLocationSectionPresentation;
};

export default function ResidentialProjectDetails({
  project,
  heroPresentation,
  showProjectHero = true,
  locationSectionPresentation,
}: ResidentialProjectDetailsProps) {
  const overviewImage = project.overview.mainImage ?? project.overview.images[0] ?? null;
  const tabs = [
    { id: "district", label: "عن الموقع", visible: true },
    { id: "overview", label: "نظرة عامة", visible: true },
    { id: "plans", label: "المساحات والمخططات", visible: project.plans.length > 0 },
    { id: "delivery-specs", label: "مواصفات التنفيذ", visible: Boolean(project.delivery.body || project.delivery.items.length || project.delivery.images.length) },
    { id: "gallery", label: "معرض المشروع", visible: project.gallery.images.length > 0 },
  ].filter((tab) => tab.visible);

  return (
    <main className={projectDetailsMainClassName(showProjectHero)} dir="rtl">
      {showProjectHero ? (
        <ProjectDetailsHero project={project} presentation={heroPresentation} />
      ) : null}

      <nav className="sticky top-0 z-30 border-b border-[#D8B87A]/15 bg-[#070A0F]/92 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-6 py-3">
          {tabs.map((tab, index) => (
            <a key={tab.id} href={`#${tab.id}`} className={`shrink-0 rounded-xl px-5 py-2.5 text-sm transition ${index === 0 ? "bg-[#D8B87A] text-[#111]" : "text-white/60 hover:bg-white/[0.04] hover:text-[#D8B87A]"}`}>
              {tab.label}
            </a>
          ))}
        </div>
      </nav>

      <ProjectDistrictSection
        location={project.location}
        cardImage={project.cardImage}
        englishName={project.englishName}
        presentation={locationSectionPresentation}
      />

      <section id="overview" className="scroll-mt-24 mx-auto max-w-7xl px-6 py-14">
        <div className={`grid gap-8 ${overviewImage ? "lg:grid-cols-[0.85fr_1.15fr]" : ""}`}>
          <div className="min-w-0 rounded-[26px] border border-white/10 bg-white/[0.025] p-8">
            {project.overview.title ? (
              <h2 className="text-2xl font-semibold text-[#D8B87A]">{project.overview.title}</h2>
            ) : null}
            <RichTextContent value={project.overview.body} mode="rich" className={`${project.overview.title ? "mt-5" : ""} text-sm leading-8 text-white/62`} />
            {project.overview.features.length ? (
              <div className="mt-6 space-y-3">
                {project.overview.features.map((feature) => (
                  <div key={feature.id} className="flex items-start gap-3 text-sm text-white/70">
                    <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#D8B87A]" />
                    <RichTextContent value={feature.body} mode="rich" />
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {overviewImage ? (
            <div className="relative min-h-[320px] overflow-hidden rounded-[26px] border border-[#D8B87A]/20">
              <PublicMediaImage src={overviewImage.src} alt={overviewImage.alt} fill sizes="(max-width: 1024px) 100vw, 60vw" className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#05070B]/75 via-[#05070B]/20 to-transparent" />
              <div className="absolute bottom-5 right-5 rounded-2xl border border-[#D8B87A]/25 bg-[#05070B]/70 px-5 py-4 backdrop-blur-md">
                <p className="text-xs tracking-[0.22em] text-[#D8B87A]/70">VENESIA DEVELOPMENTS</p>
                <p className="mt-1 font-en text-xl font-semibold text-white">{project.englishName}</p>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <ProjectPlansAndAreasSection areas={project.plans} title={project.plansTitle} />
      <ProjectDeliverySpecsSection deliverySpecs={project.delivery} />

      {project.gallery.images.length ? (
        <section id="gallery" className="scroll-mt-24 border-t border-white/10 px-6 py-16">
          <div className="mx-auto max-w-7xl">
            {project.gallery.title ? (
              <h2 className="text-3xl font-semibold text-[#D8B87A]">{project.gallery.title}</h2>
            ) : null}
            <div className={project.gallery.title ? "mt-8" : ""}>
              <ProjectMainGallery images={project.gallery.images} />
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
