import type {
  ComponentPropsWithoutRef,
  ElementType,
  ReactNode,
} from "react";

type AdminPageExperienceProps = Omit<
  ComponentPropsWithoutRef<"div">,
  "children"
> & {
  children: ReactNode;
  state?: "ready" | "loading" | "error" | "empty" | "under-construction";
  as?: ElementType;
};

export default function AdminPageExperience({
  children,
  state = "ready",
  className = "",
  as: Component = "main",
  ...props
}: AdminPageExperienceProps) {
  return (
    <Component
      {...props}
      className={`flex flex-col gap-7 ${className}`.trim()}
      data-admin-page-experience={state}
      data-admin-page-surface-owner="AdminPageExperience"
    >
      {children}
    </Component>
  );
}
