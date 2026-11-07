import React from 'react';
import {
  Wrench,
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Phone,
  MessageSquare,
  Play,
  ArrowRight,
  Droplets,
  Plus,
  ShieldCheck,
  ChevronRight,
  MapPin,
  ExternalLink,
} from 'lucide-react';
import { Customer, ServiceRecord, Reminder, MessageAttempt } from '../types';
import {
  formatDisplayDate,
  getTodayKolkata,
  getDaysSinceDate,
  getDaysUntilDate,
} from '../utils/dateUtils';
import { ActiveTab } from '../components/Sidebar';

interface DashboardPageProps {
  customers: Customer[];
  serviceRecords: ServiceRecord[];
  reminders: Reminder[];
  messageAttempts: MessageAttempt[];
  setActiveTab: (tab: ActiveTab) => void;
  onOpenAddCustomer: () => void;
  onOpenRecordService: (customer?: Customer) => void;
  onOpenCustomerDetail: (customer: Customer) => void;
  onTriggerDailyBatch: () => Promise<void>;
  batchRunning: boolean;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  customers,
  serviceRecords,
  reminders,
  messageAttempts,
  setActiveTab,
  onOpenAddCustomer,
  onOpenRecordService,
  onOpenCustomerDetail,
  onTriggerDailyBatch,
  batchRunning,
}) => {
  const today = getTodayKolkata();
  const activeCustomers = customers.filter((c) => c.status === 'active');

  // Customer Map
  const customerMap = new Map<string, Customer>();
  customers.forEach((c) => customerMap.set(c.id, c));

  // Key groups
  const dueTodayReminders = reminders.filter(
    (r) => r.reminderDate === today && r.status !== 'superseded' && r.status !== 'sent' && r.status !== 'contacted_manually' && r.status !== 'paused'
  );

  const overdueReminders = reminders.filter((r) => {
    const days = getDaysUntilDate(r.reminderDate);
    return days < 0 && r.status !== 'superseded' && r.status !== 'sent' && r.status !== 'contacted_manually' && r.status !== 'paused';
  });

  const dueSoonReminders = reminders.filter((r) => {
    const days = getDaysUntilDate(r.reminderDate);
    return days > 0 && days <= 14 && r.status !== 'paused' && r.status !== 'superseded';
  });

  const todayCompleted = serviceRecords.filter((s) => s.serviceDate === today);
  const currentMonth = today.slice(0, 7);
  const thisMonthServices = serviceRecords.filter((s) => s.serviceDate.startsWith(currentMonth));
  const thisMonthRevenue = thisMonthServices.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);

  // High priority worklist: Overdue first, then Due Today
  const followUpWorklist = [...overdueReminders, ...dueTodayReminders];

  // Editorial Operational Summary Text
  let summaryHeadline = 'All Purifier Schedules are Current';
  if (overdueReminders.length > 0 && dueTodayReminders.length > 0) {
    summaryHeadline = `${dueTodayReminders.length} Purifier${dueTodayReminders.length > 1 ? 's' : ''} Due Today & ${overdueReminders.length} Overdue`;
  } else if (overdueReminders.length > 0) {
    summaryHeadline = `${overdueReminders.length} Purifier${overdueReminders.length > 1 ? 's' : ''} Require Immediate Follow-Up`;
  } else if (dueTodayReminders.length > 0) {
    summaryHeadline = `${dueTodayReminders.length} Scheduled Maintenance Visit${dueTodayReminders.length > 1 ? 's' : ''} for Today`;
  }

  return (
    <div className="space-y-8 max-w-7xl">
      {/* SECTION A: Strong Editorial Welcome & Daily Operational Post */}
      <section className="bg-[#0C231F] text-[#FAF8F3] rounded-2xl p-6 lg:p-8 shadow-sm border border-[#1A3D35] relative overflow-hidden">
        {/* Subtle decorative ripple lines */}
        <div className="absolute right-0 top-0 bottom-0 w-96 opacity-5 pointer-events-none hidden lg:block">
          <svg viewBox="0 0 300 300" className="w-full h-full stroke-current fill-none">
            <circle cx="200" cy="150" r="40" strokeWidth="1" />
            <circle cx="200" cy="150" r="80" strokeWidth="1" />
            <circle cx="200" cy="150" r="120" strokeWidth="1" />
            <circle cx="200" cy="150" r="160" strokeWidth="1" />
          </svg>
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            {/* Context Line */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#86AB9F]">
              <span className="font-editorial italic text-[#FAF8F3]">Aqua Plus RO Tech</span>
              <span className="text-[#356155]">·</span>
              <span className="font-mono-data text-[#A9C7BE]">{formatDisplayDate(today)}</span>
              <span className="text-[#356155]">·</span>
              <span>Madurai Service Base</span>
            </div>

            {/* Editorial Headline */}
            <h1 className="font-editorial text-2xl lg:text-3xl font-bold tracking-tight text-[#FAF8F3] leading-snug">
              {summaryHeadline}
            </h1>

            {/* Natural Operational Prose */}
            <p className="text-xs lg:text-sm text-[#B4CBC3] leading-relaxed">
              Serving residential & commercial RO units across Thirunagar, KK Nagar, and Anna Nagar.
              {overdueReminders.length > 0
                ? ` Prioritize the ${overdueReminders.length} overdue customer${overdueReminders.length > 1 ? 's' : ''} to prevent membrane scaling from high Madurai borewell TDS.`
                : ' Water purifier maintenance schedules are performing smoothly across your registered fleet.'}
            </p>

            {/* Integrated Purposeful Metrics (Asymmetrical, NOT identical cards) */}
            <div className="pt-2 flex flex-wrap items-center gap-6 text-xs border-t border-[#1C3E37]/80">
              <div>
                <span className="text-[11px] text-[#7A9C91] block">Customer Fleet</span>
                <span className="font-mono-data text-base font-bold text-[#FAF8F3]">
                  {activeCustomers.length}
                </span>
                <span className="text-[10px] text-[#7A9C91] ml-1">active</span>
              </div>

              <div className="w-px h-7 bg-[#1C3E37]" />

              <div>
                <span className="text-[11px] text-[#7A9C91] block">Due Today</span>
                <span className="font-mono-data text-base font-bold text-[#F6D285]">
                  {dueTodayReminders.length}
                </span>
                <span className="text-[10px] text-[#7A9C91] ml-1">calls</span>
              </div>

              <div className="w-px h-7 bg-[#1C3E37]" />

              <div>
                <span className="text-[11px] text-[#7A9C91] block">Overdue Follow-up</span>
                <span
                  className={`font-mono-data text-base font-bold ${
                    overdueReminders.length > 0 ? 'text-[#FF8B8B]' : 'text-[#FAF8F3]'
                  }`}
                >
                  {overdueReminders.length}
                </span>
                <span className="text-[10px] text-[#7A9C91] ml-1">urgent</span>
              </div>

              <div className="w-px h-7 bg-[#1C3E37]" />

              <div>
                <span className="text-[11px] text-[#7A9C91] block">Month Completed</span>
                <span className="font-mono-data text-base font-bold text-[#9EE8C8]">
                  ₹{thisMonthRevenue.toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-[#7A9C91] ml-1">({thisMonthServices.length} visits)</span>
              </div>
            </div>
          </div>

          {/* Primary Action Button (Tactile Terracotta/Amber Accent) */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => onOpenRecordService()}
              className="px-5 py-3 bg-[#C25E00] hover:bg-[#A34F00] text-[#FAF8F3] text-xs font-bold rounded-lg shadow-md transition-all active:scale-98 flex items-center gap-2"
            >
              <Wrench className="w-4 h-4 text-[#FFD8B2]" />
              <span>Record Completed Visit</span>
            </button>

            <button
              onClick={onTriggerDailyBatch}
              disabled={batchRunning}
              className="px-4 py-3 bg-[#174238] hover:bg-[#1C5044] text-[#FAF8F3] text-xs font-semibold rounded-lg border border-[#265D50] transition-colors flex items-center gap-2 disabled:opacity-50"
              title="Process automated reminders and compile morning owner report"
            >
              <Play className="w-3.5 h-3.5 text-[#7EE787]" />
              <span>{batchRunning ? 'Running...' : 'Run Morning Batch'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* SECTION B: Today's Service Rhythm (Chronological Operational Timeline) */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between border-b border-[#E5DEC9] pb-2">
          <div>
            <h2 className="font-editorial text-lg font-bold text-[#1B2421]">
              Today's Service Rhythm
            </h2>
            <p className="text-xs text-[#5C6E67]">
              Chronological operational timeline for {formatDisplayDate(today)}
            </p>
          </div>
          <button
            onClick={() => setActiveTab('reminders')}
            className="text-xs text-[#165B50] hover:text-[#0C231F] font-semibold flex items-center gap-1 transition-colors"
          >
            <span>Full Queue</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="bg-[#F4F0E6] border border-[#E5DEC9] rounded-xl p-5 shadow-2xs">
          {dueTodayReminders.length === 0 && todayCompleted.length === 0 ? (
            <div className="py-6 text-center text-xs text-[#5C6E67] space-y-1">
              <Clock className="w-5 h-5 mx-auto text-[#8C9B94] mb-1" />
              <p className="font-semibold text-[#2D3733]">No visits recorded or scheduled for today yet.</p>
              <p>Completed field visits and scheduled maintenance will appear here chronologically.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Scheduled Due Today Items */}
              {dueTodayReminders.map((rem, idx) => {
                const cust = customerMap.get(rem.customerId);
                return (
                  <div
                    key={rem.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FAF8F3] p-3.5 rounded-lg border border-[#DDD6C5]"
                  >
                    <div className="flex items-start gap-3">
                      <div className="font-mono-data text-xs text-[#8C9B94] pt-0.5">
                        {String(idx + 1).padStart(2, '0')}.
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            onClick={() => cust && onOpenCustomerDetail(cust)}
                            className="font-bold text-xs text-[#1B2421] hover:text-[#165B50] cursor-pointer"
                          >
                            {rem.customerName}
                          </span>
                          <span className="text-[11px] text-[#B45309] font-medium font-mono-data">
                            · Due Today
                          </span>
                        </div>
                        <div className="text-[11px] text-[#5C6E67] flex flex-wrap items-center gap-2 mt-0.5">
                          <span>{rem.customerLocality}</span>
                          <span>·</span>
                          <span className="font-mono-data">{rem.customerPhone}</span>
                          <span>·</span>
                          <span>{rem.serviceCategory || 'Filter Inspection'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <a
                        href={`tel:${rem.customerPhone}`}
                        className="px-2.5 py-1.5 bg-[#F4F0E6] hover:bg-[#EDE7DA] text-[#2D3733] text-xs font-medium rounded border border-[#DDD6C5] flex items-center gap-1.5 transition-colors"
                      >
                        <Phone className="w-3 h-3 text-[#165B50]" />
                        <span>Call</span>
                      </a>
                      <button
                        onClick={() => cust && onOpenRecordService(cust)}
                        className="px-3 py-1.5 bg-[#163830] hover:bg-[#0E2822] text-[#FAF8F3] text-xs font-semibold rounded flex items-center gap-1.5 transition-colors"
                      >
                        <Wrench className="w-3 h-3 text-[#7EE787]" />
                        <span>Log Visit</span>
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Completed Today Items */}
              {todayCompleted.map((rec) => (
                <div
                  key={rec.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#EBF7F2] p-3.5 rounded-lg border border-[#C6EAD8]"
                >
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-[#165B50] shrink-0 mt-0.5" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-[#163830]">
                          {rec.customerName}
                        </span>
                        <span className="text-[11px] text-[#165B50] font-medium">
                          · Completed Today
                        </span>
                      </div>
                      <p className="text-[11px] text-[#2D5A4C] mt-0.5">
                        {rec.serviceCategory} · {rec.workPerformed}
                      </p>
                    </div>
                  </div>
                  <div className="font-mono-data text-xs font-bold text-[#163830] self-end sm:self-center">
                    ₹{rec.totalAmount} ({rec.paymentStatus})
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* SECTION C & D: Asymmetrical Split — Urgent Worklist vs Recent Audit History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Customer Follow-Up Worklist */}
        <section className="lg:col-span-7 space-y-3">
          <div className="flex items-baseline justify-between border-b border-[#E5DEC9] pb-2">
            <div>
              <h2 className="font-editorial text-lg font-bold text-[#1B2421]">
                Follow-Up Worklist
              </h2>
              <p className="text-xs text-[#5C6E67]">
                Overdue customers and upcoming maintenance checks
              </p>
            </div>
            <span className="text-xs font-mono-data text-[#5C6E67]">
              {followUpWorklist.length} pending
            </span>
          </div>

          <div className="space-y-2.5">
            {followUpWorklist.length === 0 ? (
              <div className="p-8 bg-[#F4F0E6] border border-[#E5DEC9] rounded-xl text-center text-xs text-[#5C6E67]">
                No pending customer follow-ups. All registered purifiers are on schedule.
              </div>
            ) : (
              followUpWorklist.slice(0, 6).map((rem) => {
                const cust = customerMap.get(rem.customerId);
                const daysUntil = getDaysUntilDate(rem.reminderDate);
                const isOverdue = daysUntil < 0;

                return (
                  <div
                    key={rem.id}
                    className="p-4 bg-[#FAF8F3] border border-[#E5DEC9] hover:border-[#C5BDAA] rounded-xl transition-all space-y-2.5 shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            onClick={() => cust && onOpenCustomerDetail(cust)}
                            className="font-bold text-xs text-[#1B2421] hover:text-[#165B50] cursor-pointer"
                          >
                            {rem.customerName}
                          </span>
                          <span
                            className={`text-[10px] font-mono-data font-bold ${
                              isOverdue ? 'text-[#8B1E1E]' : 'text-[#B45309]'
                            }`}
                          >
                            {isOverdue ? `${Math.abs(daysUntil)}d Overdue` : 'Due Today'}
                          </span>
                        </div>

                        <div className="text-[11px] text-[#5C6E67] flex flex-wrap items-center gap-2 mt-0.5">
                          <span>{rem.customerLocality}</span>
                          <span>·</span>
                          <span className="font-mono-data">{rem.customerPhone}</span>
                          {rem.lastServiceDate && (
                            <>
                              <span>·</span>
                              <span>Last visit: {formatDisplayDate(rem.lastServiceDate)}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {cust?.purifierBrand && (
                        <div className="text-right text-[11px] text-[#2D3733] font-medium hidden sm:block">
                          {cust.purifierBrand}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-[#F0EBE0] text-xs">
                      <div className="flex items-center gap-2">
                        <a
                          href={`tel:${rem.customerPhone}`}
                          className="px-2.5 py-1 bg-[#F4F0E6] hover:bg-[#EDE7DA] text-[#2D3733] rounded text-[11px] font-medium flex items-center gap-1 border border-[#DDD6C5] transition-colors"
                        >
                          <Phone className="w-3 h-3 text-[#165B50]" />
                          <span>Call</span>
                        </a>

                        <a
                          href={`https://wa.me/91${rem.customerPhone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 bg-[#F4F0E6] hover:bg-[#EDE7DA] text-[#2D3733] rounded text-[11px] font-medium flex items-center gap-1 border border-[#DDD6C5] transition-colors"
                        >
                          <MessageSquare className="w-3 h-3 text-[#165B50]" />
                          <span>WhatsApp</span>
                        </a>
                      </div>

                      <button
                        onClick={() => cust && onOpenRecordService(cust)}
                        className="text-xs font-bold text-[#163830] hover:text-[#0C231F] flex items-center gap-1"
                      >
                        <span>Record Visit</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Right Column (5 cols): Compact Recent Field Records */}
        <section className="lg:col-span-5 space-y-3">
          <div className="flex items-baseline justify-between border-b border-[#E5DEC9] pb-2">
            <div>
              <h2 className="font-editorial text-lg font-bold text-[#1B2421]">
                Recent Field Visits
              </h2>
              <p className="text-xs text-[#5C6E67]">
                Completed service tickets & findings
              </p>
            </div>
            <button
              onClick={() => setActiveTab('service_history')}
              className="text-xs text-[#165B50] hover:text-[#0C231F] font-semibold"
            >
              All Records
            </button>
          </div>

          <div className="space-y-2.5">
            {serviceRecords.length === 0 ? (
              <div className="p-8 bg-[#F4F0E6] border border-[#E5DEC9] rounded-xl text-center text-xs text-[#5C6E67]">
                No service records recorded yet.
              </div>
            ) : (
              serviceRecords.slice(0, 5).map((srv) => (
                <div
                  key={srv.id}
                  className="p-3.5 bg-[#FAF8F3] border border-[#E5DEC9] rounded-xl space-y-1.5 shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-bold text-xs text-[#1B2421] block">
                        {srv.customerName}
                      </span>
                      <span className="text-[11px] text-[#5C6E67]">
                        {srv.serviceCategory} · {formatDisplayDate(srv.serviceDate)}
                      </span>
                    </div>
                    <span className="font-mono-data text-xs font-bold text-[#163830]">
                      ₹{srv.totalAmount}
                    </span>
                  </div>

                  {srv.workPerformed && (
                    <p className="text-[11px] text-[#47544F] line-clamp-1">
                      {srv.workPerformed}
                    </p>
                  )}

                  {srv.technicianNotes && (
                    <div className="text-[10px] text-[#5C6E67] bg-[#F4F0E6] p-1.5 rounded font-mono-data">
                      {srv.technicianNotes}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Quick Field Utilities Banner */}
          <div className="p-4 bg-[#F4F0E6] border border-[#E5DEC9] rounded-xl space-y-2 text-xs text-[#2D3733]">
            <span className="font-bold block text-[#1B2421]">Shop Actions</span>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={onOpenAddCustomer}
                className="px-3 py-1.5 bg-[#FAF8F3] hover:bg-[#EDE7DA] border border-[#DDD6C5] rounded text-xs font-medium text-[#1B2421] transition-colors"
              >
                + Register Customer
              </button>
              <button
                onClick={() => setActiveTab('reminders')}
                className="px-3 py-1.5 bg-[#FAF8F3] hover:bg-[#EDE7DA] border border-[#DDD6C5] rounded text-xs font-medium text-[#1B2421] transition-colors"
              >
                Review Reminders
              </button>
              <button
                onClick={() => setActiveTab('daily_reports')}
                className="px-3 py-1.5 bg-[#FAF8F3] hover:bg-[#EDE7DA] border border-[#DDD6C5] rounded text-xs font-medium text-[#1B2421] transition-colors"
              >
                Morning Digest
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
