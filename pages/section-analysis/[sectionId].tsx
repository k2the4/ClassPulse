import { GetServerSideProps } from "next";

// Legacy class-analysis URLs must go through the assigned-class selector.
// This prevents dashboard/bookmark links from bypassing teacher-scoped selection.
export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: {
    destination: "/section-analysis",
    permanent: false,
  },
});

export default function SectionAnalysisRedirect() {
  return null;
}
