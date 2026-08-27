import Link from "next/link";
import { useRouter } from "next/router";

type Props = {
  subjectId: string;
};

export default function SubjectAnalysisNav({ subjectId }: Props) {
  const router = useRouter();

  const items = [
    { label: "Attendance", href: `/subject-analysis/${subjectId}/attendance` },
    { label: "Academic", href: `/subject-analysis/${subjectId}/academic` },
    { label: "Overall", href: `/subject-analysis/${subjectId}/overall` },
    { label: "Student Report", href: `/subject-analysis/${subjectId}/students` },
  ];

  return (
    <nav className="mb-8 border-b border-gray-200/80">
      <div className="flex gap-1 overflow-x-auto">
        {items.map((item) => {
          const active = router.asPath === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative px-4 py-3 text-sm whitespace-nowrap transition-all ${
                active
                  ? "text-gray-900 font-semibold"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              {item.label}
              {active && (
                <span className="absolute left-4 right-4 bottom-0 h-0.5 rounded-full bg-slate-900" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
