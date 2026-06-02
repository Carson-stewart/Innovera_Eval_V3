"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Upload,
  CheckSquare,
  FileText,
  Clock,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/upload-framing", label: "Upload Framing", icon: Upload },
  { href: "/sanity-check", label: "Sanity Check", icon: CheckSquare },
  { href: "/score-memo", label: "Score Memo", icon: FileText },
  { href: "/history", label: "History", icon: Clock },
  { href: "/scoring-guide", label: "Scoring Guide", icon: BookOpen },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-56 bg-white border-r border-border flex flex-col z-20">
      {/* Logo / wordmark area */}
      <div className="h-14 flex items-center px-5 border-b border-border">
        <span className="font-semibold text-foreground tracking-tight">
          Innovera <span className="text-brand-orange">Eval</span>
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-0.5 px-2">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    active
                      ? "bg-brand-orange-light text-brand-orange"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <Icon
                    className={cn("h-4 w-4 shrink-0", active && "text-brand-orange")}
                  />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
