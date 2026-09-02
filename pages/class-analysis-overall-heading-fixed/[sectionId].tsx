import { useEffect } from "react";
import SectionOverallPage from "../section-analysis/[sectionId]/overall";

type OverallStudent = {
  enrollmentNo: string;
  name: string;
  subjects?: Array<{ basicInternal?: number }>;
};

type OverallPayload = {
  students?: OverallStudent[];
};

const TIER_RANGES: Record<string, [number, number]> = {
  Excellent: [32, 40],
  Good: [24, 31.99],
  "Needs Attention": [16, 23.99],
  "Critical Risk": [0, 15.99],
};

const CARD_COLORS = ["#3b82f6", "#16a34a", "#f59e0b", "#7c3aed", "#06b6d4"];

function formatMark(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function getSectionId() {
  const match = window.location.pathname.match(/\/section-analysis\/([^/]+)/);
  return match?.[1] || "";
}

function setNativeInputValue(input: HTMLInputElement, value: number) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, String(value));
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function findPanelByHeading(text: string) {
  const heading = Array.from(document.querySelectorAll("h2,h3,h4,p"))
    .find((element) => element.textContent?.trim() === text) as HTMLElement | undefined;
  if (!heading) return null;
  return heading.closest("section") as HTMLElement | null;
}

function makeMetricCard(label: string, value: string, detail: string, color: string) {
  const card = document.createElement("section");
  card.className = "rounded-xl border border-slate-200 bg-white p-4 shadow-sm classpulse-overall-metric";
  card.dataset.classpulseMetric = label;
  card.style.borderTop = `3px solid ${color}`;
  card.innerHTML = `
    <p class="text-xs text-slate-500">${label}</p>
    <p class="mt-1 text-[28px] font-extrabold text-slate-900">${value}</p>
    <p class="mt-1 text-[10px] text-slate-400">${detail}</p>
  `;
  return card;
}

function installHeadingAndMetrics(topStudents: OverallStudent[]) {
  const filter = document.querySelector(".at-risk-filter") as HTMLElement | null;
  if (!filter) return;

  const metrics = filter.previousElementSibling as HTMLElement | null;
  if (!metrics || !metrics.classList.contains("grid")) return;

  metrics.classList.add("classpulse-overall-metrics");
  metrics.style.gridTemplateColumns = "repeat(5, minmax(0, 1fr))";
  metrics.style.gap = "12px";

  let heading = document.querySelector(".classpulse-overall-heading") as HTMLElement | null;
  if (!heading) {
    heading = document.createElement("div");
    heading.className = "classpulse-overall-heading";
    heading.innerHTML = `
      <h2>Overall Analysis</h2>
      <p>Overall performance overview across the six theory subjects.</p>
    `;
    metrics.parentElement?.insertBefore(heading, metrics);
  }

  const existing = new Set(
    Array.from(metrics.querySelectorAll<HTMLElement>("[data-classpulse-metric]"))
      .map((element) => element.dataset.classpulseMetric || "")
  );

  if (!existing.has("High Performers")) {
    const highPerformers = topStudents.filter((student) => {
      const subjects = student.subjects?.slice(0, 6) || [];
      const average = subjects.length
        ? subjects.reduce((sum, subject) => sum + (Number(subject.basicInternal) || 0), 0) / subjects.length
        : 0;
      return average >= 28;
    }).length;
    metrics.appendChild(makeMetricCard("High Performers", String(highPerformers), "students scoring 70% or more", CARD_COLORS[3]));
  }

  if (!existing.has("Needs Attention")) {
    const needsAttention = topStudents.filter((student) => {
      const subjects = student.subjects?.slice(0, 6) || [];
      const average = subjects.length
        ? subjects.reduce((sum, subject) => sum + (Number(subject.basicInternal) || 0), 0) / subjects.length
        : 0;
      return average < 16;
    }).length;
    metrics.appendChild(makeMetricCard("Needs Attention", String(needsAttention), "students scoring below 40%", CARD_COLORS[4]));
  }
}

function installTableNumbering() {
  const table = document.querySelector(".at-risk-table table") as HTMLTableElement | null;
  if (!table) return;

  const headRow = table.querySelector("thead tr") as HTMLTableRowElement | null;
  const bodyRows = Array.from(table.querySelectorAll("tbody tr")) as HTMLTableRowElement[];
  const firstHeader = headRow?.querySelector("th") as HTMLElement | null;
  if (!headRow || !firstHeader) return;

  const hasRank = Array.from(headRow.querySelectorAll("th")).some((th) => th.textContent?.trim() === "Rank");
  const customHeader = headRow.querySelector("[data-classpulse-sno]");
  const customCells = table.querySelectorAll("[data-classpulse-sno-cell]");
  const colgroup = table.querySelector("colgroup");

  if (hasRank) {
    customHeader?.remove();
    customCells.forEach((cell) => cell.remove());
    colgroup?.querySelector("[data-classpulse-sno-col]")?.remove();
    return;
  }

  if (!customHeader) {
    const th = document.createElement("th");
    th.dataset.classpulseSno = "true";
    th.className = "text-center px-1 py-2";
    th.textContent = "S.No.";
    headRow.insertBefore(th, headRow.firstElementChild);
  }

  if (colgroup && !colgroup.querySelector("[data-classpulse-sno-col]")) {
    const col = document.createElement("col");
    col.dataset.classpulseSnoCol = "true";
    col.style.width = "5%";
    colgroup.insertBefore(col, colgroup.firstElementChild);
  }

  bodyRows.forEach((row, index) => {
    if (!row.querySelector("[data-classpulse-sno-cell]")) {
      const td = document.createElement("td");
      td.dataset.classpulseSnoCell = "true";
      td.className = "text-center px-1 py-2 text-slate-500";
      td.textContent = String(index + 1);
      row.insertBefore(td, row.firstElementChild);
    } else {
      const cell = row.querySelector("[data-classpulse-sno-cell]") as HTMLElement;
      cell.textContent = String(index + 1);
    }
  });

  const cols = Array.from(colgroup?.querySelectorAll("col") || []) as HTMLElement[];
  if (cols.length >= 12) {
    const widths = [5, 13, 7, 7, 7, 7, 7, 7, 9, 9, 8, 12];
    cols.slice(0, widths.length).forEach((col, index) => { col.style.width = `${widths[index]}%`; });
  }
}

function installDistributionClicks() {
  const panel = findPanelByHeading("Distribution");
  if (!panel) return;

  Object.entries(TIER_RANGES).forEach(([tier, [lower, upper]]) => {
    const label = Array.from(panel.querySelectorAll("p,span,div"))
      .find((element) => element.children.length === 0 && element.textContent?.trim() === tier) as HTMLElement | undefined;
    if (!label) return;

    const row = (label.closest("div.flex") || label.parentElement?.parentElement || label.parentElement) as HTMLElement | null;
    if (!row) return;

    row.style.cursor = "pointer";
    row.title = `Filter students: ${tier}`;
    row.onclick = () => {
      const inputs = Array.from(document.querySelectorAll(".at-risk-filter input[type='number']")) as HTMLInputElement[];
      const apply = document.querySelector(".at-risk-apply") as HTMLButtonElement | null;
      if (inputs.length >= 2) {
        setNativeInputValue(inputs[0], lower);
        setNativeInputValue(inputs[1], upper);
        apply?.click();
      }
    };
  });
}

function installTopFive(topStudents: OverallStudent[]) {
  const panel = findPanelByHeading("Top Students");
  if (!panel) return;

  const ranked = topStudents
    .map((student) => {
      const subjects = student.subjects?.slice(0, 6) || [];
      const average = subjects.length
        ? subjects.reduce((sum, subject) => sum + (Number(subject.basicInternal) || 0), 0) / subjects.length
        : 0;
      return { ...student, average };
    })
    .sort((a, b) => b.average - a.average || a.name.localeCompare(b.name))
    .slice(0, 5);

  panel.innerHTML = `
    <div class="px-3 py-3 border-b border-slate-100">
      <h3 class="text-sm font-semibold text-slate-900">Top 5 Students</h3>
      <p class="text-[10px] text-slate-500 mt-1">Highest average internal marks.</p>
    </div>
    <div class="px-3">
      ${ranked.map((student, index) => `
        <div class="flex items-center justify-between gap-3 py-3 border-b border-slate-100 last:border-0">
          <div class="flex min-w-0 items-center gap-3">
            <span class="text-[10px] text-slate-400 w-4">${index + 1}.</span>
            <span class="truncate text-[10px] text-slate-700">${student.name}</span>
          </div>
          <strong class="text-[11px] text-emerald-600 whitespace-nowrap">${formatMark(student.average)} / 40</strong>
        </div>
      `).join("")}
    </div>
  `;
}

async function loadOverallStudents() {
  const sectionId = getSectionId();
  if (!sectionId) return [];

  try {
    const response = await fetch(`/api/analysis/section/${sectionId}/overall`);
    if (!response.ok) return [];
    const json = await response.json();
    return (json.data?.students || []) as OverallStudent[];
  } catch {
    return [];
  }
}

function installStyles() {
  if (document.getElementById("classpulse-overall-fixes")) return;
  const style = document.createElement("style");
  style.id = "classpulse-overall-fixes";
  style.textContent = `
    .classpulse-overall-heading { margin: 20px 0 16px; }
    .classpulse-overall-heading h2 { margin: 0; color: #0f172a; font-size: 20px; line-height: 1.25; font-weight: 600; }
    .classpulse-overall-heading p { margin: 5px 0 0; color: #64748b; font-size: 12px; line-height: 1.5; }
    .classpulse-overall-metrics > .classpulse-overall-metric { min-width: 0; }
    @media (max-width: 1100px) {
      .classpulse-overall-metrics { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
    }
    @media (max-width: 700px) {
      .classpulse-overall-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
    }
    @media (max-width: 480px) {
      .classpulse-overall-metrics { grid-template-columns: 1fr !important; }
    }
  `;
  document.head.appendChild(style);
}

export default function ClassAnalysisOverallHeadingFixedPage() {
  useEffect(() => {
    let disposed = false;
    let observer: MutationObserver | null = null;
    let scheduled = false;
    let students: OverallStudent[] = [];

    const apply = () => {
      scheduled = false;
      if (disposed) return;
      observer?.disconnect();
      installStyles();
      installHeadingAndMetrics(students);
      installTableNumbering();
      installDistributionClicks();
      installTopFive(students);
      observer?.observe(document.body, { childList: true, subtree: true });
    };

    const schedule = () => {
      if (scheduled || disposed) return;
      scheduled = true;
      requestAnimationFrame(apply);
    };

    observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });

    loadOverallStudents().then((result) => {
      if (disposed) return;
      students = result;
      schedule();
    });

    schedule();

    return () => {
      disposed = true;
      observer?.disconnect();
    };
  }, []);

  return <SectionOverallPage />;
}
