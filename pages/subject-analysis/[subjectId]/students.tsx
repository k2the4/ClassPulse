import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

import SubjectAnalysisNav from "../../../components/SubjectAnalysisNav";
import { SubjectAnalysis } from "../../../lib/analysis";
import { RawDataButton, GradeBadge } from "../../../components/AnalysisWidgets";

function round1(n: number) { return Math.round((Number(n) || 0) * 10) / 10; }

export default function SubjectStudentReportPage() {
  const router = useRouter();
  const { subjectId } = router.query;

  const [data, setData] = useState<SubjectAnalysis | null>(null);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [computedAt, setComputedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedEnrollment, setSelectedEnrollment] = useState<string>("");

  async function loadAnalysis() {
    if (!subjectId || typeof subjectId !== "string") return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/analysis/subject/${subjectId}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.detail ? `${json.error}: ${json.detail}` : json.error || "Failed to load student report");
        return;
      }
      setData(json.data);
      setComputedAt(json.computedAt);
      setSheetId(json.sheetId || null);
      if (json.data?.students?.[0]) setSelectedEnrollment(json.data.students[0].enrollmentNo);
    } catch (e: any) {
      setError(e.message || "Failed to load student report");
    } finally {
      setLoading(false);
    }
  }

  async function syncAnalysis() {
    if (!subjectId || typeof subjectId !== "string") return;
    setSyncing(true);
    setError("");
    try {
      const res = await fetch(`/api/analysis/subject/${subjectId}?sync=1`);
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

  useEffect(() => {
    loadAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId]);

  const students = data?.students || [];

  const filteredList = useMemo(() => {
    if (!search.trim()) return students;
    const q = search.trim().toLowerCase();
    return students.filter((s: any) => s.name.toLowerCase().includes(q) || s.enrollmentNo.includes(q));
  }, [students, search]);

  const selected = students.find((s: any) => s.enrollmentNo === selectedEnrollment);

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

      {error && <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg p-4 mb-6">{error}</div>}
      {loading && !data && <div className="text-sm text-gray-500 py-10">Loading student report...</div>}

      {data && (
        <>
          <div className="mb-6"><h2 className="text-xl font-semibold text-gray-900">Student Report</h2><p className="text-sm text-gray-500 mt-1">A subject-wise report card with attendance, coursework and internal marks.</p></div>
          <div className="grid grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)] gap-6">
            <section className="bg-white rounded-2xl border border-gray-100 p-5 h-fit"><input type="text" placeholder="Search name or enrollment" value={search} onChange={(e)=>setSearch(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4"/><div className="max-h-[620px] overflow-y-auto space-y-1">{filteredList.map((s:any)=><button key={s.enrollmentNo} onClick={()=>setSelectedEnrollment(s.enrollmentNo)} className={`w-full text-left px-3 py-3 rounded-xl ${s.enrollmentNo===selectedEnrollment?"bg-gray-900 text-white":"hover:bg-gray-50 text-gray-700"}`}><span className="block text-sm font-medium truncate">{s.name}</span><span className={`block text-xs mt-1 ${s.enrollmentNo===selectedEnrollment?"text-gray-300":"text-gray-400"}`}>{s.enrollmentNo}</span></button>)}{!filteredList.length&&<p className="text-sm text-gray-400 text-center py-6">No matches.</p>}</div></section>
            <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden">{!selected?<p className="p-6 text-sm text-gray-400">Select a student to view the report card.</p>:<>
              <div className="px-6 py-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white"><div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.18em] text-gray-400">Subject performance report</p><h3 className="text-2xl font-semibold text-gray-900 mt-2">{selected.name}</h3><p className="text-sm text-gray-500 mt-1">{selected.enrollmentNo} · {selected.email || "Email not available"}</p></div><div className="text-left sm:text-right"><GradeBadge grade={selected.midsem.grade}/><p className="text-xs text-gray-400 mt-2">Based on current subject performance</p></div></div></div>
              <div className="p-6"><div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6"><div className="rounded-xl border border-gray-100 p-4"><p className="text-xs text-gray-400">Current Attendance</p><p className="text-2xl font-semibold mt-1">{selected.attendancePct.currMonth}%</p></div><div className="rounded-xl border border-gray-100 p-4"><p className="text-xs text-gray-400">Attendance Trend</p><p className="text-lg font-semibold mt-2">{selected.attendancePct.trend}</p></div><div className="rounded-xl border border-gray-100 p-4"><p className="text-xs text-gray-400">Basic Marks</p><p className="text-2xl font-semibold mt-1">{round1(selected.internalMarks.basic)}</p></div><div className="rounded-xl border border-gray-100 p-4"><p className="text-xs text-gray-400">Moderated Marks</p><p className="text-2xl font-semibold mt-1">{round1(selected.internalMarks.moderated)}</p></div></div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5"><section className="rounded-2xl border border-gray-100 p-5"><h4 className="font-medium text-gray-900">Assessment Record</h4><div className="mt-4 divide-y divide-gray-50 text-sm"><div className="flex justify-between py-3"><span className="text-gray-500">Assignment</span><span className="font-medium">{selected.assignment.submitted}/{selected.assignment.total}</span></div><div className="flex justify-between py-3"><span className="text-gray-500">Presentation</span><span className="font-medium">{selected.presentation}/10</span></div><div className="flex justify-between py-3"><span className="text-gray-500">Midsem 1</span><span className="font-medium">{selected.midsem.first}/30</span></div><div className="flex justify-between py-3"><span className="text-gray-500">Midsem 2</span><span className="font-medium">{selected.midsem.second}/30</span></div><div className="flex justify-between py-3"><span className="text-gray-500">Midsem Combined</span><span className="font-semibold">{selected.midsem.combined}</span></div></div></section>
                <section className="rounded-2xl border border-gray-100 p-5"><h4 className="font-medium text-gray-900">Internal Marks Summary</h4><p className="text-xs text-gray-400 mt-1">Basic marks are the weighted total. Moderated marks are rank-adjusted using the subject moderation tiers.</p><div className="mt-5 space-y-4"><div><div className="flex justify-between text-sm mb-2"><span className="text-gray-500">Basic</span><span className="font-semibold">{round1(selected.internalMarks.basic)}</span></div><div className="h-2 rounded-full bg-gray-100 overflow-hidden"><div className="h-full bg-gray-500" style={{width:`${Math.min(100,(selected.internalMarks.basic/40)*100)}%`}}/></div></div><div><div className="flex justify-between text-sm mb-2"><span className="text-gray-500">Moderated</span><span className="font-semibold">{round1(selected.internalMarks.moderated)}</span></div><div className="h-2 rounded-full bg-gray-100 overflow-hidden"><div className="h-full bg-gray-900" style={{width:`${Math.min(100,(selected.internalMarks.moderated/40)*100)}%`}}/></div></div><div className="pt-3 border-t text-sm flex justify-between"><span className="text-gray-500">Previous Attendance</span><span className="font-medium">{selected.attendancePct.prevMonth}%</span></div></div></section></div></div>
            </>}</section>
          </div>
        </>
      )}
    </div>
  );
}
