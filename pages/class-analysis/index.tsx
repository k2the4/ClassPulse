import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../lib/authOptions";
import { prisma } from "../../lib/prisma";
import Link from "next/link";

type ClassOption = { id: string; label: string };
type Props = { classes: ClassOption[] };

function formatClassLabel(department: string, semester: number, classNumber: string) {
  return `${department}${classNumber} Sem ${semester}`;
}

export default function ClassAnalysisIndex({ classes }: Props) {
  return (
    <div className="min-h-screen max-w-5xl mx-auto px-6 py-10">
      <Link href="/dashboard" className="text-sm text-indigo-600 hover:text-indigo-800">← Back to Dashboard</Link>
      <div className="mt-8 mb-6">
        <p className="text-sm font-medium text-indigo-600 mb-2">Class Analysis</p>
        <h1 className="text-2xl font-semibold text-gray-900">Choose a class</h1>
        <p className="text-sm text-gray-500 mt-2">Select a class assigned to you to open its analysis.</p>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-2">
        {classes.map((classOption) => (
          <Link key={classOption.id} href={`/class-analysis/${classOption.id}`} className="block rounded-xl border border-gray-100 px-4 py-4 text-sm text-gray-900 hover:bg-gray-50">
            {classOption.label}
          </Link>
        ))}
        {!classes.length && <p className="text-sm text-gray-400 py-4">No classes are assigned to you.</p>}
      </div>
    </div>
  );
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
    include: { class: { include: { department: true } } },
  });

  const classes = new Map<string, ClassOption>();
  for (const section of sections) {
    classes.set(section.class.id, {
      id: section.class.id,
      label: formatClassLabel(section.class.department.name, section.class.semester, section.name),
    });
  }

  return { props: { classes: Array.from(classes.values()) } };
};
