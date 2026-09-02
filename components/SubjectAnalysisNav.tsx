import Link from "next/link";
import { useRouter } from "next/router";
import { BarChart3, FileText, GraduationCap, LayoutDashboard } from "lucide-react";

type Props = { subjectId: string };

const items = [
  { label: "Attendance", icon: BarChart3, path: "attendance" },
  { label: "Academic", icon: GraduationCap, path: "academic" },
  { label: "Overall", icon: LayoutDashboard, path: "overall" },
  { label: "Student Report", icon: FileText, path: "students" },
  { label: "Summary", icon: BarChart3, path: "summary" },
];

export default function SubjectAnalysisNav({ subjectId }: Props) {
  const router = useRouter();
  const pathname = router.pathname || "";
  const asPath = (router.asPath || "").split("?")[0];

  return (
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
            <Link
              key={path}
              href={href}
              className={`subject-analysis-nav__item ${active ? "is-active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={17} strokeWidth={1.8} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
