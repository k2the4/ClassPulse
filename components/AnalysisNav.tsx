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
      <aside className="classpulse-analysis-sidebar fixed inset-y-0 left-0 z-50 hidden w-[220px] shrink-0 flex-col border-r border-[#e7e5e1] bg-white lg:flex">
        <div className="px-5 pt-6">
          <Link href="/dashboard" className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#3b2992] text-white shadow-[0_10px_25px_rgba(59,41,146,0.20)]">
              <BarChart3 size={21} strokeWidth={2.2} />
            </span>
            <span className="text-[20px] font-extrabold tracking-[-0.7px] text-[#17223b]">ClassPulse</span>
          </Link>
        </div>

        <nav className="mt-8 space-y-1 px-3 text-sm font-medium text-[#626b80]">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const active = item.href === "/class-analysis";
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 transition-colors ${
                  active ? "bg-[#eeeaff] font-semibold text-[#38258e]" : "hover:bg-[#f6f4ff] hover:text-[#38258e]"
                }`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto">
          <div className="mx-4 border-t border-[#eeeeeb] py-4">
            <div className="flex items-center gap-3 px-2">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[#eeeaff] text-xs font-bold text-[#4b36a7]">F</span>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-[#17223b]">Faculty</p>
                <p className="text-[11px] text-[#8991a2]">Teacher Portal</p>
              </div>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="mx-4 mb-4 flex w-[calc(100%-2rem)] items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium text-[#626b80] transition-colors hover:bg-[#f6f4ff] hover:text-[#38258e]"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      <nav className="mb-8 flex overflow-x-auto rounded-2xl border border-[#ddd9ee] bg-white/90 p-1.5 shadow-[0_8px_24px_rgba(31,35,49,0.05)] backdrop-blur">
        {items.map((item) => {
          const Icon = item.icon;
          const active = router.asPath === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-5 py-3 text-sm transition-colors ${
                active
                  ? "bg-[#eeeaff] font-semibold text-[#38258e] shadow-[inset_0_0_0_1px_rgba(91,78,230,.16)]"
                  : "text-[#626b80] hover:bg-[#f7f5ff] hover:text-[#38258e]"
              }`}
            >
              <Icon size={17} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <style jsx global>{`
        body:has(.classpulse-analysis-sidebar) { background: #f7f6f2 !important; color: #17223b; }
        body:has(.classpulse-analysis-sidebar) #__next { padding-left: 220px; }
        body:has(.classpulse-analysis-sidebar) main > div {
          max-width: none !important;
          margin: 0 !important;
          min-height: 100vh;
          padding: 34px 38px 48px !important;
          background: radial-gradient(circle at 82% 5%, rgba(91,78,230,.09), transparent 27%), linear-gradient(135deg, #fbfaf7 0%, #f7f6f2 58%, #f2f4f6 100%);
        }
        body:has(.classpulse-analysis-sidebar) main section.bg-white {
          border: 1px solid #e1e3ea !important;
          border-radius: 18px !important;
          box-shadow: 0 8px 28px rgba(31,35,49,.055) !important;
        }
        body:has(.classpulse-analysis-sidebar) main .bg-gray-900 { background: #30227d !important; }
        body:has(.classpulse-analysis-sidebar) main .bg-gray-100 { background: #f5f4f8 !important; }
        body:has(.classpulse-analysis-sidebar) main .border-gray-100,
        body:has(.classpulse-analysis-sidebar) main .border-gray-200 { border-color: #e5e3ea !important; }
        body:has(.classpulse-analysis-sidebar) main input,
        body:has(.classpulse-analysis-sidebar) main select,
        body:has(.classpulse-analysis-sidebar) main textarea { border-color: #dfe1e8; border-radius: 11px; }
        body:has(.classpulse-analysis-sidebar) main input:focus,
        body:has(.classpulse-analysis-sidebar) main select:focus,
        body:has(.classpulse-analysis-sidebar) main textarea:focus { outline: none; border-color: #6b5be7; box-shadow: 0 0 0 3px rgba(107,91,231,.10); }
        @media (max-width: 1023px) {
          body:has(.classpulse-analysis-sidebar) #__next { padding-left: 0; }
          body:has(.classpulse-analysis-sidebar) main > div { padding: 24px 20px 36px !important; }
        }
      `}</style>
    </>
  );
}
