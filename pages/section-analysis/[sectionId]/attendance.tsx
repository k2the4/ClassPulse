import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Gauge, Info, SlidersHorizontal, Sparkles, UsersRound } from "lucide-react";

import AnalysisNav from "../../../components/AnalysisNav";
import { SectionAnalysis } from "../../../lib/analysisClass";

type AttendanceView = "trend" | "risk" | "summary";

const TREND_COLORS = ["#14a66a", "#ef4444", "#5278c9"];
const ATTENDANCE_COLORS = ["#ef4444", "#f97316", "#f59e0b", "#16a66a"];

export default function AttendancePage() {
  const router = useRouter();
  const { sectionId } = router.query;

  const [view, setView] = useState<AttendanceView>("trend");
  const [data, setData] = useState<SectionAnalysis | null>(null);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [computedAt, setComputedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  const [previousMonth, setPreviousMonth] = useState("");
  const [currentMonth, setCurrentMonth] = useState("");
  const [trendCriteria, setTrendCriteria] = useState(5);

  const [lowerBound, setLowerBound] = useState(0);
  const [upperBound, setUpperBound] = useState(100);
  const [riskTrendFilter, setRiskTrendFilter] = useState("All");
  const [riskMonth, setRiskMonth] = useState<"previous" | "current">("current");
  const [copied, setCopied] = useState(false);

  async function loadAnalysis(selectedPrevious?: string, selectedCurrent?: string, criteria?: number) {
    if (!sectionId || typeof sectionId !== "string") return;

    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (selectedPrevious) params.set("previousMonth", selectedPrevious);
      if (selectedCurrent) params.set("currentMonth", selectedCurrent);
      if (criteria !== undefined) params.set("trendCriteria", String(criteria));

      const query = params.toString();
      const res = await fetch(`/api/analysis/section/${sectionId}${query ? `?${query}` : ""}`);
      const json = await res.json();

      if (!res.ok) {
        setError(json.detail ? `${json.error}: ${json.detail}` : json.error || "Failed to load attendance analysis");
        return;
      }

      setData(json.data);
      setComputedAt(json.computedAt);
      setSheetId(json.sheetId || null);

      if (json.data?.monthsUsed) {
        if (!previousMonth && json.data.monthsUsed.previous) setPreviousMonth(json.data.monthsUsed.previous);
        if (!currentMonth && json.data.monthsUsed.current) setCurrentMonth(json.data.monthsUsed.current);
      }
    } catch (e: any) {
      setError(e.message || "Failed to load attendance analysis");
    } finally {
      setLoading(false);
    }
  }

  async function syncAnalysis() {
    if (!sectionId || typeof sectionId !== "string") return;

    setSyncing(true);
    setError("");

    try {
      const params = new URLSearchParams({
        sync: "1",
        previousMonth,
        currentMonth,
        trendCriteria: String(trendCriteria),
      });

      const res = await fetch(`/api/analysis/section/${sectionId}?${params.toString()}`);
      const json = await res.json();

      if (!res.ok) {
        setError(json.detail ? `${json.error}: ${json.detail}` : json.error || "Failed to sync analysis");
        return;
      }

      setData(json.data);
      setComputedAt(json.computedAt);
      setSheetId(json.sheetId || null);
    } catch (e: any) {
      setError(e.message || "Failed to sync analysis");
    } finally {
      setSyncing(false);
    }
  }

  function applyTrendSettings() {
    loadAnalysis(previousMonth, currentMonth, trendCriteria);
  }

  useEffect(() => {
    loadAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId]);

  const availableMonths = data?.availableMonths || [];

  const trendData = data
    ? [
        { name: "Increasing", count: data.trendCounts?.increasing || 0 },
        { name: "Decreasing", count: data.trendCounts?.decreasing || 0 },
        { name: "Stable", count: data.trendCounts?.stable || 0 },
      ]
    : [];

  const attendanceBuckets = data?.attendanceBuckets ?? {
    below30: 0,
    to49: 0,
    to74: 0,
    above75: 0,
  };

  const attendanceDistribution = data
    ? [
        { name: "Below 30%", count: attendanceBuckets.below30 },
        { name: "30% to 49%", count: attendanceBuckets.to49 },
        { name: "50% to 74%", count: attendanceBuckets.to74 },
        { name: "75% and above", count: attendanceBuckets.above75 },
      ]
    : [];

  const riskResults = useMemo(() => {
    if (!data) return [];
    return data.students.filter((s: any) => {
      const pct = riskMonth === "current" ? s.attendancePct?.currMonth ?? 0 : s.attendancePct?.prevMonth ?? 0;
      const inBounds = pct >= lowerBound && pct <= upperBound;
      const trendMatches = riskTrendFilter === "All" || (s.attendancePct?.trend || "Stable") === riskTrendFilter;
      return inBounds && trendMatches;
    });
  }, [data, lowerBound, upperBound, riskTrendFilter, riskMonth]);

  const riskEmails = riskResults.map((s: any) => s.email).filter(Boolean);
  const riskEmailsText = riskEmails.join("; ");

  async function copyEmails() {
    try {
      await navigator.clipboard.writeText(riskEmailsText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // The textarea remains selectable if clipboard access is unavailable.
    }
  }

  const mailtoHref = `mailto:?bcc=${encodeURIComponent(riskEmails.join(","))}&subject=${encodeURIComponent(
    "Attendance Alert"
  )}&body=${encodeURIComponent(
    "This is a reminder regarding your recent attendance. Please make sure to attend upcoming classes."
  )}`;

  const topMovers = useMemo(() => {
    if (!data) return { improved: [], declined: [] };
    const withChange = data.students.map((s: any) => ({
      name: s.name,
      change: round1((s.attendancePct?.currMonth ?? 0) - (s.attendancePct?.prevMonth ?? 0)),
    }));
    const sorted = [...withChange].sort((a, b) => b.change - a.change);
    return {
      improved: sorted.slice(0, 5),
      declined: [...sorted].reverse().slice(0, 5),
    };
  }, [data]);

  function round1(n: number) {
    return Math.round(n * 10) / 10;
  }

  const donutData = data
    ? [
        { name: "Good Standing (75%+)", value: attendanceBuckets.above75, color: "#16a66a" },
        { name: "Satisfactory (50-74%)", value: attendanceBuckets.to74, color: "#5278c9" },
        { name: "Needs Attention (30-49%)", value: attendanceBuckets.to49, color: "#f59e0b" },
        { name: "Critical Risk (<30%)", value: attendanceBuckets.below30, color: "#ef4444" },
      ]
    : [];

  const compareBarData = data
    ? [
        { name: data.monthsUsed?.previous || "Previous", value: data.classAveragePrevMonth },
        { name: data.monthsUsed?.current || "Current", value: data.classAverageCurrMonth },
      ]
    : [];

  const classAverageChange = data ? round1(data.classAverageCurrMonth - data.classAveragePrevMonth) : 0;
  const improvingStudents = data?.trendCounts?.increasing ?? 0;
  const totalStudents = data?.totalStudents ?? data?.students?.length ?? 0;

  return (
    <div className="classpulse-attendance-page min-h-screen text-[#17223b]">
      <div className="mx-auto w-full max-w-[1180px]">
        <header className="mb-5 flex items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[20px] font-bold tracking-[-0.4px] text-[#17223b]">Class / Section Analysis</h1>
              {computedAt && <span className="text-xs text-[#8991a2]">• Last synced {new Date(computedAt).toLocaleString()}</span>}
            </div>
          </div>
          <button
            onClick={syncAnalysis}
            disabled={syncing}
            className="shrink-0 rounded-xl bg-[#3b2992] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(59,41,146,.18)] transition hover:bg-[#30227d] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {syncing ? "Syncing..." : "Sync now"}
          </button>
        </header>

        {typeof sectionId === "string" && <AnalysisNav sectionId={sectionId} />}

        <div className="mb-7 flex gap-2">
          {(["trend", "risk", "summary"] as AttendanceView[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                view === v
                  ? "bg-[#3b2992] text-white shadow-[0_7px_18px_rgba(59,41,146,.18)]"
                  : "border border-transparent bg-[#f1f0f3] text-[#626b80] hover:bg-[#e9e6f5] hover:text-[#38258e]"
              }`}
            >
              {v === "risk" ? "At Risk" : v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>

        {error && <div className="mb-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {loading && !data && <div className="rounded-2xl border border-[#e1e3ea] bg-white p-8 text-sm text-[#6f7890]">Loading attendance analysis...</div>}

        {data && view === "trend" && (
          <>
            <section className="mb-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-[560px]">
                <h2 className="text-[25px] font-extrabold tracking-[-0.7px] text-[#17223b]">Attendance Trend</h2>
                <p className="mt-2 text-sm leading-6 text-[#6f7890]">
                  Compare attendance between two months and identify increasing, decreasing, and stable students.
                </p>
              </div>
              <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3 lg:w-[650px]">
                <div className="rounded-2xl border border-[#dfe2e8] bg-white px-5 py-4 shadow-[0_7px_24px_rgba(31,35,49,.045)]">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-[#f0edff] text-[#5b4ee6]"><UsersRound size={19} /></span>
                    <div><p className="text-xs font-medium text-[#626b80]">Class Average ({data.monthsUsed?.previous || "Previous"})</p><p className="mt-1 text-[25px] font-extrabold leading-none text-[#17223b]">{data.classAveragePrevMonth}%</p></div>
                  </div>
                </div>
                <div className="rounded-2xl border border-[#dfe2e8] bg-white px-5 py-4 shadow-[0_7px_24px_rgba(31,35,49,.045)]">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-[#f0edff] text-[#5b4ee6]"><Gauge size={19} /></span>
                    <div><p className="text-xs font-medium text-[#626b80]">Class Average ({data.monthsUsed?.current || "Current"})</p><p className="mt-1 text-[25px] font-extrabold leading-none text-[#17223b]">{data.classAverageCurrMonth}% <span className={`ml-1 text-xs font-bold ${classAverageChange >= 0 ? "text-[#10a66a]" : "text-red-500"}`}>{classAverageChange > 0 ? "+" : ""}{classAverageChange}%</span></p></div>
                  </div>
                </div>
                <div className="rounded-2xl border border-[#dfe2e8] bg-white px-5 py-4 shadow-[0_7px_24px_rgba(31,35,49,.045)]">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-[#f0edff] text-[#5b4ee6]"><Sparkles size={19} /></span>
                    <div><p className="text-xs font-medium text-[#626b80]">Students Improving</p><p className="mt-1 text-[25px] font-extrabold leading-none text-[#17223b]">{improvingStudents}</p><p className="mt-1 text-[11px] text-[#8991a2]">{totalStudents ? round1((improvingStudents / totalStudents) * 100) : 0}% of total students</p></div>
                  </div>
                </div>
              </div>
            </section>

            <section className="mb-5 rounded-[18px] border border-[#dfe2e8] bg-white p-5 shadow-[0_8px_28px_rgba(31,35,49,.055)] sm:p-6">
              <h3 className="text-sm font-bold text-[#17223b]">Trend Comparison Settings</h3>
              <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1fr_1fr_1.05fr] lg:items-end">
                <div>
                  <label className="mb-2 block text-xs font-medium text-[#626b80]">First Month</label>
                  <select value={previousMonth} onChange={(e) => setPreviousMonth(e.target.value)} className="w-full rounded-xl border border-[#dfe2e8] bg-white px-3.5 py-2.5 text-sm text-[#17223b] outline-none transition focus:border-[#6b5be7] focus:ring-2 focus:ring-[#6b5be7]/10">
                    <option value="">Select month</option>
                    {availableMonths.map((m: string) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-medium text-[#626b80]">Second Month</label>
                  <select value={currentMonth} onChange={(e) => setCurrentMonth(e.target.value)} className="w-full rounded-xl border border-[#dfe2e8] bg-white px-3.5 py-2.5 text-sm text-[#17223b] outline-none transition focus:border-[#6b5be7] focus:ring-2 focus:ring-[#6b5be7]/10">
                    <option value="">Select month</option>
                    {availableMonths.map((m: string) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-medium text-[#626b80]">Trend Criteria (%)</label>
                  <input type="number" min="0" max="100" value={trendCriteria} onChange={(e) => setTrendCriteria(Number(e.target.value))} className="w-full rounded-xl border border-[#dfe2e8] px-3.5 py-2.5 text-sm text-[#17223b] outline-none transition focus:border-[#6b5be7] focus:ring-2 focus:ring-[#6b5be7]/10" />
                </div>
                <button onClick={applyTrendSettings} disabled={!previousMonth || !currentMonth || previousMonth === currentMonth} className="flex items-center justify-center gap-2 rounded-xl bg-[#3b2992] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_7px_18px_rgba(59,41,146,.18)] transition hover:bg-[#30227d] disabled:cursor-not-allowed disabled:opacity-40"><SlidersHorizontal size={16} /> Apply Comparison</button>
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-[#dce7fb] bg-[#f8fbff] px-3.5 py-2.5 text-xs text-[#5d6d87]"><Info size={15} className="shrink-0 text-[#617aa8]" /> Trend calculation: a change of <span className="font-bold text-[#34445f]">±{trendCriteria} percentage points</span> or more is Increasing or Decreasing.</div>
            </section>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.03fr_.97fr]">
              <section className="rounded-[18px] border border-[#dfe2e8] bg-white p-5 shadow-[0_8px_28px_rgba(31,35,49,.055)] sm:p-6">
                <div className="mb-4 flex items-center justify-between gap-4"><div className="flex items-center gap-3"><h3 className="text-sm font-bold text-[#17223b]">Student Trend Analysis</h3><span className="rounded-full bg-[#f0edff] px-2.5 py-1 text-[10px] font-semibold text-[#5b4ee6]">{totalStudents} Students</span></div></div>
                <div className="max-h-[600px] overflow-y-auto pr-1">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-white"><tr className="border-b border-[#e7e8ec] text-left text-[11px] font-semibold text-[#8991a2]"><th className="py-3 pr-3">Student Name</th><th className="py-3 pr-3">{data.monthsUsed?.previous || "Month 1"}</th><th className="py-3 pr-3">{data.monthsUsed?.current || "Month 2"}</th><th className="py-3 pr-3">Change</th><th className="py-3">Trend</th></tr></thead>
                    <tbody>
                      {data.students.map((student: any) => {
                        const previous = student.attendancePct?.prevMonth ?? 0;
                        const current = student.attendancePct?.currMonth ?? 0;
                        const change = round1(current - previous);
                        const trend = student.attendancePct?.trend || "Stable";
                        const initials = String(student.name || "S").split(" ").filter(Boolean).slice(0, 2).map((part: string) => part[0]).join("").toUpperCase();
                        return <tr key={student.enrollmentNo} className="border-b border-[#f0f1f4] last:border-0"><td className="py-3 pr-3"><div className="flex items-center gap-2.5"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#f0edff] text-[10px] font-bold text-[#5b4ee6]">{initials}</span><span className="whitespace-nowrap font-medium text-[#17223b]">{student.name}</span></div></td><td className="py-3 pr-3 text-[#6f7890]">{previous}%</td><td className="py-3 pr-3 text-[#6f7890]">{current}%</td><td className={`py-3 pr-3 font-bold ${change > 0 ? "text-[#10a66a]" : change < 0 ? "text-red-500" : "text-[#8991a2]"}`}>{change > 0 ? "+" : ""}{change}%</td><td className="py-3"><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${trend === "Increasing" ? "bg-[#e8f8f1] text-[#0d9960]" : trend === "Decreasing" ? "bg-[#fff0f0] text-[#e23c3c]" : "bg-[#f1f3f6] text-[#687286]"}`}>{trend === "Decreasing" ? "↓ " : trend === "Increasing" ? "↑ " : "– "}{trend}</span></td></tr>;
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              <div className="space-y-5">
                <section className="rounded-[18px] border border-[#dfe2e8] bg-white p-5 shadow-[0_8px_28px_rgba(31,35,49,.055)] sm:p-6"><h3 className="text-base font-medium text-[#17223b]">Trend Distribution</h3><p className="mt-1 text-[11px] text-[#8991a2]">Click a column to inspect the students in that trend.</p><div className="mt-3"><ResponsiveContainer width="100%" height={235}><BarChart data={trendData} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d9dce2" /><XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={{ stroke: "#8b9099" }} /><YAxis fontSize={11} allowDecimals={false} tickLine={false} axisLine={{ stroke: "#8b9099" }} /><Tooltip /><Bar dataKey="count" radius={[4, 4, 0, 0]}>{trendData.map((entry, index) => <Cell key={`trend-${entry.name}`} fill={TREND_COLORS[index]} />)}</Bar></BarChart></ResponsiveContainer></div></section>
                <section className="rounded-[18px] border border-[#dfe2e8] bg-white p-5 shadow-[0_8px_28px_rgba(31,35,49,.055)] sm:p-6"><h3 className="text-base font-medium text-[#17223b]">Attendance Distribution</h3><p className="mt-1 text-[11px] text-[#8991a2]">Attendance ranges for the selected current month.</p><div className="mt-3"><ResponsiveContainer width="100%" height={235}><BarChart data={attendanceDistribution} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d9dce2" /><XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={{ stroke: "#8b9099" }} /><YAxis fontSize={11} allowDecimals={false} tickLine={false} axisLine={{ stroke: "#8b9099" }} /><Tooltip /><Bar dataKey="count" radius={[4, 4, 0, 0]}>{attendanceDistribution.map((entry, index) => <Cell key={`attendance-${entry.name}`} fill={ATTENDANCE_COLORS[index]} />)}</Bar></BarChart></ResponsiveContainer></div></section>
              </div>
            </div>
          </>
        )}

        {data && view === "risk" && (
          <>
            <section className="mb-5"><h2 className="text-[25px] font-extrabold tracking-[-0.7px] text-[#17223b]">At Risk Students</h2><p className="mt-2 text-sm leading-6 text-[#6f7890]">Filter students by attendance range and trend, then copy or email the list directly.</p></section>
            <section className="mb-5 rounded-[18px] border border-[#dfe2e8] bg-white p-5 shadow-[0_8px_28px_rgba(31,35,49,.055)] sm:p-6"><h3 className="text-sm font-bold text-[#17223b]">Filter Criteria</h3><div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4"><div><label className="mb-2 block text-xs font-medium text-[#626b80]">Lower Bound (%)</label><input type="number" min="0" max="100" value={lowerBound} onChange={(e) => setLowerBound(Number(e.target.value))} className="w-full rounded-xl border border-[#dfe2e8] px-3.5 py-2.5 text-sm" /></div><div><label className="mb-2 block text-xs font-medium text-[#626b80]">Upper Bound (%)</label><input type="number" min="0" max="100" value={upperBound} onChange={(e) => setUpperBound(Number(e.target.value))} className="w-full rounded-xl border border-[#dfe2e8] px-3.5 py-2.5 text-sm" /></div><div><label className="mb-2 block text-xs font-medium text-[#626b80]">Trend</label><select value={riskTrendFilter} onChange={(e) => setRiskTrendFilter(e.target.value)} className="w-full rounded-xl border border-[#dfe2e8] bg-white px-3.5 py-2.5 text-sm"><option value="All">All</option><option value="Increasing">Increasing</option><option value="Decreasing">Decreasing</option><option value="Stable">Stable</option></select></div><div><label className="mb-2 block text-xs font-medium text-[#626b80]">Month</label><select value={riskMonth} onChange={(e) => setRiskMonth(e.target.value as "previous" | "current")} className="w-full rounded-xl border border-[#dfe2e8] bg-white px-3.5 py-2.5 text-sm"><option value="current">{data.monthsUsed?.current || "Current month"}</option><option value="previous">{data.monthsUsed?.previous || "Previous month"}</option></select></div></div><p className="mt-3 flex items-center gap-2 text-xs text-[#8991a2]"><Info size={14} /> Filtering uses the two months currently loaded in Trend settings.</p></section>
            <section className="mb-5 rounded-[18px] border border-[#dfe2e8] bg-white p-5 shadow-[0_8px_28px_rgba(31,35,49,.055)] sm:p-6"><h3 className="mb-4 text-sm font-bold text-[#17223b]">Filtered Students <span className="font-normal text-[#8991a2]">({riskResults.length})</span></h3><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-[#e7e8ec] text-left text-[11px] font-semibold text-[#8991a2]"><th className="py-3 pr-3">Enrollment</th><th className="py-3 pr-3">Name</th><th className="py-3 pr-3">Email</th><th className="py-3 pr-3">Attendance</th><th className="py-3">Trend</th></tr></thead><tbody>{riskResults.map((s: any) => <tr key={s.enrollmentNo} className="border-b border-[#f0f1f4]"><td className="py-3 pr-3 text-[#6f7890]">{s.enrollmentNo}</td><td className="py-3 pr-3 font-medium text-[#17223b]">{s.name}</td><td className="py-3 pr-3 text-[#6f7890]">{s.email || "—"}</td><td className="py-3 pr-3">{riskMonth === "current" ? s.attendancePct?.currMonth : s.attendancePct?.prevMonth}%</td><td className="py-3">{s.attendancePct?.trend}</td></tr>)}{riskResults.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-sm text-[#8991a2]">No students match this filter.</td></tr>}</tbody></table></div></section>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2"><section className="rounded-[18px] border border-[#dfe2e8] bg-white p-5 shadow-[0_8px_28px_rgba(31,35,49,.055)] sm:p-6"><h3 className="text-sm font-bold text-[#17223b]">Copy to Mail</h3><textarea readOnly value={riskEmailsText} rows={5} className="mt-3 w-full rounded-xl border border-[#dfe2e8] bg-[#f8f8fa] p-3 text-xs text-[#626b80]" /><button onClick={copyEmails} disabled={riskEmails.length === 0} className="mt-3 rounded-xl bg-[#3b2992] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{copied ? "Copied!" : "Copy Emails"}</button></section><section className="rounded-[18px] border border-[#dfe2e8] bg-white p-5 shadow-[0_8px_28px_rgba(31,35,49,.055)] sm:p-6"><h3 className="text-sm font-bold text-[#17223b]">Send Alert Emails</h3><p className="mt-3 text-sm leading-6 text-[#6f7890]">Opens your default email app with all {riskEmails.length} filtered students BCC'd.</p><a href={mailtoHref} className={`mt-4 inline-block rounded-xl px-4 py-2.5 text-sm font-semibold text-white ${riskEmails.length === 0 ? "pointer-events-none bg-[#cfd2da]" : "bg-[#ef4444] hover:bg-[#dc3b3b]"}`}>Send Alert Emails ↗</a></section></div>
          </>
        )}

        {data && view === "summary" && (
          <>
            <section className="mb-5"><h2 className="text-[25px] font-extrabold tracking-[-0.7px] text-[#17223b]">Attendance Summary</h2><p className="mt-2 text-sm leading-6 text-[#6f7890]">Overall class attendance health at a glance.</p></section>
            <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">{[["Total Students", data.totalStudents], ["Class Average (Current)", `${data.classAverageCurrMonth}%`], ["Class Average (Previous)", `${data.classAveragePrevMonth}%`], ["Overall Trend", `${data.overallTrendPct > 0 ? "+" : ""}${data.overallTrendPct}%`]].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-[#dfe2e8] bg-white p-5 shadow-[0_8px_28px_rgba(31,35,49,.055)]"><p className="text-xs font-medium text-[#626b80]">{label}</p><p className="mt-2 text-[25px] font-extrabold text-[#17223b]">{value}</p></div>)}</div>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2"><section className="rounded-[18px] border border-[#dfe2e8] bg-white p-5 shadow-[0_8px_28px_rgba(31,35,49,.055)] sm:p-6"><h3 className="text-base font-medium text-[#17223b]">Attendance Breakdown</h3><div className="mt-3"><ResponsiveContainer width="100%" height={270}><PieChart><Pie data={donutData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={98} paddingAngle={2}>{donutData.map((entry, i) => <Cell key={i} fill={entry.color} />)}</Pie><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} /></PieChart></ResponsiveContainer></div></section><section className="rounded-[18px] border border-[#dfe2e8] bg-white p-5 shadow-[0_8px_28px_rgba(31,35,49,.055)] sm:p-6"><h3 className="text-base font-medium text-[#17223b]">Class Average: Previous vs Current</h3><div className="mt-3"><ResponsiveContainer width="100%" height={270}><BarChart data={compareBarData} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d9dce2" /><XAxis dataKey="name" fontSize={11} tickLine={false} /><YAxis fontSize={11} tickLine={false} /><Tooltip /><Bar dataKey="value" fill="#3b2992" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></section></div>
            <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2"><section className="rounded-[18px] border border-[#dfe2e8] bg-white p-5 shadow-[0_8px_28px_rgba(31,35,49,.055)] sm:p-6"><h3 className="text-sm font-bold text-[#17223b]">Core Summary</h3><table className="mt-3 w-full text-sm"><tbody>{[["Good Standing (≥75%)", data.attendanceBuckets.above75], ["Satisfactory (50-74%)", data.attendanceBuckets.to74], ["Needs Attention (30-49%)", data.attendanceBuckets.to49], ["Critical Risk (<30%)", data.attendanceBuckets.below30]].map(([label, value]) => <tr key={String(label)} className="border-b border-[#f0f1f4] last:border-0"><td className="py-3 text-[#626b80]">{label}</td><td className="py-3 text-right font-bold text-[#17223b]">{value}</td></tr>)}</tbody></table></section><section className="rounded-[18px] border border-[#dfe2e8] bg-white p-5 shadow-[0_8px_28px_rgba(31,35,49,.055)] sm:p-6"><h3 className="text-sm font-bold text-[#17223b]">Attendance Shifts</h3><table className="mt-3 w-full text-sm"><tbody><tr className="border-b border-[#f0f1f4]"><td className="py-3 text-[#626b80]">Improving Students</td><td className="py-3 text-right font-bold text-[#10a66a]">{data.trendCounts?.increasing ?? 0}</td></tr><tr className="border-b border-[#f0f1f4]"><td className="py-3 text-[#626b80]">Declining Students</td><td className="py-3 text-right font-bold text-red-500">{data.trendCounts?.decreasing ?? 0}</td></tr><tr><td className="py-3 text-[#626b80]">Stable Students</td><td className="py-3 text-right font-bold text-[#687286]">{data.trendCounts?.stable ?? 0}</td></tr></tbody></table></section></div>
            <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2"><section className="rounded-[18px] border border-[#dfe2e8] bg-white p-5 shadow-[0_8px_28px_rgba(31,35,49,.055)] sm:p-6"><h3 className="text-sm font-bold text-[#17223b]">Top 5 Most Improved</h3><ol className="mt-3 space-y-2 text-sm">{topMovers.improved.map((s, i) => <li key={s.name} className="flex justify-between gap-4"><span className="text-[#626b80]">{i + 1}. {s.name}</span><span className="font-bold text-[#10a66a]">{s.change > 0 ? "+" : ""}{s.change}%</span></li>)}</ol></section><section className="rounded-[18px] border border-[#dfe2e8] bg-white p-5 shadow-[0_8px_28px_rgba(31,35,49,.055)] sm:p-6"><h3 className="text-sm font-bold text-[#17223b]">Top 5 Critical Decliners</h3><ol className="mt-3 space-y-2 text-sm">{topMovers.declined.map((s, i) => <li key={s.name} className="flex justify-between gap-4"><span className="text-[#626b80]">{i + 1}. {s.name}</span><span className="font-bold text-red-500">{s.change > 0 ? "+" : ""}{s.change}%</span></li>)}</ol></section></div>
          </>
        )}
      </div>
      <span className="sr-only">{sheetId || ""}</span>
    </div>
  );
}
