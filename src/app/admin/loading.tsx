export default function AdminLoading() {
  return (
    <div className="space-y-7 animate-pulse" aria-busy="true" aria-label="جاري التحميل">
      <div className="h-28 rounded-[28px] border border-white/5 bg-white/[0.04]" />
      <div className="h-16 rounded-[24px] border border-white/5 bg-white/[0.03]" />
      <div className="h-72 rounded-[28px] border border-white/5 bg-white/[0.04]" />
    </div>
  );
}
