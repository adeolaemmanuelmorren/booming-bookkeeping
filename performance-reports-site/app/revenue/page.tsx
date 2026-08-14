"use client";

import {
  DashboardShell,
  KpiCard,
  PageHeader,
  ReportFooter,
  RevenueBars,
  SectionHeading,
  money,
  percent,
  safeDivide,
} from "../dashboard-components";
import {
  julyRevenue,
  paidMedia,
  revenueByAttributionHistory,
  revenueByProduct,
} from "../dashboard-data";

export default function RevenueBreakdownPage() {
  const blendedRoas = safeDivide(julyRevenue.revenue, paidMedia.spend);

  return (
    <DashboardShell active="revenue">
      <PageHeader
        eyebrow="Total business revenue"
        title="Every payment collected during July."
        description="This page uses payment date—not ad-click date—and includes new orders, installments, renewals, and payments without an attributable browser touchpoint."
      />

      <section className="report-section">
        <SectionHeading number="01" eyebrow="July 1–30" title="Complete collected revenue" />
        <div className="kpi-grid">
          <KpiCard label="All collected revenue" value={money.format(julyRevenue.revenue)} note={`${julyRevenue.paymentCount.toLocaleString()} successful payment rows`} accent />
          <KpiCard label="New-order revenue" value={money.format(julyRevenue.newOrderRevenue)} note={`${percent.format(safeDivide(julyRevenue.newOrderRevenue, julyRevenue.revenue))} of collected revenue`} />
          <KpiCard label="Repeat-payment revenue" value={money.format(julyRevenue.repeatRevenue)} note="Installments, subscriptions, and renewals" />
          <KpiCard label="Blended revenue ÷ ad spend" value={`${blendedRoas.toFixed(2)}×`} note={`${money.format(julyRevenue.revenue)} ÷ ${money.format(paidMedia.spend)}`} />
        </div>
      </section>

      <section className="report-section">
        <SectionHeading
          number="02"
          eyebrow="Attribution availability"
          title="Where July revenue had—or did not have—a paid click"
          description="These four rows reconcile exactly to all July payment revenue."
        />
        <div className="two-column-grid revenue-layout">
          <article className="panel">
            <RevenueBars rows={revenueByAttributionHistory} total={julyRevenue.revenue} />
          </article>
          <article className="panel table-panel">
            <table className="summary-table">
              <thead><tr><th>Attribution history</th><th>Revenue</th><th>Share</th></tr></thead>
              <tbody>
                {revenueByAttributionHistory.map((row) => (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    <td>{money.format(row.value)}</td>
                    <td>{percent.format(safeDivide(row.value, julyRevenue.revenue))}</td>
                  </tr>
                ))}
                <tr className="total-row"><td>Total</td><td>{money.format(julyRevenue.revenue)}</td><td>100%</td></tr>
              </tbody>
            </table>
            <p className="panel-note"><strong>{money.format(880_589)}</strong> of the no-prior-touchpoint bucket was repeat-payment revenue, largely from customers whose original acquisition predates the available browser history.</p>
          </article>
        </div>
      </section>

      <section className="report-section">
        <SectionHeading number="03" eyebrow="Product mix" title="Collected revenue by product category" />
        <article className="panel">
          <RevenueBars
            rows={revenueByProduct.map((row) => ({
              label: row.label,
              value: row.value,
              note: `${row.payments.toLocaleString()} payments`,
            }))}
            total={julyRevenue.revenue}
          />
        </article>
      </section>

      <ReportFooter />
    </DashboardShell>
  );
}
