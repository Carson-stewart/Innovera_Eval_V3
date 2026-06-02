import { ReactNode } from "react";

interface TopBarProps {
  title: string;
  actions?: ReactNode;
}

export function TopBar({ title, actions }: TopBarProps) {
  return (
    <header className="h-14 bg-white border-b border-border flex items-center justify-between px-6 sticky top-0 z-10">
      <h1 className="text-base font-semibold text-foreground">{title}</h1>
      <div className="flex items-center gap-3">
        {actions}
        {/* User initials placeholder */}
        <div className="h-8 w-8 rounded-full bg-brand-orange flex items-center justify-center text-white text-xs font-semibold select-none">
          CS
        </div>
      </div>
    </header>
  );
}
