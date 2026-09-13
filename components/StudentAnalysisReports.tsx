import React from "react";

type ClassReport = { computedAt: string | null; classAverageOverallPct: number | null; rank: number | null; totalStudents: number; student: any };
type Props = { activeTab: "attendance" | "class"; classReport: ClassReport | null };
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? (Number.isInteger(n) ? String(n) : n.toFixed(1)) : "—"; };
const fmtDate = (v: string | null) => v ? new Date(v).toLocaleString() : "";

export default function StudentAnalysisReports({ activeTab, classReport }: Props) {
  if (activeTab === "attendance") return null;
  const students = classReport?.student?._classStudents || [];
  return <section className="mt-6 rounded-2xl border border-[#e5e4e1] bg-white shadow-[0_8px_25px_rgba(31,35,49,0.04)]">
    <div className="border-b border-[#eeeeeb] px-5 py-5 sm:px-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
      <div><h2 className="text-lg font-bold">Academic Analysis</h2><p className="mt-1 text-xs text-[#7b8498]">Your student report generated from Class Analysis.</p></div>
      {classReport?.computedAt && <span className="text-[11px] text-[#9aa1b0]">Teacher report · {fmtDate(classReport.computedAt)}</span>}
    </div>
    {classReport ? <div className="p-5 sm:p-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Overall Score" value={`${num(classReport.student.overallPct)}%`} />
        <Metric label="Overall Grade" value={classReport.student.overallGrade || "—"} />
        <Metric label="Class Rank" value={classReport.rank ? `${classReport.rank} / ${classReport.totalStudents}` : "—"} />
        <Metric label="Class Average" value={classReport.classAverageOverallPct == null ? "—" : `${num(classReport.classAverageOverallPct)}%`} />
      </div>
      <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[860px] text-left"><thead><tr className="border-b border-[#eeeeeb] text-xs font-bold uppercase tracking-wide text-[#8a92a3]"><th className="px-4 py-3">Subject</th><th className="px-4 py-3">Attendance</th><th className="px-4 py-3">Midsem 1</th><th className="px-4 py-3">Midsem 2</th><th className="px-4 py-3">Assignment</th><th className="px-4 py-3">Presentation</th><th className="px-4 py-3">Internal</th><th className="px-4 py-3">Subject Rank</th></tr></thead><tbody>{(classReport.student.subjects || []).map((subject: any) => <tr key={subject.subjectId || subject.code} className="border-b border-[#f0efed] last:border-0"><td className="px-4 py-4"><p className="text-sm font-bold">{subject.name}</p><p className="mt-1 text-xs text-[#8a92a3]">{subject.code}</p></td><td className="px-4 py-4 text-sm">{num(subject.attendance)}%</td><td className="px-4 py-4 text-sm">{num(subject.midsem1)}</td><td className="px-4 py-4 text-sm">{num(subject.midsem2)}</td><td className="px-4 py-4 text-sm">{subject.assignment ? `${num(subject.assignment.mark)} / 5` : "—"}</td><td className="px-4 py-4 text-sm">{subject.presentation ? `${num(subject.presentation.mark)} / 5` : "—"}</td><td className="px-4 py-4 text-sm font-extrabold">{num(subject.basicInternal)} / {num(subject.basicMax)}</td><td className="px-4 py-4 text-sm font-bold">{subject.subjectRank ? `${subject.subjectRank} / ${classReport.totalStudents}` : "—"}</td></tr>)}</tbody></table></div>
      <div className="mt-6 rounded-xl border border-[#ece9ff] bg-[#faf9ff] p-4"><h3 className="text-sm font-bold">Notes</h3><ul className="mt-2 space-y-2 text-xs leading-5 text-[#687287]"><li>• This report shows the latest Class Analysis report shared by your teacher.</li><li>• If a subject has not been updated by the teacher, its values may appear as “—”.</li><li>• Subject rank is based on the internal score available in the Class Analysis report.</li><li>• This is a static report card and does not include automated judgments or risk labels.</li></ul></div>
    </div> : <div className="px-6 py-10 text-center"><p className="text-sm font-semibold">Class report is not available yet.</p><p className="mt-1 text-xs text-[#8a92a3]">Your teacher has not synced the Class Analysis report for this class.</p></div>}
  </section>;
}
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-[#ecebe8] bg-[#fafaf8] p-4"><p className="text-xs text-[#7a8295]">{label}</p><p className="mt-2 text-2xl font-extrabold">{value}</p></div>; }
