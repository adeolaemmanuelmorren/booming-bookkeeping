"use client";

import { useMemo, useState } from "react";
import {
  DashboardShell,
  KpiCard,
  PageHeader,
  ReportFooter,
  RevenueBars,
  SectionHeading,
  money,
  number,
  safeDivide,
} from "../dashboard-components";
import {
  ads,
  cohortRevenueByProduct,
  julyRevenue,
  paidClickCohort,
  paidMedia,
  type AdRow,
  type Attribution,
} from "../dashboard-data";

const attributionLabels: Record<Attribution, string> = {
  first: "First paid touch",
  last: "Last paid touch",
  multi: "Paid multi-touch",
};

function AdTable({ rows }: { rows: AdRow[] }) {
  return (
    <div className="table-wrap">
      <table className="ad-table">
        <thead>
          <tr>
            <th>Ad</th>
            <th>Campaign / ad set</th>
            <th>Spend</th>
            <th>Clicks</th>
            <th>KRC registrations</th>
            <th>BBB buyers</th>
            <th>Attributed revenue</th>
            <th>ROAS</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.attribution}-${row.campaign}-${row.adSet}-${row.ad}`}>
              <td><span className={`platform ${row.platform.toLowerCase()}`}>{row.platform}</span><strong>{row.ad}</strong></td>
              <td><strong>{row.campaign}</strong><small>{row.adSet}</small></td>
              <td>{row.spend ? money.format(row.spend) : "Unresolved"}</td>
              <td>{row.clicks ? number.format(row.clicks) : "—"}</td>
              <td>{number.format(row.registrations)}</td>
              <td>{number.format(row.bbbBuyers)}</td>
              <td>{money.format(row.revenue)}</td>
              <td>{row.spend ? `${safeDivide(row.revenue, row.spend).toFixed(2)}×` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdRevenuePage() {
  const [attribution, setAttribution] = useState<Attribution>("multi");
  const [query, setQuery] = useState("");
  const cohortRoas = safeDivide(paidClickCohort.revenue, paidMedia.spend);

  const selectedAds = useMemo(() => {
    const search = query.trim().toLowerCase();

    return ads.filter((row) => {
      if (row.attribution !== attribution) return false;
      if (!search) return true;

      return [row.platform, row.campaign, row.adSet, row.ad]
        .join(" ")
        .toLowerCase()
        .includes(search);
    });
  }, [attribution, query]);

  return (
    <DashboardShell active="ads">
      <PageHeader
        eyebrow="Paid-click cohort"
        title="Revenue assigned back to July ads."
        description="Every purchase observed through August 13 that had an eligible paid click from July 1–30. Later purchases stay with the July ads that generated the clicks."
      />

      <section className="report-section">
        <SectionHeading number="01" eyebrow="Paid cohort" title="The cohort total no longer changes by attribution model" />
        <div className="kpi-grid">
          <KpiCard label="Paid-click cohort revenue" value={money.format(paidClickCohort.revenue)} note="All observed payments tied to July paid clicks" accent />
          <KpiCard label="Purchased July 1–30" value={money.format(paidClickCohort.julyPurchaseRevenue)} note="Revenue collected inside the click window" />
          <KpiCard label="Purchased July 31–Aug 13" value={money.format(paidClickCohort.laterPurchaseRevenue)} note="Included below and assigned back to July ads" accent />
          <KpiCard label="Paid-click cohort ROAS" value={`${cohortRoas.toFixed(2)}×`} note={`${money.format(paidClickCohort.revenue)} ÷ ${money.format(paidMedia.spend)}`} />
          <KpiCard label="KRC registrations" value={number.format(paidClickCohort.registrations)} note="Server-side registrations with an eligible paid click" />
          <KpiCard label="Unique BBB buyers" value={number.format(paidClickCohort.bbbBuyers)} note={`${money.format(paidClickCohort.bbbRevenue)} first-order BBB revenue`} />
        </div>
      </section>

      <section className="report-section">
        <SectionHeading number="02" eyebrow="Reconciliation" title="Why $4.049M and $2.787M are both correct" />
        <div className="reconciliation-grid">
          <article className="panel reconciliation-card">
            <span>All July 1–30 payments</span>
            <strong>{money.format(julyRevenue.revenue)}</strong>
            <p>Payment-date view: every successful July payment, regardless of attribution.</p>
          </article>
          <article className="panel reconciliation-card">
            <span>July paid-click cohort</span>
            <strong>{money.format(paidClickCohort.revenue)}</strong>
            <p>Click-date view: all payments observed through August 13 from customers with a July paid click.</p>
          </article>
        </div>

        <div className="two-column-grid reconciliation-tables">
          <article className="panel table-panel">
            <div className="panel-title"><span>All July payments</span><strong>{money.format(julyRevenue.revenue)}</strong></div>
            <table className="summary-table">
              <tbody>
                <tr><td>Paid click during July 1–30</td><td>{money.format(1_971_759.45)}</td></tr>
                <tr><td>Paid click before July 1</td><td>{money.format(330_851.9)}</td></tr>
                <tr><td>Browser history, no paid click</td><td>{money.format(725_967.45)}</td></tr>
                <tr><td>No prior browser touchpoint</td><td>{money.format(1_020_652.15)}</td></tr>
                <tr className="total-row"><td>Total</td><td>{money.format(julyRevenue.revenue)}</td></tr>
              </tbody>
            </table>
          </article>

          <article className="panel table-panel">
            <div className="panel-title"><span>July paid-click cohort</span><strong>{money.format(paidClickCohort.revenue)}</strong></div>
            <table className="summary-table">
              <tbody>
                <tr><td>July purchases tied to July paid clicks</td><td>{money.format(paidClickCohort.julyPurchaseRevenue)}</td></tr>
                <tr><td>July 31–August 13 purchases tied to July paid clicks</td><td>{money.format(paidClickCohort.laterPurchaseRevenue)}</td></tr>
                <tr className="total-row"><td>Total</td><td>{money.format(paidClickCohort.revenue)}</td></tr>
              </tbody>
            </table>
            <p className="panel-note">The apparent {money.format(paidClickCohort.apparentGap)} difference is {money.format(paidClickCohort.julyRevenueExcluded)} of July revenue without a July paid click, offset by {money.format(paidClickCohort.laterPurchaseRevenue)} collected later from the July paid-click cohort.</p>
          </article>
        </div>
      </section>

      <section className="report-section">
        <div className="section-heading-row">
          <SectionHeading
            number="03"
            eyebrow="Ad allocation"
            title="Paid performance by ad"
            description="The selector changes which eligible July ad receives credit. Every model includes the full $2.787M cohort, including the $814.9K collected after July."
          />
          <div className="segmented" role="group" aria-label="Attribution model">
            {(Object.keys(attributionLabels) as Attribution[]).map((model) => (
              <button className={attribution === model ? "active" : ""} key={model} onClick={() => setAttribution(model)}>{attributionLabels[model]}</button>
            ))}
          </div>
        </div>

        <div className="controls">
          <label className="search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search campaign, ad set, or ad" /></label>
          <span className="table-context">{money.format(paidClickCohort.revenue)} cohort · {attributionLabels[attribution]}</span>
        </div>
        <AdTable rows={selectedAds} />
        <p className="panel-note">The table shows the leading allocated ad rows. Its revenue calculation includes July purchases and the {money.format(paidClickCohort.laterPurchaseRevenue)} collected afterward. “Unresolved” rows have a confirmed paid source but no recoverable campaign/ad identifier; that revenue remains in the cohort instead of being silently discarded.</p>
      </section>

      <section className="report-section">
        <SectionHeading number="04" eyebrow="Cohort composition" title="What July paid clicks eventually sold" />
        <article className="panel">
          <RevenueBars
            rows={cohortRevenueByProduct.map((row) => ({
              label: row.label,
              value: row.july + row.later,
              note: `${money.format(row.july)} in July + ${money.format(row.later)} later`,
            }))}
            total={paidClickCohort.revenue}
          />
        </article>
      </section>

      <ReportFooter />
    </DashboardShell>
  );
}
