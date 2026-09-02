import { useEffect } from "react";
import SectionOverallPage from "../section-analysis/[sectionId]/overall";

function installOverallHeading() {
  const filter = document.querySelector(".at-risk-filter") as HTMLElement | null;
  if (!filter || document.querySelector(".class-analysis-overall-heading")) return;

  const heading = document.createElement("div");
  heading.className = "class-analysis-overall-heading";
  heading.innerHTML = `<h2>Overall</h2>`;
  heading.style.cssText = "margin:20px 0 20px;";
  const h2 = heading.querySelector("h2") as HTMLElement;
  h2.style.cssText = "font-size:20px;line-height:1.25;font-weight:600;margin:0;color:#0f172a;";
  filter.parentElement?.insertBefore(heading, filter);
}

export default function ClassAnalysisOverallHeadingFixedPage() {
  useEffect(() => {
    const run = () => requestAnimationFrame(installOverallHeading);
    run();
    const observer = new MutationObserver(run);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return <SectionOverallPage />;
}
