import Link from "next/link";
import { useRouter } from "next/router";
import { BarChart3, FileText, GraduationCap, LayoutDashboard } from "lucide-react";

type Props = { subjectId: string };

const items = [
  { label: "Attendance", icon: BarChart3, path: "attendance" },
  { label: "Academic", icon: GraduationCap, path: "academic" },
  { label: "Overall", icon: LayoutDashboard, path: "overall" },
  { label: "Student Report", icon: FileText, path: "students" },
];

export default function SubjectAnalysisNav({ subjectId }: Props) {
  const router = useRouter();

  return (
    <nav className="subject-analysis-nav" aria-label="Subject analysis sections">
      <div className="subject-analysis-nav__rail">
        {items.map(({ label, icon: Icon, path }) => {
          const href = `/subject-analysis/${subjectId}/${path}`;
          const active = router.pathname.endsWith(`/${path}`) || (path === "academic" && router.asPath.includes(`/subject-analysis/${subjectId}/academic`));
          return (
            <Link key={path} href={href} className={`subject-analysis-nav__item ${active ? "is-active" : ""}`}>
              <Icon size={17} strokeWidth={1.8} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
