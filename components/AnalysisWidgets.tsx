export function StatCard({
  label,
  value,
  positive,
}: {
  label: string;
  value: string | number;
  positive?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm transition-transform hover:-translate-y-0.5">
      <p className="text-[11px] uppercase tracking-[0.12em] text-gray-400">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p
          className={`text-2xl font-semibold tracking-tight ${
            positive === undefined ? "text-gray-900" : positive ? "text-emerald-600" : "text-red-600"
          }`}
        >
          {value}
        </p>
        {positive !== undefined && (
          <span className={`text-xs font-medium ${positive ? "text-emerald-600" : "text-red-500"}`}>
            {positive ? "Improving" : "Needs attention"}
          </span>
        )}
      </div>
    </div>
  );
}

export function RankedList({
  title,
  items,
  positive,
}: {
  title: string;
  items: { name: string; marks: number }[];
  positive: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white/70 p-4">
      <p className="text-xs font-medium uppercase tracking-[0.08em] text-gray-400 mb-3">{title}</p>
      <ol className="text-sm space-y-2">
        {items.map((it, i) => (
          <li key={it.name} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-500">{i + 1}</span>
              <span className="truncate">{it.name}</span>
            </span>
            <span className={`font-medium ${positive ? "text-emerald-600" : "text-red-500"}`}>{it.marks}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function GradeBadge({ grade }: { grade: string }) {
  const colors: Record<string, string> = {
    Excellent: "bg-emerald-50 text-emerald-700 border border-emerald-100",
    Good: "bg-blue-50 text-blue-700 border border-blue-100",
    Average: "bg-amber-50 text-amber-700 border border-amber-100",
    Bad: "bg-red-50 text-red-700 border border-red-100",
    "Needs Attention": "bg-amber-50 text-amber-700 border border-amber-100",
    "Critical Risk": "bg-red-50 text-red-700 border border-red-100",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${colors[grade] || "bg-gray-100 text-gray-600"}`}>{grade}</span>
  );
}

export function RawDataButton({ sheetId }: { sheetId: string | null }) {
  if (!sheetId) return null;
  return (
    <a
      href={`https://docs.google.com/spreadsheets/d/${sheetId}/edit`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white/80 px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
    >
      <span>Raw Data</span>
      <span aria-hidden="true">↗</span>
    </a>
  );
}
