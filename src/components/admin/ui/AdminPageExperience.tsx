import type { ElementType, ReactNode } from "react";

type AdminPageExperienceProps = {
  children: ReactNode;
  state?: "ready" | "loading" | "error" | "empty" | "under-construction";
  className?: string;
  as?: ElementType;
};

export default function AdminPageExperience({
  children,
  state = "ready",
  className = "",
  as: Component = "main",
}: AdminPageExperienceProps) {
  return (
    <Component
      className={`space-y-7 ${className}`.trim()}
      data-admin-page-experience={state}
    >
      {children}
    </Component>
  );
}
