export function AdminBadge({
  label,
  tone = "neutral",
  mono = false
}: {
  label: string;
  tone?: "neutral" | "green" | "blue" | "amber" | "red";
  mono?: boolean;
}) {
  const toneMap = {
    neutral: "border-[#374151] bg-[#1F2937] text-zinc-200",
    green: "border-[#14532D] bg-[#052E16] text-[#86EFAC]",
    blue: "border-[#1D4ED8] bg-[#172554] text-[#93C5FD]",
    amber: "border-[#78350F] bg-[#451A03] text-[#FCD34D]",
    red: "border-[#7F1D1D] bg-[#450A0A] text-[#FCA5A5]"
  } as const;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${toneMap[tone]} ${
        mono ? "font-mono" : ""
      }`}
    >
      {label}
    </span>
  );
}
