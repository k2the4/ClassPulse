import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../lib/authOptions";
import { prisma } from "../../lib/prisma";

// Class Analysis is a class-level entry point into the existing section-based
// analysis UI. A class can contain multiple sections, so never blindly pick
// the first section: resolve the section the signed-in user is actually
// allowed to view.
export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const classId = typeof ctx.params?.classId === "string" ? ctx.params.classId : "";

  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user) {
    return { redirect: { destination: "/login", permanent: false } };
  }

  if (!classId) {
    return { notFound: true };
  }

  const userId = (session.user as any).id as string;
  const role = (session.user as any).role as string;

  if (role === "ADMIN") {
    const section = await prisma.section.findFirst({
      where: { classId },
      orderBy: { name: "asc" },
      select: { id: true },
    });

    if (!section) return { notFound: true };

    return {
      redirect: {
        destination: `/section-analysis/${section.id}/attendance`,
        permanent: false,
      },
    };
  }

  // Prefer a section the teacher teaches. This is important when a class has
  // multiple sections: the section-analysis API enforces section-level access.
  const assignedSection = await prisma.section.findFirst({
    where: {
      classId,
      OR: [
        { class: { proctorId: userId } },
        { subjects: { some: { assignments: { some: { teacherId: userId } } } } },
      ],
    },
    orderBy: { name: "asc" },
    select: { id: true },
  });

  if (!assignedSection) {
    return { notFound: true };
  }

  return {
    redirect: {
      destination: `/section-analysis/${assignedSection.id}/attendance`,
      permanent: false,
    },
  };
};

export default function ClassAnalysisRedirect() {
  return null;
}
