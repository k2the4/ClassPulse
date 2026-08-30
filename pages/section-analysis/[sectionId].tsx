import { GetServerSideProps } from "next";

// The bare /section-analysis/[sectionId] URL isn't a page on its own —
// analysis lives under /attendance, /academic, /overall, /students.
// This just sends anyone landing here (dashboard links, bookmarks, etc.)
// straight to the default tab.
export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const { sectionId } = ctx.params as { sectionId: string };
  return {
    redirect: {
      destination: `/section-analysis/${sectionId}/attendance`,
      permanent: false,
    },
  };
};

export default function SectionAnalysisRedirect() {
  return null;
}
