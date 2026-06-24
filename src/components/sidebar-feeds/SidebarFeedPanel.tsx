export function SidebarFeedPanel({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[1.6rem] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm">
      {eyebrow ? (
        <p className="text-xs uppercase tracking-[0.25em] text-[#D8B87A]/70">{eyebrow}</p>
      ) : null}

      <h3
        className={
          eyebrow
            ? "mt-3 text-lg font-semibold text-white"
            : "text-lg font-semibold text-white"
        }
      >
        {title}
      </h3>

      <div className="mt-5">{children}</div>
    </section>
  );
}
