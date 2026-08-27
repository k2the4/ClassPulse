import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { BarChart3, BookOpen, GraduationCap, LayoutDashboard, RefreshCw } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import SubjectAnalysisNav from "../../../components/SubjectAnalysisNav";
import { RawDataButton } from "../../../components/AnalysisWidgets";
import { SubjectAnalysis } from "../../../lib/analysis";

type Tier = "Excellent" | "Good" | "Needs Attention" | "Critical Risk";
const TIERS: Tier[] = ["Excellent", "Good", "Needs Attention", "Critical Risk"];
const COLORS: Record<Tier, string> = { Excellent: "#15966a", Good: "#4d75d0", "Needs Attention": "#f59e0b", "Critical Risk": "#ef4444" };
const round1 = (n: number) => Math.round(n * 10) / 10;
const tierFor = (marks: number): Tier => { const p = marks / 30 * 100; if (p >= 80) return "Excellent"; if (p >= 60) return "Good"; if (p >= 40) return "Needs Attention"; return "Critical Risk"; };
const initials = (name: string) => name.split(" ").filter(Boolean).slice(0,2).map(p => p[0]).join("").toUpperCase();

export default function CombinedMidsemPage() {
  const router = useRouter();
  const { subjectId } = router.query;
  const [data, setData] = useState<SubjectAnalysis | null>(null);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [computedAt, setComputedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [grade, setGrade] = useState("combined");
  const [order, setOrder] = useState("desc");
  const [selectedTier, setSelectedTier] = useState<Tier | null>(null);

  async function load(sync = false) {
    if (!subjectId || typeof subjectId !== "string") return;
    sync ? setSyncing(true) : setLoading(true);
    setError("");
    try {
      const r = await fetch(`/api/analysis/subject/${subjectId}${sync ? "?sync=1" : ""}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail ? `${j.error}: ${j.detail}` : j.error || "Failed to load academic analysis");
      setData(j.data); setComputedAt(j.computedAt || ""); setSheetId(j.sheetId || null);
    } catch (e: any) { setError(e.message || "Failed to load academic analysis"); }
    finally { setLoading(false); setSyncing(false); }
  }

  useEffect(() => { load(); }, [subjectId]);

  const rows = useMemo(() => (data?.students || []).map((s: any) => ({
    enrollmentNo: s.enrollmentNo, name: s.name,
    first: Number(s.midsem?.first || 0), second: Number(s.midsem?.second || 0),
    combined: Number(s.midsem?.combined || 0), max: Number(s.midsem?.max || 0),
  })), [data]);

  const filteredRows = useMemo(() => {
    const filtered = selectedTier ? rows.filter(r => tierFor(r.combined) === selectedTier) : rows;
    return [...filtered].sort((a,b) => {
      const av = grade === "max" ? a.max : grade === "midsem1" ? a.first : grade === "midsem2" ? a.second : a.combined;
      const bv = grade === "max" ? b.max : grade === "midsem1" ? b.first : grade === "midsem2" ? b.second : b.combined;
      return order === "asc" ? av - bv : bv - av;
    });
  }, [rows, selectedTier, grade, order]);

  const counts = useMemo(() => TIERS.reduce((a,t) => ({ ...a, [t]: rows.filter(r => tierFor(r.combined) === t).length }), {} as Record<Tier,number>), [rows]);
  const chartData = TIERS.map(name => ({ name, count: counts[name] }));
  const average = rows.length ? round1(rows.reduce((s,r) => s + r.combined, 0) / rows.length) : 0;
  const highest = rows.length ? Math.max(...rows.map(r => r.max)) : 0;
  const top5 = [...rows].sort((a,b) => b.combined - a.combined).slice(0,5);
  const bottom5 = [...rows].sort((a,b) => a.combined - b.combined).slice(0,5);

  return <div className="analysis-layout">
    <aside className="analysis-sidebar">
      <div className="analysis-brand"><span className="analysis-brand__mark"><BarChart3 size={18}/></span><span>ClassPulse</span></div>
      <nav className="analysis-side-nav">
        <a href="/dashboard"><LayoutDashboard size={18}/>Dashboard</a>
        <a href="/classes"><BookOpen size={18}/>Class Analysis</a>
        <a className="is-active" href={typeof subjectId === "string" ? `/subject-analysis/${subjectId}/academic` : "#"}><GraduationCap size={18}/>Subject Analysis</a>
      </nav>
      <RawDataButton sheetId={sheetId}/>
      <div className="analysis-side-footer">ClassPulse Teacher Portal</div>
    </aside>
    <main className="analysis-page">
      <header className="analysis-topbar">
        <div className="analysis-title-row"><h1>Subject Analysis</h1>{computedAt && <span className="analysis-sync">• Last synced {new Date(computedAt).toLocaleString()}</span>}</div>
        <div className="analysis-top-actions"><button className="analysis-primary" onClick={() => load(true)} disabled={syncing}><RefreshCw size={15} className={syncing ? "animate-spin" : ""}/>{syncing ? "Syncing..." : "Sync now"}</button></div>
      </header>
      {typeof subjectId === "string" && <SubjectAnalysisNav subjectId={subjectId}/>} 
      <div className="analysis-view-switch">
        <a href={`/subject-analysis/${subjectId}/academic`}><button>Midsem 1</button></a>
        <a href={`/subject-analysis/${subjectId}/academic`}><button>Midsem 2</button></a>
        <button className="is-active">Combined</button>
        <a href={`/subject-analysis/${subjectId}/academic`}><button>Summary</button></a>
      </div>
      {error && <div className="analysis-panel" style={{padding:14, marginBottom:16, color:"#b42318"}}>{error}</div>}
      {loading && !data && <div style={{padding:40,color:"#667085",fontSize:13}}>Loading combined academic analysis...</div>}
      {data && <>
        <section className="analysis-hero">
          <div className="analysis-hero-copy"><h2>Midsem Combined</h2><p>Choose the academic measure and sorting order.</p></div>
          <Metric label="Class Average" value={average} detail="combined average"/>
          <Metric label="Highest Score" value={highest} detail="best individual mark"/>
          <Metric label="Students" value={rows.length} detail="students in analysis"/>
        </section>

        <section className="combined-controls analysis-panel">
          <div><label>Grade / Sort By</label><select value={grade} onChange={e => setGrade(e.target.value)}><option value="combined">Combined (average)</option><option value="midsem1">Midsem 1</option><option value="midsem2">Midsem 2</option><option value="max">Maximum score</option></select></div>
          <div><label>Order</label><select value={order} onChange={e => setOrder(e.target.value)}><option value="desc">High to Low</option><option value="asc">Low to High</option></select></div>
          {selectedTier && <button className="analysis-secondary" onClick={() => setSelectedTier(null)}>Clear filter</button>}
        </section>

        <section className="combined-grid">
          <section className="analysis-panel combined-table-panel">
            <div className="analysis-panel-head"><div><h3>All Students</h3><p style={{marginTop:4,color:"#98a2b3",fontSize:11}}>{selectedTier ? `Filtered: ${selectedTier}` : "Ranked by selected measure"}</p></div><span className="analysis-count">{filteredRows.length} Students</span></div>
            <div className="analysis-table-wrap combined-table-wrap"><table className="analysis-table"><thead><tr><th>Rank</th><th>Name</th><th>1st</th><th>2nd</th><th>Combined</th><th>Max</th><th>Grade</th></tr></thead><tbody>{filteredRows.map((r,i) => <tr key={r.enrollmentNo}><td>{i+1}</td><td><span className="student-cell"><span className="student-avatar">{initials(r.name)}</span>{r.name}</span></td><td>{r.first}</td><td>{r.second}</td><td><strong>{r.combined}</strong></td><td>{r.max}</td><td><button type="button" onClick={() => setSelectedTier(tierFor(r.combined))} style={{border:0,cursor:"pointer"}} className={`analysis-grade-badge ${tierFor(r.combined) === "Excellent" ? "excellent" : tierFor(r.combined) === "Good" ? "good" : tierFor(r.combined) === "Needs Attention" ? "attention" : "risk"}`}>{tierFor(r.combined)}</button></td></tr>)}</tbody></table></div>
          </section>

          <div className="combined-right-stack">
            <section className="analysis-panel analysis-chart-panel"><div className="analysis-panel-head"><div><h3>Grade Distribution</h3><p>Click a bar to filter the same tier.</p></div></div><div className="analysis-chart combined-grade-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} onClick={(state:any) => { const name = state?.activeLabel as Tier | undefined; if (name && TIERS.includes(name)) setSelectedTier(selectedTier === name ? null : name); }}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name" fontSize={10}/><YAxis allowDecimals={false} fontSize={11}/><Tooltip/><Bar dataKey="count" radius={[6,6,0,0]}>{TIERS.map(t => <Cell key={t} fill={COLORS[t]} cursor="pointer" opacity={!selectedTier || selectedTier === t ? 1 : .35}/>)}</Bar></BarChart></ResponsiveContainer></div></section>
            <section className="analysis-panel combined-rank-panel"><h3>Top 5 Highest Scorers</h3>{top5.map((r,i) => <div className="academic-rank-row" key={r.enrollmentNo}><span>{i+1}</span><p>{r.name}</p><strong>{r.combined}</strong></div>)}</section>
            <section className="analysis-panel combined-rank-panel"><h3>Bottom 5</h3>{bottom5.map((r,i) => <div className="academic-rank-row" key={r.enrollmentNo}><span>{i+1}</span><p>{r.name}</p><strong className="is-negative">{r.combined}</strong></div>)}</section>
          </div>
        </section>
      </>}
    </main>
  </div>;
}

function Metric({label,value,detail}:{label:string;value:string|number;detail:string}) { return <div className="analysis-metric"><div className="analysis-metric-content"><span className="analysis-metric-label">{label}</span><div className="analysis-metric-value-row"><strong>{value}</strong></div><span className="analysis-metric-detail">{detail}</span></div></div>; }
