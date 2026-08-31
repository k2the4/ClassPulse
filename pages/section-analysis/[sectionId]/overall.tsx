import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { BarChart3, BookOpen, GraduationCap, LayoutDashboard, RefreshCw } from "lucide-react";
import { BarChart, Bar, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import AnalysisNav from "../../../components/AnalysisNav";
import { RawDataButton } from "../../../components/AnalysisWidgets";

type MarkMode = "basic" | "internal";
type View = "internal" | "risk";
type SortDirection = "none" | "asc" | "desc";

type Subject = { id: string; name: string; code: string };
type SubjectScore = {
  subjectId: string;
  code: string;
  name: string;
  attendance: number;
  midsem1: number;
  midsem2: number;
  combined: number;
  basicInternal: number;
  moderatedInternal: number;
  basicMax: number;
  grade: string;
};
type Student = {
  enrollmentNo: string;
  name: string;
  email: string;
  subjects: SubjectScore[];
  overallPct: number;
  overallAttendance: number;
  overallGrade: string;
};
type OverallData = {
  subjects: Subject[];
  students: Student[];
  classAverageOverallPct: number;
};

const TIER_COLORS: Record<string, string> = {
  Excellent: "#2563eb",
  Good: "#16a34a",
  "Needs Attention": "#f59e0b",
  "Critical Risk": "#ef4444",
};

function tierFor(pct: number) {
  if (pct > 80) return "Excellent";
  if (pct >= 60) return "Good";
  if (pct >= 40) return "Needs Attention";
  return "Critical Risk";
}

function tierClass(tier: string) {
  if (tier === "Excellent") return "bg-blue-50 text-blue-700";
  if (tier === "Good") return "bg-green-50 text-green-700";
  if (tier === "Needs Attention") return "bg-amber-50 text-amber-700";
  return "bg-red-50 text-red-600";
}

function scoreClass(value: number, max: number) {
  const ratio = max > 0 ? value / max : 0;
  if (ratio >= 0.8) return "text-emerald-600";
  if (ratio >= 0.6) return "text-amber-600";
  return "text-red-500";
}

export default function SectionOverallPage() {
  const router = useRouter();
  const { sectionId } = router.query;
  const [data, setData] = useState<OverallData | null>(null);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [computedAt, setComputedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("risk");
  const [markMode, setMarkMode] = useState<MarkMode>("basic");
  const [lower, setLower] = useState(0);
  const [upper, setUpper] = useState(40);
  const [draftLower, setDraftLower] = useState(0);
  const [draftUpper, setDraftUpper] = useState(40);
  const [sortDirection, setSortDirection] = useState<SortDirection>("none");
  const [draftSortDirection, setDraftSortDirection] = useState<SortDirection>("none");

  async function loadAnalysis(sync = false) {
    if (!sectionId || typeof sectionId !== "string") return;
    if (sync) setSyncing(true);
    else setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/analysis/section/${sectionId}/overall${sync ? "?sync=1" : ""}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.detail ? `${json.error}: ${json.detail}` : json.error || "Failed to load overall analysis");
        return;
      }
      setData(json.data);
      setComputedAt(json.computedAt);
      setSheetId(json.sheetId || null);
    } catch (e: any) {
      setError(e.message || "Failed to load overall analysis");
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }

  useEffect(() => {
    loadAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId]);

  const rows = useMemo(() => {
    if (!data) return [];
    return data.students.map((student, originalIndex) => {
      const subjects = data.subjects.map((subject) => {
        const score = student.subjects.find((item) => item.subjectId === subject.id || item.code === subject.code);
        const mark = markMode === "basic" ? Number(score?.basicInternal || 0) : Number(score?.moderatedInternal || 0);
        const max = Number(score?.basicMax || 0);
        return { ...subject, mark, max, pct: max > 0 ? (mark / max) * 100 : 0 };
      });
      const overallPct = subjects.length
        ? subjects.reduce((sum, subject) => sum + subject.pct, 0) / subjects.length
        : 0;
      return {
        ...student,
        originalIndex,
        subjects,
        overallPct,
        tier: tierFor(overallPct),
      };
    });
  }, [data, markMode]);

  const filteredRows = useMemo(() => {
    const lo = Math.min(lower, upper);
    const hi = Math.max(lower, upper);
    const filtered = rows.filter((row) => row.overallPct >= lo && row.overallPct <= hi);
    if (sortDirection === "none") return filtered.sort((a, b) => a.originalIndex - b.originalIndex);
    return filtered.sort((a, b) =>
      sortDirection === "asc"
        ? a.overallPct - b.overallPct || a.name.localeCompare(b.name)
        : b.overallPct - a.overallPct || a.name.localeCompare(b.name)
    );
  }, [rows, lower, upper, sortDirection]);

  const tierCounts = useMemo(() => {
    return rows.reduce((acc, row) => {
      acc[row.tier] = (acc[row.tier] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [rows]);

  const classAverage = useMemo(() => {
    if (!rows.length) return 0;
    return rows.reduce((sum, row) => sum + row.overallPct, 0) / rows.length;
  }, [rows]);

  const topFive = useMemo(
    () => [...rows].sort((a, b) => b.overallPct - a.overallPct || a.originalIndex - b.originalIndex).slice(0, 5),
    [rows]
  );

  const distribution = ["Excellent", "Good", "Needs Attention", "Critical Risk"].map((name) => ({
    name,
    count: tierCounts[name] || 0,
  }));

  function applyFilters() {
    setLower(Math.min(draftLower, draftUpper));
    setUpper(Math.max(draftLower, draftUpper));
    setSortDirection(draftSortDirection);
  }

  function selectDistribution(index: number) {
    const ranges = [
      [80.0001, 100],
      [60, 80],
      [40, 59.9999],
      [0, 39.9999],
    ];
    const range = ranges[index];
    if (!range) return;
    setDraftLower(range[0]);
    setDraftUpper(range[1]);
  }

  return (
    <div className="min-h-screen bg-[#fffdf8] text-[#17223b] lg:flex">
      <aside className="hidden w-[220px] shrink-0 border-r border-[#e8e7e3] bg-white lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:flex-col">
        <div className="px-5 pt-6">
          <a href="/dashboard" className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#39268f] text-white shadow-[0_10px_25px_rgba(57,38,143,0.2)]">
              <BarChart3 size={21} strokeWidth={2.2} />
            </span>
            <span className="text-[20px] font-extrabold tracking-[-0.7px]">ClassPulse</span>
          </a>
        </div>
        <nav className="mt-7 space-y-1 px-3 text-sm font-medium text-[#626b80]">
          <a href="/dashboard" className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-[#f6f4ff] hover:text-[#38258e]"><LayoutDashboard size={18} />Dashboard</a>
          <a href="/class-analysis" className="flex items-center gap-3 rounded-xl bg-[#eeeaff] px-3 py-3 font-semibold text-[#38258e]"><BarChart3 size={18} />Class Analysis</a>
          <a href="/subject-analysis" className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-[#f6f4ff] hover:text-[#38258e]"><BookOpen size={18} />Subject Analysis</a>
        </nav>
        <div className="mt-auto border-t border-[#eeeeeb] px-5 py-5 text-xs text-[#7a8295]">ClassPulse Teacher Portal</div>
      </aside>

      <main className="w-full lg:ml-[220px]">
        <div className="min-h-screen px-5 py-7 sm:px-8 lg:px-10 lg:py-9">
          <div className="mb-5 flex items-start justify-between">
            <div>
              <h1 className="text-[26px] font-extrabold tracking-[-1px] sm:text-[30px]">Class / Section Analysis</h1>
              {computedAt && <p className="mt-1 text-xs text-[#8a92a4]">Last synced {new Date(computedAt).toLocaleString()}</p>}
            </div>
            <div className="flex items-center gap-2">
              <RawDataButton sheetId={sheetId} />
              <button onClick={() => loadAnalysis(true)} disabled={syncing} className="inline-flex items-center gap-2 rounded-xl bg-[#39268f] px-4 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(57,38,143,.18)] disabled:opacity-60">
                <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
                {syncing ? "Syncing..." : "Sync now"}
              </button>
            </div>
          </div>

          {typeof sectionId === "string" && <AnalysisNav sectionId={sectionId} />}

          {error && <div className="mt-5 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
          {loading && !data && <div className="py-12 text-sm text-[#6f7890]">Loading overall analysis...</div>}

          {data && (
            <>
              <div className="mt-5 flex items-center gap-2">
                <button onClick={() => setView("internal")} className={`rounded-xl border px-5 py-3 text-sm font-semibold ${view === "internal" ? "border-[#39268f] bg-[#39268f] text-white shadow-[0_8px_20px_rgba(57,38,143,.18)]" : "border-[#dedfe5] bg-white text-[#667087]"}`}>Internal Marks</button>
                <button onClick={() => setView("risk")} className={`rounded-xl border px-5 py-3 text-sm font-semibold ${view === "risk" ? "border-[#39268f] bg-[#39268f] text-white shadow-[0_8px_20px_rgba(57,38,143,.18)]" : "border-[#dedfe5] bg-white text-[#667087]"}`}>At Risk</button>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-[#e4e4e8] bg-white p-6 shadow-[0_8px_30px_rgba(31,35,49,.04)]"><p className="text-sm text-[#6d7890]">Class Average</p><p className="mt-2 text-[31px] font-extrabold tracking-[-1.5px]">{classAverage.toFixed(1)}%</p><p className="mt-1 text-xs text-[#8b94a6]">across all {data.subjects.length} subjects</p></div>
                <div className="rounded-2xl border border-[#e4e4e8] bg-white p-6 shadow-[0_8px_30px_rgba(31,35,49,.04)]"><p className="text-sm text-[#6d7890]">Students</p><p className="mt-2 text-[31px] font-extrabold tracking-[-1.5px]">{rows.length}</p><p className="mt-1 text-xs text-[#8b94a6]">students assessed</p></div>
                <div className="rounded-2xl border border-[#e4e4e8] bg-white p-6 shadow-[0_8px_30px_rgba(31,35,49,.04)]"><p className="text-sm text-[#6d7890]">Excellent Students</p><p className="mt-2 text-[31px] font-extrabold tracking-[-1.5px]">{tierCounts.Excellent || 0}</p><p className="mt-1 text-xs text-[#8b94a6]">above 80%</p></div>
              </div>

              {view === "risk" ? (
                <>
                  <section className="mt-5 rounded-2xl border border-[#e4e4e8] bg-white p-5 shadow-[0_8px_30px_rgba(31,35,49,.04)]">
                    <h2 className="text-[16px] font-bold">At-Risk Filters</h2>
                    <p className="mt-1 text-xs text-[#8b94a6]">Choose mark type, range and sort.</p>
                    <div className="mt-4 grid gap-3 md:grid-cols-[1.1fr_.7fr_.7fr_1.1fr_auto] md:items-end">
                      <label className="text-xs font-semibold text-[#6f7890]">Marks shown
                        <select value={markMode} onChange={(e) => setMarkMode(e.target.value as MarkMode)} className="mt-2 w-full rounded-xl border border-[#d9dce4] bg-white px-4 py-3 text-sm font-medium text-[#17223b] outline-none focus:border-[#5b4ee6]">
                          <option value="basic">Basic</option>
                          <option value="internal">Internal Marks</option>
                        </select>
                      </label>
                      <label className="text-xs font-semibold text-[#6f7890]">Lower bound<input type="number" value={draftLower} min={0} max={100} onChange={(e) => setDraftLower(Number(e.target.value))} className="mt-2 w-full rounded-xl border border-[#d9dce4] px-4 py-3 text-sm outline-none focus:border-[#5b4ee6]" /></label>
                      <label className="text-xs font-semibold text-[#6f7890]">Upper bound<input type="number" value={draftUpper} min={0} max={100} onChange={(e) => setDraftUpper(Number(e.target.value))} className="mt-2 w-full rounded-xl border border-[#d9dce4] px-4 py-3 text-sm outline-none focus:border-[#5b4ee6]" /></label>
                      <label className="text-xs font-semibold text-[#6f7890]">Sort<select value={draftSortDirection} onChange={(e) => setDraftSortDirection(e.target.value as SortDirection)} className="mt-2 w-full rounded-xl border border-[#d9dce4] bg-white px-4 py-3 text-sm font-medium text-[#17223b] outline-none focus:border-[#5b4ee6]"><option value="none">No sort</option><option value="desc">High to Low</option><option value="asc">Low to High</option></select></label>
                      <button onClick={applyFilters} className="rounded-xl bg-[#39268f] px-5 py-3 text-sm font-semibold text-white">Apply</button>
                    </div>
                  </section>

                  <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
                    <section className="min-w-0 rounded-2xl border border-[#e4e4e8] bg-white p-5 shadow-[0_8px_30px_rgba(31,35,49,.04)]">
                      <div className="mb-3 flex items-center justify-between"><div><h2 className="text-[16px] font-bold">Filtered Students</h2><p className="mt-1 text-xs text-[#8b94a6]">Showing {filteredRows.length} of {rows.length} students.</p></div><span className="rounded-full bg-[#f0edff] px-3 py-1 text-xs font-semibold text-[#5b4ee6]">{data.subjects.length} Subjects</span></div>
                      <div className="max-h-[600px] overflow-auto rounded-xl border border-[#f0f0f2]">
                        <table className="min-w-[1080px] w-full text-sm">
                          <thead className="sticky top-0 z-10 bg-white">
                            <tr className="border-b border-[#ececf0] text-left text-[11px] font-bold uppercase tracking-wide text-[#7c8497]">
                              <th className="px-3 py-3">Enrollment</th><th className="px-3 py-3">Student</th>
                              {data.subjects.map((subject) => <th key={subject.id} className="px-3 py-3 text-center">{subject.code || subject.name}</th>)}
                              <th className="px-3 py-3 text-center">Overall %</th><th className="px-3 py-3">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredRows.map((row) => (
                              <tr key={row.enrollmentNo} className="border-b border-[#f1f1f3] last:border-0">
                                <td className="whitespace-nowrap px-3 py-3 text-xs text-[#7b8497]">{row.enrollmentNo}</td>
                                <td className="whitespace-nowrap px-3 py-3 font-semibold text-[#17223b]">{row.name}</td>
                                {row.subjects.map((subject) => <td key={subject.id} className={`px-3 py-3 text-center font-semibold ${scoreClass(subject.mark, subject.max)}`}>{subject.mark}</td>)}
                                <td className="px-3 py-3 text-center font-bold text-[#17223b]">{row.overallPct.toFixed(1)}%</td>
                                <td className="px-3 py-3"><span className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold ${tierClass(row.tier)}`}>{row.tier}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>

                    <div className="space-y-5">
                      <section className="rounded-2xl border border-[#e4e4e8] bg-white p-5 shadow-[0_8px_30px_rgba(31,35,49,.04)]">
                        <h2 className="text-[16px] font-bold">Distribution</h2><p className="mt-1 text-xs text-[#8b94a6]">Click a segment to stage that score range in the filters.</p>
                        <button className="mt-4 block w-full" onClick={() => undefined} aria-label="Distribution chart">
                          <ResponsiveContainer width="100%" height={240}><BarChart data={distribution} onClick={(state: any) => { if (state?.activeTooltipIndex !== undefined) selectDistribution(state.activeTooltipIndex); }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" fontSize={10} /><YAxis fontSize={11} allowDecimals={false} /><Tooltip /><Bar dataKey="count" radius={[5, 5, 0, 0]}>{distribution.map((item) => <Cell key={item.name} fill={TIER_COLORS[item.name]} />)}</Bar></BarChart></ResponsiveContainer>
                          </ResponsiveContainer>
                        </button>
                      </section>

                      <section className="rounded-2xl border border-[#e4e4e8] bg-white p-5 shadow-[0_8px_30px_rgba(31,35,49,.04)]">
                        <h2 className="text-[16px] font-bold">Top Students</h2><p className="mt-1 text-xs text-[#8b94a6]">Highest scores across all {data.subjects.length} subjects.</p>
                        <div className="mt-3 divide-y divide-[#eeeeef]">
                          {topFive.map((student) => <div key={student.enrollmentNo} className="flex items-center justify-between py-3"><span className="text-sm font-semibold text-[#17223b]">{student.name}</span><span className="font-bold text-emerald-600">{student.overallPct.toFixed(1)}%</span></div>)}
                        </div>
                      </section>
                    </div>
                  </div>
                </>
              ) : (
                <section className="mt-5 rounded-2xl border border-[#e4e4e8] bg-white p-5 shadow-[0_8px_30px_rgba(31,35,49,.04)]">
                  <div className="mb-3"><h2 className="text-[16px] font-bold">Internal Marks</h2><p className="mt-1 text-xs text-[#8b94a6]">Internal marks for all students across all {data.subjects.length} subjects.</p></div>
                  <div className="max-h-[600px] overflow-auto rounded-xl border border-[#f0f0f2]"><table className="min-w-[1080px] w-full text-sm"><thead className="sticky top-0 z-10 bg-white"><tr className="border-b border-[#ececf0] text-left text-[11px] font-bold uppercase tracking-wide text-[#7c8497]"><th className="px-3 py-3">Enrollment</th><th className="px-3 py-3">Student</th>{data.subjects.map((subject) => <th key={subject.id} className="px-3 py-3 text-center">{subject.code || subject.name}</th>)}<th className="px-3 py-3 text-center">Overall %</th><th className="px-3 py-3">Grade</th></tr></thead><tbody>{rows.map((row) => <tr key={row.enrollmentNo} className="border-b border-[#f1f1f3] last:border-0"><td className="px-3 py-3 text-xs text-[#7b8497]">{row.enrollmentNo}</td><td className="px-3 py-3 font-semibold">{row.name}</td>{row.subjects.map((subject) => <td key={subject.id} className={`px-3 py-3 text-center font-semibold ${scoreClass(subject.mark, subject.max)}`}>{subject.mark}</td>)}<td className="px-3 py-3 text-center font-bold">{row.overallPct.toFixed(1)}%</td><td className="px-3 py-3"><span className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold ${tierClass(row.tier)}`}>{row.tier}</span></td></tr>)}</tbody></table></div>
                </section>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
