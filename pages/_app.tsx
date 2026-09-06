import { useEffect } from "react";
import type { AppProps } from "next/app";
import GlobalButtonLoading from "../components/GlobalButtonLoading";
import "../styles/globals.css";
import "../styles/analysis.css";
import "../styles/overall-analysis-fixes.css";
import "../styles/academic-table-fix.css";
import "../styles/academic-summary-fix.css";

function AnalysisSidebarRouting() {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const link = target?.closest(".analysis-side-nav a") as HTMLAnchorElement | null;
      if (!link) return;

      const label = link.textContent?.trim();
      if (label === "Class Analysis") {
        event.preventDefault();
        window.location.href = "/class-analysis";
      } else if (label === "Subject Analysis") {
        event.preventDefault();
        window.location.href = "/subject-analysis";
      }
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return null;
}

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div className="notranslate" translate="no">
      <AnalysisSidebarRouting />
      <GlobalButtonLoading />
      <Component {...pageProps} />
    </div>
  );
}
