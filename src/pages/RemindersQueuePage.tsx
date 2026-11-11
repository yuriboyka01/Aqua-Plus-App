import React, { useState, useMemo } from 'react';
import {
  BellRing,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  PauseCircle,
  PlayCircle,
  Phone,
  MessageSquare,
  Search,
  Filter,
  User,
  Wrench,
  ChevronRight,
} from 'lucide-react';
import { Reminder, Customer, ServiceRecord, MessageAttempt } from '../types';
import {
  formatDisplayDate,
  getDaysSinceDate,
  getDaysUntilDate,
  getTodayKolkata,
} from '../utils/dateUtils';

interface RemindersQueuePageProps {
  reminders: Reminder[];
  customers: Customer[];
  serviceRecords: ServiceRecord[];
  messageAttempts: MessageAttempt[];
  onOpenCustomerDetail: (customer: Customer) => void;
  onOpenReminderAction: (reminder: Reminder) => void;
  onOpenWhatsAppPreview: (reminder: Reminder, customer: Customer) => void;
}

export const RemindersQueuePage: React.FC<RemindersQueuePageProps> = ({
  reminders,
  customers,
  serviceRecords,
  messageAttempts,
  onOpenCustomerDetail,
  onOpenReminderAction,
  onOpenWhatsAppPreview,
}) => {
  const [activeTab, setActiveTab] = useState<
    'all' | 'due_today' | 'overdue' | 'upcoming' | 'sent' | 'failed' | 'paused'
  >('due_today');
  const [search, setSearch] = useState('');

  const today = getTodayKolkata();

  const customerMap = useMemo(() => {
    const map = new Map<string, Customer>();
    customers.forEach((c) => map.set(c.id, c));
    return map;
  }, [customers]);

  const categorized = useMemo(() => {
    const all = reminders;
    const active = reminders.filter((r) => r.status !== 'superseded');
    const due_today = active.filter((r) => r.reminderDate === today && r.status !== 'sent' && r.status !== 'contacted_manually' && r.status !== 'paused');
    const overdue = active.filter((r) => getDaysUntilDate(r.reminderDate) < 0 && r.status !== 'sent' && r.status !== 'contacted_manually' && r.status !== 'paused');
    const upcoming = active.filter((r) => getDaysUntilDate(r.reminderDate) > 0 && r.status !== 'paused');
    const sent = active.filter((r) => r.status === 'sent' || r.messageStatus === 'sent');
    const failed = active.filter((r) => r.status === 'failed' || r.messageStatus === 'failed');
    const paused = active.filter((r) => r.status === 'paused');

    return { all, due_today, overdue, upcoming, sent, failed, paused };
  }, [reminders, today]);

  const displayedReminders = useMemo(() => {
    const list = categorized[activeTab] || [];
    if (!search.trim()) return list;

    const q = search.toLowerCase();
    return list.filter((r) => {
      const matchName = r.customerName.toLowerCase().includes(q);
      const matchPhone = r.customerPhone.includes(q);
      const matchLoc = (r.customerLocality || '').toLowerCase().includes(q);
      return matchName || matchPhone || matchLoc;
    });
  }, [categorized, activeTab, search]);

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-[#E5DEC9] pb-4">
        <div>
          <h1 className="font-editorial text-2xl font-bold text-[#1B2421]">
            Maintenance Reminder Rhythm
          </h1>
          <p className="text-xs text-[#5C6E67] mt-0.5">
            Chronological follow-up schedule and WhatsApp reminder queue for Aqua Plus RO Tech customers.
          </p>
        </div>
      </div>

      {/* Segmented Filter Bar (Clean Functional Tabs) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-[#E5DEC9] text-xs font-medium">
        <button
          onClick={() => setActiveTab('due_today')}
          className={`px-3 py-2 rounded transition-colors flex items-center gap-1.5 ${
            activeTab === 'due_today'
              ? 'bg-[#163830] text-[#FAF8F3] font-bold'
              : 'text-[#2D3733] hover:bg-[#F4F0E6]'
          }`}
        >
          <span>Due Today</span>
          <span className="font-mono-data text-[11px] opacity-80">
            ({categorized.due_today.length})
          </span>
        </button>

        <button
          onClick={() => setActiveTab('overdue')}
          className={`px-3 py-2 rounded transition-colors flex items-center gap-1.5 ${
            activeTab === 'overdue'
              ? 'bg-[#8B1E1E] text-[#FAF8F3] font-bold'
              : 'text-[#8B1E1E] hover:bg-[#F4F0E6]'
          }`}
        >
          <span>Overdue</span>
          <span className="font-mono-data text-[11px] opacity-90 font-bold">
            ({categorized.overdue.length})
          </span>
        </button>

        <button
          onClick={() => setActiveTab('upcoming')}
          className={`px-3 py-2 rounded transition-colors flex items-center gap-1.5 ${
            activeTab === 'upcoming'
              ? 'bg-[#163830] text-[#FAF8F3] font-bold'
              : 'text-[#2D3733] hover:bg-[#F4F0E6]'
          }`}
        >
          <span>Upcoming</span>
          <span className="font-mono-data text-[11px] opacity-80">
            ({categorized.upcoming.length})
          </span>
        </button>

        <button
          onClick={() => setActiveTab('sent')}
          className={`px-3 py-2 rounded transition-colors flex items-center gap-1.5 ${
            activeTab === 'sent'
              ? 'bg-[#163830] text-[#FAF8F3] font-bold'
              : 'text-[#2D3733] hover:bg-[#F4F0E6]'
          }`}
        >
          <span>Delivered</span>
          <span className="font-mono-data text-[11px] opacity-80">
            ({categorized.sent.length})
          </span>
        </button>

        <button
          onClick={() => setActiveTab('failed')}
          className={`px-3 py-2 rounded transition-colors flex items-center gap-1.5 ${
            activeTab === 'failed'
              ? 'bg-[#163830] text-[#FAF8F3] font-bold'
              : 'text-[#2D3733] hover:bg-[#F4F0E6]'
          }`}
        >
          <span>Failed / Attn</span>
          <span className="font-mono-data text-[11px] opacity-80">
            ({categorized.failed.length})
          </span>
        </button>

        <button
          onClick={() => setActiveTab('paused')}
          className={`px-3 py-2 rounded transition-colors flex items-center gap-1.5 ${
            activeTab === 'paused'
              ? 'bg-[#163830] text-[#FAF8F3] font-bold'
              : 'text-[#2D3733] hover:bg-[#F4F0E6]'
          }`}
        >
          <span>Paused</span>
          <span className="font-mono-data text-[11px] opacity-80">
            ({categorized.paused.length})
          </span>
        </button>

        <button
          onClick={() => setActiveTab('all')}
          className={`px-3 py-2 rounded transition-colors ml-auto ${
            activeTab === 'all'
              ? 'bg-[#163830] text-[#FAF8F3] font-bold'
              : 'text-[#5C6E67] hover:bg-[#F4F0E6]'
          }`}
        >
          <span>All Records ({categorized.all.length})</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-[#7A8C84] absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter queue by customer name, phone, locality..."
          className="w-full pl-9 pr-3 py-2 text-xs bg-[#F4F0E6] border border-[#DDD6C5] rounded-md focus:outline-none focus:border-[#163830] text-[#1B2421]"
        />
      </div>

      {/* Reminders Table */}
      <div className="bg-[#FAF8F3] border border-[#E5DEC9] rounded-xl shadow-2xs overflow-hidden">
        {displayedReminders.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#5C6E67] space-y-1">
            <BellRing className="w-8 h-8 text-[#8C9B94] mx-auto mb-2" />
            <p className="font-semibold text-[#2D3733]">No reminders in this queue category</p>
            <p>Everything is currently accounted for and up to date.</p>
          </div>
        ) : (
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E5DEC9] bg-[#F4F0E6] text-[11px] font-mono-data text-[#5C6E67] uppercase tracking-wider">
                  <th className="py-3 px-4 font-semibold">Customer</th>
                  <th className="py-3 px-4 font-semibold">Contact & Locality</th>
                  <th className="py-3 px-4 font-semibold">Last Service</th>
                  <th className="py-3 px-4 font-semibold">Scheduled Date</th>
                  <th className="py-3 px-4 font-semibold">Rhythm Status</th>
                  <th className="py-3 px-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDE7DA] text-xs">
                {displayedReminders.map((rem) => {
                  const cust = customerMap.get(rem.customerId);
                  const relatedAttempt = messageAttempts.find((attempt) => attempt.reminderId === rem.id && attempt.status === 'success');
                  const deliveryLabel = relatedAttempt?.providerDeliveryStatus;
                  const daysSince = rem.lastServiceDate ? getDaysSinceDate(rem.lastServiceDate) : null;
                  const daysUntil = getDaysUntilDate(rem.reminderDate);
                  const isOverdue = daysUntil < 0;

                  return (
                    <tr key={rem.id} className="hover:bg-[#F4F0E6]/70 transition-colors">
                      {/* Customer */}
                      <td className="py-3.5 px-4">
                        <strong
                          onClick={() => cust && onOpenCustomerDetail(cust)}
                          className="font-bold text-[#1B2421] hover:text-[#165B50] cursor-pointer block"
                        >
                          {rem.customerName}
                        </strong>
                        <span className="text-[11px] text-[#5C6E67]">
                          {rem.serviceCategory || 'Routine Filter Change'}
                        </span>
                      </td>

                      {/* Phone & Locality */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono-data font-semibold text-[#1B2421]">
                          {rem.customerPhone}
                        </div>
                        <div className="text-[11px] text-[#5C6E67]">
                          {rem.customerLocality || 'Madurai'}
                        </div>
                      </td>

                      {/* Last Service */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono-data text-[#1B2421]">
                          {formatDisplayDate(rem.lastServiceDate)}
                        </span>
                        {daysSince !== null && (
                          <span className="text-[10px] text-[#5C6E67] block">
                            {daysSince}d elapsed
                          </span>
                        )}
                      </td>

                      {/* Reminder Date */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono-data font-semibold text-[#1B2421] block">
                          {formatDisplayDate(rem.reminderDate)}
                        </span>
                        <span
                          className={`text-[10px] font-mono-data font-bold ${
                            isOverdue
                              ? 'text-[#8B1E1E]'
                              : daysUntil === 0
                              ? 'text-[#B45309]'
                              : 'text-[#165B50]'
                          }`}
                        >
                          {isOverdue
                            ? `${Math.abs(daysUntil)}d Overdue`
                            : daysUntil === 0
                            ? 'Due Today!'
                            : `In ${daysUntil} days`}
                        </span>
                      </td>

                      {/* Status (Unboxed Typography) */}
                      <td className="py-3.5 px-4 font-mono-data text-[11px]">
                        {rem.status === 'superseded' ? (
                          <span className="text-[#6B7280] font-semibold">Superseded</span>
                        ) : rem.status === 'paused' ? (
                          <span className="text-[#5C6E67]">Paused</span>
                        ) : rem.status === 'contacted_manually' ? (
                          <span className="text-[#4A2860] font-semibold">Phone Call Logged</span>
                        ) : rem.status === 'sent' ? (
                          <span className="text-[#165B50] font-semibold">
                            {deliveryLabel === 'delivered' ? 'Delivered' : deliveryLabel === 'read' ? 'Read' : deliveryLabel === 'failed' ? 'Delivery failed' : 'Accepted by Meta'}
                          </span>
                        ) : isOverdue ? (
                          <span className="text-[#8B1E1E] font-bold">Overdue</span>
                        ) : daysUntil === 0 ? (
                          <span className="text-[#B45309] font-bold">Due Today</span>
                        ) : (
                          <span className="text-[#165B50]">Upcoming</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        {rem.status !== 'superseded' && (
                        <div className="flex items-center justify-end gap-1.5">
                          <a
                            href={`tel:${rem.customerPhone}`}
                            className="p-1.5 bg-[#F4F0E6] hover:bg-[#EDE7DA] text-[#165B50] rounded border border-[#DDD6C5] transition-colors"
                            title={`Call ${rem.customerPhone}`}
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>

                          {cust && (
                            <button
                              onClick={() => onOpenWhatsAppPreview(rem, cust)}
                              className="px-2.5 py-1 bg-[#174238] hover:bg-[#0E2822] text-[#FAF8F3] font-bold rounded text-[11px] transition-colors flex items-center gap-1"
                              title="Preview & Dispatch WhatsApp"
                            >
                              <MessageSquare className="w-3 h-3 text-[#7EE787]" />
                              <span>WhatsApp</span>
                            </button>
                          )}

                          <button
                            onClick={() => onOpenReminderAction(rem)}
                            className="px-2.5 py-1 bg-[#F4F0E6] hover:bg-[#EDE7DA] text-[#2D3733] font-semibold rounded text-[11px] border border-[#DDD6C5] transition-colors"
                          >
                            Manage
                          </button>
                        </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Mobile Reminder Cards (md:hidden) */}
      {displayedReminders.length > 0 && (
        <div className="md:hidden space-y-3">
          {displayedReminders.map((rem) => {
            const cust = customerMap.get(rem.customerId);
            const daysUntil = getDaysUntilDate(rem.reminderDate);
            const isOverdue = daysUntil < 0;

            return (
              <div
                key={rem.id}
                className="bg-[#FAF8F3] border border-[#E5DEC9] rounded-xl p-4 shadow-2xs space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div onClick={() => cust && onOpenCustomerDetail(cust)} className="cursor-pointer">
                    <h3 className="font-bold text-sm text-[#1B2421]">{rem.customerName}</h3>
                    <p className="text-[11px] text-[#5C6E67]">
                      {rem.customerLocality || 'Madurai'} · <span className="font-mono-data">{rem.customerPhone}</span>
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono-data font-bold shrink-0 ${
                      isOverdue
                        ? 'bg-rose-50 text-[#8B1E1E] border border-rose-200'
                        : daysUntil === 0
                          ? 'bg-amber-50 text-[#B45309] border border-amber-200'
                          : 'bg-[#EBF7F2] text-[#165B50] border border-[#C6EAD8]'
                    }`}
                  >
                    {isOverdue ? `${Math.abs(daysUntil)}d Overdue` : daysUntil === 0 ? 'Due Today' : `In ${daysUntil}d`}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#5C6E67] pt-2 border-t border-[#F0EBE0] font-mono-data">
                  <span>Last: {formatDisplayDate(rem.lastServiceDate)}</span>
                  <span>Due: <strong className="text-[#1B2421]">{formatDisplayDate(rem.reminderDate)}</strong></span>
                </div>

                {rem.status !== 'superseded' && (
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <a
                      href={`tel:${rem.customerPhone}`}
                      className="py-2 px-2.5 bg-[#F4F0E6] hover:bg-[#EDE7DA] text-[#1B2421] rounded-lg border border-[#DDD6C5] text-xs font-semibold flex items-center justify-center gap-1.5"
                    >
                      <Phone className="w-3.5 h-3.5 text-[#165B50]" />
                      <span>Call</span>
                    </a>

                    {cust && (
                      <button
                        onClick={() => onOpenWhatsAppPreview(rem, cust)}
                        className="py-2 px-2.5 bg-[#174238] hover:bg-[#0E2822] text-[#FAF8F3] rounded-lg text-xs font-bold flex items-center justify-center gap-1.5"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-[#7EE787]" />
                        <span>WhatsApp</span>
                      </button>
                    )}

                    <button
                      onClick={() => onOpenReminderAction(rem)}
                      className="py-2 px-2.5 bg-[#F4F0E6] hover:bg-[#EDE7DA] text-[#2D3733] rounded-lg border border-[#DDD6C5] text-xs font-semibold flex items-center justify-center"
                    >
                      Manage
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
