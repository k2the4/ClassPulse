import { useEffect } from "react";
import SubjectStudentReportPage from "../section-analysis/[sectionId]/students";

const SHELL_CSS = `
  .class-analysis-student-shell { min-height: 100vh; display: grid; grid-template-columns: 198px minmax(0, 1fr); }
  .class-analysis-student-shell .analysis-sidebar { position: sticky; top: 0; height: 100vh; }
  .class-analysis-student-shell .analysis-page { min-width: 0; width: 100%; max-width: none; margin: 0; padding: 28px 32px; }
  .class-analysis-student-shell .student-report-shell-heading { margin-top: 20px !important; margin-bottom: 20px !important; }
  .class-analysis-student-shell .student-report-shell-heading p { display: none !important; }
  .class-analysis-student-shell .student-report-profile-meta { color: #94a3b8 !important; }
  .class-analysis-student-shell .class-analysis-student-raw button { margin-top: 18px; }
  .class-analysis-student-shell .shell-icon { width: 18px; display: inline-flex; justify-content: center; font-size: 17px; line-height: 1; }
  @media (max-width: 900px) {
    .class-analysis-student-shell { display: block; }
    .class-analysis-student-shell .analysis-sidebar { position: relative; height: auto; }
    .class-analysis-student-shell .analysis-page { padding: 24px; }
  }
`;

function syncStudentMeta(page: HTMLElement) {
  const profile = Array.from(page.querySelectorAll("section")).find((section) => {
    const h3 = section.querySelector("h3");
    return h3 && section.textContent?.includes("Rank by average");
  });
  if (!profile) return;
  const meta = Array.from(profile.querySelectorAll("p")).find((p) => p.textContent?.includes("Student report"));
  if (!meta) return;
  const name = profile.querySelector("h3")?.textContent?.trim() || "";
  const students = (window as any).__classPulseStudentData || [];
  const student = students.find((item: any) => item.name === name);
  if (student) meta.textContent = `${student.enrollmentNo} · ${student.email || ""}`;
  meta.className = "text-xs mt-1 truncate student-report-profile-meta";
}

function installShell() {
  const shell = document.getElementById("__next") as HTMLElement | null;
  const page = shell?.firstElementChild as HTMLElement | null;
  if (!shell || !page || shell.dataset.classAnalysisStudentShell === "1") return;

  shell.dataset.classAnalysisStudentShell = "1";
  shell.className = "class-analysis-student-shell";

  const style = document.createElement("style");
  style.id = "class-analysis-student-shell-style";
  style.textContent = SHELL_CSS;
  document.head.appendChild(style);

  page.className = "analysis-page";
  const header = page.firstElementChild as HTMLElement | null;
  if (!header) return;

  const sidebar = document.createElement("aside");
  sidebar.className = "analysis-sidebar";
  sidebar.innerHTML = `
    <div class="analysis-brand">
      <span class="analysis-brand__mark"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg></span>
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
  header.className = "analysis-topbar";
  if (titleRow) {
    titleRow.className = "analysis-title-row";
    const title = titleRow.querySelector("h1");
    if (title) title.className = "";
    const sync = titleRow.querySelector("p");
    if (sync) {
      sync.className = "analysis-sync";
      sync.textContent = `• ${sync.textContent.trim()}`;
    }
  }
  if (actionRow) {
    actionRow.className = "analysis-top-actions";
    const buttons = Array.from(actionRow.querySelectorAll("button"));
    if (buttons.length > 1) buttons.slice(0, -1).forEach((button) => button.remove());
  }

  const heading = page.querySelector("h2")?.parentElement as HTMLElement | null;
  if (heading) {
    heading.classList.add("student-report-shell-heading");
    heading.querySelector("p")?.remove();
  }

  shell.insertBefore(sidebar, page);

  const observer = new MutationObserver(() => syncStudentMeta(page));
  observer.observe(page, { childList: true, subtree: true, characterData: true });

  const fetchStudentData = async () => {
    const match = window.location.pathname.match(/\/section-analysis\/([^/]+)\/students$/);
    if (!match) return;
    try {
      const res = await fetch(`/api/analysis/section/${match[1]}/overall`);
      const json = await res.json();
      if (json.data?.students) {
        (window as any).__classPulseStudentData = json.data.students;
        syncStudentMeta(page);
      }
    } catch {}
  };
  fetchStudentData();

  (window as any).__classPulseStudentShellObserver = observer;
}

export default function ClassAnalysisStudentShellFixedPage() {
  useEffect(() => {
    const frame = requestAnimationFrame(installShell);
    return () => {
      cancelAnimationFrame(frame);
      (window as any).__classPulseStudentShellObserver?.disconnect?.();
      delete (window as any).__classPulseStudentShellObserver;
      document.getElementById("class-analysis-student-shell-style")?.remove();
    };
  }, []);

  return <SubjectStudentReportPage />;
}
