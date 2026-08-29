import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../lib/authOptions";
import { prisma } from "../lib/prisma";
import Link from "next/link";
import { signOut } from "next-auth/react";

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
          <Link
            href="/class-analysis"
            className="bg-white rounded-2xl border border-gray-100 p-6 hover:bg-gray-50"
          >
            <h3 className="font-medium text-gray-900 mb-1">Class Analysis</h3>
            <p className="text-sm text-gray-500">Choose one of the classes assigned to you.</p>
            <p className="text-xs text-gray-400 mt-4">{classes.length} assigned class{classes.length === 1 ? "" : "es"}</p>
          </Link>

          <Link
            href="/subject-analysis"
            className="bg-white rounded-2xl border border-gray-100 p-6 hover:bg-gray-50"
          >
            <h3 className="font-medium text-gray-900 mb-1">Subject Analysis</h3>
            <p className="text-sm text-gray-500">Choose a class, then choose one of your assigned subjects.</p>
            <p className="text-xs text-gray-400 mt-4">{subjects.length} assigned subject{subjects.length === 1 ? "" : "s"}</p>
          </Link>
        </div>
      </main>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user) {
    return { redirect: { destination: "/login", permanent: false } };
  }

  const userId = (session.user as any).id;
  const role = (session.user as any).role;

  const sectionsRaw = await prisma.section.findMany({
    where:
      role === "ADMIN"
        ? undefined
        : {
            OR: [
              { class: { proctorId: userId } },
              { subjects: { some: { assignments: { some: { teacherId: userId } } } } },
            ],
          },
    include: { class: { include: { department: true } } },
  });

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

function formatClassLabel(department: string, semester: number, classNumber: string) {
  return `${department}${classNumber} Sem ${semester}`;
}
