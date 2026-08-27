import Link from "next/link";
import { useRouter } from "next/router";

type Props = { subjectId: string };

export default function SubjectAnalysisNav({ subjectId }: Props) {
  const router = useRouter();
  const items = [
    { label: "Attendance", href: `/subject-analysis/${subjectId}/attendance` },
    { label: "Academic", href: `/subject-analysis/${subjectId}/academic` },
    { label: "Overall", href: `/subject-analysis/${subjectId}/overall` },
    { label: "Student Report", href: `/subject-analysis/${subjectId}/students` },
  ];

  return (
    <nav className="subject-analysis-nav mb-8" aria-label="Subject analysis sections">
      <div className="subject-analysis-nav__rail">
        {items.map((item) => {
          const active = router.asPath === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`subject-analysis-nav__item ${active ? "is-active" : ""}`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
