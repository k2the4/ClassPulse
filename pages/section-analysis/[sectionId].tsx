import { GetServerSideProps } from "next";

// Keep legacy dashboard/bookmark URLs working, but always require
// class selection before opening Class Analysis.
export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: { destination: "/class-analysis", permanent: false },
});

export default function SectionAnalysisRedirect() {
  return null;
}
