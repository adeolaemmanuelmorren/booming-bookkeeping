"use client";

import type { ReactNode } from "react";
import { reportMeta } from "./dashboard-data";

export const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export const number = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

export const percent = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 2,
});

export function safeDivide(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return numerator / denominator;
}

const navigation = [
  { id: "bills", href: "/", number: "01", label: "Bill's questions" },
  { id: "revenue", href: "/revenue", number: "02", label: "Revenue breakdown" },
  { id: "ads", href: "/ads", number: "03", label: "Ad revenue" },
];

export function DashboardShell({
  active,
  children,
}: {
  active: "bills" | "revenue" | "ads";
  children: ReactNode;
}) {
  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Booming Bookkeeping reports home">
          <span className="brand-mark">BB</span>
          <span><strong>Booming</strong><small>Bookkeeping reports</small></span>
        </a>

        <nav aria-label="Report pages">
          {navigation.map((item) => (
            <a className={active === item.id ? "active" : ""} href={item.href} key={item.id}>
              <span>{item.number}</span>
              <strong>{item.label}</strong>
            </a>
          ))}
        </nav>

        <div className="sidebar-meta">
          <span className="status"><i /> Mature cohort</span>
          <p>{reportMeta.startDate}–{reportMeta.endDate}</p>
          <small>Outcomes through {reportMeta.observedThrough}</small>
        </div>
      </aside>

      <main className="dashboard-main">{children}</main>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="page-header">
      <span>{eyebrow}</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  );
}

export function SectionHeading({
  number: sectionNumber,
  eyebrow,
  title,
  description,
}: {
  number: string;
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="section-heading">
      <span>{sectionNumber}</span>
      <div>
        <p>{eyebrow}</p>
        <h2>{title}</h2>
        {description && <small>{description}</small>}
      </div>
    </div>
  );
}

export function KpiCard({
  label,
  value,
  note,
  accent = false,
}: {
  label: string;
  value: string;
  note: string;
  accent?: boolean;
}) {
  return (
    <article className={`kpi-card ${accent ? "accent-card" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{note}</p>
    </article>
  );
}

export function RevenueBars({
  rows,
  total,
}: {
  rows: Array<{ label: string; value: number; note?: string }>;
  total?: number;
}) {
  const denominator = total ?? Math.max(...rows.map((row) => row.value), 1);

  return (
    <div className="bar-list">
      {rows.map((row) => (
        <div className="bar-item" key={row.label}>
          <div className="bar-label">
            <div><span>{row.label}</span>{row.note && <small>{row.note}</small>}</div>
            <strong>{money.format(row.value)}</strong>
          </div>
          <div className="bar-track"><span style={{ width: `${safeDivide(row.value, denominator) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

export function ReportFooter() {
  return (
    <footer>
      <strong>Booming Bookkeeping Performance Reports</strong>
      <span>Canonical warehouse data · {reportMeta.timezone}</span>
    </footer>
  );
}
