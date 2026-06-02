"use client";

import React from "react";

// ─── Status dot + label ────────────────────────────────────────────────────────

const STATUS_DOT: Record<string, { dot: string; label: string }> = {
  // Memo scoring statuses
  READY_TO_SHIP:       { dot: "bg-green-500", label: "Ready to Ship" },
  NEEDS_WORK:          { dot: "bg-amber-400", label: "Needs Work"    },
  MAJOR_REWORK:        { dot: "bg-red-500",   label: "Major Rework"  },
  // Sanity-check verdicts
  READY_FOR_DELIVERY:  { dot: "bg-green-500", label: "Ready"         },
  REVISIONS_REQUIRED:  { dot: "bg-amber-400", label: "Revisions"     },
  MAJOR_REWORK_NEEDED: { dot: "bg-red-500",   label: "Major Rework"  },
};

export function StatusDot({ status }: { status: string }) {
  const cfg = STATUS_DOT[status];
  if (!cfg) return <span className="text-xs text-gray-400">{status}</span>;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
      <span className="text-sm text-gray-700">{cfg.label}</span>
    </span>
  );
}

// ─── Column definition ────────────────────────────────────────────────────────

export interface ColDef<T> {
  key: string;
  header: string;
  /** Tailwind width classes — applied to both header and cell */
  width?: string;
  align?: "left" | "right" | "center";
  render: (row: T) => React.ReactNode;
  hideOnMobile?: boolean;
}

// ─── DataTable ────────────────────────────────────────────────────────────────

interface DataTableProps<T> {
  columns: ColDef<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  /** Optionally highlight selected rows */
  isSelected?: (row: T) => boolean;
  emptyMessage?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  isSelected,
  emptyMessage = "No records found.",
}: DataTableProps<T>) {
  const alignClass = (a?: "left" | "right" | "center") =>
    a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left";

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white px-6 py-14 text-center">
        <p className="text-sm text-gray-400">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center border-b border-gray-100 px-4">
        {columns.map((col) => (
          <div
            key={col.key}
            className={[
              "py-3 text-xs font-medium text-gray-400 uppercase tracking-wide shrink-0",
              col.width ?? "flex-1",
              alignClass(col.align),
              col.hideOnMobile ? "hidden sm:block" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {col.header}
          </div>
        ))}
      </div>

      {/* ── Rows ── */}
      <div className="divide-y divide-gray-100">
        {rows.map((row) => {
          const selected = isSelected?.(row) ?? false;
          return (
            <div
              key={rowKey(row)}
              onClick={() => onRowClick?.(row)}
              className={[
                "flex items-center px-4 py-3.5 transition-colors",
                onRowClick ? "cursor-pointer" : "",
                selected
                  ? "bg-brand-orange-light hover:bg-brand-orange-light"
                  : "hover:bg-gray-50",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {columns.map((col) => (
                <div
                  key={col.key}
                  onClick={(e) => {
                    // Prevent row-click if the cell renders an interactive element
                    // (the cell's own handler handles it)
                  }}
                  className={[
                    "shrink-0",
                    col.width ?? "flex-1",
                    alignClass(col.align),
                    col.hideOnMobile ? "hidden sm:block" : "",
                    "min-w-0",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {col.render(row)}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Toolbar atoms ────────────────────────────────────────────────────────────

export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative flex-1 min-w-48">
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
        />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange-ring focus:border-transparent placeholder:text-gray-400"
      />
    </div>
  );
}

export function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange-ring text-gray-700"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Small ghost button for secondary table actions */
export function TableAction({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      disabled={disabled}
      className={[
        "text-xs px-2.5 py-1.5 rounded-md border transition-colors",
        disabled
          ? "opacity-40 cursor-not-allowed border-gray-200 text-gray-400"
          : danger
          ? "border-red-200 text-red-600 hover:bg-red-50"
          : "border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-800",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </button>
  );
}
