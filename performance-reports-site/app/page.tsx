"use client";

import { useMemo, useState } from "react";
import {
  ads,
  billMetrics,
  productRevenue,
  reportMeta,
  sourceBreakdown,
  summaryByAttribution,
  timing,
  trend,
  vipGroups,
  type AdRow,
  type Attribution,
} from "./dashboard-data";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const compactMoney = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const number = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

const percent = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 2,
});

const attributionLabels: Record<Attribution, string> = {
  first: "First touch",
  last: "Last touch",
  multi: "Multi-touch",
};

function safeDivide(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return numerator / denominator;
}

function KpiCard({
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

function ProductRevenueChart({ attribution }: { attribution: Attribution }) {
  const rows = productRevenue[attribution];
  const maxValue = Math.max(...rows.map((row) => row.value), 1);

  return (
    <div className="chart-card">
      <div className="card-title">
        <div>
          <span>All payment revenue</span>
          <h3>Revenue by product category</h3>
        </div>
        <span className="chart-total">
          {compactMoney.format(rows.reduce((total, row) => total + row.value, 0))}
        </span>
      </div>
      <div className="bar-list">
        {rows.map((row) => (
          <div className="bar-item" key={row.label}>
            <div className="bar-item-label">
              <span>{row.label}</span>
              <strong>{money.format(row.value)}</strong>
            </div>
            <div className="bar-track">
              <span style={{ width: `${(row.value / maxValue) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      <p className="chart-note">Includes new orders, installments, and renewals so ROAS reflects collected revenue.</p>
    </div>
  );
}

function SourceChart({ attribution }: { attribution: Attribution }) {
  const rows = sourceBreakdown[attribution];

  return (
    <div className="chart-card">
      <div className="card-title">
        <div>
          <span>Paid acquisition</span>
          <h3>Source and medium</h3>
        </div>
        <span className="medium-pill">cpc</span>
      </div>
      <div className="source-list">
        {rows.map((row) => {
          const roas = safeDivide(row.revenue, row.spend);
          return (
            <article key={row.source}>
              <span className={`source-dot ${row.source.toLowerCase()}`} />
              <div>
                <strong>{row.source}</strong>
                <small>{number.format(row.registrations)} registrations</small>
              </div>
              <div className="source-values">
                <strong>{compactMoney.format(row.revenue)}</strong>
                <small>{roas.toFixed(2)}× ROAS</small>
              </div>
            </article>
          );
        })}
      </div>
      <div className="source-share" aria-label="Revenue share by paid source">
        {rows.map((row) => (
          <span
            className={row.source.toLowerCase()}
            key={row.source}
            style={{
              width: `${safeDivide(row.revenue, rows.reduce((total, item) => total + item.revenue, 0)) * 100}%`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function TrendChart({ attribution }: { attribution: Attribution }) {
  const rows = trend[attribution];
  const maxValue = Math.max(...rows.flatMap((row) => [row.spend, row.revenue]), 1);

  return (
    <div className="chart-card trend-card">
      <div className="card-title">
        <div>
          <span>Five-day periods</span>
          <h3>Spend versus attributed revenue</h3>
        </div>
        <div className="legend"><span className="spend" />Spend <span className="revenue" />Revenue</div>
      </div>
      <div className="trend-chart">
        {rows.map((row) => (
          <div className="trend-column" key={row.label}>
            <div className="trend-bars">
              <span className="spend" style={{ height: `${(row.spend / maxValue) * 100}%` }} title={`Spend ${money.format(row.spend)}`} />
              <span className="revenue" style={{ height: `${(row.revenue / maxValue) * 100}%` }} title={`Revenue ${money.format(row.revenue)}`} />
            </div>
            <strong>{compactMoney.format(row.revenue)}</strong>
            <small>{row.label}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdTable({ rows }: { rows: AdRow[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Ad</th>
            <th>Campaign / ad set</th>
            <th>Impressions</th>
            <th>Clicks</th>
            <th>Spend</th>
            <th>KRC registrations</th>
            <th>Cost / registration</th>
            <th>BBB buyers</th>
            <th>All revenue</th>
            <th>ROAS</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.attribution}-${row.campaign}-${row.adSet}-${row.ad}`}>
              <td>
                <span className={`platform ${row.platform.toLowerCase()}`}>{row.platform}</span>
                <strong>{row.ad}</strong>
              </td>
              <td><strong>{row.campaign}</strong><small>{row.adSet}</small></td>
              <td>{number.format(row.impressions)}</td>
              <td>{number.format(row.clicks)}</td>
              <td>{money.format(row.spend)}</td>
              <td>{number.format(row.registrations)}</td>
              <td>{money.format(safeDivide(row.spend, row.registrations))}</td>
              <td>{number.format(row.bbbBuyers)}</td>
              <td>{money.format(row.revenue)}</td>
              <td><span className={`roas ${safeDivide(row.revenue, row.spend) >= 1 ? "positive" : ""}`}>{safeDivide(row.revenue, row.spend).toFixed(2)}×</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="empty">No ads match those filters.</p>}
    </div>
  );
}

export default function Home() {
  const [attribution, setAttribution] = useState<Attribution>("multi");
  const [platform, setPlatform] = useState("All");
  const [query, setQuery] = useState("");

  const summary = summaryByAttribution[attribution];
  const platformCpl = safeDivide(summary.spend, summary.leads);
  const costPerRegistration = safeDivide(summary.spend, summary.registrations);
  const roas = safeDivide(summary.revenue, summary.spend);

  const selectedAds = useMemo(() => {
    const search = query.trim().toLowerCase();

    return ads.filter((row) => {
      if (row.attribution !== attribution) return false;
      if (platform !== "All" && row.platform !== platform) return false;
      if (!search) return true;

      return [row.platform, row.campaign, row.adSet, row.ad]
        .join(" ")
        .toLowerCase()
        .includes(search);
    });
  }, [attribution, platform, query]);

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Booming Bookkeeping performance dashboard home">
          <span className="brand-mark">BB</span>
          <span>Booming Bookkeeping</span>
        </a>
        <span className="status"><i /> Mature cohort</span>
      </header>

      <section className="hero" id="top">
        <div className="hero-grid">
          <div>
            <div className="eyebrow">Paid growth intelligence · August 13, 2026</div>
            <h1>From ad spend<br />to collected revenue.</h1>
            <p className="hero-copy">One dashboard for paid media, KRC registrations, unique BBB buyers, and every payment collected.</p>
          </div>
          <div className="cohort-card">
            <span className="cohort-label">Fully matured click cohort</span>
            <strong>{reportMeta.startDate} — {reportMeta.endDate}</strong>
            <p>30 click days ending 14 days before this report.</p>
            <div className="cohort-foot"><span>Pacific time</span><span>Outcomes through {reportMeta.observedThrough}</span></div>
          </div>
        </div>
      </section>

      <section className="content-shell">
        <nav className="section-nav" aria-label="Dashboard sections">
          <a href="#performance">Performance</a>
          <a href="#revenue">Revenue mix</a>
          <a href="#bill">Bill&apos;s questions</a>
          <a href="#ads">Ad detail</a>
        </nav>

        <section className="report-section" id="performance">
          <div className="section-heading-row">
            <div className="section-heading">
              <span>01</span>
              <div><p>Paid performance</p><h2>Choose how credit is assigned</h2></div>
            </div>
            <div className="segmented" role="group" aria-label="Attribution model">
              {(Object.keys(attributionLabels) as Attribution[]).map((model) => (
                <button className={attribution === model ? "active" : ""} key={model} onClick={() => setAttribution(model)}>{attributionLabels[model]}</button>
              ))}
            </div>
          </div>

          <p className="definition-note">
            BBB is attributed directly from prior touchpoints to the first non-repeat mentorship order above $900 per person. Registration is not required. Revenue includes every payment collected.
          </p>

          <div className="kpi-grid performance-kpis">
            <KpiCard label="Ad spend" value={money.format(summary.spend)} note={`${number.format(summary.impressions)} impressions`} />
            <KpiCard label="Clicks" value={number.format(summary.clicks)} note={`${percent.format(safeDivide(summary.clicks, summary.impressions))} click-through rate`} />
            <KpiCard label="Platform cost / lead" value={money.format(platformCpl)} note={`${number.format(summary.leads)} platform conversions`} />
            <KpiCard label="KRC registrations" value={number.format(summary.registrations)} note={`${money.format(costPerRegistration)} per warehouse registration`} />
            <KpiCard label="Unique BBB buyers" value={number.format(summary.bbbBuyers)} note={`${money.format(summary.bbbRevenue)} first-order BBB revenue`} />
            <KpiCard label="All payment revenue" value={money.format(summary.revenue)} note="Includes installments and renewals" accent />
            <KpiCard label="True ROAS" value={`${roas.toFixed(2)}×`} note="All collected revenue ÷ spend" accent />
            <KpiCard label="Attribution model" value={attributionLabels[attribution]} note="First, last, or 40/20/40 multi-touch" />
          </div>
        </section>

        <section className="report-section" id="revenue">
          <div className="section-heading">
            <span>02</span>
            <div><p>Revenue composition</p><h2>What was purchased, and where it came from</h2></div>
          </div>
          <div className="chart-grid">
            <ProductRevenueChart attribution={attribution} />
            <SourceChart attribution={attribution} />
            <TrendChart attribution={attribution} />
          </div>
        </section>

        <section className="report-section" id="bill">
          <div className="section-heading">
            <span>03</span>
            <div><p>Bill&apos;s decision questions</p><h2>Registration, VIP timing, and BBB likelihood</h2></div>
          </div>

          <div className="kpi-grid bill-kpis">
            <KpiCard label="BBB within 14 days" value={`${billMetrics.bbbWithin14DaysRate}%`} note={`${billMetrics.bbbWithin14Days} of ${billMetrics.bbbBuyersLinkedToRegistration} linked buyers`} accent />
            <KpiCard label="BBB within 13.5 days" value={`${billMetrics.bbbWithin13Point5DaysRate}%`} note="The maturity window captures nearly all observed BBB sales" />
            <KpiCard label="Same-day VIP rate" value={`${billMetrics.sameDayVipRate}%`} note={`${number.format(billMetrics.sameDayVip)} of ${number.format(billMetrics.registrants)} registrants`} />
            <KpiCard label="Payment-plan adoption" value={`${billMetrics.paymentPlanRate}%`} note={`${billMetrics.paymentPlanBuyers} of ${billMetrics.highTicketBuyers} high-ticket buyers`} />
          </div>

          <div className="analysis-grid">
            <div className="chart-card">
              <div className="card-title"><div><span>Registration → BBB</span><h3>Purchase timing</h3></div></div>
              <div className="timing-list">
                {timing.map((bucket) => (
                  <div key={bucket.label}>
                    <span>{bucket.label}</span>
                    <div className="bar-track"><span style={{ width: `${bucket.pct}%` }} /></div>
                    <strong>{bucket.count} · {bucket.pct.toFixed(2)}%</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="chart-card">
              <div className="card-title"><div><span>VIP as a signal</span><h3>Observed BBB purchase rate</h3></div></div>
              <div className="vip-list">
                {vipGroups.map((group) => (
                  <article key={group.label}>
                    <div><strong>{group.label}</strong><small>{number.format(group.buyers)} of {number.format(group.people)}</small></div>
                    <strong>{group.rate.toFixed(2)}%</strong>
                  </article>
                ))}
              </div>
              <p className="chart-note">Same-day VIP is a strong immediate signal; later VIP currently has the highest observed BBB rate.</p>
            </div>
          </div>
        </section>

        <section className="report-section ad-section" id="ads">
          <div className="section-heading">
            <span>04</span>
            <div><p>Campaign drill-down</p><h2>Paid performance by ad</h2></div>
          </div>

          <div className="controls">
            <div className="select-group">
              <label htmlFor="platform">Source</label>
              <select id="platform" value={platform} onChange={(event) => setPlatform(event.target.value)}>
                <option>All</option>
                <option>Meta</option>
                <option>Google</option>
              </select>
            </div>
            <label className="search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search campaign, ad set, or ad" /></label>
          </div>

          <AdTable rows={selectedAds} />
          <p className="table-note">Showing the 15 leading ads by attributed all-payment revenue for the selected model. Fractional multi-touch values are expected.</p>
        </section>

        <footer>
          <div><strong>Booming Bookkeeping Performance Dashboard</strong><span>Canonical Dataform marts · {reportMeta.timezone}</span></div>
          <p>Platform cost per lead uses advertising-platform conversions. Cost per registration uses warehouse-recorded KRC registrations.</p>
        </footer>
      </section>
    </main>
  );
}
