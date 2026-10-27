import Link from "next/link";
import { ADMIN_CINEMATIC_GOLD_V1, resolveAdminCollectionPresentation } from "../../../lib/admin/admin-ui-styles";
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  MouseEventHandler,
  ReactNode,
  Ref,
} from "react";

type AdminActionButtonProps = {
  children: ReactNode;
  href?: string;
  disabled?: boolean;
  variant?: "gold" | "primary" | "dark" | "ghost" | "danger" | "gold-ghost" | "danger-ghost";
  size?: "default" | "icon";
  /** Default and historical names share the official Admin action presentation. */
  presentation?: "default" | "cinematic";
  className?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  type?: ButtonHTMLAttributes<HTMLButtonElement>["type"];
  form?: string;
  buttonRef?: Ref<HTMLButtonElement>;
  /** Link transport attributes stay on enabled links, never disabled buttons. */
  target?: AnchorHTMLAttributes<HTMLAnchorElement>["target"];
  rel?: string;
  prefetch?: boolean | null;
} & Pick<ButtonHTMLAttributes<HTMLButtonElement>,
  "id" | "title" | "aria-label" | "aria-haspopup" | "aria-expanded" | "aria-describedby"
>;

const variants: Record<Exclude<NonNullable<AdminActionButtonProps["variant"]>, "gold" | "primary" | "dark">, string> = {
  ghost: "border-transparent bg-transparent text-white/50 hover:text-white/80",
  "gold-ghost": "border-transparent bg-transparent text-[#D8B87A] hover:bg-[#D8B87A]/10 hover:text-[#F2D99B]",
  "danger-ghost": "border-transparent bg-transparent text-red-400 hover:bg-red-500/10 hover:text-red-300",
  danger: "border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/15 hover:text-red-300",
};

/** Shared chrome also preserves consumers whose disabled contract is a span. */
export function adminActionButtonClassName({
  disabled = false,
  variant = "dark",
  size = "default",
  className = "",
}: Pick<AdminActionButtonProps, "disabled" | "variant" | "size" | "className"> = {}) {
  const variantClasses = variant === "primary"
    ? ADMIN_CINEMATIC_GOLD_V1.action.primary
    : variant === "gold" || variant === "dark"
      ? ADMIN_CINEMATIC_GOLD_V1.action.secondary
      : variants[variant];
  return `inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl border text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A]/70 ${size === "icon" ? "size-11 shrink-0 p-0" : "px-4 py-2.5"} ${variantClasses} ${
    disabled ? "cursor-not-allowed opacity-45" : ""
  } ${className}`;
}

export default function AdminActionButton({
  children,
  href,
  disabled = false,
  variant = "dark",
  size = "default",
  presentation = "default",
  className = "",
  onClick,
  type = "button",
  form,
  buttonRef,
  target,
  rel,
  prefetch,
  ...accessibleAttributes
}: AdminActionButtonProps) {
  const resolvedPresentation = resolveAdminCollectionPresentation(presentation);
  const classes = adminActionButtonClassName({ disabled, variant, size, className });

  if (href && !disabled) {
    return (
      <Link {...accessibleAttributes} href={href} target={target} rel={rel} prefetch={prefetch} className={classes} data-admin-action-presentation={resolvedPresentation}>
        {children}
      </Link>
    );
  }

  return (
    <button
      {...accessibleAttributes}
      data-admin-action-presentation={resolvedPresentation}
      ref={buttonRef}
      type={type}
      form={form}
      disabled={disabled}
      onClick={onClick}
      className={classes}
    >
      {children}
    </button>
  );
}
