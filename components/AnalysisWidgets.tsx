export function StatCard({ label, value, positive }: { label: string; value: string | number; positive?: boolean }) {
  return (
    <div className="analysis-stat-card">
      <div className="analysis-stat-card__top"><p>{label}</p><span className="analysis-stat-card__dot" /></div>
      <div className="analysis-stat-card__body">
        <strong className={positive === undefined ? "" : positive ? "is-positive" : "is-negative"}>{value}</strong>
        {positive !== undefined && <span className={positive ? "analysis-stat-card__status is-positive" : "analysis-stat-card__status is-negative"}>{positive ? "Improving" : "Needs attention"}</span>}
      </div>
    </div>
  );
}

export function RankedList({ title, items, positive }: { title: string; items: { name: string; marks: number }[]; positive: boolean }) {
  return (
    <div className="analysis-ranked-list">
      <div className="analysis-ranked-list__head"><p>{title}</p><span>{items.length}</span></div>
      <ol>
        {items.map((it, i) => <li key={`${it.name}-${i}`}><span className="analysis-ranked-list__rank">{String(i + 1).padStart(2, "0")}</span><span className="analysis-ranked-list__name">{it.name}</span><strong className={positive ? "is-positive" : "is-negative"}>{it.marks}</strong></li>)}
      </ol>
    </div>
  );
}

export function GradeBadge({ grade }: { grade: string }) {
  const tone: Record<string, string> = {
    Excellent: "excellent", Good: "good", Average: "attention", Bad: "risk",
    "Needs Attention": "attention", "Critical Risk": "risk",
  };
  return <span className={`analysis-grade-badge ${tone[grade] || "neutral"}`}>{grade}</span>;
}

export function RawDataButton({ sheetId }: { sheetId: string | null }) {
  if (!sheetId) return null;
  return <a href={`https://docs.google.com/spreadsheets/d/${sheetId}/edit`} target="_blank" rel="noopener noreferrer" className="analysis-raw-button"><span>Raw Data</span><span aria-hidden="true">↗</span></a>;
}
