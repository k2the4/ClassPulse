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
} from "recharts";

import SubjectAnalysisNav from "../../../components/SubjectAnalysisNav";
import { SubjectAnalysis } from "../../../lib/analysis";
import { RawDataButton } from "../../../components/AnalysisWidgets";

type AttendanceView = "trend" | "risk";

export default function SubjectAttendancePage() {
  const router = useRouter();
  const { subjectId } = router.query;

  const [view, setView] = useState<AttendanceView>("trend");
  const [data, setData] = useState<SubjectAnalysis | null>(null);
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
    if (!subjectId || typeof subjectId !== "string") return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (selectedPrevious) params.set("previousMonth", selectedPrevious);
      if (selectedCurrent) params.set("currentMonth", selectedCurrent);
      if (criteria !== undefined) params.set("trendCriteria", String(criteria));
      const query = params.toString();
      const res = await fetch(`/api/analysis/subject/${subjectId}${query ? `?${query}` : ""}`);
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
    if (!subjectId || typeof subjectId !== "string") return;
    setSyncing(true);
    setError("");
    try {
      const params = new URLSearchParams({ sync: "1", previousMonth, currentMonth, trendCriteria: String(trendCriteria) });
      const res = await fetch(`/api/analysis/subject/${subjectId}?${params.toString()}`);
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

  function openRiskFilter(options: {
    trend?: string;
    lower?: number;
    upper?: number;
    month?: "previous" | "current";
  }) {
    setRiskTrendFilter(options.trend || "All");
    setLowerBound(options.lower ?? 0);
    setUpperBound(options.upper ?? 100);
    setRiskMonth(options.month || "current");
    setView("risk");
    window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 0);
  }

  useEffect(() => {
    loadAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId]);

  const availableMonths = data?.availableMonths || [];
  const trendData = data
    ? [
        { name: "Increasing", count: data.trendCounts?.increasing || 0 },
        { name: "Decreasing", count: data.trendCounts?.decreasing || 0 },
        { name: "Stable", count: data.trendCounts?.stable || 0 },
      ]
    : [];

  const attendanceDistribution = data
    ? [
        { name: "Below 30%", count: data.attendanceBuckets.below30 },
        { name: "30% to 49%", count: data.attendanceBuckets.to49 },
        { name: "50% to 74%", count: data.attendanceBuckets.to74 },
        { name: "75% and above", count: data.attendanceBuckets.above75 },
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
    } catch {}
  }

  const mailtoHref = `mailto:?bcc=${encodeURIComponent(riskEmails.join(","))}&subject=${encodeURIComponent("Attendance Alert")}&body=${encodeURIComponent("This is a reminder regarding your recent attendance. Please make sure to attend upcoming classes.")}`;

  function round1(n: number) {
    return Math.round(n * 10) / 10;
  }

  return (
    <div className="min-h-screen max-w-[1700px] mx-auto px-8 py-10">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Subject Analysis</h1>
          {computedAt && <p className="text-xs text-gray-400 mt-1">Last synced {new Date(computedAt).toLocaleString()}</p>}
        </div>
        <div className="flex items-center gap-2">
          <RawDataButton sheetId={sheetId} />
          <button onClick={syncAnalysis} disabled={syncing} className="text-sm bg-gray-900 text-white rounded-lg px-4 py-2 disabled:opacity-50">
            {syncing ? "Syncing..." : "Sync now"}
          </button>
        </div>
      </div>

      {typeof subjectId === "string" && <SubjectAnalysisNav subjectId={subjectId} />}

      <div className="flex gap-2 mb-8">
        {(["trend", "risk"] as AttendanceView[]).map((v) => (
          <button key={v} onClick={() => setView(v)} className={`text-sm px-4 py-2 rounded-lg font-medium capitalize ${view === v ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            {v === "risk" ? "At Risk" : v}
          </button>
        ))}
      </div>

      {error && <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg p-4 mb-6">{error}</div>}
      {loading && !data && <div className="text-sm text-gray-500 py-10">Loading attendance analysis...</div>}

      {data && view === "trend" && (
        <>
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Attendance Trend</h2>
            <p className="text-sm text-gray-500 mt-1">Compare attendance between two months and identify increasing, decreasing, and stable students. Click any graph column to open the matching At Risk list.</p>
          </div>

          <section className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
            <h3 className="font-medium text-gray-900 mb-5">Trend Comparison Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">First Month</label>
                <select value={previousMonth} onChange={(e) => setPreviousMonth(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white">
                  <option value="">Select month</option>
                  {availableMonths.map((m: string) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">Second Month</label>
                <select value={currentMonth} onChange={(e) => setCurrentMonth(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white">
                  <option value="">Select month</option>
                  {availableMonths.map((m: string) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">Trend Criteria (%)</label>
                <input type="number" min="0" max="100" value={trendCriteria} onChange={(e) => setTrendCriteria(Number(e.target.value))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900" />
              </div>
              <button onClick={applyTrendSettings} disabled={!previousMonth || !currentMonth || previousMonth === currentMonth} className="bg-gray-900 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-40">
                {loading ? "Applying..." : "Apply Comparison"}
              </button>
            </div>
            <div className="mt-5 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-500">Trend calculation: a change of <span className="font-semibold text-gray-700">±{trendCriteria} percentage points</span> or more is classified as Increasing or Decreasing. Smaller changes are Stable.</p>
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <section className="bg-white rounded-2xl border border-gray-100 p-6 order-2 lg:order-1">
              <h3 className="font-medium text-gray-900 mb-4">Student Trend Analysis</h3>
              <div className="max-h-[600px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-gray-400 border-b border-gray-100"><th className="py-3 pr-3">Name</th><th className="py-3 pr-3">{data.monthsUsed?.previous || "Month 1"}</th><th className="py-3 pr-3">{data.monthsUsed?.current || "Month 2"}</th><th className="py-3 pr-3">Change</th><th className="py-3">Trend</th></tr></thead>
                  <tbody>
                    {data.students.map((student: any) => {
                      const previous = student.attendancePct?.prevMonth ?? 0;
                      const current = student.attendancePct?.currMonth ?? 0;
                      const change = round1(current - previous);
                      const trend = student.attendancePct?.trend || "Stable";
                      return <tr key={student.enrollmentNo} className="border-b border-gray-50">
                        <td className="py-3 pr-3 text-gray-900 whitespace-nowrap">{student.name}</td>
                        <td className="py-3 pr-3 text-gray-500">{previous}%</td><td className="py-3 pr-3 text-gray-500">{current}%</td>
                        <td className={`py-3 pr-3 font-medium ${change > 0 ? "text-emerald-600" : change < 0 ? "text-red-500" : "text-gray-500"}`}>{change > 0 ? "+" : ""}{change}%</td>
                        <td className="py-3"><span className={`text-xs px-2.5 py-1 rounded-full ${trend === "Increasing" ? "bg-emerald-50 text-emerald-700" : trend === "Decreasing" ? "bg-red-50 text-red-600" : "bg-gray-100 text-gray-600"}`}>{trend}</span></td>
                      </tr>;
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="space-y-6 order-1 lg:order-2">
              <section className="bg-white rounded-2xl border border-gray-100 p-6">
                <h3 className="font-medium text-gray-900 mb-1">Trend Distribution</h3>
                <p className="text-xs text-gray-400 mb-4">Click a column to filter those students in At Risk.</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" fontSize={11} /><YAxis fontSize={12} allowDecimals={false} /><Tooltip />
                    <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} cursor="pointer" onClick={(entry: any) => openRiskFilter({ trend: entry?.name || "All" })} />
                  </BarChart>
                </ResponsiveContainer>
              </section>

              <section className="bg-white rounded-2xl border border-gray-100 p-6">
                <h3 className="font-medium text-gray-900 mb-1">Attendance Distribution</h3>
                <p className="text-xs text-gray-400 mb-4">Click a column to open that attendance range in At Risk.</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={attendanceDistribution}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" fontSize={11} /><YAxis fontSize={12} allowDecimals={false} /><Tooltip />
                    <Bar dataKey="count" fill="#111827" radius={[4, 4, 0, 0]} cursor="pointer" onClick={(entry: any) => {
                      const name = entry?.name;
                      if (name === "Below 30%") openRiskFilter({ lower: 0, upper: 29.999 });
                      else if (name === "30% to 49%") openRiskFilter({ lower: 30, upper: 49.999 });
                      else if (name === "50% to 74%") openRiskFilter({ lower: 50, upper: 74.999 });
                      else if (name === "75% and above") openRiskFilter({ lower: 75, upper: 100 });
                    }} />
                  </BarChart>
                </ResponsiveContainer>
              </section>
            </div>
          </div>
        </>
      )}

      {data && view === "risk" && (
        <>
          <div className="mb-6"><h2 className="text-xl font-semibold text-gray-900">At Risk Students</h2><p className="text-sm text-gray-500 mt-1">Filter students by attendance range and trend, then copy or email the list directly.</p></div>
          <section className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
            <h3 className="font-medium text-gray-900 mb-5">Filter Criteria</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div><label className="block text-xs font-medium text-gray-500 mb-2">Lower Bound (%)</label><input type="number" min="0" max="100" step="0.1" value={lowerBound} onChange={(e) => setLowerBound(Number(e.target.value))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900" /></div>
              <div><label className="block text-xs font-medium text-gray-500 mb-2">Upper Bound (%)</label><input type="number" min="0" max="100" step="0.1" value={upperBound} onChange={(e) => setUpperBound(Number(e.target.value))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900" /></div>
              <div><label className="block text-xs font-medium text-gray-500 mb-2">Trend</label><select value={riskTrendFilter} onChange={(e) => setRiskTrendFilter(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white"><option value="All">All</option><option value="Increasing">Increasing</option><option value="Decreasing">Decreasing</option><option value="Stable">Stable</option></select></div>
              <div><label className="block text-xs font-medium text-gray-500 mb-2">Month</label><select value={riskMonth} onChange={(e) => setRiskMonth(e.target.value as "previous" | "current")} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white"><option value="current">{data.monthsUsed?.current || "Current month"}</option><option value="previous">{data.monthsUsed?.previous || "Previous month"}</option></select></div>
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
            <h3 className="font-medium text-gray-900 mb-4">Filtered Students <span className="text-gray-400 font-normal">({riskResults.length})</span></h3>
            <table className="w-full text-sm"><thead><tr className="text-left text-gray-400 border-b border-gray-100"><th className="py-2 pr-3">Enrollment</th><th className="py-2 pr-3">Name</th><th className="py-2 pr-3">Email</th><th className="py-2 pr-3">Attendance</th><th className="py-2">Trend</th></tr></thead><tbody>
              {riskResults.map((s: any) => <tr key={s.enrollmentNo} className="border-b border-gray-50"><td className="py-2 pr-3 text-gray-500">{s.enrollmentNo}</td><td className="py-2 pr-3 text-gray-900">{s.name}</td><td className="py-2 pr-3 text-gray-500">{s.email || "—"}</td><td className="py-2 pr-3">{riskMonth === "current" ? s.attendancePct?.currMonth : s.attendancePct?.prevMonth}%</td><td className="py-2">{s.attendancePct?.trend}</td></tr>)}
              {riskResults.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-gray-400">No students match this filter.</td></tr>}
            </tbody></table>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section className="bg-white rounded-2xl border border-gray-100 p-6"><h3 className="font-medium text-gray-900 mb-3">Copy to Mail</h3><textarea readOnly value={riskEmailsText} rows={5} className="w-full text-xs text-gray-700 border border-gray-200 rounded-lg p-3 bg-gray-50" /><button onClick={copyEmails} disabled={riskEmails.length === 0} className="mt-3 text-sm bg-gray-900 text-white rounded-lg px-4 py-2 disabled:opacity-40">{copied ? "Copied!" : "Copy Emails"}</button></section>
            <section className="bg-white rounded-2xl border border-gray-100 p-6"><h3 className="font-medium text-gray-900 mb-3">Send Alert Emails</h3><p className="text-sm text-gray-500 mb-4">Opens your default email app with all {riskEmails.length} filtered students BCC'd.</p><a href={mailtoHref} className={`inline-block text-sm rounded-lg px-4 py-2 text-white ${riskEmails.length === 0 ? "bg-gray-300 pointer-events-none" : "bg-red-600 hover:bg-red-700"}`}>Send Alert Emails ↗</a></section>
          </div>
        </>
      )}
    </div>
  );
}
