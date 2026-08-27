import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../lib/authOptions";
import { prisma } from "../lib/prisma";
import Link from "next/link";
import { signOut } from "next-auth/react";

interface Props {
  teacherName: string;
  sections: { id: string; label: string }[];
  subjects: { id: string; label: string }[];
}

export default function Dashboard({ teacherName, sections, subjects }: Props) {
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
              Combined attendance and exam performance for a whole class/section.
            </p>
            <div className="space-y-2">
              {sections.map((s) => (
                <Link
                  key={s.id}
                  href={`/section-analysis/${s.id}`}
                  className="block text-sm rounded-lg border border-gray-100 px-3 py-2 hover:bg-gray-50"
                >
                  {s.label}
                </Link>
              ))}
              {sections.length === 0 && (
                <p className="text-sm text-gray-400">No classes assigned yet.</p>
              )}
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-gray-100 p-6">
            <h3 className="font-medium text-gray-900 mb-1">Subject Analysis</h3>
            <p className="text-sm text-gray-500 mb-4">
              Detailed attendance, marks, and student reports for one subject.
            </p>
            <div className="space-y-2">
              {subjects.map((s) => (
                <Link
                  key={s.id}
                  href={`/subject-analysis/${s.id}`}
                  className="block text-sm rounded-lg border border-gray-100 px-3 py-2 hover:bg-gray-50"
                >
                  {s.label}
                </Link>
              ))}
              {subjects.length === 0 && (
                <p className="text-sm text-gray-400">No subjects assigned yet.</p>
              )}
            </div>
          </section>
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

  // Sections the teacher can view: they proctor the class, or teach a
  // subject within that section.
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

  const subjectsRaw = await prisma.subject.findMany({
    where: role === "ADMIN" ? {} : { assignments: { some: { teacherId: userId } } },
    include: { section: { include: { class: true } } },
  });

  return {
    props: {
      teacherName: session.user.name || session.user.email,
      sections: sectionsRaw.map((s) => ({
        id: s.id,
        label: `${s.class.department.name} — ${s.class.program}, Sem ${s.class.semester}, Section ${s.name}`,
      })),
      subjects: subjectsRaw.map((s) => ({
        id: s.id,
        label: `${s.name} (${s.code}) — Section ${s.section.name}`,
      })),
    },
  };
};
