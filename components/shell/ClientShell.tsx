"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";

export function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  if (isLogin) {
    return <>{children}</>;
  }

  return (
    <>
      <Sidebar />
      <div className="ml-56 min-h-screen flex flex-col">{children}</div>
    </>
  );
}
