import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { BarChart3, BookOpen, GraduationCap, LayoutDashboard, RefreshCw } from "lucide-react";
import SubjectAnalysisNav from "../../../components/SubjectAnalysisNav";
import { RawDataButton } from "../../../components/AnalysisWidgets";
import { SubjectAnalysis } from "../../../lib/analysis";

type Tier = "Excellent" | "Good" | "Needs Attention" | "Critical Risk";
type Exam = "combined" | "midsem1" | "midsem2" | "max";
const TIERS: Tier[] = ["Excellent", "Good", "Needs Attention", "Critical Risk"];
const MAX = 30;

function tierFor(marks: number): Tier {
  const pct = (marks / MAX) * 100;
  if (pct >= 80) return "Excellent";
  if (pct >= 60) return "Good";
  if (pct >= 40) return "Needs Attention";
  return "Critical Risk";
}

function tierClass(tier: Tier) {
  return tier === "Excellent" ? "excellent" : tier === "Good" ? "good" : tier === "Needs Attention" ? "attention" : "risk";
}

export default function SubjectAcademicSummaryPage() {
  const router = useRouter();
  const { subjectId } = router.query;
  const [data, setData] = useState<SubjectAnalysis | null>(null);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [computedAt, setComputedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [exam, setExam] = useState<Exam>("combined");
  const [tier, setTier] = useState<Tier | "all">("all");
  const [lower, setLower] = useState("0");
  const [upper, setUpper] = useState("30");
  const [sort, setSort] = useState<"none" | "desc" | "asc">("none");

  async function loadAnalysis(sync = false) {
    if (!subjectId || typeof subjectId !== "string") return;
    sync ? setSyncing(true) : setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/analysis/subject/${subjectId}${sync ? "?sync=1" : ""}`);
      const json = await response.json();
      if (!response.ok) throw new Error(json.detail ? `${json.error}: ${json.detail}` : json.error || "Failed to load academic summary");
      setData(json.data);
      setComputedAt(json.computedAt || "");
      setSheetId(json.sheetId || null);
    } catch (e: any) {
      setError(e.message || "Failed to load academic summary");
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }

  useEffect(() => { loadAnalysis(); }, [subjectId]);

  const students = data?.students || [];
  const rows = useMemo(() => {
    const mapped = students.map((student: any, index: number) => {
      const marks = exam === "midsem1" ? Number(student.midsem?.first || 0) : exam === "midsem2" ? Number(student.midsem?.second || 0) : exam === "max" ? Number(student.midsem?.max || 0) : Number(student.midsem?.combined || 0);
      return { sno: index + 1, enrollmentNo: student.enrollmentNo, name: student.name, marks, tier: tierFor(marks) };
    });
    const lo = Number(lower);
    const hi = Number(upper);
    const filtered = mapped.filter((row) => row.marks >= (Number.isFinite(lo) ? lo : 0) && row.marks <= (Number.isFinite(hi) ? hi : MAX) && (tier === "all" || row.tier === tier));
    if (sort === "desc") filtered.sort((a, b) => b.marks - a.marks || a.name.localeCompare(b.name));
    if (sort === "asc") filtered.sort((a, b) => a.marks - b.marks || a.name.localeCompare(b.name));
    return filtered;
  }, [students, exam, tier, lower, upper, sort]);

  const combinedMarks = students.map((s: any) => Number(s.midsem?.combined || 0));
  const average = combinedMarks.length ? Math.round(combinedMarks.reduce((a, b) => a + b, 0) / combinedMarks.length * 10) / 10 : 0;
  const highest = combinedMarks.length ? Math.max(...combinedMarks) : 0;
  const passRate = combinedMarks.length ? Math.round(combinedMarks.filter((m) => m >= 12).length / combinedMarks.length * 100) : 0;
  const midsem1Average = students.length ? Math.round(students.reduce((sum, s: any) => sum + Number(s.midsem?.first || 0), 0) / students.length * 10) / 10 : 0;
  const midsem2Average = students.length ? Math.round(students.reduce((sum, s: any) => sum + Number(s.midsem?.second || 0), 0) / students.length * 10) / 10 : 0;
  const increases = [...students].map((s: any) => ({ name: s.name, enrollmentNo: s.enrollmentNo, change: Math.round((Number(s.midsem?.second || 0) - Number(s.midsem?.first || 0)) * 10) / 10 })).filter((r) => r.change > 0).sort((a, b) => b.change - a.change).slice(0, 5);
  const decreases = [...students].map((s: any) => ({ name: s.name, enrollmentNo: s.enrollmentNo, change: Math.round((Number(s.midsem?.second || 0) - Number(s.midsem?.first || 0)) * 10) / 10 })).filter((r) => r.change < 0).sort((a, b) => a.change - b.change).slice(0, 5);
  const highestName = students.find((s: any) => Number(s.midsem?.combined || 0) === highest)?.name || "—";

  return (
    <div className="summary-page">
      <aside className="summary-sidebar">
        <div className="summary-brand"><span><BarChart3 size={18} /></span><strong>ClassPulse</strong></div>
        <nav>
          <a href="/dashboard"><LayoutDashboard size={18} />Dashboard</a>
          <a href="/classes"><BookOpen size={18} />Class Analysis</a>
          <a className="active" href={typeof subjectId === "string" ? `/subject-analysis/${subjectId}/summary` : "#"}><GraduationCap size={18} />Subject Analysis</a>
        </nav>
        <RawDataButton sheetId={sheetId} />
        <div className="summary-footer">ClassPulse Teacher Portal</div>
      </aside>

      <main className="summary-content">
        <header className="summary-topbar">
          <div><h1>Subject Analysis</h1>{computedAt && <span>• Last synced {new Date(computedAt).toLocaleString()}</span>}</div>
          <button onClick={() => loadAnalysis(true)} disabled={syncing}><RefreshCw size={15} className={syncing ? "spin" : ""} />{syncing ? "Syncing..." : "Sync now"}</button>
        </header>
        {typeof subjectId === "string" && <SubjectAnalysisNav subjectId={subjectId} />}

        {error && <div className="summary-error">{error}</div>}
        {loading && !data && <div className="summary-loading">Loading academic summary...</div>}

        {data && <>
          <section className="summary-heading"><h2>Academic Summary</h2><p>One subject, one marks column, and one performance tier for every student.</p></section>

          <section className="summary-filter">
            <div className="filter-head"><div><h3>Filter Criteria</h3><p>Narrow the student list by examination, performance tier, marks range, and order.</p></div><button onClick={() => { setExam("combined"); setTier("all"); setLower("0"); setUpper("30"); setSort("none"); }}>Reset</button></div>
            <div className="filter-grid">
              <label>Exam<select value={exam} onChange={(e) => setExam(e.target.value as Exam)}><option value="combined">Combined</option><option value="midsem1">Midsem 1</option><option value="midsem2">Midsem 2</option><option value="max">Max</option></select></label>
              <label>Performance Tier<select value={tier} onChange={(e) => setTier(e.target.value as Tier | "all")}><option value="all">All Tiers</option>{TIERS.map((t) => <option key={t}>{t}</option>)}</select></label>
              <label>Lower Bound<input type="number" min="0" max="30" value={lower} onChange={(e) => setLower(e.target.value)} /></label>
              <label>Upper Bound<input type="number" min="0" max="30" value={upper} onChange={(e) => setUpper(e.target.value)} /></label>
              <label>Sort<select value={sort} onChange={(e) => setSort(e.target.value as "none" | "desc" | "asc")}><option value="none">No Sort</option><option value="desc">High to Low</option><option value="asc">Low to High</option></select></label>
            </div>
          </section>

          <section className="metrics">
            <div><span>Overall Class Average</span><strong>{average}</strong><small>combined average</small></div>
            <div><span>Highest Combined Score</span><strong>{highest}</strong><small>{highestName}</small></div>
            <div><span>Overall Pass Rate</span><strong>{passRate}%</strong><small>students scoring 12 or more</small></div>
            <div><span>Midsem 1 Average</span><strong>{midsem1Average}</strong><small>out of 30 marks</small></div>
            <div><span>Midsem 2 Average</span><strong>{midsem2Average}</strong><small>out of 30 marks</small></div>
          </section>

          <section className="summary-layout">
            <section className="student-panel">
              <div className="panel-head"><div><h3>Filtered Students</h3><p>Showing {rows.length} of {students.length} students</p></div><span>{rows.length} Students</span></div>
              <div className="table-wrap"><table><thead><tr><th>S.No.</th><th>Enrollment No.</th><th>Student</th><th>Marks</th><th>Tier</th></tr></thead><tbody>
                {rows.map((row) => <tr key={row.enrollmentNo}><td>{row.sno}</td><td>{row.enrollmentNo}</td><td>{row.name}</td><td className={`mark ${tierClass(row.tier)}`}><strong>{row.marks}</strong></td><td><button className={`tier ${tierClass(row.tier)}`} onClick={() => setTier(tier === row.tier ? "all" : row.tier)}>{row.tier}</button></td></tr>)}
                {!rows.length && <tr><td colSpan={5} className="empty">No students match these filters.</td></tr>}
              </tbody></table></div>
            </section>

            <div className="side-cards">
              <section><h3>Marks Increase (Top 5)</h3><p>Students whose Midsem 2 score improved.</p>{increases.length ? increases.map((r, i) => <div className="rank" key={r.enrollmentNo}><span>{i + 1}.</span><b>{r.name}</b><strong>+{r.change}</strong></div>) : <div className="empty">No increases.</div>}</section>
              <section><h3>Marks Decrease (Top 5)</h3><p>Students whose Midsem 2 score fell.</p>{decreases.length ? decreases.map((r, i) => <div className="rank" key={r.enrollmentNo}><span>{i + 1}.</span><b>{r.name}</b><strong>{r.change}</strong></div>) : <div className="empty">No decreases.</div>}</section>
            </div>
          </section>
        </>}
      </main>

      <style jsx global>{`
        .summary-page{min-height:100vh;background:linear-gradient(135deg,#faf9f7,#f4f7fb);color:#172b4d;font-family:inherit;display:flex}.summary-sidebar{width:178px;flex-shrink:0;background:#fff;border-right:1px solid #e4e7ec;min-height:100vh;display:flex;flex-direction:column}.summary-brand{height:68px;display:flex;align-items:center;gap:9px;padding:0 20px;font-size:15px}.summary-brand span{width:32px;height:32px;border-radius:9px;background:#37258a;color:#fff;display:grid;place-items:center}.summary-sidebar nav{padding:8px 10px;display:grid;gap:4px}.summary-sidebar nav a{height:38px;border-radius:9px;display:flex;align-items:center;gap:10px;padding:0 12px;color:#667085;text-decoration:none;font-size:12px}.summary-sidebar nav a.active{background:#eeeafa;color:#38258e;font-weight:700}.summary-footer{margin-top:auto;border-top:1px solid #e4e7ec;padding:16px 20px 22px;color:#8491a5;font-size:10px}.summary-content{flex:1;min-width:0;padding:0 26px 28px}.summary-topbar{height:68px;display:flex;align-items:center;justify-content:space-between}.summary-topbar h1{display:inline;font-size:20px;margin:0}.summary-topbar span{font-size:10px;color:#98a2b3;margin-left:6px}.summary-topbar button{height:36px;border:0;border-radius:9px;background:linear-gradient(135deg,#251b62,#4637a3);color:#fff;padding:0 15px;font-weight:700;display:flex;align-items:center;gap:8px}.spin{animation:summary-spin 1s linear infinite}@keyframes summary-spin{to{transform:rotate(360deg)}}.summary-heading{margin:24px 0 17px}.summary-heading h2{margin:0;font-size:21px}.summary-heading p{margin:5px 0 0;color:#667085;font-size:12px}.summary-filter,.student-panel,.side-cards section,.metrics>div{background:rgba(255,255,255,.84);border:1px solid #dfe5ec;border-radius:16px;box-shadow:0 2px 10px rgba(31,41,55,.025)}.summary-filter{padding:17px;margin-bottom:16px}.filter-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:15px}.filter-head h3{margin:0;font-size:13px}.filter-head p{margin:4px 0 0;color:#98a2b3;font-size:10px}.filter-head button{height:34px;background:#fff;border:1px solid #d8e0ea;border-radius:9px;padding:0 13px;color:#344054}.filter-grid{display:grid;grid-template-columns:1.1fr 1.1fr .8fr .8fr 1fr;gap:11px}.filter-grid label{font-size:10px;color:#667085;font-weight:600}.filter-grid select,.filter-grid input{display:block;width:100%;box-sizing:border-box;height:39px;margin-top:6px;border:1px solid #d8e0ea;border-radius:9px;background:#fff;padding:0 11px;color:#344054;font-size:12px;outline:0}.metrics{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin-bottom:16px}.metrics>div{padding:15px 16px;min-height:68px}.metrics>div:nth-child(1){border-top:3px solid #4d75d0}.metrics>div:nth-child(2){border-top:3px solid #15966a}.metrics>div:nth-child(3){border-top:3px solid #f59e0b}.metrics>div:nth-child(4){border-top:3px solid #4d75d0}.metrics>div:nth-child(5){border-top:3px solid #15966a}.metrics span,.metrics small{display:block;color:#667085;font-size:10px}.metrics strong{display:block;font-size:22px;line-height:1.2;margin:5px 0 2px}.metrics small{color:#98a2b3}.summary-layout{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(340px,.8fr);gap:16px;align-items:start}.student-panel{overflow:hidden}.panel-head{padding:13px 14px 10px;display:flex;justify-content:space-between;align-items:flex-start}.panel-head h3{margin:0;font-size:13px}.panel-head p{margin:4px 0 0;color:#98a2b3;font-size:10px}.panel-head>span{font-size:10px;color:#667085;background:#f5f7fa;border-radius:999px;padding:5px 8px}.table-wrap{max-height:560px;overflow:auto}.table-wrap table{width:100%;border-collapse:collapse;table-layout:fixed}.table-wrap th,.table-wrap td{height:35px;padding:0 12px;border-top:1px solid #edf0f4;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.table-wrap th{height:31px;text-align:left;color:#667085;font-size:9px}.table-wrap th:nth-child(1),.table-wrap td:nth-child(1){width:8%;text-align:center}.table-wrap th:nth-child(2),.table-wrap td:nth-child(2){width:24%;text-align:left}.table-wrap th:nth-child(3),.table-wrap td:nth-child(3){width:34%;text-align:left}.table-wrap th:nth-child(4),.table-wrap td:nth-child(4){width:14%;text-align:center}.table-wrap th:nth-child(5),.table-wrap td:nth-child(5){width:20%;text-align:center}.mark.excellent{color:#4d75d0}.mark.good{color:#15966a}.mark.attention{color:#f59e0b}.mark.risk{color:#ef4444}.tier{border:0;background:transparent;font-size:9px;font-weight:700;cursor:pointer;padding:4px 8px;border-radius:999px}.tier.excellent{background:#eef3ff;color:#4d75d0}.tier.good{background:#eaf8f2;color:#15966a}.tier.attention{background:#fff6df;color:#d58a00}.tier.risk{background:#fff0f0;color:#ef4444}.side-cards{display:grid;gap:16px}.side-cards section{padding:18px}.side-cards h3{margin:0;font-size:14px}.side-cards p{margin:5px 0 12px;color:#98a2b3;font-size:10px}.rank{display:grid;grid-template-columns:22px 1fr auto;align-items:center;gap:7px;min-height:31px;border-top:1px solid #edf0f4;font-size:10px}.rank span{color:#667085}.rank b{font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rank strong{color:#15966a}.side-cards section:nth-child(2) .rank strong{color:#ef4444}.empty{text-align:center;padding:20px;color:#98a2b3;font-size:11px}.summary-error{margin-top:18px;padding:14px;border:1px solid #f3c4c0;border-radius:10px;background:#fff6f5;color:#b42318}.summary-loading{padding:40px;color:#667085;font-size:13px}@media(max-width:1000px){.filter-grid,.metrics{grid-template-columns:1fr 1fr}.summary-layout{grid-template-columns:1fr}.summary-sidebar{width:150px}}@media(max-width:700px){.summary-sidebar{display:none}.summary-content{padding:0 14px}.filter-grid,.metrics{grid-template-columns:1fr}}
      `}</style>
    </div>
  );
}
