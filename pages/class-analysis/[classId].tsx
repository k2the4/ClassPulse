import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../lib/authOptions";
import { prisma } from "../../lib/prisma";

// Class Analysis is a class-level entry point into the existing section-based
// analysis UI. Teachers may enter a class only through an explicit ClassAccess
// record; teaching a subject or being listed as a proctor does not grant access.
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

  const classAccess = await prisma.classAccess.findUnique({
    where: { teacherId_classId: { teacherId: userId, classId } },
  });

  if (!classAccess) {
    return { notFound: true };
  }

  const section = await prisma.section.findFirst({
    where: { classId },
    orderBy: { name: "asc" },
    select: { id: true },
  });

  if (!section) {
    return { notFound: true };
  }

  return {
    redirect: {
      destination: `/section-analysis/${section.id}/attendance`,
      permanent: false,
    },
  };
};

export default function ClassAnalysisRedirect() {
  return null;
}
