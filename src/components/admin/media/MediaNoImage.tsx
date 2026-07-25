type MediaNoImageProps = {
  label?: string;
  compact?: boolean;
  className?: string;
};

export default function MediaNoImage({
  label = "لا توجد صورة",
  compact = false,
  className = "",
}: MediaNoImageProps) {
  return (
    <div
      className={`flex h-full w-full flex-col items-center justify-center gap-2 bg-[radial-gradient(circle_at_top,#1A202A,#080B10_72%)] text-center text-white/38 ${className}`}
      role="img"
      aria-label={label}
    >
      <span
        aria-hidden="true"
        className={`grid place-items-center rounded-2xl border border-dashed border-white/18 bg-white/[0.025] text-[#D8B87A]/55 ${compact ? "h-10 w-10 text-lg" : "h-14 w-14 text-2xl"}`}
      >
        ◇
      </span>
      <span className={compact ? "text-[10px]" : "text-xs"}>{label}</span>
    </div>
  );
}
