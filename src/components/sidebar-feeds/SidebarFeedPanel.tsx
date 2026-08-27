export function SidebarFeedPanel({
  eyebrow,
  title,
  formatting,
  children,
}: {
  eyebrow?: string;
  title: string;
  formatting?: import("../../lib/page-blocks/configs").PageBlockTextFormattingConfig;
  children: React.ReactNode;
}) {
  const eyebrowVisible = formatting?.showEyebrow !== false;
  const titleVisible = formatting?.showTitle !== false;
  const eyebrowAlignment = formatting?.eyebrowAlignment ?? "right";
  const titleAlignment = formatting?.titleAlignment ?? "right";
  return (
    <section className="rounded-[1.6rem] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm">
      {eyebrowVisible && eyebrow ? (
        <p className={`text-xs uppercase tracking-[0.25em] text-[#D8B87A]/70 ${eyebrowAlignment === "center" ? "text-center" : eyebrowAlignment === "left" ? "text-left" : "text-right"} ${formatting?.eyebrowBold ? "font-bold" : "font-normal"}`}>{eyebrow}</p>
      ) : null}

      {titleVisible ? <h3
        className={
          `${eyebrowVisible && eyebrow ? "mt-3 " : ""}text-lg text-white ${titleAlignment === "center" ? "text-center" : titleAlignment === "left" ? "text-left" : "text-right"} ${formatting?.titleBold === false ? "font-normal" : "font-bold"}`
        }
      >
        {title}
      </h3> : null}

      <div className="mt-5">{children}</div>
    </section>
  );
}
