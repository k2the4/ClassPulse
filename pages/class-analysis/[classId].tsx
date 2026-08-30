import { GetServerSideProps } from "next";

// Class selection uses the new /class-analysis page, but the existing
// class-analysis experience remains under /section-analysis/[sectionId].
// Keep this route as a compatibility redirect so the existing analysis UI
// and its Attendance / Academic / Overall / Student Report tabs are preserved.
export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const { classId } = ctx.params as { classId: string };

  return {
    redirect: {
      destination: `/section-analysis/${classId}/attendance`,
      permanent: false,
    },
  };
};

export default function ClassAnalysisRedirect() {
  return null;
}
