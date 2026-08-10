type FeedCarouselDotsProps = {
  count: number;
  activeIndex: number;
  onSelect: (index: number) => void;
  itemLabel: string;
};

export default function FeedCarouselDots({
  count,
  activeIndex,
  onSelect,
  itemLabel,
}: FeedCarouselDotsProps) {
  if (count <= 0) return null;

  return (
    <div className="mt-5 flex justify-center gap-1.5" aria-label={`التنقل بين ${itemLabel}`}>
      {Array.from({ length: count }, (_, index) => (
        <button
          key={index}
          type="button"
          onClick={() => onSelect(index)}
          aria-label={`عرض ${itemLabel} ${index + 1}`}
          aria-current={index === activeIndex ? "true" : undefined}
          className="group inline-flex h-8 min-w-8 items-center justify-center"
        >
          <span
            className={`block h-1.5 rounded-full transition-all duration-300 motion-reduce:transition-none ${
              index === activeIndex
                ? "w-7 bg-[#D8B87A]"
                : "w-2 bg-[#D8B87A]/25 group-hover:bg-[#D8B87A]/55"
            }`}
          />
        </button>
      ))}
    </div>
  );
}
