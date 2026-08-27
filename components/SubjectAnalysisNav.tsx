import Link from "next/link";
import { useRouter } from "next/router";

type Props = { subjectId: string };

export default function SubjectAnalysisNav({ subjectId }: Props) {
  const router = useRouter();
  const items = [
    { label: "Attendance", href: `/subject-analysis/${subjectId}/attendance`, short: "01" },
    { label: "Academic", href: `/subject-analysis/${subjectId}/academic`, short: "02" },
    { label: "Overall", href: `/subject-analysis/${subjectId}/overall`, short: "03" },
    { label: "Student Report", href: `/subject-analysis/${subjectId}/students`, short: "04" },
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
              <span className="subject-analysis-nav__index">{item.short}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
