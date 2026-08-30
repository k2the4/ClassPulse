import Link from "next/link";
import { useRouter } from "next/router";
import { signOut } from "next-auth/react";
import {
  BarChart3,
  BookOpen,
  Database,
  LayoutDashboard,
  LogOut,
  GraduationCap,
  FileText,
} from "lucide-react";

type Props = {
  sectionId: string;
};

export default function AnalysisNav({ sectionId }: Props) {
  const router = useRouter();

  const items = [
    { label: "Attendance", href: `/section-analysis/${sectionId}/attendance`, icon: BarChart3 },
    { label: "Academic", href: `/section-analysis/${sectionId}/academic`, icon: GraduationCap },
    { label: "Overall", href: `/section-analysis/${sectionId}/overall`, icon: LayoutDashboard },
    { label: "Student Report", href: `/section-analysis/${sectionId}/students`, icon: FileText },
  ];

  const sidebarItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Class Analysis", href: "/class-analysis", icon: BarChart3 },
    { label: "Subject Analysis", href: "/subject-analysis", icon: BookOpen },
    { label: "Raw Data", href: "/raw-data", icon: Database },
  ];

  return (
    <>
      <aside className="classpulse-analysis-sidebar fixed inset-y-0 left-0 z-50 hidden w-[195px] shrink-0 flex-col border-r border-[rgba(203,213,225,.78)] bg-white/60 px-3 py-[22px] backdrop-blur-[18px] lg:flex">
        <Link href="/dashboard" className="flex items-center gap-2.5 px-2.5 pb-6 text-base font-bold text-[#172033]">
          <span className="grid h-[34px] w-[34px] place-items-center rounded-[9px] bg-[linear-gradient(135deg,#251b62,#5544ba)] text-white shadow-[0_8px_20px_rgba(67,52,157,.22)]">
            <BarChart3 size={18} />
          </span>
          <span>ClassPulse</span>
        </Link>

        <nav className="grid gap-1.5 text-[13px] font-medium text-[#667085]">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const active = item.href === "/class-analysis";
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-[11px] rounded-[10px] px-3 py-[11px] transition-colors ${
                  active
                    ? "bg-[linear-gradient(90deg,rgba(79,70,229,.12),rgba(79,70,229,.04))] font-semibold text-[#312783]"
                    : "hover:bg-[rgba(79,70,229,.06)] hover:text-[#2d246f]"
                }`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto">
          <div className="border-t border-[rgba(203,213,225,.72)] px-2.5 pt-4">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[#eeeaff] text-xs font-bold text-[#4b36a7]">F</span>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-[#17223b]">Faculty</p>
                <p className="text-[11px] text-[#8991a2]">Teacher Portal</p>
              </div>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="mt-3 flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2.5 text-xs font-medium text-[#667085] transition-colors hover:bg-[rgba(79,70,229,.06)] hover:text-[#2d246f]"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      <nav className="subject-analysis-nav" aria-label="Class analysis sections">
        <div className="subject-analysis-nav__rail">
          {items.map((item) => {
            const Icon = item.icon;
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

      <style jsx global>{`
        body:has(.classpulse-analysis-sidebar) {
          background: #f7f6f2 !important;
          color: #17223b;
        }

        body:has(.classpulse-analysis-sidebar) #__next {
          padding-left: 195px;
        }

        body:has(.classpulse-analysis-sidebar) #__next > div {
          max-width: none !important;
          width: auto !important;
          margin: 0 !important;
          min-height: 100vh;
          padding: 18px 28px 28px !important;
          background: radial-gradient(circle at 82% 5%, rgba(91,78,230,.09), transparent 27%), linear-gradient(135deg, #fbfaf7 0%, #f7f6f2 58%, #f2f4f6 100%);
        }

        body:has(.classpulse-analysis-sidebar) #__next .classpulse-attendance-page > div > .mb-7 {
          margin-top: 12px !important;
          margin-bottom: 18px !important;
        }

        body:has(.classpulse-analysis-sidebar) #__next .bg-white {
          border-color: #e1e3ea !important;
          border-radius: 18px !important;
          box-shadow: 0 8px 28px rgba(31,35,49,.055) !important;
        }

        body:has(.classpulse-analysis-sidebar) #__next .bg-gray-900 {
          background: #30227d !important;
        }

        body:has(.classpulse-analysis-sidebar) #__next .bg-gray-100 {
          background: #f5f4f8 !important;
        }

        body:has(.classpulse-analysis-sidebar) #__next .border-gray-100,
        body:has(.classpulse-analysis-sidebar) #__next .border-gray-200 {
          border-color: #e5e3ea !important;
        }

        body:has(.classpulse-analysis-sidebar) #__next input,
        body:has(.classpulse-analysis-sidebar) #__next select,
        body:has(.classpulse-analysis-sidebar) #__next textarea {
          border-color: #dfe1e8;
          border-radius: 11px;
        }

        body:has(.classpulse-analysis-sidebar) #__next input:focus,
        body:has(.classpulse-analysis-sidebar) #__next select:focus,
        body:has(.classpulse-analysis-sidebar) #__next textarea:focus {
          outline: none;
          border-color: #6b5be7;
          box-shadow: 0 0 0 3px rgba(107,91,231,.10);
        }

        @media (max-width: 1023px) {
          body:has(.classpulse-analysis-sidebar) #__next {
            padding-left: 0;
          }

          body:has(.classpulse-analysis-sidebar) #__next > div {
            padding: 18px 20px 28px !important;
          }
        }
      `}</style>
    </>
  );
}
