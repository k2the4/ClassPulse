import { useEffect } from "react";
import SubjectAttendancePage from "../subject-analysis/[subjectId]/attendance";

type Student = {
  enrollmentNo: string;
  name: string;
  email?: string;
  attendancePct: { prevMonth: number; currMonth: number; trend: string };
};
type AttendancePayload = {
  students?: Student[];
  monthsUsed?: { previous?: string; current?: string };
};

const fmt = (n: number) => `${Math.round(n * 10) / 10}%`;
const esc = (v: unknown) => String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const initials = (name: string) => name.split(" ").filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase();

function getSubjectId() {
  return window.location.pathname.match(/\/subject-analysis\/([^/]+)/)?.[1] || "";
}

function addStyles() {
  if (document.getElementById("classpulse-subject-attendance-trend-fixes")) return;
  const style = document.createElement("style");
  style.id = "classpulse-subject-attendance-trend-fixes";
  style.textContent = `
    .classpulse-trend-hero{display:grid!important;grid-template-columns:300px minmax(480px,620px)!important;justify-content:space-between!important;gap:24px!important;align-items:center!important}
    .classpulse-trend-hero-copy h2{margin:0;font-size:21px;line-height:1.2;font-weight:700;color:#17223b}
    .classpulse-trend-hero-copy p{margin:8px 0 0;max-width:300px;font-size:12px;line-height:1.55;color:#667085}
    .classpulse-trend-metrics{display:grid;grid-template-columns:repeat(2,minmax(220px,1fr));gap:10px;width:100%;max-width:620px}
    .classpulse-trend-metric{min-width:0;height:76px;padding:11px 14px;border:1px solid #e7ebf1;border-top:3px solid;border-radius:13px;background:#fff;box-shadow:0 2px 7px rgba(16,24,40,.04);box-sizing:border-box}
    .classpulse-trend-metric-label{display:block;font-size:10px;line-height:1.25;color:#64748b;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .classpulse-trend-metric-value{margin-top:5px;font-size:19px;line-height:1.15;color:#17223b;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .classpulse-trend-metric-detail{margin-top:3px;font-size:9px;line-height:1.25;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .classpulse-trend-table-wrap{overflow-x:hidden!important;overflow-y:auto!important;height:500px!important;max-height:500px!important;scrollbar-gutter:stable}
    .classpulse-trend-table{width:100%!important;max-width:100%!important;min-width:0!important;table-layout:fixed!important;border-collapse:collapse!important}
    .classpulse-trend-table th,.classpulse-trend-table td{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:10px 6px!important}
    .classpulse-trend-table th:nth-child(1),.classpulse-trend-table td:nth-child(1){width:5%!important;text-align:center}
    .classpulse-trend-table th:nth-child(2),.classpulse-trend-table td:nth-child(2){width:28%!important}
    .classpulse-trend-table th:nth-child(3),.classpulse-trend-table td:nth-child(3){width:18%!important}
    .classpulse-trend-table th:nth-child(4),.classpulse-trend-table td:nth-child(4){width:13%!important}
    .classpulse-trend-table th:nth-child(5),.classpulse-trend-table td:nth-child(5){width:13%!important}
    .classpulse-trend-table th:nth-child(6),.classpulse-trend-table td:nth-child(6){width:10%!important}
    .classpulse-trend-table th:nth-child(7),.classpulse-trend-table td:nth-child(7){width:13%!important}
    .classpulse-trend-chart-stack{min-width:0}
    .classpulse-trend-chart-stack .analysis-chart-panel{min-width:0}
    @media(min-width:1000px){.analysis-content-grid{grid-template-columns:minmax(0,1.35fr) minmax(300px,.85fr)!important;gap:14px!important}}
    @media(max-width:1050px){.classpulse-trend-hero{grid-template-columns:260px minmax(440px,1fr)!important}.classpulse-trend-metrics{max-width:560px}}
    @media(max-width:900px){.classpulse-trend-hero{grid-template-columns:1fr!important}.classpulse-trend-metrics{grid-template-columns:repeat(2,minmax(0,1fr));max-width:none}.analysis-content-grid{grid-template-columns:1fr!important}}
    @media(max-width:560px){.classpulse-trend-metrics{grid-template-columns:1fr}.classpulse-trend-table th,.classpulse-trend-table td{padding-left:4px!important;padding-right:4px!important}}
  `;
  document.head.appendChild(style);
}

function makeMetric(label: string, value: string, detail: string, color: string) {
  const card = document.createElement("div");
  card.className = "classpulse-trend-metric";
  card.style.borderTopColor = color;
  card.innerHTML = `<span class="classpulse-trend-metric-label">${esc(label)}</span><div class="classpulse-trend-metric-value">${esc(value)}</div><div class="classpulse-trend-metric-detail" title="${esc(detail)}">${esc(detail)}</div>`;
  return card;
}

function installHero(payload: AttendancePayload) {
  const hero = document.querySelector(".analysis-hero") as HTMLElement | null;
  if (!hero) return;
  hero.classList.add("classpulse-trend-hero");
  Array.from(hero.querySelectorAll(":scope > .analysis-metric")).forEach((x) => x.remove());
  const copy = hero.querySelector(":scope > .analysis-hero-copy") as HTMLElement | null;
  if (copy) copy.classList.add("classpulse-trend-hero-copy");
  let metrics = hero.querySelector(":scope > .classpulse-trend-metrics") as HTMLElement | null;
  if (!metrics) { metrics = document.createElement("div"); metrics.className = "classpulse-trend-metrics"; hero.appendChild(metrics); }
  metrics.innerHTML = "";
  const students = payload.students || [];
  const prev = students.length ? students.reduce((s, x) => s + Number(x.attendancePct.prevMonth || 0), 0) / students.length : 0;
  const curr = students.length ? students.reduce((s, x) => s + Number(x.attendancePct.currMonth || 0), 0) / students.length : 0;
  const improving = students.filter((x) => x.attendancePct.trend === "Increasing").length;
  const highest = [...students].sort((a, b) => Number(b.attendancePct.currMonth || 0) - Number(a.attendancePct.currMonth || 0))[0];
  metrics.appendChild(makeMetric(`Class Average (${payload.monthsUsed?.previous || "Previous"})`, fmt(prev), "Previous month attendance", "#2563eb"));
  metrics.appendChild(makeMetric(`Class Average (${payload.monthsUsed?.current || "Current"})`, fmt(curr), `${fmt(curr - prev)} change from previous month`, "#16a34a"));
  metrics.appendChild(makeMetric("Students Improving", String(improving), `${students.length ? fmt((improving / students.length) * 100) : "0%"} of total students`, "#f59e0b"));
  metrics.appendChild(makeMetric("Highest Attendance Student", highest ? fmt(Number(highest.attendancePct.currMonth || 0)) : "—", highest?.name || "Highest current-month attendance", "#7c3aed"));
}

function installTable(payload: AttendancePayload) {
  const panel = document.querySelector(".analysis-table-panel") as HTMLElement | null;
  const oldTable = panel?.querySelector("table.analysis-table") as HTMLTableElement | null;
  if (!panel || !oldTable) return;
  const students = payload.students || [];
  const oldSearch = panel.querySelector(".analysis-panel-head input") as HTMLInputElement | null;
  const search = oldSearch?.value || "";
  const filtered = students.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()) || s.enrollmentNo.toLowerCase().includes(search.toLowerCase()));
  oldTable.className = "analysis-table classpulse-trend-table";
  oldTable.innerHTML = `<thead><tr><th>S.No.</th><th>Student Name</th><th>Enrollment No.</th><th>${esc(payload.monthsUsed?.previous || "Month 1")}</th><th>${esc(payload.monthsUsed?.current || "Month 2")}</th><th>Change</th><th>Trend</th></tr></thead><tbody>${filtered.map((s, i) => { const prev = Number(s.attendancePct.prevMonth || 0); const curr = Number(s.attendancePct.currMonth || 0); const change = Math.round((curr - prev) * 10) / 10; const trend = s.attendancePct.trend; const badge = trend === "Increasing" ? "trend-up" : trend === "Decreasing" ? "trend-down" : "trend-stable"; return `<tr><td>${i + 1}</td><td><span class="student-cell"><span class="student-avatar">${esc(initials(s.name))}</span>${esc(s.name)}</span></td><td title="${esc(s.enrollmentNo)}">${esc(s.enrollmentNo)}</td><td>${fmt(prev)}</td><td>${fmt(curr)}</td><td class="${change > 0 ? "change-up" : change < 0 ? "change-down" : ""}">${change > 0 ? "+" : ""}${fmt(change)}</td><td><span class="trend-badge ${badge}">${trend === "Increasing" ? "↑ " : trend === "Decreasing" ? "↓ " : "− "}${esc(trend)}</span></td></tr>`; }).join("")}</tbody>`;
  const wrap = panel.querySelector(".analysis-table-wrap") as HTMLElement | null;
  if (wrap) wrap.classList.add("classpulse-trend-table-wrap");
  panel.querySelector(".classpulse-trend-pagination")?.remove();
  const count = panel.querySelector(".analysis-count") as HTMLElement | null;
  if (count) count.textContent = `${filtered.length} Students`;
}

function installCharts() {
  const stack = document.querySelector(".analysis-right-stack") as HTMLElement | null;
  if (stack) stack.classList.add("classpulse-trend-chart-stack");
}

export default function SubjectAnalysisAttendanceTrendFixedPage() {
  useEffect(() => {
    let dead = false;
    let timer: number | undefined;
    let running = false;
    const run = async () => {
      if (running || dead) return;
      running = true;
      const observer = (window as any).__subjectAttendanceObserver as MutationObserver | undefined;
      observer?.disconnect();
      addStyles();
      const id = getSubjectId();
      if (!id) { running = false; return; }
      try {
        const response = await fetch(`/api/analysis/subject/${id}`);
        if (!response.ok) return;
        const json = await response.json();
        if (dead) return;
        const payload: AttendancePayload = json.data || {};
        installHero(payload);
        installTable(payload);
        installCharts();
      } catch {} finally {
        running = false;
        if (!dead) observer?.observe(document.body, { childList: true, subtree: true });
      }
    };
    const schedule = () => { window.clearTimeout(timer); timer = window.setTimeout(run, 150); };
    const observer = new MutationObserver(schedule);
    (window as any).__subjectAttendanceObserver = observer;
    observer.observe(document.body, { childList: true, subtree: true });
    schedule();
    return () => { dead = true; window.clearTimeout(timer); observer.disconnect(); delete (window as any).__subjectAttendanceObserver; };
  }, []);
  return <SubjectAttendancePage />;
}
