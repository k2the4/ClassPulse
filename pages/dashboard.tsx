import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../lib/authOptions";
import { prisma } from "../lib/prisma";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useMemo, useState } from "react";

interface ClassOption {
  id: string;
  label: string;
}

interface SubjectOption {
  id: string;
  classId: string;
  label: string;
}

interface Props {
  teacherName: string;
  classes: ClassOption[];
  subjects: SubjectOption[];
}

export default function Dashboard({ teacherName, classes, subjects }: Props) {
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id || "");

  const selectedSubjects = useMemo(
    () => subjects.filter((subject) => subject.classId === selectedClassId),
    [subjects, selectedClassId]
  );

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-100 bg-white">
        <div className="max-w-[1700px] mx-auto px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-semibold text-gray-900">ClassPulse</h1>
            <p className="text-sm text-gray-500">Welcome, {teacherName}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-sm text-gray-500 hover:text-gray-900"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-[1700px] mx-auto px-8 py-10">
        <h2 className="text-lg font-medium text-gray-900 mb-1">What would you like to do today?</h2>
        <p className="text-sm text-gray-500 mb-8">Choose an option below to view and analyze your data.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section className="bg-white rounded-2xl border border-gray-100 p-6">
            <h3 className="font-medium text-gray-900 mb-1">Class Analysis</h3>
            <p className="text-sm text-gray-500 mb-4">
              Select one of the classes assigned to you.
            </p>
            <div className="space-y-2">
              {classes.map((classOption) => (
                <Link
                  key={classOption.id}
                  href={`/class-analysis/${classOption.id}`}
                  className="block text-sm rounded-lg border border-gray-100 px-3 py-2 hover:bg-gray-50"
                >
                  {classOption.label}
                </Link>
              ))}
              {classes.length === 0 && (
                <p className="text-sm text-gray-400">No classes assigned yet.</p>
              )}
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-gray-100 p-6">
            <h3 className="font-medium text-gray-900 mb-1">Subject Analysis</h3>
            <p className="text-sm text-gray-500 mb-4">
              First choose a class, then choose one of its assigned subjects.
            </p>

            {classes.length > 0 && (
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 mb-3"
              >
                {classes.map((classOption) => (
                  <option key={classOption.id} value={classOption.id}>
                    {classOption.label}
                  </option>
                ))}
              </select>
            )}

            <div className="space-y-2">
              {selectedSubjects.map((subject) => (
                <Link
                  key={subject.id}
                  href={`/subject-analysis/${subject.id}`}
                  className="block text-sm rounded-lg border border-gray-100 px-3 py-2 hover:bg-gray-50"
                >
                  {subject.label}
                </Link>
              ))}
              {classes.length === 0 && (
                <p className="text-sm text-gray-400">No classes assigned yet.</p>
              )}
              {classes.length > 0 && selectedSubjects.length === 0 && (
                <p className="text-sm text-gray-400">No subjects assigned for this class yet.</p>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function formatClassLabel(department: string, semester: number, sectionName: string) {
  // The application presents a class as Department + class number + Semester.
  // For the current ECE 2 proof-of-concept, the existing legacy section "A"
  // represents class 2. The UI must not expose "Section A" as part of the class name.
  const classNumber = department === "ECE" && semester === 7 && sectionName === "A" ? "2" : sectionName;
  return `${department}${classNumber} Sem ${semester}`;
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user) {
    return { redirect: { destination: "/login", permanent: false } };
  }

  const userId = (session.user as any).id;
  const role = (session.user as any).role;

  // A class is visible when the teacher is its proctor or teaches at least
  // one subject in the class. The UI presents the class as a single unit;
  // internal Section records remain an implementation detail for now.
  const sectionsRaw =
    role === "ADMIN"
      ? await prisma.section.findMany({ include: { class: { include: { department: true } } } })
      : await prisma.section.findMany({
          where: {
            OR: [
              { class: { proctorId: userId } },
              { subjects: { some: { assignments: { some: { teacherId: userId } } } } },
            ],
          },
          include: { class: { include: { department: true } } },
        });

  // Collapse the internal section records into teacher-visible classes.
  const classMap = new Map<string, ClassOption>();
  for (const section of sectionsRaw) {
    classMap.set(section.class.id, {
      id: section.class.id,
      label: formatClassLabel(
        section.class.department.name,
        section.class.semester,
        section.name
      ),
    });
  }

  const subjectsRaw = await prisma.subject.findMany({
    where: role === "ADMIN" ? {} : { assignments: { some: { teacherId: userId } } },
    include: { section: { include: { class: true } } },
  });

  return {
    props: {
      teacherName: session.user.name || session.user.email,
      classes: Array.from(classMap.values()),
      subjects: subjectsRaw.map((subject) => ({
        id: subject.id,
        classId: subject.section.classId,
        label: `${subject.name} (${subject.code})`,
      })),
    },
  };
};
