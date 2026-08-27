import Link from "next/link";
import { useRouter } from "next/router";

type Props = {
  sectionId: string;
};

export default function AnalysisNav({ sectionId }: Props) {
  const router = useRouter();

  const items = [
    {
      label: "Attendance",
      href: `/section-analysis/${sectionId}/attendance`,
    },
    {
      label: "Academic",
      href: `/section-analysis/${sectionId}/academic`,
    },
    {
      label: "Overall",
      href: `/section-analysis/${sectionId}/overall`,
    },
    {
      label: "Student Report",
      href: `/section-analysis/${sectionId}/students`,
    },
  ];

  return (
    <nav className="flex gap-1 border-b border-gray-200 mb-8 overflow-x-auto">
      {items.map((item) => {
        const active = router.asPath === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`px-4 py-3 text-sm whitespace-nowrap border-b-2 transition-colors ${
              active
                ? "border-gray-900 text-gray-900 font-medium"
                : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}