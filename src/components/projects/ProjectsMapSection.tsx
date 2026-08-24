import PublicMediaImage from "../public/PublicMediaImage";
import Link from "next/link";

import { getProjectHref } from "../../lib/projects/public-helpers";
import type { PublicProject, PublicProjectLocationLevel } from "../../lib/projects/public-types";
import {
  PROJECTS_HUB_MAP_DEFAULTS,
  type ProjectsHubMapPresentationProps,
} from "../../lib/projects/map-projects-hub-module-props";

type ProjectsMapSectionProps = {
  projects: PublicProject[];
  title?: string;
  mapImage?: string;
  exploreButtonLabel?: string;
  mapPins?: ProjectsHubMapPresentationProps["mapPins"];
};

export default function ProjectsMapSection({
  projects,
  title = PROJECTS_HUB_MAP_DEFAULTS.title,
  mapImage = PROJECTS_HUB_MAP_DEFAULTS.mapImage,
  exploreButtonLabel = PROJECTS_HUB_MAP_DEFAULTS.exploreButtonLabel,
  mapPins = PROJECTS_HUB_MAP_DEFAULTS.mapPins,
}: ProjectsMapSectionProps) {
  const residentialProjects = projects.filter(
    (project) => project.category === "residential"
  );

  const grouped = residentialProjects.reduce<Record<string, number>>(
    (acc, project) => {
      const visibleTags = [
        project.location.governorate,
        project.location.city,
        project.location.mainArea,
        project.location.subArea,
      ].filter((item): item is PublicProjectLocationLevel => item !== null);
      const area =
        visibleTags.at(-1)?.nameAr ??
        project.location.label;
      if (!area) return acc;
      acc[area] = (acc[area] ?? 0) + 1;
      return acc;
    },
    {}
  );

  return (
    <section className="px-6 pt-16">
      <div className="mx-auto grid max-w-7xl gap-5 rounded-[28px] border border-[#D8B87A]/15 bg-white/[0.025] p-5 lg:grid-cols-[280px_1fr]">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-6">
          <h2 className="text-xl font-semibold text-[#D8B87A]">
            {title}
          </h2>

          <div className="mt-6 space-y-4">
            {Object.entries(grouped).map(([area, count]) => (
              <div
                key={area}
                className="flex items-center justify-between border-b border-white/10 pb-3 text-sm"
              >
                <span className="text-white/70">{area}</span>
                <span className="text-[#D8B87A]">{count} مشروع</span>
              </div>
            ))}
          </div>

          <button className="mt-7 w-full rounded-xl border border-[#D8B87A]/35 px-5 py-3 text-sm text-[#D8B87A]">
            {exploreButtonLabel}
          </button>
        </div>

        <div className="relative min-h-[500px] overflow-hidden rounded-2xl border border-white/10 bg-[#080B10]">
          <PublicMediaImage
            src={mapImage}
            alt="خريطة بيت الوطن"
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 70vw"
          />

          <div className="absolute inset-0 bg-[#05070B]/15" />

          {mapPins.map((pin) => {
            const project = residentialProjects.find(
              (item) => item.code === pin.code
            );

            if (!project) return null;

            return (
              <MapProjectPin
                key={pin.code}
                project={project}
                district={pin.district}
                right={pin.right}
                top={pin.top}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

function MapProjectPin({
  project,
  district,
  right,
  top,
}: {
  project: PublicProject;
  district: string;
  right: string;
  top: string;
}) {
  return (
    <Link
      href={getProjectHref(project)}
      className="group absolute z-10 -translate-x-1/2 -translate-y-1/2"
      style={{ right, top }}
      title={`${project.code} - ${district}`}
    >
      <div className="flex flex-col items-center">
        <span className="mb-2 rounded-full border border-[#D8B87A]/45 bg-[#05070B]/85 px-3 py-1 text-xs font-semibold text-[#D8B87A] shadow-[0_12px_30px_rgba(0,0,0,0.35)] backdrop-blur-md transition duration-300 group-hover:bg-[#D8B87A] group-hover:text-[#111]">
          {project.code}
        </span>

        <span className="h-5 w-5 rounded-full border-4 border-[#05070B] bg-[#D8B87A] shadow-[0_0_24px_rgba(216,184,122,0.55)] transition duration-300 group-hover:scale-125" />
      </div>
    </Link>
  );
}
