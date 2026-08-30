import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../lib/authOptions";
import { prisma } from "../../lib/prisma";

// The selector is class-based, while the existing analysis implementation is
// section-based internally. A ClassPulse "class" currently maps to its
// assigned section (for example ECE-2 Sem 7 -> section 2 of that class).
// Resolve that section here and hand off to the existing analysis UI.
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

  const cls = await prisma.class.findUnique({
    where: { id: classId },
    include: {
      sections: {
        orderBy: { name: "asc" },
        select: { id: true },
      },
    },
  });

  if (!cls || cls.sections.length === 0) {
    return { notFound: true };
  }

  // Match the same access rules used by the existing section analysis:
  // admin, class proctor, or teacher assigned to a subject in this class.
  if (role !== "ADMIN") {
    const isProctor = cls.proctorId === userId;
    const teachesInClass = await prisma.assignment.findFirst({
      where: {
        teacherId: userId,
        subject: { section: { classId } },
      },
      select: { id: true },
    });

    if (!isProctor && !teachesInClass) {
      return { notFound: true };
    }
  }

  const sectionId = cls.sections[0].id;

  return {
    redirect: {
      destination: `/section-analysis/${sectionId}/attendance`,
      permanent: false,
    },
  };
};

export default function ClassAnalysisRedirect() {
  return null;
}
