import { useEffect } from "react";
import SubjectAcademicPage from "../subject-analysis/[subjectId]/academic";

const COMBINED_CSS = `
  .combined-table-panel { min-width: 0 !important; }
  .combined-layout { grid-template-columns: minmax(0, 1.65fr) minmax(300px, .85fr) !important; }
  .combined-table-wrap { min-width: 0 !important; overflow-x: hidden !important; overflow-y: auto !important; }
  .combined-table-panel .analysis-table { width: 100% !important; max-width: 100% !important; min-width: 0 !important; table-layout: fixed !important; }
  .combined-table-panel .analysis-table th,
  .combined-table-panel .analysis-table td { white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; }
  .combined-table-panel .analysis-table th:nth-child(1), .combined-table-panel .analysis-table td:nth-child(1) { width: 7% !important; }
  .combined-table-panel .analysis-table th:nth-child(2), .combined-table-panel .analysis-table td:nth-child(2) { width: 24% !important; }
  .combined-table-panel .analysis-table th:nth-child(3), .combined-table-panel .analysis-table td:nth-child(3) { width: 16% !important; }
  .combined-table-panel .analysis-table th:nth-child(4), .combined-table-panel .analysis-table td:nth-child(4),
  .combined-table-panel .analysis-table th:nth-child(5), .combined-table-panel .analysis-table td:nth-child(5),
  .combined-table-panel .analysis-table th:nth-child(6), .combined-table-panel .analysis-table td:nth-child(6),
  .combined-table-panel .analysis-table th:nth-child(7), .combined-table-panel .analysis-table td:nth-child(7) { width: 10% !important; }
  .combined-table-panel .analysis-table th:nth-child(8), .combined-table-panel .analysis-table td:nth-child(8) { width: 13% !important; }
  .combined-table-panel .analysis-table th:not(:nth-child(2)):not(:nth-child(3)),
  .combined-table-panel .analysis-table td:not(:nth-child(2)):not(:nth-child(3)) { text-align: center; }
  .combined-table-panel .analysis-table th:nth-child(2), .combined-table-panel .analysis-table td:nth-child(2),
  .combined-table-panel .analysis-table th:nth-child(3), .combined-table-panel .analysis-table td:nth-child(3) { text-align: left; }
  .combined-tier-panel { display: none !important; }
  .combined-controls-bar:not(.combined-controls-proxy) { display: none !important; }
  .combined-controls-proxy { display: flex !important; justify-content: flex-end; align-items: flex-end; gap: 12px; margin: 0 0 14px; padding: 12px; border: 1px solid #eef1f5; border-radius: 10px; background: #fafbfc; }
  .combined-controls-proxy .combined-control { min-width: 180px; }
  .combined-controls-proxy .combined-control label { display: block; margin-bottom: 7px; color: #667085; font-size: 11px; font-weight: 600; }
  .combined-controls-proxy .combined-control select { width: 100%; height: 38px; border: 1px solid #d8e0ea; border-radius: 9px; background: #fff; color: #344054; padding: 0 12px; font-size: 13px; outline: none; box-sizing: border-box; }
  .combined-controls-proxy .combined-control select:focus { border-color: #4b2e91; box-shadow: 0 0 0 2px rgba(75,46,145,.12); }
  .combined-table-panel .tier-mark.excellent { color: #4d75d0 !important; }
  .combined-table-panel .tier-mark.good { color: #15966a !important; }
  .combined-table-panel .tier-mark.attention { color: #f59e0b !important; }
  .combined-table-panel .tier-mark.risk { color: #ef4444 !important; }
  .summary-filter-title { align-items: center !important; }
  .summary-filter-title > div:first-child { min-width: 0; }
  .summary-filter-actions { display: flex !important; align-items: center; gap: 8px; flex-shrink: 0; }
  .summary-filter-actions button { height: 36px; min-width: 64px; padding: 0 12px !important; }
  .summary-apply-button { border: 0; border-radius: 8px; background: #4b2e91; color: #fff; font-weight: 600; cursor: pointer; }
  .summary-apply-button:hover { background: #3f267b; }
  .summary-table-wrap { min-width: 0 !important; overflow-x: hidden !important; overflow-y: auto !important; }
  .summary-table-wrap .analysis-table { width: 100% !important; max-width: 100% !important; min-width: 0 !important; table-layout: fixed !important; }
  .summary-table-wrap .analysis-table th,
  .summary-table-wrap .analysis-table td { white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; }
  .summary-table-wrap .analysis-table th:nth-child(1), .summary-table-wrap .analysis-table td:nth-child(1) { width: 8% !important; text-align: center !important; }
  .summary-table-wrap .analysis-table th:nth-child(2), .summary-table-wrap .analysis-table td:nth-child(2) { width: 23% !important; text-align: left !important; }
  .summary-table-wrap .analysis-table th:nth-child(3), .summary-table-wrap .analysis-table td:nth-child(3) { width: 41% !important; text-align: left !important; }
  .summary-table-wrap .analysis-table th:nth-child(4), .summary-table-wrap .analysis-table td:nth-child(4) { width: 13% !important; text-align: center !important; }
  .summary-table-wrap .analysis-table th:nth-child(5), .summary-table-wrap .analysis-table td:nth-child(5) { width: 15% !important; text-align: center !important; }
  .summary-table-wrap .summary-index-cell { text-align: center !important; font-variant-numeric: tabular-nums; }
  @media (max-width: 1200px) { .combined-layout { grid-template-columns: 1fr !important; } }
  @media (max-width: 800px) { .combined-controls-proxy { justify-content: flex-start; flex-wrap: wrap; } .combined-controls-proxy .combined-control { min-width: 0; flex: 1 1 180px; } }
  @media (max-width: 600px) { .combined-controls-proxy { flex-direction: column; align-items: stretch; } .combined-controls-proxy .combined-control { width: 100%; } .summary-filter-title { align-items: stretch !important; } .summary-filter-actions { justify-content: flex-end; } }
`;

function installCombinedUiFix() {
  const styleId = "classpulse-combined-ui-fix";
  let style = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = styleId;
    style.textContent = COMBINED_CSS;
    document.head.appendChild(style);
  }

  const controls = document.querySelector(".combined-controls-bar:not(.combined-controls-proxy)") as HTMLElement | null;
  const panel = document.querySelector(".combined-table-panel") as HTMLElement | null;
  if (!controls || !panel) return;

  controls.style.display = "none";

  const sourceSelects = Array.from(controls.querySelectorAll("select"));
  const existing = panel.querySelector(".combined-controls-proxy") as HTMLElement | null;
  const existingSources = existing ? (existing as any).__sourceSelects as HTMLSelectElement[] | undefined : undefined;

  if (existing && existingSources?.[0] === sourceSelects[0] && existingSources?.[1] === sourceSelects[1]) {
    sourceSelects.forEach((source, index) => {
      const proxy = existing.querySelectorAll("select")[index] as HTMLSelectElement | undefined;
      if (proxy && proxy.value !== source.value) proxy.value = source.value;
    });
    return;
  }

  existing?.remove();
  const proxy = controls.cloneNode(true) as HTMLElement;
  proxy.classList.add("combined-controls-proxy");
  proxy.style.display = "flex";

  const proxySelects = Array.from(proxy.querySelectorAll("select"));
  const proxyLabels = Array.from(proxy.querySelectorAll("label"));
  const listeners: Array<() => void> = [];

  proxySelects.forEach((proxySelect, index) => {
    const source = sourceSelects[index];
    if (!source) return;
    proxySelect.id = `combined-sort-proxy-${index}`;
    proxySelect.value = source.value;
    proxyLabels[index]?.setAttribute("htmlFor", proxySelect.id);
    const onProxyChange = () => {
      source.value = proxySelect.value;
      source.dispatchEvent(new Event("change", { bubbles: true }));
    };
    const onSourceChange = () => {
      proxySelect.value = source.value;
    };
    proxySelect.addEventListener("change", onProxyChange);
    source.addEventListener("change", onSourceChange);
    listeners.push(() => {
      proxySelect.removeEventListener("change", onProxyChange);
      source.removeEventListener("change", onSourceChange);
    });
  });

  (proxy as any).__sourceSelects = sourceSelects;
  (proxy as any).__cleanup = () => listeners.forEach((cleanup) => cleanup());
  panel.prepend(proxy);
}

function installSummaryUiFix() {
  const panel = document.querySelector(".summary-filter-panel") as HTMLElement | null;
  const title = panel?.querySelector(".summary-filter-title") as HTMLElement | null;
  if (!panel || !title) return;

  const reset = title.querySelector("button") as HTMLButtonElement | null;
  if (!reset || title.querySelector(".summary-filter-actions")) {
    if (title.querySelector(".summary-filter-actions")) syncSummaryTable();
    return;
  }

  const actions = document.createElement("div");
  actions.className = "summary-filter-actions";
  reset.parentElement?.insertBefore(actions, reset);
  actions.appendChild(reset);

  const apply = document.createElement("button");
  apply.type = "button";
  apply.className = "summary-apply-button";
  apply.textContent = "Apply";
  apply.addEventListener("click", () => {
    const filters = panel.querySelectorAll("select, input");
    filters.forEach((control) => control.dispatchEvent(new Event("change", { bubbles: true })));
    requestAnimationFrame(syncSummaryTable);
  });
  actions.appendChild(apply);
  syncSummaryTable();
}

function syncSummaryTable() {
  const table = document.querySelector(".summary-table-wrap .analysis-table") as HTMLTableElement | null;
  if (!table) return;
  const headerRow = table.querySelector("thead tr");
  const bodyRows = Array.from(table.querySelectorAll("tbody tr"));
  if (!headerRow) return;

  let indexHeader = headerRow.querySelector(".summary-index-header") as HTMLTableCellElement | null;
  if (!indexHeader) {
    indexHeader = document.createElement("th");
    indexHeader.className = "summary-index-header";
    headerRow.insertBefore(indexHeader, headerRow.firstElementChild);
  }

  const headers = Array.from(headerRow.children) as HTMLTableCellElement[];
  const enrollmentHeader = headers.find((cell) => cell !== indexHeader && cell.textContent?.trim() === "Enrollment");
  if (enrollmentHeader) enrollmentHeader.textContent = "Enrollment No.";

  const sortSelect = document.querySelector(".summary-filter-grid select:last-child") as HTMLSelectElement | null;
  const sorted = sortSelect?.value === "desc" || sortSelect?.value === "asc";
  indexHeader.textContent = sorted ? "Rank" : "S.No.";

  let visibleIndex = 0;
  bodyRows.forEach((row) => {
    if (row.querySelector("td[colspan]")) return;
    let cell = row.querySelector(".summary-index-cell") as HTMLTableCellElement | null;
    if (!cell) {
      cell = document.createElement("td");
      cell.className = "summary-index-cell";
      row.insertBefore(cell, row.firstElementChild);
    }
    visibleIndex += 1;
    cell.textContent = String(visibleIndex);
  });
}

export default function CombinedAnalysisFixedPage() {
  useEffect(() => {
    let frame = 0;
    const run = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        installCombinedUiFix();
        installSummaryUiFix();
        syncSummaryTable();
      });
    };

    run();
    const observer = new MutationObserver(run);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", run);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", run);
      const proxy = document.querySelector(".combined-controls-proxy") as any;
      proxy?.__cleanup?.();
      proxy?.remove();
      document.getElementById("classpulse-combined-ui-fix")?.remove();
    };
  }, []);

  return <SubjectAcademicPage />;
}
