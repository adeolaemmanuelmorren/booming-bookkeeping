"use client";

import {
  DashboardShell,
  KpiCard,
  PageHeader,
  ReportFooter,
  SectionHeading,
  number,
} from "./dashboard-components";
import { billMetrics, timing, vipGroups } from "./dashboard-data";

export default function BillsQuestionsPage() {
  return (
    <DashboardShell active="bills">
      <PageHeader
        eyebrow="Bill's decision questions"
        title="What predicts a BBB purchase?"
        description="Registration timing, immediate VIP upgrades, eventual BBB conversion, and payment-plan adoption for the mature reporting window."
      />

      <section className="report-section">
        <SectionHeading number="01" eyebrow="Executive answers" title="The short version" />
        <div className="kpi-grid">
          <KpiCard
            label="BBB within 14 days"
            value={`${billMetrics.bbbWithin14DaysRate}%`}
            note={`${billMetrics.bbbWithin14Days} of ${billMetrics.bbbBuyersLinkedToRegistration} buyers linked to KRC registration`}
            accent
          />
          <KpiCard
            label="BBB within 13.5 days"
            value={`${billMetrics.bbbWithin13Point5DaysRate}%`}
            note={`${billMetrics.bbbWithin13Point5Days} buyers purchased inside the challenge maturity window`}
          />
          <KpiCard
            label="Same-day VIP upgrade rate"
            value={`${billMetrics.sameDayVipRate}%`}
            note={`${number.format(billMetrics.sameDayVip)} of ${number.format(billMetrics.registrants)} KRC registrants`}
          />
          <KpiCard
            label="Same-day VIP → BBB"
            value={`${billMetrics.sameDayVipToBbbRate}%`}
            note={`${billMetrics.sameDayVipToBbb} same-day VIP buyers later purchased BBB`}
          />
          <KpiCard
            label="Payment-plan adoption"
            value={`${billMetrics.paymentPlanRate}%`}
            note={`${billMetrics.paymentPlanBuyers} of ${billMetrics.highTicketBuyers} high-ticket buyers`}
          />
        </div>
      </section>

      <section className="report-section">
        <SectionHeading
          number="02"
          eyebrow="Registration → BBB"
          title="Nearly every linked BBB purchase happens inside 13.5 days"
          description="Same-day means the same America/Los_Angeles calendar date."
        />

        <div className="two-column-grid">
          <article className="panel">
            <div className="panel-title"><span>Purchase timing</span><strong>589 linked buyers</strong></div>
            <div className="timing-list">
              {timing.map((bucket) => (
                <div key={bucket.label}>
                  <span>{bucket.label}</span>
                  <div className="bar-track"><span style={{ width: `${bucket.pct}%` }} /></div>
                  <strong>{bucket.count} · {bucket.pct.toFixed(2)}%</strong>
                </div>
              ))}
            </div>
          </article>

          <article className="panel">
            <div className="panel-title"><span>VIP as a signal</span><strong>Observed BBB rate</strong></div>
            <div className="vip-list">
              {vipGroups.map((group) => (
                <div key={group.label}>
                  <div><strong>{group.label}</strong><small>{number.format(group.buyers)} of {number.format(group.people)} people</small></div>
                  <span>{group.rate.toFixed(2)}%</span>
                </div>
              ))}
            </div>
            <p className="panel-note">Same-day VIP is a much stronger BBB signal than no VIP. Later VIP currently has the highest observed BBB purchase rate.</p>
          </article>
        </div>
      </section>

      <ReportFooter />
    </DashboardShell>
  );
}
