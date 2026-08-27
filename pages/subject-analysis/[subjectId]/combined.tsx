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
    sync ? setSyncing(true) : setLoading(true); setError("");
    try { const r = await fetch(`/api/analysis/subject/${subjectId}${sync ? "?sync=1" : ""}`); const j = await r.json(); if (!r.ok) throw new Error(j.detail ? `${j.error}: ${j.detail}` : j.error || "Failed to load academic analysis"); setData(j.data); setComputedAt(j.computedAt || ""); setSheetId(j.sheetId || null); }
    catch (e: any) { setError(e.message || "Failed to load academic analysis"); }
    finally { setLoading(false); setSyncing(false); }
  }
  useEffect(() => { load(); }, [subjectId]);

  const rows = useMemo(() => (data?.students || []).map((s: any) => ({ enrollmentNo: s.enrollmentNo, name: s.name, first: Number(s.midsem?.first || 0), second: Number(s.midsem?.second || 0), combined: Number(s.midsem?.combined || 0), max: Number(s.midsem?.max || 0) })), [data]);
  const filteredRows = useMemo(() => { const filtered = selectedTier ? rows.filter(r => tierFor(r.combined) === selectedTier) : rows; return [...filtered].sort((a,b) => { const av = grade === "max" ? a.max : grade === "midsem1" ? a.first : grade === "midsem2" ? a.second : a.combined; const bv = grade === "max" ? b.max : grade === "midsem1" ? b.first : grade === "midsem2" ? b.second : b.combined; return order === "asc" ? av - bv : bv - av; }); }, [rows, selectedTier, grade, order]);
  const counts = useMemo(() => TIERS.reduce((a,t) => ({ ...a, [t]: rows.filter(r => tierFor(r.combined) === t).length }), {} as Record<Tier,number>), [rows]);
  const chartData = TIERS.map(name => ({ name, count: counts[name] }));
  const average = rows.length ? round1(rows.reduce((s,r) => s + r.combined, 0) / rows.length) : 0;
  const highest = rows.length ? Math.max(...rows.map(r => r.max)) : 0;
  const top5 = [...rows].sort((a,b) => b.combined - a.combined).slice(0,5);
  const bottom5 = [...rows].sort((a,b) => a.combined - b.combined).slice(0,5);

  return <div className="analysis-layout"><aside className="analysis-sidebar"><div className="analysis-brand"><span className="analysis-brand__mark"><BarChart3 size={18}/></span><span>ClassPulse</span></div><nav className="analysis-side-nav"><a href="/dashboard"><LayoutDashboard size={18}/>Dashboard</a><a href="/classes"><BookOpen size={18}/>Class Analysis</a><a className="is-active" href={typeof subjectId === "string" ? `/subject-analysis/${subjectId}/academic` : "#"}><GraduationCap size={18}/>Subject Analysis</a></nav><RawDataButton sheetId={sheetId}/><div className="analysis-side-footer">ClassPulse Teacher Portal</div></aside>
  <main className="analysis-page"><header className="analysis-topbar"><div className="analysis-title-row"><h1>Subject Analysis</h1>{computedAt && <span className="analysis-sync">• Last synced {new Date(computedAt).toLocaleString()}</span>}</div><div className="analysis-top-actions"><button className="analysis-primary" onClick={() => load(true)} disabled={syncing}><RefreshCw size={15} className={syncing ? "animate-spin" : ""}/>{syncing ? "Syncing..." : "Sync now"}</button></div></header>
  {typeof subjectId === "string" && <SubjectAnalysisNav subjectId={subjectId}/>}<div className="analysis-view-switch"><a href={`/subject-analysis/${subjectId}/academic`}><button>Midsem 1</button></a><a href={`/subject-analysis/${subjectId}/academic`}><button>Midsem 2</button></a><button className="is-active">Combined</button><a href={`/subject-analysis/${subjectId}/academic`}><button>Summary</button></a></div>
  {error && <div className="analysis-panel" style={{padding:14,marginBottom:16,color:"#b42318"}}>{error}</div>}{loading && !data && <div style={{padding:40,color:"#667085",fontSize:13}}>Loading combined academic analysis...</div>}
  {data && <><section className="combined-heading"><div><h2>Midsem Combined</h2><p>Choose the academic measure and sorting order.</p></div><div className="combined-controls"><div><label>Grade / Sort By</label><select value={grade} onChange={e => setGrade(e.target.value)}><option value="combined">Combined (average)</option><option value="midsem1">Midsem 1</option><option value="midsem2">Midsem 2</option><option value="max">Maximum score</option></select></div><div><label>Order</label><select value={order} onChange={e => setOrder(e.target.value)}><option value="desc">High to Low</option><option value="asc">Low to High</option></select></div></div></section>
  <section className="combined-grid"><section className="analysis-panel combined-table-panel"><div className="analysis-panel-head"><div><h3>All Students</h3></div><span className="analysis-count">{filteredRows.length} Students</span></div><div className="analysis-table-wrap combined-table-wrap"><table className="analysis-table"><thead><tr><th>Rank</th><th>Name</th><th>1st</th><th>2nd</th><th>Combined</th><th>Max</th><th>Grade</th></tr></thead><tbody>{filteredRows.map((r,i) => { const t=tierFor(r.combined); return <tr key={r.enrollmentNo}><td>{i+1}</td><td><span className="student-cell"><span className="student-avatar">{initials(r.name)}</span>{r.name}</span></td><td>{r.first}</td><td>{r.second}</td><td><strong>{r.combined}</strong></td><td>{r.max}</td><td><button type="button" onClick={() => setSelectedTier(selectedTier === t ? null : t)} className={`analysis-grade-badge ${t === "Excellent" ? "excellent" : t === "Good" ? "good" : t === "Needs Attention" ? "attention" : "risk"}`}>{t}</button></td></tr>; })}</tbody></table></div></section>
  <div className="combined-right-stack"><section className="analysis-panel analysis-chart-panel"><div className="analysis-panel-head"><div><h3>Grade Distribution</h3><p>Click a bar to filter the same tier.</p></div></div><div className="analysis-chart combined-grade-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} onClick={(state:any) => { const name=state?.activeLabel as Tier|undefined; if(name && TIERS.includes(name)) setSelectedTier(selectedTier===name?null:name); }}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name" fontSize={10}/><YAxis allowDecimals={false} fontSize={11}/><Tooltip/><Bar dataKey="count" radius={[6,6,0,0]}>{TIERS.map(t => <Cell key={t} fill={COLORS[t]} cursor="pointer" opacity={!selectedTier || selectedTier===t ? 1 : .35}/>)}</Bar></BarChart></ResponsiveContainer></div></section>
  <section className="analysis-panel combined-rank-panel"><h3>Top 5 Highest Scorers</h3>{top5.map((r,i)=><div className="academic-rank-row" key={r.enrollmentNo}><span>{i+1}</span><p>{r.name}</p><strong>{r.combined}</strong></div>)}</section>
  <section className="analysis-panel combined-rank-panel"><h3>Bottom 5</h3>{bottom5.map((r,i)=><div className="academic-rank-row" key={r.enrollmentNo}><span>{i+1}</span><p>{r.name}</p><strong className="is-negative">{r.combined}</strong></div>)}</section></div></section></>}
  </main><style jsx global>{`.combined-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin:28px 0 20px}.combined-heading h2{font-size:22px;font-weight:700;letter-spacing:-.03em}.combined-heading p{margin-top:6px;color:#667085;font-size:13px}.combined-controls{display:flex;gap:12px;align-items:flex-end}.combined-controls>div{min-width:176px}.combined-controls label{display:block;margin-bottom:7px;font-size:11px;color:#667085;font-weight:600}.combined-controls select{height:38px}.combined-grid{display:grid;grid-template-columns:minmax(560px,1.08fr) minmax(390px,.92fr);gap:16px;align-items:start}.combined-table-panel{padding:18px}.combined-table-wrap{height:590px;max-height:590px}.combined-table-panel .analysis-table th:not(:nth-child(2)),.combined-table-panel .analysis-table td:not(:nth-child(2)){text-align:center}.combined-table-panel .analysis-table td:nth-child(2){min-width:220px}.combined-right-stack{display:grid;gap:16px}.combined-grade-chart{height:250px}.combined-rank-panel{padding:16px}.combined-rank-panel h3{font-size:14px;font-weight:700;margin-bottom:8px}.combined-rank-panel .academic-rank-row{padding:9px 0}@media(max-width:1100px){.combined-heading{align-items:flex-start;flex-direction:column}.combined-controls{width:100%}.combined-controls>div{flex:1}.combined-grid{grid-template-columns:1fr}}@media(max-width:700px){.combined-controls{flex-direction:column;align-items:stretch}.combined-controls>div{width:100%}.combined-grid{grid-template-columns:1fr}.combined-table-wrap{height:500px;max-height:500px}}`}</style></div>;
}
