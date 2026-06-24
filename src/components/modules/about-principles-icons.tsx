import type { AboutPrinciplesIconKey } from "../../lib/page-blocks/configs";

export function PrincipleIcon({ icon, className = "h-10 w-10" }: { icon: AboutPrinciplesIconKey | string; className?: string }) {
  if (icon === "engineering") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M4 18h16" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M7 18V9.5C7 7.6 8.6 6 10.5 6h3C15.4 6 17 7.6 17 9.5V18"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <path d="M9.5 6V4.5h5V6" stroke="currentColor" strokeWidth="1.6" />
        <path d="M9 11h6" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }

  if (icon === "timeline") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M7 4h10v16H7z" stroke="currentColor" strokeWidth="1.6" />
        <path d="M9.5 8h5" stroke="currentColor" strokeWidth="1.6" />
        <path d="M9.5 12h5" stroke="currentColor" strokeWidth="1.6" />
        <path d="M9.5 16h3" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M4 10.5L12 5l8 5.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6.5 10.5V19h11v-8.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 19v-5.5h6V19" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
