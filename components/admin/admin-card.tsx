export function AdminCard({
  children,
  className = ""
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-3xl border border-[#222222] bg-[#111111] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] ${className}`}>
      {children}
    </div>
  );
}
