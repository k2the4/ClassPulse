import { GetServerSideProps } from "next";

export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: { destination: "/class-analysis", permanent: false },
});

export default function SectionAnalysisRedirect() {
  return null;
}
