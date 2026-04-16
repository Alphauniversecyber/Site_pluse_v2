type SeriesKey = {
  key: string;
  label: string;
  tone: "blue" | "green" | "amber" | "red";
};

type ChartPoint = {
  date: string;
  [key: string]: number | string;
};

const TONE_CLASSES: Record<SeriesKey["tone"], string> = {
  blue: "bg-[#2563EB]",
  green: "bg-[#16A34A]",
  amber: "bg-[#D97706]",
  red: "bg-[#DC2626]"
};

export function AdminSeriesChart({
  title,
  description,
  points,
  series
}: {
  title: string;
  description: string;
  points: ChartPoint[];
  series: SeriesKey[];
}) {
  const maxValue = Math.max(
    1,
    ...points.flatMap((point) =>
      series.map((item) => {
        const value = point[item.key];
        return typeof value === "number" ? value : 0;
      })
    )
  );

  return (
    <div className="rounded-3xl border border-[#1F1F1F] bg-[#0D0D0D] p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="mt-1 text-sm leading-6 text-zinc-400">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {series.map((item) => (
            <span
              key={item.key}
              className="inline-flex items-center gap-2 rounded-full border border-[#27272A] bg-[#111111] px-3 py-1 text-xs text-zinc-300"
            >
              <span className={`h-2.5 w-2.5 rounded-full ${TONE_CLASSES[item.tone]}`} />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {points.length ? (
          points.map((point) => (
            <div key={point.date as string} className="grid gap-3 md:grid-cols-[88px,1fr]">
              <div className="font-mono text-xs text-zinc-500">{point.date as string}</div>
              <div className="space-y-2">
                {series.map((item) => {
                  const value = typeof point[item.key] === "number" ? (point[item.key] as number) : 0;
                  const width = `${Math.max((value / maxValue) * 100, value > 0 ? 6 : 0)}%`;

                  return (
                    <div key={`${point.date as string}-${item.key}`} className="grid grid-cols-[90px,1fr,36px] items-center gap-3">
                      <span className="text-xs text-zinc-400">{item.label}</span>
                      <div className="h-2.5 overflow-hidden rounded-full bg-[#1B1B1B]">
                        <div className={`h-full rounded-full ${TONE_CLASSES[item.tone]}`} style={{ width }} />
                      </div>
                      <span className="text-right font-mono text-xs text-zinc-300">{value}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-zinc-500">No monitoring data has been collected yet.</p>
        )}
      </div>
    </div>
  );
}
