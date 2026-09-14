import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, BookOpen, GraduationCap, LayoutDashboard, RefreshCw, X } from "lucide-react";
import SubjectAnalysisNav from "../../../components/SubjectAnalysisNav";
import { RawDataButton } from "../../../components/AnalysisWidgets";
import { SubjectAnalysis } from "../../../lib/analysis";

type Tier = "Excellent" | "Good" | "Needs Attention" | "Critical Risk";
type SortField = "combined" | "midsem1" | "midsem2" | "max";
type SortOrder = "desc" | "asc" | "none";

const MAX = 30;
const TIERS: Tier[] = ["Excellent", "Good", "Needs Attention", "Critical Risk"];
const COLORS: Record<Tier, string> = { Excellent: "#4d75d0", Good: "#15966a", "Needs Attention": "#f59e0b", "Critical Risk": "#ef4444" };
const initials = (name: string) => name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
const round1 = (n: number) => Math.round(n * 10) / 10;
const tierFor = (marks: number): Tier => { const p = (marks / MAX) * 100; if (p >= 80) return "Excellent"; if (p >= 60) return "Good"; if (p >= 40) return "Needs Attention"; return "Critical Risk"; };

export default function CombinedMidsemPage() {
  const router = useRouter();
  const { subjectId } = router.query;
  const [data, setData] = useState<SubjectAnalysis | null>(null);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [computedAt, setComputedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [selectedTier, setSelectedTier] = useState<Tier | null>(null);
  const [sortField, setSortField] = useState<SortField>("combined");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  async function load(sync = false) {
    if (!subjectId || typeof subjectId !== "string") return;
    sync ? setSyncing(true) : setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/analysis/subject/${subjectId}${sync ? "?sync=1" : ""}`);
      const json = await response.json();
      if (!response.ok) throw new Error(json.detail ? `${json.error}: ${json.detail}` : json.error || "Failed to load academic analysis");
      setData(json.data);
      setComputedAt(json.computedAt || "");
      setSheetId(json.sheetId || null);
    } catch (e: any) {
      setError(e.message || "Failed to load academic analysis");
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }

  useEffect(() => { load(); }, [subjectId]);

  const students = data?.students || [];
  const rows = useMemo(() => students.map((s: any) => ({
    enrollmentNo: s.enrollmentNo,
    name: s.name,
    first: Number(s.midsem?.first || 0),
    second: Number(s.midsem?.second || 0),
    combined: Number(s.midsem?.combined || 0),
    max: Number(s.midsem?.max || 0),
  })), [students]);

  const counts = useMemo(() => {
    const result = TIERS.reduce((acc, tier) => ({ ...acc, [tier]: 0 }), {} as Record<Tier, number>);
    rows.forEach((row) => result[tierFor(row.combined)]++);
    return result;
  }, [rows]);

  const metricValue = (row: typeof rows[number], field: SortField) => {
    if (field === "midsem1") return row.first;
    if (field === "midsem2") return row.second;
    if (field === "max") return row.max;
    return row.combined;
  };
  const activeGradeField: SortField = sortOrder === "none" ? "combined" : sortField;
  const filteredRows = useMemo(
    () => selectedTier ? rows.filter((row) => tierFor(metricValue(row, activeGradeField)) === selectedTier) : rows,
    [rows, selectedTier, activeGradeField]
  );

  const sortedRows = useMemo(() => {
    if (sortOrder === "none") return [...filteredRows];
    return [...filteredRows].sort((a, b) => {
      const difference = metricValue(a, sortField) - metricValue(b, sortField);
      if (difference !== 0) return sortOrder === "asc" ? difference : -difference;
      return a.name.localeCompare(b.name);
    });
  }, [filteredRows, sortField, sortOrder]);

  const rankRows = useMemo(() => [...rows].sort((a, b) => b.combined - a.combined), [rows]);
  const top5 = rankRows.slice(0, 5);
  const bottom5 = [...rankRows].reverse().slice(0, 5);
  const average = rows.length ? round1(rows.reduce((sum, row) => sum + row.combined, 0) / rows.length) : 0;
  const passRate = rows.length ? Math.round(rows.filter((row) => row.combined >= 12).length / rows.length * 100) : 0;
  const highest = rows.length ? Math.max(...rows.map((row) => row.max)) : 0;
  const highestNames = rows.filter((row) => row.max === highest).map((row) => row.name);
  const chartData = TIERS.map((name) => ({ name, count: counts[name] }));

  return (
    <div className="analysis-layout">
      <aside className="analysis-sidebar">
        <div className="analysis-brand"><span className="analysis-brand__mark"><BarChart3 size={18} /></span><span>ClassPulse</span></div>
        <nav className="analysis-side-nav">
          <a href="/dashboard"><LayoutDashboard size={18} />Dashboard</a>
          <a href="/classes"><BookOpen size={18} />Class Analysis</a>
          <a className="is-active" href={typeof subjectId === "string" ? `/subject-analysis/${subjectId}/academic` : "#"}><GraduationCap size={18} />Subject Analysis</a>
        </nav>
        <RawDataButton sheetId={sheetId} />
        <div className="analysis-side-footer">ClassPulse Teacher Portal</div>
      </aside>

      <main className="analysis-page">
        <header className="analysis-topbar">
          <div className="analysis-title-row">
            <h1>Subject Analysis</h1>
            {computedAt && <span className="analysis-sync">• Last synced {new Date(computedAt).toLocaleString()}</span>}
          </div>
          <div className="analysis-top-actions">
            <button className="analysis-primary" onClick={() => load(true)} disabled={syncing}><RefreshCw size={15} className={syncing ? "animate-spin" : ""} />{syncing ? "Syncing..." : "Sync now"}</button>
          </div>
        </header>

        {typeof subjectId === "string" && <SubjectAnalysisNav subjectId={subjectId} />}

        <div className="analysis-view-switch">
          <a href={`/subject-analysis/${subjectId}/academic`}><button>Midsem 1</button></a>
          <a href={`/subject-analysis/${subjectId}/academic`}><button>Midsem 2</button></a>
          <button className="is-active">Combined</button>
          <a href={`/subject-analysis/${subjectId}/academic`}><button>Summary</button></a>
        </div>

        {error && <div className="analysis-panel" style={{ padding: 14, marginBottom: 16, color: "#b42318" }}>{error}</div>}
        {loading && !data && <div style={{ padding: 40, color: "#667085", fontSize: 13 }}>Loading combined academic analysis...</div>}

        {data && <>
          <section className="analysis-hero">
            <div className="analysis-hero-copy">
              <h2>Midsem Combined</h2>
              <p>Combined performance across Midsem 1 and Midsem 2, with class statistics and performance tiers.</p>
            </div>
            <Metric label="Class Average" value={average} detail="combined average out of 30" />
            <Metric label="Pass Rate" value={`${passRate}%`} detail="students scoring 12 or more" />
            <Metric label="Highest Score" value={highest} detail={highestNames.join(", ") || "no score available"} />
          </section>

          <section className="combined-controls-bar">
            <div className="combined-control">
              <label htmlFor="combined-sort-field">Grade / Sort By</label>
              <select id="combined-sort-field" value={sortField} onChange={(event) => setSortField(event.target.value as SortField)}>
                <option value="combined">Combined (average)</option>
                <option value="midsem1">Midsem 1</option>
                <option value="midsem2">Midsem 2</option>
                <option value="max">Maximum score</option>
              </select>
            </div>
            <div className="combined-control">
              <label htmlFor="combined-sort-order">Order</label>
              <select id="combined-sort-order" value={sortOrder} onChange={(event) => setSortOrder(event.target.value as SortOrder)}>
                <option value="desc">High to Low</option>
                <option value="asc">Low to High</option>
                <option value="none">No Sort</option>
              </select>
            </div>
          </section>

          <section className="analysis-content-grid combined-content-grid">
            <section className="analysis-panel analysis-table-panel">
              <div className="analysis-panel-head">
                <div>
                  <h3>All Students</h3>
                  <p style={{ marginTop: 4, color: "#98a2b3", fontSize: 11 }}>{selectedTier ? `Filtered: ${selectedTier}` : "Midsem 1 + Midsem 2 combined"}</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {selectedTier && <button className="analysis-secondary" style={{ padding: "5px 8px" }} onClick={() => setSelectedTier(null)}><X size={13} />Clear</button>}
                  <span className="analysis-count">{sortedRows.length} Students</span>
                </div>
              </div>
              <div className="analysis-table-wrap combined-table-wrap">
                <table className="analysis-table combined-student-table">
                  <colgroup>
                    <col className="combined-sno-col" />
                    <col className="combined-name-col" />
                    <col className="combined-midsem-col" />
                    <col className="combined-midsem-col" />
                    <col className="combined-midsem-col" />
                    <col className="combined-grade-col" />
                  </colgroup>
                  <thead><tr><th>{sortOrder === "none" ? "S.No." : "Rank"}</th><th>Student</th><th>Midsem 1</th><th>Midsem 2</th><th>Combined</th><th>Grade</th></tr></thead>
                  <tbody>
                    {sortedRows.map((row, index) => {
                      const tier = tierFor(metricValue(row, activeGradeField));
                      const sortedColor = sortOrder !== "none" ? COLORS[tier] : undefined;
                      const serial = sortOrder === "none" ? rows.findIndex((item) => item.enrollmentNo === row.enrollmentNo) + 1 : index + 1;
                      return <tr key={row.enrollmentNo}>
                        <td>{serial}</td>
                        <td><span className="student-cell"><span className="student-avatar">{initials(row.name)}</span><span className="combined-student-name">{row.name}</span></span></td>
                        <td style={sortField === "midsem1" && sortOrder !== "none" ? { color: sortedColor, fontWeight: 700 } : undefined}>{row.first}</td>
                        <td style={sortField === "midsem2" && sortOrder !== "none" ? { color: sortedColor, fontWeight: 700 } : undefined}>{row.second}</td>
                        <td style={sortField === "combined" && sortOrder !== "none" ? { color: sortedColor, fontWeight: 700 } : undefined}>{row.combined}</td>
                        <td><button type="button" className={`analysis-grade-badge ${tier === "Excellent" ? "excellent" : tier === "Good" ? "good" : tier === "Needs Attention" ? "attention" : "risk"}`} onClick={() => setSelectedTier(selectedTier === tier ? null : tier)}>{tier}</button></td>
                      </tr>;
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="analysis-right-stack combined-right-stack">
              <section className="analysis-panel analysis-chart-panel">
                <h3>Grade Distribution</h3>
                <p>Click a bar to filter the student table by performance tier.</p>
                <div className="analysis-chart combined-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} onClick={(state: any) => { const tier = state?.activeLabel as Tier | undefined; if (tier && TIERS.includes(tier)) setSelectedTier(selectedTier === tier ? null : tier); }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" fontSize={10} />
                      <YAxis allowDecimals={false} fontSize={11} />
                      <Tooltip />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]}>{TIERS.map((tier) => <Cell key={tier} fill={COLORS[tier]} cursor="pointer" opacity={!selectedTier || selectedTier === tier ? 1 : 0.35} />)}</Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <div className="academic-rank-grid">
                <section className="analysis-panel academic-rank-panel"><h3>Top 5 Highest Scorers</h3>{top5.map((row, index) => <div className="academic-rank-row" key={row.enrollmentNo}><span>{index + 1}</span><p>{row.name}</p><strong>{row.combined}</strong></div>)}</section>
                <section className="analysis-panel academic-rank-panel"><h3>Bottom 5 At-Risk Students</h3>{bottom5.map((row, index) => <div className="academic-rank-row" key={row.enrollmentNo}><span>{index + 1}</span><p>{row.name}</p><strong className="is-negative">{row.combined}</strong></div>)}</section>
              </div>
            </div>
          </section>
        </>}
      </main>

      <style jsx global>{`
        .combined-content-grid { align-items: start; min-width: 0; }
        .analysis-table-panel { min-width: 0 !important; width: 100%; }
        .combined-right-stack { min-width: 0; display: grid; gap: 16px; }
        .combined-controls-bar { display: flex; justify-content: flex-end; align-items: flex-end; gap: 12px; margin: 0 0 18px; }
        .combined-control { min-width: 190px; }
        .combined-control label { display: block; margin-bottom: 7px; color: #667085; font-size: 11px; font-weight: 600; }
        .combined-control select { width: 100%; height: 40px; border: 1px solid #d8e0ea; border-radius: 9px; background: #fff; color: #344054; padding: 0 12px; font-size: 13px; outline: none; }
        .combined-control select:focus { border-color: #4b2e91; box-shadow: 0 0 0 2px rgba(75,46,145,.12); }
        .combined-table-wrap { min-height: 560px; max-height: 560px; width: 100%; min-width: 0; max-width: 100%; overflow-x: hidden !important; overflow-y: auto; }
        .combined-student-table { width: 100% !important; min-width: 0 !important; max-width: 100%; table-layout: fixed; }
        .combined-student-table .combined-sno-col { width: 9%; }
        .combined-student-table .combined-name-col { width: 35%; }
        .combined-student-table .combined-midsem-col { width: 14%; }
        .combined-student-table .combined-grade-col { width: 14%; }
        .combined-student-table th, .combined-student-table td { min-width: 0 !important; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
        .combined-student-table .student-cell { min-width: 0; max-width: 100%; }
        .combined-student-table .combined-student-name { min-width: 0; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .combined-table-panel .analysis-table th:not(:nth-child(2)), .combined-table-panel .analysis-table td:not(:nth-child(2)) { text-align: center; }
        .combined-chart { height: 250px; }
        @media (max-width: 1100px) { .combined-controls-bar { justify-content: flex-start; } .combined-table-wrap { min-height: 480px; max-height: 480px; } }
        @media (max-width: 650px) { .combined-controls-bar { flex-direction: column; align-items: stretch; } .combined-control { width: 100%; } }
      `}</style>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return <div className="analysis-metric"><div className="analysis-metric-content"><span className="analysis-metric-label">{label}</span><div className="analysis-metric-value-row"><strong>{value}</strong></div><span className="analysis-metric-detail">{detail}</span></div></div>;
}
