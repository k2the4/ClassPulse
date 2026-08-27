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
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <p className="text-xs text-gray-400">{label}</p>
      <p
        className={`text-xl font-semibold mt-1 ${
          positive === undefined ? "text-gray-900" : positive ? "text-green-600" : "text-red-600"
        }`}
      >
        {value}
      </p>
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
    <div>
      <p className="text-xs text-gray-400 mb-1">{title}</p>
      <ol className="text-sm space-y-1">
        {items.map((it, i) => (
          <li key={it.name} className="flex justify-between">
            <span>
              {i + 1}. {it.name}
            </span>
            <span className={positive ? "text-green-600" : "text-red-600"}>{it.marks}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function GradeBadge({ grade }: { grade: string }) {
  const colors: Record<string, string> = {
    Excellent: "bg-green-100 text-green-700",
    Good: "bg-blue-100 text-blue-700",
    Average: "bg-yellow-100 text-yellow-700",
    Bad: "bg-red-100 text-red-700",
    "Needs Attention": "bg-yellow-100 text-yellow-700",
    "Critical Risk": "bg-red-100 text-red-700",
  };
  return (
    <span className={`text-xs px-2 py-1 rounded-full ${colors[grade] || "bg-gray-100"}`}>{grade}</span>
  );
}

// Opens the linked Google Sheet directly — this is the whole "raw data"
// workflow: no upload/download, just edit the sheet, come back, resync.
export function RawDataButton({ sheetId }: { sheetId: string | null }) {
  if (!sheetId) return null;
  return (
    <a
      href={`https://docs.google.com/spreadsheets/d/${sheetId}/edit`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50"
    >
      Raw Data ↗
    </a>
  );
}
