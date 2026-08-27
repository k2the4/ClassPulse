import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";

interface ClassAnalysisResponse {
  className: string;
  totalStudents: number;
  subjects: {
    subjectId: string;
    subjectName: string;
    section: string;
    classAverage: number | null;
    passRate: number | null;
    computedAt: string | null;
  }[];
}

export default function ClassAnalysisPage() {
  const router = useRouter();
  const { classId } = router.query;
  const [data, setData] = useState<ClassAnalysisResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!classId) return;
    fetch(`/api/analysis/class/${classId}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        setData(json);
      })
      .catch((e) => setError(e.message));
  }, [classId]);

  return (
    <div className="min-h-screen max-w-5xl mx-auto px-6 py-10">
      <h1 className="text-lg font-semibold text-gray-900 mb-1">Class Analysis</h1>
      {data && <p className="text-sm text-gray-500 mb-6">{data.className} · {data.totalStudents} students</p>}

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg p-4 mb-6">
          {error}
        </div>
      )}

      {data && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-100">
                <th className="py-3 px-4">Subject</th>
                <th className="py-3 px-4">Section</th>
                <th className="py-3 px-4">Class Average</th>
                <th className="py-3 px-4">Pass Rate</th>
                <th className="py-3 px-4">Last Synced</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {data.subjects.map((s) => (
                <tr key={s.subjectId} className="border-b border-gray-50">
                  <td className="py-3 px-4 text-gray-900">{s.subjectName}</td>
                  <td className="py-3 px-4 text-gray-500">{s.section}</td>
                  <td className="py-3 px-4">
                    {s.classAverage !== null ? `${s.classAverage}%` : "—"}
                  </td>
                  <td className="py-3 px-4">{s.passRate !== null ? `${s.passRate}%` : "—"}</td>
                  <td className="py-3 px-4 text-gray-400">
                    {s.computedAt ? new Date(s.computedAt).toLocaleDateString() : "Never"}
                  </td>
                  <td className="py-3 px-4">
                    <Link
                      href={`/subject-analysis/${s.subjectId}`}
                      className="text-gray-900 underline"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
