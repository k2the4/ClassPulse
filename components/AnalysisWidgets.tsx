import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, BarChart3, BookOpen, GraduationCap, LayoutDashboard } from "lucide-react";

export function StatCard({ label, value, positive }: { label: string; value: string | number; positive?: boolean }) {
  return (
    <div className="analysis-stat-card">
      <div className="analysis-stat-card__top"><p>{label}</p><span className="analysis-stat-card__dot" /></div>
      <div className="analysis-stat-card__body">
        <strong className={positive === undefined ? "" : positive ? "is-positive" : "is-negative"}>{value}</strong>
        {positive !== undefined && <span className={positive ? "analysis-stat-card__status is-positive" : "analysis-stat-card__status is-negative"}>{positive ? "Improving" : "Needs attention"}</span>}
      </div>
    </div>
  );
}

export function RankedList({ title, items, positive }: { title: string; items: { name: string; marks: number }[]; positive: boolean }) {
  return (
    <div className="analysis-ranked-list">
      <div className="analysis-ranked-list__head"><p>{title}</p><span>{items.length}</span></div>
      <ol>
        {items.map((it, i) => <li key={`${it.name}-${i}`}><span className="analysis-ranked-list__rank">{String(i + 1).padStart(2, "0")}</span><span className="analysis-ranked-list__name">{it.name}</span><strong className={positive ? "is-positive" : "is-negative"}>{it.marks}</strong></li>)}
      </ol>
    </div>
  );
}

export function GradeBadge({ grade }: { grade: string }) {
  const tone: Record<string, string> = {
    Excellent: "excellent", Good: "good", Average: "attention", Bad: "risk",
    "Needs Attention": "attention", "Critical Risk": "risk",
  };
  return <span className={`analysis-grade-badge ${tone[grade] || "neutral"}`}>{grade}</span>;
}

export function RawDataButton({ sheetId }: { sheetId: string | null }) {
  const [sideNav, setSideNav] = useState<HTMLElement | null>(null);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    const existing = document.querySelector<HTMLElement>(".analysis-side-nav");
    if (existing) {
      setSideNav(existing);
      return;
    }

    // Class Analysis uses its own sidebar markup, so attach Raw Data to the
    // same navigation by locating its Class Analysis link.
    const classAnalysisLink = document.querySelector<HTMLElement>('nav a[href="/class-analysis"]');
    const classAnalysisNav = classAnalysisLink?.closest("nav") as HTMLElement | null;
    if (classAnalysisNav) {
      setSideNav(classAnalysisNav);
      return;
    }

    if (!window.location.pathname.startsWith("/subject-analysis/") && !window.location.pathname.startsWith("/section-analysis/")) return;

    const root = document.querySelector<HTMLElement>("#\\_\\_next > div.min-h-screen.max-w-\\[1900px\\]")
      || document.querySelector<HTMLElement>("div.min-h-screen.max-w-\\[1900px\\]")
      || document.querySelector<HTMLElement>("#\\_\\_next > div.min-h-screen");
    if (root) root.classList.add("overall-analysis-root");
    document.body.classList.add("overall-analysis-body");
    setStandalone(true);
  }, []);

  const rawLink = (
    <a
      href={sheetId ? `https://docs.google.com/spreadsheets/d/${sheetId}/edit` : undefined}
      target={sheetId ? "_blank" : undefined}
      rel={sheetId ? "noopener noreferrer" : undefined}
      aria-disabled={!sheetId}
      className={`analysis-side-raw-button${sheetId ? "" : " is-loading"}`}
    >
      <ArrowDown size={16} strokeWidth={1.8} />
      <span>Raw Data</span>
    </a>
  );

  if (sideNav) return createPortal(rawLink, sideNav);
  if (!standalone) return null;

  return createPortal(
    <aside className="analysis-standalone-sidebar" aria-label="ClassPulse navigation">
      <div className="analysis-brand">
        <span className="analysis-brand__mark"><BarChart3 size={18} /></span>
        <span>ClassPulse</span>
      </div>
      <nav className="analysis-side-nav analysis-standalone-nav">
        <a href="/dashboard"><LayoutDashboard size={18} />Dashboard</a>
        <a href="/class-analysis"><BookOpen size={18} />Class Analysis</a>
        <a className="is-active" href={window.location.pathname}><GraduationCap size={18} />Subject Analysis</a>
        {rawLink}
      </nav>
      <div className="analysis-side-footer">ClassPulse Teacher Portal</div>
      <style jsx global>{`
        .overall-analysis-body { background: #faf9f5 !important; }
        .overall-analysis-root {
          width: calc(100% - 184px) !important;
          max-width: 1900px !important;
          margin-left: 184px !important;
          margin-right: 0 !important;
        }
        .overall-analysis-root > .bg-white,
        .overall-analysis-root section.bg-white {
          border-color: #dfe4eb !important;
          box-shadow: 0 8px 28px rgba(25, 34, 59, .035) !important;
        }
        .overall-analysis-root button.bg-gray-900 {
          background: #3f2a8f !important;
          box-shadow: 0 8px 20px rgba(63,42,143,.18) !important;
        }
        .overall-analysis-root button.bg-gray-900:hover { background: #33227f !important; }
        .overall-analysis-root button.bg-gray-100:hover { background: #f0edfb !important; color: #33227f !important; }
        .overall-analysis-root input,
        .overall-analysis-root select {
          border-color: #d8e0ea;
          border-radius: 9px;
          background: #fff;
        }
        .overall-analysis-root input:focus,
        .overall-analysis-root select:focus {
          outline: none;
          border-color: #4b2e91 !important;
          box-shadow: 0 0 0 2px rgba(75,46,145,.12) !important;
        }
        .analysis-standalone-sidebar {
          position: fixed;
          z-index: 40;
          inset: 0 auto 0 0;
          width: 184px;
          min-height: 100vh;
          background: rgba(255,255,255,.97);
          border-right: 1px solid #e3e7ed;
          display: flex;
          flex-direction: column;
          padding: 24px 11px 14px;
          box-sizing: border-box;
        }
        .analysis-standalone-sidebar .analysis-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 10px;
          margin-bottom: 30px;
          color: #17223b;
          font-size: 17px;
          font-weight: 750;
          letter-spacing: -.4px;
        }
        .analysis-standalone-sidebar .analysis-brand__mark {
          width: 32px;
          height: 32px;
          border-radius: 9px;
          display: grid;
          place-items: center;
          color: white;
          background: linear-gradient(145deg,#3f2a8f,#4b2e91);
          box-shadow: 0 9px 22px rgba(62,42,143,.2);
        }
        .analysis-standalone-nav { display: flex; flex-direction: column; gap: 5px; }
        .analysis-standalone-nav > a:not(.analysis-side-raw-button) {
          display: flex;
          align-items: center;
          gap: 12px;
          min-height: 42px;
          padding: 0 12px;
          border-radius: 10px;
          color: #667085;
          font-size: 13px;
          font-weight: 500;
          transition: .18s ease;
        }
        .analysis-standalone-nav > a:not(.analysis-side-raw-button):hover {
          background: #f5f3ff;
          color: #33227f;
        }
        .analysis-standalone-nav > a.is-active {
          background: #eeebfb;
          color: #33227f;
          font-weight: 650;
        }
        .analysis-standalone-nav > a.is-active svg { color: #3f2a9b; }
        .analysis-standalone-nav .analysis-side-raw-button {
          display: flex !important;
          align-items: center !important;
          gap: 11px !important;
          margin: 1px 0 0 !important;
          padding: 11px 12px !important;
          border-radius: 10px !important;
          color: #667085 !important;
          font-size: 13px !important;
          font-weight: 500 !important;
          line-height: 1.2 !important;
          text-decoration: none !important;
          transition: .18s !important;
        }
        .analysis-standalone-nav .analysis-side-raw-button:hover {
          background: rgba(79,70,229,.06) !important;
          color: #33227f !important;
        }
        .analysis-standalone-sidebar .analysis-side-footer {
          margin-top: auto;
          padding: 16px 10px 7px;
          border-top: 1px solid #e6e9ee;
          color: #8b96a8;
          font-size: 10px;
        }
        @media (max-width: 900px) {
          .overall-analysis-root { width: 100% !important; margin-left: 0 !important; }
          .analysis-standalone-sidebar { display: none; }
        }
      `}</style>
    </aside>,
    document.body
  );
}
