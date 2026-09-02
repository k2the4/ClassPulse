import { useEffect } from "react";
import SectionOverallPage from "../section-analysis/[sectionId]/overall";

type MarkMode = "basic" | "moderated";
type Subject = { id: string; name: string; code: string };
type Score = { subjectId: string; code: string; name: string; basicInternal?: number; moderatedInternal?: number; basicMax?: number };
type Student = { enrollmentNo: string; name: string; subjects?: Score[] };
type Payload = { subjects?: Subject[]; students?: Student[] };
type Row = Student & { average: number; pct: number; tier: string; marks: Array<{ subject: Subject; mark: number; max: number; tier: string }> };

const TIERS = ["Excellent", "Good", "Needs Attention", "Critical Risk"];
const RANGES: Record<string, [number, number]> = { Excellent: [32, 40], Good: [24, 31.99], "Needs Attention": [16, 23.99], "Critical Risk": [0, 15.99] };
const COLORS: Record<string, string> = { Excellent: "#2563eb", Good: "#16a34a", "Needs Attention": "#f59e0b", "Critical Risk": "#ef4444" };
const CARD_COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#7c3aed", "#06b6d4"];

const fmt = (n: number) => Number.isInteger(n) ? String(n) : n.toFixed(1);
const tierFor = (pct: number) => pct >= 80 ? "Excellent" : pct >= 60 ? "Good" : pct >= 40 ? "Needs Attention" : "Critical Risk";
const esc = (v: unknown) => String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

function sectionId() {
  return window.location.pathname.match(/\/section-analysis\/([^/]+)/)?.[1] || "";
}

function rowsFor(payload: Payload, mode: MarkMode): Row[] {
  const subjects = (payload.subjects || []).slice(0, 6);
  return (payload.students || []).map((student) => {
    const marks = subjects.map((subject) => {
      const score = student.subjects?.find((s) => s.subjectId === subject.id || s.code === subject.code);
      const mark = Number(mode === "moderated" ? score?.moderatedInternal ?? score?.basicInternal ?? 0 : score?.basicInternal ?? 0);
      const max = Number(score?.basicMax || 40);
      return { subject, mark, max, tier: tierFor(max ? (mark / max) * 100 : 0) };
    });
    const average = marks.length ? marks.reduce((s, x) => s + x.mark, 0) / marks.length : 0;
    const max = marks.length ? marks.reduce((s, x) => s + x.max, 0) / marks.length : 40;
    return { ...student, marks, average, pct: max ? (average / max) * 100 : 0, tier: tierFor(max ? (average / max) * 100 : 0) };
  });
}

function setInput(input: HTMLInputElement, value: number) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, String(value));
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function panel(text: string) {
  const el = Array.from(document.querySelectorAll("h2,h3,h4,p")).find((x) => x.textContent?.trim() === text) as HTMLElement | undefined;
  return el?.closest("section") as HTMLElement | null;
}

function metric(label: string, value: string, detail: string, color: string) {
  const el = document.createElement("section");
  el.className = "rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm classpulse-overall-metric";
  el.style.borderTop = `3px solid ${color}`;
  el.innerHTML = `<p class="classpulse-metric-label">${esc(label)}</p><p class="classpulse-metric-value">${esc(value)}</p><p class="classpulse-metric-detail" title="${esc(detail)}">${esc(detail)}</p>`;
  return el;
}

function installMetrics(rows: Row[], subjects: Subject[]) {
  const filter = document.querySelector(".at-risk-filter") as HTMLElement | null;
  const grid = filter?.previousElementSibling as HTMLElement | null;
  if (!grid || !grid.classList.contains("grid")) return;
  let heading = document.querySelector(".classpulse-overall-heading") as HTMLElement | null;
  if (!heading) {
    heading = document.createElement("div");
    heading.className = "classpulse-overall-heading";
    heading.innerHTML = `<h2>Overall Analysis</h2><p>Overall performance overview across the six theory subjects.</p>`;
    grid.parentElement?.insertBefore(heading, grid);
  }
  const avgs = subjects.map((subject) => {
    const values = rows.map((r) => r.marks.find((m) => m.subject.id === subject.id)?.mark || 0);
    return { subject, average: values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0 };
  });
  const bestSubject = [...avgs].sort((a, b) => b.average - a.average || a.subject.name.localeCompare(b.subject.name))[0];
  const worstSubject = [...avgs].sort((a, b) => a.average - b.average || a.subject.name.localeCompare(b.subject.name))[0];
  const bestStudent = [...rows].sort((a, b) => b.average - a.average || a.name.localeCompare(b.name))[0];
  const classAverage = rows.length ? rows.reduce((s, r) => s + r.average, 0) / rows.length : 0;
  const above80 = rows.filter((r) => r.pct > 80).length;

  grid.innerHTML = "";
  grid.className = "grid classpulse-overall-metrics";
  grid.style.gridTemplateColumns = "repeat(5, minmax(0, 1fr))";
  grid.style.gap = "12px";
  grid.appendChild(metric("Class Average", `${fmt(classAverage)} / 40`, "average marks across all 6 theory subjects", CARD_COLORS[0]));
  grid.appendChild(metric("Best Performing Subject", bestSubject ? `${fmt(bestSubject.average)} / 40` : "—", bestSubject?.subject.name || "highest subject average", CARD_COLORS[1]));
  grid.appendChild(metric("Worst Performing Subject", worstSubject ? `${fmt(worstSubject.average)} / 40` : "—", worstSubject?.subject.name || "lowest subject average", CARD_COLORS[2]));
  grid.appendChild(metric("Best Performing Student", bestStudent ? `${fmt(bestStudent.average)} / 40` : "—", bestStudent?.name || "highest student average", CARD_COLORS[3]));
  grid.appendChild(metric("Students Above 80%", String(above80), "students scoring above 80% overall", CARD_COLORS[4]));
}

function installMode(mode: MarkMode, change: (m: MarkMode) => void) {
  const controls = document.querySelector(".at-risk-filter-controls") as HTMLElement | null;
  if (!controls) return;
  let select = document.querySelector("#classpulse-mark-mode") as HTMLSelectElement | null;
  if (!select) {
    const label = document.createElement("label");
    label.className = "classpulse-mark-mode-control";
    label.innerHTML = `<span>Marks</span><select id="classpulse-mark-mode"><option value="basic">Basic Marks</option><option value="moderated">Moderated Marks</option></select>`;
    controls.insertBefore(label, controls.firstElementChild);
    select = label.querySelector("select");
    select?.addEventListener("change", () => change(select?.value === "moderated" ? "moderated" : "basic"));
  }
  if (select.value !== mode) select.value = mode;
}

function filterState() {
  const inputs = Array.from(document.querySelectorAll(".at-risk-filter input[type='number']")) as HTMLInputElement[];
  const selects = Array.from(document.querySelectorAll(".at-risk-filter select")) as HTMLSelectElement[];
  const lo = Number(inputs[0]?.value ?? 0);
  const hi = Number(inputs[1]?.value ?? 40);
  return { lo: Number.isFinite(lo) ? Math.max(0, Math.min(40, lo)) : 0, hi: Number.isFinite(hi) ? Math.max(0, Math.min(40, hi)) : 40, sort: selects.find((s) => s.id !== "classpulse-mark-mode")?.value || "none" };
}

function renderTable(rows: Row[]) {
  const table = document.querySelector(".at-risk-table table") as HTMLTableElement | null;
  if (!table) return;
  const head = table.querySelector("thead tr");
  const body = table.querySelector("tbody");
  if (!head || !body) return;
  table.style.width = "100%";
  table.style.tableLayout = "fixed";
  table.style.minWidth = "0";
  const state = filterState();
  const lo = Math.min(state.lo, state.hi), hi = Math.max(state.lo, state.hi);
  const filtered = rows.filter((r) => r.average >= lo && r.average <= hi);
  const ordered = [...filtered].sort((a, b) => state.sort === "asc" ? a.average - b.average || a.name.localeCompare(b.name) : state.sort === "desc" ? b.average - a.average || a.name.localeCompare(b.name) : rows.indexOf(a) - rows.indexOf(b));
  head.innerHTML = `<th class="text-center px-0.5 py-2 classpulse-sno">${state.sort === "none" ? "S.No." : "Rank"}</th><th class="text-left px-1 py-2">Student</th><th class="text-left px-1 py-2">Enrollment No.</th>${rows[0]?.marks.map((m) => `<th class="text-center px-0.5 py-2">${esc(m.subject.code || m.subject.name)}</th>`).join("") || ""}<th class="text-center px-0.5 py-2">Total</th><th class="text-center px-0.5 py-2">Average</th><th class="text-center px-0.5 py-2">Grade</th>`;
  body.innerHTML = ordered.map((r, i) => {
    const total = r.marks.reduce((s, m) => s + m.mark, 0);
    return `<tr class="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"><td class="text-center px-0.5 py-2 text-slate-500 tabular-nums classpulse-sno">${i + 1}</td><td class="px-1 py-2 font-medium text-slate-800 truncate" title="${esc(r.name)}">${esc(r.name)}</td><td class="px-1 py-2 text-slate-600 truncate tabular-nums" title="${esc(r.enrollmentNo)}">${esc(r.enrollmentNo)}</td>${r.marks.map((m) => `<td class="text-center px-0.5 py-2 tabular-nums font-medium" style="color:${COLORS[m.tier]}">${fmt(m.mark)}</td>`).join("")}<td class="text-center px-0.5 py-2 font-semibold tabular-nums text-slate-900">${fmt(total)}</td><td class="text-center px-0.5 py-2 font-semibold tabular-nums" style="color:${COLORS[r.tier]}">${fmt(r.average)}</td><td class="text-center px-0.5 py-2"><span class="inline-flex max-w-full rounded-full px-1.5 py-0.5 text-[9px] font-semibold truncate ${r.tier === "Excellent" ? "bg-blue-50 text-blue-700" : r.tier === "Good" ? "bg-green-50 text-green-700" : r.tier === "Needs Attention" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-600"}">${r.tier}</span></td></tr>`;
  }).join("");
  const p = Array.from(document.querySelectorAll(".at-risk-table p")).find((x) => x.textContent?.includes("Showing")) as HTMLElement | undefined;
  if (p) p.textContent = `Showing ${ordered.length} of ${rows.length} students.`;
}

function renderDistribution(rows: Row[]) {
  const p = panel("Distribution");
  if (!p) return;
  p.innerHTML = `<div class="px-3 pt-3 pb-2"><h3 class="text-sm font-semibold text-slate-900">Distribution</h3><p class="text-[10px] text-slate-500 mt-0.5">Overall performance across the six theory subjects.</p></div><div class="classpulse-distribution-content px-3 pb-3"></div>`;
  const content = p.querySelector(".classpulse-distribution-content") as HTMLElement;
  const counts = rows.reduce((a, r) => { a[r.tier] = (a[r.tier] || 0) + 1; return a; }, {} as Record<string, number>);
  content.innerHTML = TIERS.map((tier) => { const count = counts[tier] || 0; const width = rows.length ? Math.max(2, count / rows.length * 100) : 0; return `<button type="button" class="classpulse-distribution-row" data-tier="${tier}"><div class="flex items-center justify-between text-[11px] text-slate-600"><span>${tier}</span><span>${count}</span></div><div class="mt-2 h-2.5 rounded-full bg-slate-100 overflow-hidden"><div class="h-full rounded-full" style="width:${width}%;background:${COLORS[tier]}"></div></div></button>`; }).join("");
  content.querySelectorAll<HTMLButtonElement>(".classpulse-distribution-row").forEach((row) => row.addEventListener("click", () => {
    const range = RANGES[row.dataset.tier || ""];
    const inputs = Array.from(document.querySelectorAll(".at-risk-filter input[type='number']")) as HTMLInputElement[];
    if (range && inputs.length >= 2) { setInput(inputs[0], range[0]); setInput(inputs[1], range[1]); (document.querySelector(".at-risk-apply") as HTMLButtonElement | null)?.click(); }
  }));
}

function renderTopFive(rows: Row[]) {
  const p = panel("Top Students");
  if (!p) return;
  const top = [...rows].sort((a, b) => b.average - a.average || a.name.localeCompare(b.name)).slice(0, 5);
  p.innerHTML = `<div class="px-3 py-2.5 border-b border-slate-100"><h3 class="text-sm font-semibold text-slate-900">Top 5 Students</h3><p class="text-[10px] text-slate-500 mt-0.5">Highest average internal marks.</p></div>${top.map((r, i) => `<div class="px-3 py-3 flex items-center justify-between gap-3 border-b border-slate-100 last:border-0"><div class="flex min-w-0 items-center gap-3"><span class="text-[10px] text-slate-400 w-4">${i + 1}.</span><span class="truncate text-[10px] text-slate-700">${esc(r.name)}</span></div><span class="text-[11px] font-medium whitespace-nowrap" style="color:${COLORS[r.tier]}">${fmt(r.average)} / 40</span></div>`).join("")}`;
}

function styles() {
  if (document.getElementById("classpulse-overall-fixes")) return;
  const s = document.createElement("style"); s.id = "classpulse-overall-fixes"; s.textContent = `
    .classpulse-overall-heading{margin:18px 0 14px}.classpulse-overall-heading h2{margin:0;color:#0f172a;font-size:20px;line-height:1.25;font-weight:600}.classpulse-overall-heading p{margin:5px 0 0;color:#64748b;font-size:12px;line-height:1.5}
    .classpulse-overall-metrics{margin-bottom:16px}.classpulse-overall-metrics>.classpulse-overall-metric{min-width:0;min-height:88px;height:88px;overflow:hidden}
    .classpulse-metric-label{margin:0;color:#475569;font-size:11px;line-height:1.3;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.classpulse-metric-value{margin:7px 0 0;color:#0f172a;font-size:22px;line-height:1.1;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.classpulse-metric-detail{margin:5px 0 0;color:#94a3b8;font-size:9px;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .classpulse-mark-mode-control{min-width:0!important}.classpulse-mark-mode-control select{width:100%}.at-risk-filter-controls{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr)) minmax(120px,1fr)!important;gap:12px!important;align-items:end}
    .at-risk-table{overflow:hidden!important}.at-risk-table table{width:100%!important;min-width:0!important;table-layout:fixed!important}.at-risk-table th,.at-risk-table td{overflow:hidden}.at-risk-table th{white-space:nowrap}.at-risk-table .classpulse-sno{width:4%!important}.at-risk-table th:nth-child(2),.at-risk-table td:nth-child(2){width:14%!important}.at-risk-table th:nth-child(3),.at-risk-table td:nth-child(3){width:12%!important}.at-risk-table th:nth-child(n+4):nth-child(-n+9),.at-risk-table td:nth-child(n+4):nth-child(-n+9){width:7%!important}.at-risk-table th:nth-child(10),.at-risk-table td:nth-child(10){width:7%!important}.at-risk-table th:nth-child(11),.at-risk-table td:nth-child(11){width:7%!important}.at-risk-table th:nth-child(12),.at-risk-table td:nth-child(12){width:14%!important}
    .classpulse-distribution-content{display:grid;gap:4px}.classpulse-distribution-row{display:block;width:100%;text-align:left;border:0;background:transparent;padding:11px 4px;margin:0;cursor:pointer;border-radius:8px}.classpulse-distribution-row:hover{background:#f8fafc}.classpulse-distribution-row:focus-visible{outline:2px solid #4a35b3;outline-offset:2px}
    @media(max-width:1100px){.classpulse-overall-metrics{grid-template-columns:repeat(3,minmax(0,1fr))!important}.at-risk-filter-controls{grid-template-columns:repeat(2,minmax(0,1fr))!important}}@media(max-width:700px){.classpulse-overall-metrics{grid-template-columns:repeat(2,minmax(0,1fr))!important}}@media(max-width:480px){.classpulse-overall-metrics{grid-template-columns:1fr!important}.at-risk-filter-controls{grid-template-columns:1fr!important}}
  `; document.head.appendChild(s);
}

export default function ClassAnalysisOverallHeadingFixedPage() {
  useEffect(() => {
    let dead = false, observer: MutationObserver | null = null, scheduled = false, mode: MarkMode = "basic", payload: Payload = {};
    const apply = () => {
      scheduled = false; if (dead) return; observer?.disconnect(); styles();
      const subjects = (payload.subjects || []).slice(0, 6); const rows = rowsFor(payload, mode); if (!rows.length) { observer?.observe(document.body,{childList:true,subtree:true}); return; }
      installMetrics(rows, subjects); installMode(mode, (next) => { mode = next; schedule(); }); renderTable(rows); renderDistribution(rows); renderTopFive(rows);
      observer?.observe(document.body,{childList:true,subtree:true});
    };
    const schedule = () => { if (scheduled || dead) return; scheduled = true; requestAnimationFrame(apply); };
    observer = new MutationObserver(schedule); observer.observe(document.body,{childList:true,subtree:true});
    const load = async () => { const id = sectionId(); if (!id) return; try { const r = await fetch(`/api/analysis/section/${id}/overall`); if (r.ok) { payload = (await r.json()).data || {}; schedule(); } } catch {} };
    load(); schedule();
    return () => { dead = true; observer?.disconnect(); };
  }, []);
  return <SectionOverallPage />;
}
