import Link from "next/link";
import { useRouter } from "next/router";
import { BarChart3, FileText, GraduationCap, LayoutDashboard } from "lucide-react";

type Props = { sectionId: string };

const items = [
  { label: "Attendance", icon: BarChart3, path: "attendance" },
  { label: "Academic", icon: GraduationCap, path: "academic" },
  { label: "Overall", icon: LayoutDashboard, path: "overall" },
  { label: "Student Report", icon: FileText, path: "students" },
];

export default function AnalysisNav({ sectionId }: Props) {
  const router = useRouter();
  const pathname = router.pathname || "";
  const asPath = (router.asPath || "").split("?")[0];

  return (
    <nav className="subject-analysis-nav" aria-label="Class analysis sections">
      <div className="subject-analysis-nav__rail">
        {items.map(({ label, icon: Icon, path }) => {
          const href = `/section-analysis/${sectionId}/${path}`;
          const active =
            pathname.endsWith(`/${path}`) ||
            asPath.endsWith(`/${path}`) ||
            (path === "overall" && pathname.includes("class-analysis-overall-heading-fixed"));

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
