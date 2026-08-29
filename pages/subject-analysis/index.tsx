import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../lib/authOptions";
import { prisma } from "../../lib/prisma";
import Link from "next/link";
import { useState } from "react";

type ClassOption = { id: string; label: string };
type SubjectOption = { id: string; classId: string; code: string; name: string; type: string };
type Props = { classes: ClassOption[]; subjects: SubjectOption[] };

export default function SubjectAnalysisIndex({ classes, subjects }: Props) {
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id || "");
  const selectedSubjects = subjects.filter((subject) => subject.classId === selectedClassId);

  return (
    <div className="min-h-screen max-w-5xl mx-auto px-6 py-10">
      <Link href="/dashboard" className="text-sm text-indigo-600 hover:text-indigo-800">← Back to Dashboard</Link>
      <div className="mt-8 mb-6">
        <p className="text-sm font-medium text-indigo-600 mb-2">Subject Analysis</p>
        <h1 className="text-2xl font-semibold text-gray-900">Choose a class and subject</h1>
        <p className="text-sm text-gray-500 mt-2">Select a class you are assigned to, then choose one of your assigned subjects.</p>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <label className="block text-sm font-medium text-gray-900 mb-2">Class</label>
        <select value={selectedClassId} onChange={(event) => setSelectedClassId(event.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-3 text-sm text-gray-900">
          {classes.map((classOption) => <option key={classOption.id} value={classOption.id}>{classOption.label}</option>)}
        </select>
        <div className="mt-6">
          <p className="text-sm font-medium text-gray-900 mb-3">Subject</p>
          <div className="space-y-2">
            {selectedSubjects.map((subject) => (
              <Link key={subject.id} href={`/subject-analysis/${subject.id}`} className="block rounded-xl border border-gray-100 px-4 py-3 hover:bg-gray-50">
                <span className="text-sm font-medium text-gray-900">{subject.code}</span>
                <span className="text-sm text-gray-500"> — {subject.name}</span>
              </Link>
            ))}
            {!selectedSubjects.length && <p className="text-sm text-gray-400 py-2">No assigned subjects for this class.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatClassLabel(department: string, classNumber: string, semester: number) {
  return `${department}${classNumber} Sem ${semester}`;
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user) return { redirect: { destination: "/login", permanent: false } };

  const userId = (session.user as any).id;
  const role = (session.user as any).role;
  const sections = await prisma.section.findMany({
    where: role === "ADMIN" ? undefined : {
      OR: [
        { class: { proctorId: userId } },
        { subjects: { some: { assignments: { some: { teacherId: userId } } } } },
      ],
    },
    include: {
      class: { include: { department: true } },
      subjects: { where: role === "ADMIN" ? undefined : { assignments: { some: { teacherId: userId } } } },
    },
  });

  const classes = new Map<string, ClassOption>();
  const subjects: SubjectOption[] = [];
  for (const section of sections) {
    classes.set(section.class.id, {
      id: section.class.id,
      label: formatClassLabel(section.class.department.name, section.name, section.class.semester),
    });
    for (const subject of section.subjects) {
      subjects.push({ id: subject.id, classId: section.class.id, code: subject.code, name: subject.name, type: subject.type });
    }
  }

  return { props: { classes: Array.from(classes.values()), subjects } };
};
