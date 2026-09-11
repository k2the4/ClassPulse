import React from "react";

type ClassReport = {
  computedAt: string | null;
  classAverageOverallPct: number | null;
  rank: number | null;
  totalStudents: number;
  student: any;
};

type SubjectReport = {
  subject: { id: string; code: string; name: string; type: string };
  computedAt: string | null;
  data: any;
  classAverageBasicMarks: number | null;
};

type Props = {
  activeTab: "attendance" | "class" | "subjects";
  classReport: ClassReport | null;
  subjectReports: SubjectReport[];
};

const number = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? (Number.isInteger(n) ? String(n) : n.toFixed(1)) : "—";
};

const date = (value: string | null) => value ? new Date(value).toLocaleString() : "";

export default function StudentAnalysisReports({ activeTab, classReport, subjectReports }: Props) {
  if (activeTab === "attendance") return null;

  if (activeTab === "class") {
    return (
      <section className="mt-6 rounded-2xl border border-[#e5e4e1] bg-white shadow-[0_8px_25px_rgba(31,35,49,0.04)]">
        <div className="border-b border-[#eeeeeb] px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-bold">Class Analysis</h2>
              <p className="mt-1 text-xs text-[#7b8498]">Your student report generated from Class Analysis.</p>
            </div>
            {classReport?.computedAt && <span className="text-[11px] text-[#9aa1b0]">Teacher report · {date(classReport.computedAt)}</span>}
          </div>
        </div>

        {classReport ? (
          <div className="p-5 sm:p-6">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="rounded-xl border border-[#ecebe8] bg-[#fafaf8] p-4"><p className="text-xs text-[#7a8295]">Overall Score</p><p className="mt-2 text-2xl font-extrabold">{number(classReport.student.overallPct)}%</p></div>
              <div className="rounded-xl border border-[#ecebe8] bg-[#fafaf8] p-4"><p className="text-xs text-[#7a8295]">Overall Grade</p><p className="mt-2 text-lg font-extrabold">{classReport.student.overallGrade || "—"}</p></div>
              <div className="rounded-xl border border-[#ecebe8] bg-[#fafaf8] p-4"><p className="text-xs text-[#7a8295]">Class Rank</p><p className="mt-2 text-2xl font-extrabold">{classReport.rank ? `${classReport.rank} / ${classReport.totalStudents}` : "—"}</p></div>
              <div className="rounded-xl border border-[#ecebe8] bg-[#fafaf8] p-4"><p className="text-xs text-[#7a8295]">Class Average</p><p className="mt-2 text-2xl font-extrabold">{classReport.classAverageOverallPct == null ? "—" : `${number(classReport.classAverageOverallPct)}%`}</p></div>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left">
                <thead><tr className="border-b border-[#eeeeeb] text-xs font-bold uppercase tracking-wide text-[#8a92a3]"><th className="px-4 py-3">Subject</th><th className="px-4 py-3">Attendance</th><th className="px-4 py-3">Midsem 1</th><th className="px-4 py-3">Midsem 2</th><th className="px-4 py-3">Assignment</th><th className="px-4 py-3">Presentation</th><th className="px-4 py-3">Internal</th></tr></thead>
                <tbody>{(classReport.student.subjects || []).map((subject: any) => <tr key={subject.subjectId || subject.code} className="border-b border-[#f0efed] last:border-0"><td className="px-4 py-4"><p className="text-sm font-bold">{subject.name}</p><p className="mt-1 text-xs text-[#8a92a3]">{subject.code}</p></td><td className="px-4 py-4 text-sm">{number(subject.attendance)}%</td><td className="px-4 py-4 text-sm">{number(subject.midsem1)}</td><td className="px-4 py-4 text-sm">{number(subject.midsem2)}</td><td className="px-4 py-4 text-sm">{subject.assignment ? `${number(subject.assignment.mark)} / 5` : "—"}</td><td className="px-4 py-4 text-sm">{subject.presentation ? `${number(subject.presentation.mark)} / 5` : "—"}</td><td className="px-4 py-4 text-sm font-extrabold">{number(subject.basicInternal)} / {number(subject.basicMax)}</td></tr>)}</tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="px-6 py-10 text-center"><p className="text-sm font-semibold">Class report is not available yet.</p><p className="mt-1 text-xs text-[#8a92a3]">Your teacher has not synced the Class Analysis report for this class.</p></div>
        )}
      </section>
    );
  }

  const theoryReports = subjectReports.filter(item => item.subject.type === "THEORY");
  return (
    <section className="mt-6 rounded-2xl border border-[#e5e4e1] bg-white shadow-[0_8px_25px_rgba(31,35,49,0.04)]">
      <div className="border-b border-[#eeeeeb] px-5 py-5 sm:px-6">
        <h2 className="text-lg font-bold">Subject Analysis</h2>
        <p className="mt-1 text-xs text-[#7b8498]">Your student reports generated from Subject Analysis for theory subjects.</p>
      </div>
      <div className="divide-y divide-[#eeeeeb]">
        {theoryReports.length ? theoryReports.map(item => {
          const s = item.data;
          const attendance = s?.attendancePct || {};
          const midsem = s?.midsem || {};
          const assignment = s?.assignment || {};
          return (
            <div key={item.subject.id} className="p-5 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div><p className="text-base font-bold">{item.subject.name}</p><p className="mt-1 text-xs text-[#8a92a3]">{item.subject.code} · Theory</p></div>
                {s ? <div className="text-left sm:text-right"><p className="text-xl font-extrabold">{number(s.internalMarks?.basic)} / 40</p><p className="mt-1 text-xs text-[#8a92a3]">Basic internal score</p></div> : <span className="rounded-full bg-[#f7f6f2] px-3 py-1.5 text-xs font-semibold text-[#7a8295]">Report not available</span>}
              </div>

              {s ? <>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  <Metric label="Attendance" value={`${number(attendance.currMonth)}%`} />
                  <Metric label="Attendance Trend" value={attendance.trend || "—"} />
                  <Metric label="Midsem 1" value={number(midsem.first)} />
                  <Metric label="Midsem 2" value={number(midsem.second)} />
                  <Metric label="Assignment" value={assignment.total ? `${assignment.submitted}/${assignment.total}` : "—"} />
                  <Metric label="Presentation" value={number(s.presentation)} />
                </div>
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#687287]">
                  <span>Moderated: <strong className="text-[#17223b]">{number(s.internalMarks?.moderated)} / 40</strong></span>
                  <span>Midsem combined: <strong className="text-[#17223b]">{number(midsem.combined)} / 30</strong></span>
                  <span>Class average: <strong className="text-[#17223b]">{item.classAverageBasicMarks == null ? "—" : `${number(item.classAverageBasicMarks)} / 40`}</strong></span>
                  {item.computedAt && <span>Teacher report: {date(item.computedAt)}</span>}
                </div>
              </> : <p className="mt-4 text-xs text-[#8a92a3]">Your teacher has not synced a Subject Analysis report for this subject yet.</p>}
            </div>
          );
        }) : <div className="px-6 py-10 text-center"><p className="text-sm font-semibold">No theory subjects are configured for this class.</p></div>}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-[#ecebe8] bg-[#fafaf8] p-3"><p className="text-[11px] text-[#7a8295]">{label}</p><p className="mt-1 text-sm font-bold text-[#17223b]">{value}</p></div>;
}
