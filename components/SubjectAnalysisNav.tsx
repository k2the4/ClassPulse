import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { BarChart3, FileText, GraduationCap, LayoutDashboard } from "lucide-react";

type Props = { subjectId: string };

type SubjectInfo = { className: string; subjectName: string; subjectCode: string };

const items = [
  { label: "Attendance", icon: BarChart3, path: "attendance" },
  { label: "Academic", icon: GraduationCap, path: "academic" },
  { label: "Overall", icon: LayoutDashboard, path: "overall" },
  { label: "Student Report", icon: FileText, path: "students" },
];

export default function SubjectAnalysisNav({ subjectId }: Props) {
  const router = useRouter();
  const pathname = router.pathname || "";
  const asPath = (router.asPath || "").split("?")[0];
  const [info, setInfo] = useState<SubjectInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/analysis/subject-info/${subjectId}`)
      .then((response) => response.ok ? response.json() : null)
      .then((json) => { if (!cancelled) setInfo(json); })
      .catch(() => { if (!cancelled) setInfo(null); });
    return () => { cancelled = true; };
  }, [subjectId]);

  return (
    <>
      {info && (
        <div className="mb-4 rounded-xl border border-[#e8e6f5] bg-[#faf9ff] px-4 py-3">
          <div className="text-sm font-bold text-[#17223b]">{info.className}</div>
          <div className="mt-0.5 text-sm font-medium text-[#5b4ee6]">{info.subjectName} <span className="font-normal text-[#7a8295]">({info.subjectCode})</span></div>
        </div>
      )}
      <nav className="subject-analysis-nav" aria-label="Subject analysis sections">
        <div className="subject-analysis-nav__rail">
          {items.map(({ label, icon: Icon, path }) => {
            const href = `/subject-analysis/${subjectId}/${path}`;
            const active =
              pathname.endsWith(`/${path}`) ||
              asPath === href ||
              (path === "attendance" && pathname.includes("subject-analysis-attendance-trend-fixed")) ||
              (path === "academic" && pathname.includes("combined-analysis-fixed"));

            return (
              <Link key={path} href={href} className={`subject-analysis-nav__item ${active ? "is-active" : ""}`} aria-current={active ? "page" : undefined}>
                <Icon size={17} strokeWidth={1.8} />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
