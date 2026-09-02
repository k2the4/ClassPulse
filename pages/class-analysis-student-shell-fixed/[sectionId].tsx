import { useEffect } from "react";
import { BarChart3, BookOpen, GraduationCap, LayoutDashboard } from "lucide-react";
import SubjectStudentReportPage from "../section-analysis/[sectionId]/students";

const SHELL_CSS = `
  .class-analysis-student-shell { min-height: 100vh; }
  .class-analysis-student-shell .analysis-layout { min-height: 100vh; }
  .class-analysis-student-shell .analysis-sidebar { position: sticky; top: 0; height: 100vh; }
  .class-analysis-student-shell .analysis-page { min-width: 0; }
  .class-analysis-student-shell .student-report-shell-heading { margin-top: 20px !important; margin-bottom: 20px !important; }
  .class-analysis-student-shell .student-report-shell-heading p { display: none !important; }
  .class-analysis-student-shell .student-report-profile-meta { color: #94a3b8 !important; }
  .class-analysis-student-shell .student-report-top-raw { display: none !important; }
`;

function installShell() {
  const root = document.querySelector("body > div") as HTMLElement | null;
  if (!root || root.dataset.classAnalysisStudentShell === "1") return;
  root.dataset.classAnalysisStudentShell = "1";
  root.className = "class-analysis-student-shell";

  const style = document.createElement("style");
  style.id = "class-analysis-student-shell-style";
  style.textContent = SHELL_CSS;
  document.head.appendChild(style);

  const children = Array.from(root.children);
  const header = children[0] as HTMLElement | undefined;
  if (!header) return;

  const main = document.createElement("main");
  main.className = "analysis-page";
  children.forEach((child) => main.appendChild(child));

  const sidebar = document.createElement("aside");
  sidebar.className = "analysis-sidebar";
  sidebar.innerHTML = `
    <div class="analysis-brand">
      <span class="analysis-brand__mark">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
      </span>
      <span>ClassPulse</span>
    </div>
    <nav class="analysis-side-nav">
      <a href="/dashboard"><span class="shell-icon">▦</span>Dashboard</a>
      <a class="is-active" href="/class-analysis"><span class="shell-icon">▣</span>Class Analysis</a>
      <a href="/subject-analysis"><span class="shell-icon">⌁</span>Subject Analysis</a>
    </nav>
    <div class="class-analysis-student-raw"></div>
    <div class="analysis-side-footer">ClassPulse Teacher Portal</div>
  `;

  const rawButton = header.querySelector("button") as HTMLElement | null;
  if (rawButton) sidebar.querySelector(".class-analysis-student-raw")?.appendChild(rawButton.cloneNode(true));

  const titleRow = header.firstElementChild as HTMLElement | null;
  const actionRow = header.lastElementChild as HTMLElement | null;
  if (titleRow) {
    titleRow.className = "analysis-title-row";
    const title = titleRow.querySelector("h1");
    if (title) title.className = "";
    const sync = titleRow.querySelector("p");
    if (sync) {
      sync.className = "analysis-sync";
      sync.textContent = `• Last synced ${sync.textContent.replace(/^Last synced\s*/i, "")}`;
    }
  }
  header.className = "analysis-topbar";
  if (actionRow) {
    actionRow.className = "analysis-top-actions";
    const buttons = Array.from(actionRow.querySelectorAll("button"));
    if (buttons.length > 1) buttons.slice(0, -1).forEach((button) => button.remove());
  }

  const heading = main.querySelector("h2")?.parentElement as HTMLElement | null;
  if (heading) {
    heading.classList.add("student-report-shell-heading");
    const description = heading.querySelector("p");
    description?.remove();
  }

  const observer = new MutationObserver(() => {
    const profile = Array.from(main.querySelectorAll("section")).find((section) => {
      const h3 = section.querySelector("h3");
      return h3 && h3.textContent?.trim() && section.querySelector("p");
    });
    if (!profile) return;
    const h3 = profile.querySelector("h3");
    const meta = Array.from(profile.querySelectorAll("p")).find((p) => p.textContent?.includes("Student report"));
    if (meta) {
      const studentName = h3?.textContent?.trim() || "";
      const students = (window as any).__classPulseStudentData;
      const match = students?.find((s: any) => s.name === studentName);
      if (match) meta.textContent = `${match.enrollmentNo} · ${match.email || ""}`;
      meta.className = "text-xs mt-1 truncate student-report-profile-meta";
    }
  });
  observer.observe(main, { childList: true, subtree: true, characterData: true });

  const fetchStudentData = async () => {
    const match = window.location.pathname.match(/\/section-analysis\/([^/]+)\/students$/);
    if (!match) return;
    try {
      const res = await fetch(`/api/analysis/section/${match[1]}/overall`);
      const json = await res.json();
      if (json.data?.students) {
        (window as any).__classPulseStudentData = json.data.students;
        observer.takeRecords();
        document.body.dispatchEvent(new Event("classpulse-student-data"));
      }
    } catch {}
  };
  fetchStudentData();

  root.appendChild(sidebar);
  root.appendChild(main);
}

export default function ClassAnalysisStudentShellFixedPage() {
  useEffect(() => {
    const frame = requestAnimationFrame(installShell);
    return () => {
      cancelAnimationFrame(frame);
      document.getElementById("class-analysis-student-shell-style")?.remove();
    };
  }, []);

  return <SubjectStudentReportPage />;
}
