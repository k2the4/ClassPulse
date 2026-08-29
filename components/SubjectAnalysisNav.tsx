import { useEffect } from "react";
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
  const isOverall = router.pathname.endsWith("/overall");

  useEffect(() => {
    document.body.classList.toggle("overall-page", isOverall);
    return () => document.body.classList.remove("overall-page");
  }, [isOverall]);

  return (
    <>
      <nav className="subject-analysis-nav" aria-label="Subject analysis sections">
        <div className="subject-analysis-nav__rail">
          {items.map(({ label, icon: Icon, path }) => {
            const href = `/subject-analysis/${subjectId}/${path}`;
            const active = router.pathname.endsWith(`/${path}`);
            return (
              <Link
                key={path}
                href={href}
                className={`subject-analysis-nav__item ${active ? "is-active" : ""}`}
              >
                <Icon size={17} strokeWidth={1.8} />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {isOverall && <style jsx global>{`
        /* Overall uses the application's existing global sidebar. */
        .overall-page div[class*="max-w-[1900px]"] {
          max-width: none;
          padding: 18px 28px 28px 223px;
        }

        .overall-page div[class*="max-w-[1900px]"] > div[class*="items-start"][class*="justify-between"] {
          padding-bottom: 16px;
          margin-bottom: 0;
          align-items: center;
        }

        .overall-page div[class*="max-w-[1900px]"] > div[class*="items-start"][class*="justify-between"] h1 {
          font-size: 24px;
          line-height: 1.1;
          letter-spacing: -.035em;
          font-weight: 750;
        }

        .overall-page div[class*="max-w-[1900px]"] > div[class*="items-start"][class*="justify-between"] p {
          font-size: 11px;
        }

        .overall-page div[class*="max-w-[1900px]"] > div[class*="items-start"][class*="justify-between"] button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 0;
          border-radius: 9px;
          padding: 10px 16px;
          background: linear-gradient(135deg,#241d58,#45369d);
          color: #fff;
          font-size: 13px;
          font-weight: 600;
          box-shadow: 0 8px 18px rgba(49,39,120,.14);
        }

        .overall-page .subject-analysis-nav {
          margin-bottom: 16px;
        }

        .overall-page div[class*="mt-4"][class*="mb-3"] {
          display: flex;
          gap: 8px;
          margin: 12px 0 18px;
        }

        .overall-page div[class*="mt-4"][class*="mb-3"] button {
          border: 1px solid #dfe5ec;
          background: rgba(255,255,255,.68);
          color: #667085;
          border-radius: 9px;
          padding: 9px 16px;
          font-size: 13px;
          font-weight: 600;
        }

        .overall-page div[class*="mt-4"][class*="mb-3"] button[class*="bg-[#3d2aa0]"] {
          background: linear-gradient(135deg,#251b62,#4637a3);
          color: #fff;
          border-color: transparent;
          box-shadow: 0 8px 18px rgba(49,39,120,.13);
        }

        .overall-page div[class*="grid-cols-[0.82fr_1fr]"] > section:first-child {
          height: 315px;
          overflow: hidden;
        }

        .overall-page div[class*="grid-cols-[0.82fr_1fr]"] > section:first-child > div[class*="grid-cols-3"] {
          gap: 6px;
        }

        .overall-page div[class*="grid-cols-[0.82fr_1fr]"] > section:first-child label {
          padding: 8px;
        }

        .overall-page div[class*="grid-cols-[0.82fr_1fr]"] > section:first-child input[type="number"] {
          margin-top: 6px;
          height: 34px;
          padding: 6px 8px;
          font-size: 12px;
        }

        .overall-page div[class*="grid-cols-[0.82fr_1fr]"] > section:first-child + section {
          min-height: 315px;
        }

        .overall-page table col:first-child {
          width: 26px !important;
          max-width: 26px !important;
        }

        .overall-page table th:first-child,
        .overall-page table td:first-child {
          width: 26px;
          max-width: 26px;
          padding-left: 0;
          padding-right: 0;
        }
      `}</style>}
    </>
  );
}
