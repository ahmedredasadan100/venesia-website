"use client";

import type { ProjectsHubRenderPlanModule } from "../../lib/projects/build-projects-hub-render-plan";
import {
  applyFeaturedLimit,
  mapProjectsHubFeaturedProps,
  mapProjectsHubListingProps,
  mapProjectsHubMapProps,
} from "../../lib/projects/map-projects-hub-module-props";
import type { ProjectHubFilterId, PublicProject } from "../../lib/projects/public-types";
import ProjectsFeaturedSection from "./ProjectsFeaturedSection";
import ProjectsHubCanonicalHero from "./ProjectsHubCanonicalHero";
import ProjectsListSection from "./ProjectsListSection";
import ProjectsMapSection from "./ProjectsMapSection";
import {
  type PageLayoutSlot,
} from "../../lib/page-blocks/layout-slots";
import { VENISIA_THEME_REGION_RENDER_ORDER } from "../page-composition/venisia-theme-regions";

type ProjectsHubModulesRendererProps = {
  projects: PublicProject[];
  featuredProjects: PublicProject[];
  filteredProjects: PublicProject[];
  modules: ProjectsHubRenderPlanModule[];
  activeFilter: ProjectHubFilterId;
  onFilterChange: (filter: ProjectHubFilterId) => void;
};

/**
 * Maps Projects Hub plan nodes onto the existing public section components.
 * Receives projects from the route — never loads from Supabase.
 */
export default function ProjectsHubModulesRenderer({
  projects,
  featuredProjects,
  filteredProjects,
  modules,
  activeFilter,
  onFilterChange,
}: ProjectsHubModulesRendererProps) {
  const modulesByPosition = new Map<PageLayoutSlot, ProjectsHubRenderPlanModule[]>(
    VENISIA_THEME_REGION_RENDER_ORDER.map((position) => [position, []]),
  );
  for (const planModule of modules) {
    modulesByPosition.get(planModule.position)?.push(planModule);
  }

  const renderModule = (module: ProjectsHubRenderPlanModule) => {
    if (module.slug === "projects-hub-hero") {
      return (
        <ProjectsHubCanonicalHero
          key={`hub-${module.assignmentId}`}
          projects={projects}
          module={module}
        />
      );
    }

    if (module.slug === "projects-hub-featured") {
      const props = mapProjectsHubFeaturedProps(module);
      return (
        <ProjectsFeaturedSection
          key={`hub-${module.assignmentId}`}
          projects={applyFeaturedLimit(featuredProjects, props.limit)}
          title={props.title}
          subtitle={props.subtitle}
          autoplayMs={props.autoplayMs}
          showTitle={props.showTitle}
          showSubtitle={props.showSubtitle}
          showProjectImage={props.showProjectImage}
          showProjectCode={props.showProjectCode}
          showProjectName={props.showProjectName}
          showProjectDescription={props.showProjectDescription}
          showProjectType={props.showProjectType}
          showProjectLocation={props.showProjectLocation}
          showExploreButton={props.showExploreButton}
          showSliderDots={props.showSliderDots}
          titleBold={props.titleBold}
          titleAlignment={props.titleAlignment}
          subtitleBold={props.subtitleBold}
          subtitleAlignment={props.subtitleAlignment}
        />
      );
    }

    if (module.slug === "projects-hub-listing") {
      const props = mapProjectsHubListingProps(module);
      return (
        <ProjectsListSection
          key={`hub-${module.assignmentId}`}
          projects={filteredProjects}
          allProjects={projects}
          activeFilter={activeFilter}
          onFilterChange={onFilterChange}
          eyebrow={props.eyebrow}
          title={props.title}
          showEyebrow={props.showEyebrow}
          showTitle={props.showTitle}
          showFilterBar={props.showFilterBar}
          pageSize={props.pageSize}
          defaultView={props.defaultView}
          showViewToggle={props.showViewToggle}
          showPagination={props.showPagination}
          showProjectCount={props.showProjectCount}
          visibleFilters={props.visibleFilters}
          showProjectImage={props.showProjectImage}
          showProjectCode={props.showProjectCode}
          showProjectName={props.showProjectName}
          showProjectDescription={props.showProjectDescription}
          showProjectType={props.showProjectType}
          showProjectLocation={props.showProjectLocation}
          showExploreButton={props.showExploreButton}
          eyebrowBold={props.eyebrowBold}
          eyebrowAlignment={props.eyebrowAlignment}
          titleBold={props.titleBold}
          titleAlignment={props.titleAlignment}
        />
      );
    }

    const props = mapProjectsHubMapProps(module);
    return (
      <ProjectsMapSection
        key={`hub-${module.assignmentId}`}
        projects={filteredProjects}
        title={props.title}
        mapImage={props.mapImage}
        exploreButtonLabel={props.exploreButtonLabel}
        mapPins={props.mapPins}
        showTitle={props.showTitle}
        titleBold={props.titleBold}
        titleAlignment={props.titleAlignment}
      />
    );
  };

  const renderPosition = (position: PageLayoutSlot) => {
    const positionedModules = modulesByPosition.get(position) ?? [];
    if (!positionedModules.length) return null;
    return (
      <div className="@container/slot-module min-w-0" data-layout-slot={position}>
        {positionedModules.map(renderModule)}
      </div>
    );
  };

  const hasSidebar = Boolean(modulesByPosition.get("sidebar")?.length);

  return (
    <>
      {renderPosition("hero")}
      {hasSidebar ? (
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:[direction:ltr]">
          <section dir="rtl" className="min-w-0">{renderPosition("main")}</section>
          <aside dir="rtl" className="min-w-0">{renderPosition("sidebar")}</aside>
        </div>
      ) : (
        renderPosition("main")
      )}
      {renderPosition("bottom")}
      {renderPosition("footer")}
    </>
  );
}
