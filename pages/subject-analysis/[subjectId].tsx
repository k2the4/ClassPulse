import { GetServerSideProps } from "next";

// Bare /subject-analysis/[subjectId] isn't a page on its own — analysis
// lives under /attendance, /academic, /overall, /students, mirroring
// section-analysis. This just redirects to the default tab.
export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const { subjectId } = ctx.params as { subjectId: string };
  return {
    redirect: {
      destination: `/subject-analysis/${subjectId}/attendance`,
      permanent: false,
    },
  };
};

export default function SubjectAnalysisRedirect() {
  return null;
}
