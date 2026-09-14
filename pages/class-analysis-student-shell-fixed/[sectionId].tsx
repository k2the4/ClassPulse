import { useEffect } from "react";
import SubjectStudentReportPage from "../section-analysis/[sectionId]/students";

const SHELL_CSS = `
  .class-analysis-student-shell-fix .student-report-shell-heading { margin-top: 20px !important; margin-bottom: 20px !important; }
  .class-analysis-student-shell-fix .student-report-shell-heading p { display: none !important; }
  .class-analysis-student-shell-fix .student-report-profile-meta { color: #94a3b8 !important; }
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

function installFix() {
  const page = document.querySelector("div.min-h-screen.max-w-\\[1900px\\]") as HTMLElement | null;
  if (!page || page.dataset.classAnalysisStudentShellFix === "1") return;
  page.dataset.classAnalysisStudentShellFix = "1";
  page.classList.add("class-analysis-student-shell-fix");

  const style = document.createElement("style");
  style.id = "class-analysis-student-shell-fix-style";
  style.textContent = SHELL_CSS;
  document.head.appendChild(style);

  const header = page.firstElementChild as HTMLElement | null;
  if (header) {
    header.className = "analysis-topbar";
    const titleRow = header.firstElementChild as HTMLElement | null;
    const actionRow = header.lastElementChild as HTMLElement | null;
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
    if (actionRow) actionRow.className = "analysis-top-actions";
  }

  const heading = page.querySelector("h2")?.parentElement as HTMLElement | null;
  if (heading) {
    heading.classList.add("student-report-shell-heading");
    heading.querySelector("p")?.remove();
  }

  const sideNavObserver = new MutationObserver(() => {
    const sideNav = document.querySelector(".analysis-standalone-nav") as HTMLElement | null;
    if (sideNav) {
      sideNav.querySelector("a.is-active")?.classList.remove("is-active");
      sideNav.querySelector('a[href="/class-analysis"]')?.classList.add("is-active");
    }
    syncStudentMeta(page);
  });
  sideNavObserver.observe(document.body, { childList: true, subtree: true, characterData: true });

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
  syncStudentMeta(page);

  (window as any).__classPulseStudentShellFixObserver = sideNavObserver;
}

export default function ClassAnalysisStudentShellFixedPage() {
  useEffect(() => {
    const frame = requestAnimationFrame(installFix);
    return () => {
      cancelAnimationFrame(frame);
      (window as any).__classPulseStudentShellFixObserver?.disconnect?.();
      delete (window as any).__classPulseStudentShellFixObserver;
      document.getElementById("class-analysis-student-shell-fix-style")?.remove();
    };
  }, []);

  return <SubjectStudentReportPage />;
}
