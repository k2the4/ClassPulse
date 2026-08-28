import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, BookOpen, GraduationCap, LayoutDashboard, RefreshCw, X } from "lucide-react";
import SubjectAnalysisNav from "../../../components/SubjectAnalysisNav";
import { RawDataButton } from "../../../components/AnalysisWidgets";
import { SubjectAnalysis } from "../../../lib/analysis";

type Tier = "Excellent" | "Good" | "Needs Attention" | "Critical Risk";
const MAX = 30;
const TIERS: Tier[] = ["Excellent", "Good", "Needs Attention", "Critical Risk"];
const COLORS: Record<Tier, string> = { Excellent: "#15966a", Good: "#4d75d0", "Needs Attention": "#f59e0b", "Critical Risk": "#ef4444" };
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

  const filteredRows = useMemo(() => selectedTier ? rows.filter((row) => tierFor(row.combined) === selectedTier) : rows, [rows, selectedTier]);
  const sorted = useMemo(() => [...rows].sort((a, b) => b.combined - a.combined), [rows]);
  const top5 = sorted.slice(0, 5);
  const bottom5 = [...sorted].reverse().slice(0, 5);
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

          <section className="analysis-content-grid combined-content-grid">
            <section className="analysis-panel analysis-table-panel">
              <div className="analysis-panel-head">
                <div>
                  <h3>All Students</h3>
                  <p style={{ marginTop: 4, color: "#98a2b3", fontSize: 11 }}>{selectedTier ? `Filtered: ${selectedTier}` : "Midsem 1 + Midsem 2 combined"}</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {selectedTier && <button className="analysis-secondary" style={{ padding: "5px 8px" }} onClick={() => setSelectedTier(null)}><X size={13} />Clear</button>}
                  <span className="analysis-count">{filteredRows.length} Students</span>
                </div>
              </div>
              <div className="analysis-table-wrap combined-table-wrap">
                <table className="analysis-table">
                  <thead><tr><th>Rank</th><th>Student</th><th>Midsem 1</th><th>Midsem 2</th><th>Combined</th><th>Grade</th></tr></thead>
                  <tbody>
                    {filteredRows.map((row) => {
                      const tier = tierFor(row.combined);
                      return <tr key={row.enrollmentNo}>
                        <td>{sorted.findIndex((item) => item.enrollmentNo === row.enrollmentNo) + 1}</td>
                        <td><span className="student-cell"><span className="student-avatar">{initials(row.name)}</span>{row.name}</span></td>
                        <td>{row.first}</td><td>{row.second}</td><td><strong>{row.combined}</strong></td>
                        <td><button type="button" className={`analysis-grade-badge ${tier === "Excellent" ? "excellent" : tier === "Good" ? "good" : tier === "Needs Attention" ? "attention" : "risk"}`} onClick={() => setSelectedTier(selectedTier === tier ? null : tier)}>{tier}</button></td>
                      </tr>;
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="analysis-right-stack combined-right-stack">
              <section className="analysis-panel academic-stats-panel">
                <div className="academic-highest"><span>Highest Score</span><strong>{highest}</strong><p>{highestNames.join(", ") || "—"}</p></div>
                <div className="academic-tier-grid">
                  {TIERS.map((tier) => <button key={tier} type="button" className="academic-tier-card" onClick={() => setSelectedTier(selectedTier === tier ? null : tier)} style={{ borderColor: `${COLORS[tier]}55`, cursor: "pointer", boxShadow: selectedTier === tier ? `0 0 0 2px ${COLORS[tier]}33` : undefined }}><span>{tier}</span><strong style={{ color: COLORS[tier] }}>{counts[tier]}</strong></button>)}
                </div>
              </section>

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
        .combined-content-grid { align-items: start; }
        .combined-table-wrap { min-height: 560px; max-height: 560px; }
        .combined-table-panel .analysis-table th:not(:nth-child(2)), .combined-table-panel .analysis-table td:not(:nth-child(2)) { text-align: center; }
        .combined-right-stack { display: grid; gap: 16px; }
        .combined-chart { height: 250px; }
        @media (max-width: 1100px) { .combined-table-wrap { min-height: 480px; max-height: 480px; } }
      `}</style>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return <div className="analysis-metric"><div className="analysis-metric-content"><span className="analysis-metric-label">{label}</span><div className="analysis-metric-value-row"><strong>{value}</strong></div><span className="analysis-metric-detail">{detail}</span></div></div>;
}
