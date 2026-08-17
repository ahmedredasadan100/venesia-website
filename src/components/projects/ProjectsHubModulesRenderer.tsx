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
  return (
    <>
      {modules.map((module) => {
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
          />
        );
      })}
    </>
  );
}
