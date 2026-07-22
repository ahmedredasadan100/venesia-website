export default function TopicFieldCounter({ count, limit }: { count: number; limit?: number }) {
  return <span className="min-w-12 self-center text-left font-en text-[11px] tabular-nums text-[#D8B87A]/78" dir="ltr">{count}{typeof limit === "number" ? ` / ${limit}` : ""}</span>;
}
