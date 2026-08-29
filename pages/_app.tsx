import type { AppProps } from "next/app";
import { SessionProvider } from "next-auth/react";
import GlobalButtonLoading from "../components/GlobalButtonLoading";
import "../styles/globals.css";
import "../app/globals.css";
import "../styles/overall-analysis-fixes.css";

export default function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  return (
    <SessionProvider session={session}>
      <GlobalButtonLoading />
      <Component {...pageProps} />
    </SessionProvider>
  );
}
