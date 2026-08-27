import Link from "next/link";
import { useRouter } from "next/router";
import { BarChart3, GraduationCap, LayoutDashboard, FileText } from "lucide-react";

type Props = { subjectId: string };

const icons = [BarChart3, GraduationCap, LayoutDashboard, FileText];

export default function SubjectAnalysisNav({ subjectId }: Props) {
  const router = useRouter();
  const items = [
    { label: "Attendance", href: `/subject-analysis/${subjectId}/attendance` },
    { label: "Academic", href: `/subject-analysis/${subjectId}/academic` },
    { label: "Overall", href: `/subject-analysis/${subjectId}/overall` },
    { label: "Student Report", href: `/subject-analysis/${subjectId}/students` },
  ];

  return (
    <nav className="subject-analysis-nav" aria-label="Subject analysis sections">
      <div className="subject-analysis-nav__rail">
        {items.map((item, index) => {
          const Icon = icons[index];
          const active = router.asPath === item.href;
          return (
            <Link key={item.href} href={item.href} className={`subject-analysis-nav__item ${active ? "is-active" : ""}`}>
              <Icon size={17} strokeWidth={1.8} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
