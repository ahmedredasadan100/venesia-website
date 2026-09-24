type FeedCarouselNavigationProps = {
  onPrevious: () => void;
  onNext: () => void;
  label: string;
  previousLabel: string;
  nextLabel: string;
  placement?: "inline" | "image-edges";
};

const BUTTON_CLASS_NAME =
  "pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-black/65 text-white shadow-[0_8px_24px_rgba(0,0,0,0.4)] backdrop-blur-sm transition hover:border-[#D8B87A]/70 hover:bg-[#D8B87A] hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A] motion-reduce:transition-none";

export default function FeedCarouselNavigation({
  onPrevious,
  onNext,
  label,
  previousLabel,
  nextLabel,
  placement = "inline",
}: FeedCarouselNavigationProps) {
  const imageEdges = placement === "image-edges";

  return (
    <div
      className={
        imageEdges
          ? "pointer-events-none absolute inset-x-0 top-1/2 z-20 flex -translate-y-1/2 items-center justify-between"
          : "mt-4 flex items-center justify-center gap-2"
      }
      role="group"
      aria-label={label}
      data-feed-carousel-navigation={placement}
    >
      <button
        type="button"
        onClick={onPrevious}
        aria-label={previousLabel}
        className={`${BUTTON_CLASS_NAME} ${imageEdges ? "translate-x-1/2" : ""}`.trim()}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="m9 5 7 7-7 7" />
        </svg>
      </button>
      <button
        type="button"
        onClick={onNext}
        aria-label={nextLabel}
        className={`${BUTTON_CLASS_NAME} ${imageEdges ? "-translate-x-1/2" : ""}`.trim()}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="m15 5-7 7 7 7" />
        </svg>
      </button>
    </div>
  );
}
