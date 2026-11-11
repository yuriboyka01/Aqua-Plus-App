import React, { useState, useMemo } from 'react';
import {
  History,
  Search,
  Filter,
  Download,
  Calendar,
  Wrench,
  DollarSign,
  Tag,
  Clock,
  ArrowUpDown,
  CheckCircle2,
  AlertCircle,
  FileCheck2,
  Droplets,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  User,
  Phone,
  Gauge,
  X,
} from 'lucide-react';
import { ServiceRecord, Customer, ServiceCategory, PaymentStatus } from '../types';
import { formatDisplayDate } from '../utils/dateUtils';
import { exportServiceRecordsToCsv } from '../utils/csvExport';
import { DEFAULT_SERVICE_CATEGORIES } from '../lib/constants';

interface ServiceHistoryPageProps {
  serviceRecords: ServiceRecord[];
  customers: Customer[];
  onOpenCustomerDetail: (customer: Customer) => void;
}

export const ServiceHistoryPage: React.FC<ServiceHistoryPageProps> = ({
  serviceRecords,
  customers,
  onOpenCustomerDetail,
}) => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [selectedRecord, setSelectedRecord] = useState<ServiceRecord | null>(null);

  const customerMap = useMemo(() => {
    const map = new Map<string, Customer>();
    customers.forEach((c) => map.set(c.id, c));
    return map;
  }, [customers]);

  const filteredRecords = useMemo(() => {
    return serviceRecords.filter((rec) => {
      if (categoryFilter !== 'all' && rec.serviceCategory !== categoryFilter) return false;
      if (paymentFilter !== 'all' && rec.paymentStatus !== paymentFilter) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = rec.customerName.toLowerCase().includes(q);
        const matchesPhone = rec.customerPhone.includes(q);
        const matchesWork = (rec.workPerformed || '').toLowerCase().includes(q);
        const matchesParts = (rec.filtersReplaced || '').toLowerCase().includes(q);
        const matchesNotes = (rec.technicianNotes || '').toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesWork && !matchesParts && !matchesNotes) return false;
      }
      return true;
    });
  }, [serviceRecords, categoryFilter, paymentFilter, search]);

  // Aggregate metrics
  const totalRevenue = useMemo(() => {
    return serviceRecords.reduce((acc, curr) => acc + (Number(curr.totalAmount) || 0), 0);
  }, [serviceRecords]);

  const paidRevenue = useMemo(() => {
    return serviceRecords
      .filter((s) => s.paymentStatus === 'Paid')
      .reduce((acc, curr) => acc + (Number(curr.totalAmount) || 0), 0);
  }, [serviceRecords]);

  const pendingRevenue = totalRevenue - paidRevenue;

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Editorial Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-[#E5DEC9] pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#5C6E67] mb-1">
            <span className="font-editorial italic text-[#1B2421]">Aqua Plus RO Tech</span>
            <span>·</span>
            <span>Madurai Field Service Records</span>
            <span>·</span>
            <span className="font-mono-data text-[#2D3733] font-semibold">{filteredRecords.length} entries</span>
          </div>
          <h1 className="font-editorial text-2xl font-bold text-[#1B2421] tracking-tight">
            Certified Maintenance Ledger & Field Logbook
          </h1>
          <p className="text-xs text-[#5C6E67] mt-0.5">
            Permanent physical audit trail of completed RO purifier visits, filter changes, TDS reductions, and cash/UPI collections.
          </p>
        </div>

        <button
          onClick={() => exportServiceRecordsToCsv(filteredRecords)}
          disabled={filteredRecords.length === 0}
          className="px-3.5 py-2 bg-[#F4F0E6] hover:bg-[#EDE7DA] text-[#1B2421] text-xs font-semibold rounded border border-[#DDD6C5] flex items-center gap-2 transition-colors disabled:opacity-50 shrink-0"
        >
          <Download className="w-3.5 h-3.5 text-[#165B50]" />
          <span>Export Ledger CSV</span>
        </button>
      </div>

      {/* Integrated Technical Ribbon (Asymmetrical Operational Strip, NO identical cards) */}
      <section className="bg-[#0C231F] text-[#FAF8F3] rounded-xl p-5 border border-[#1A3D35] flex flex-wrap items-center justify-between gap-6 shadow-2xs">
        <div className="flex flex-wrap items-center gap-6 sm:gap-10 text-xs">
          <div>
            <span className="text-[11px] text-[#86AB9F] block">Verified Completed Visits</span>
            <span className="font-mono-data text-xl font-bold text-[#FAF8F3]">
              {serviceRecords.length}
            </span>
            <span className="text-[10px] text-[#86AB9F] ml-1.5">permanent records</span>
          </div>

          <div className="w-px h-8 bg-[#1C3E37] hidden sm:block" />

          <div>
            <span className="text-[11px] text-[#86AB9F] block">Total Collections Realized</span>
            <span className="font-mono-data text-xl font-bold text-[#7EE787]">
              ₹{paidRevenue.toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] text-[#86AB9F] ml-1.5">settled</span>
          </div>

          <div className="w-px h-8 bg-[#1C3E37] hidden sm:block" />

          <div>
            <span className="text-[11px] text-[#86AB9F] block">Pending / Unsettled Invoices</span>
            <span className="font-mono-data text-xl font-bold text-[#F6D285]">
              ₹{pendingRevenue.toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] text-[#86AB9F] ml-1.5">receivables</span>
          </div>
        </div>

        <div className="text-[11px] text-[#86AB9F] flex items-center gap-2 font-mono-data">
          <ShieldCheck className="w-4 h-4 text-[#7EE787]" />
          <span>Verified Field Operations • Madurai Division</span>
        </div>
      </section>

      {/* Search and Filters Toolbar */}
      <div className="bg-[#F4F0E6] border border-[#E5DEC9] rounded-xl p-4 flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-[#7A8C84] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search logbook by customer name, phone, replaced filters, TDS notes..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-[#FAF8F3] border border-[#DDD6C5] rounded-md focus:outline-none focus:border-[#163830] text-[#1B2421] placeholder:text-[#8C9B94]"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full md:w-48 px-3 py-2 text-xs bg-[#FAF8F3] border border-[#DDD6C5] rounded-md text-[#1B2421] font-medium focus:outline-none focus:border-[#163830]"
          >
            <option value="all">All Service Categories</option>
            {DEFAULT_SERVICE_CATEGORIES.map((cat) => (
              <option key={cat.category} value={cat.category}>
                {cat.category}
              </option>
            ))}
          </select>

          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="w-full md:w-36 px-3 py-2 text-xs bg-[#FAF8F3] border border-[#DDD6C5] rounded-md text-[#1B2421] font-medium focus:outline-none focus:border-[#163830]"
          >
            <option value="all">All Payments</option>
            <option value="Paid">Paid</option>
            <option value="Pending">Pending</option>
            <option value="Partial">Partial</option>
          </select>
        </div>
      </div>

      {/* Certified Ledger Table */}
      <div className="bg-[#FAF8F3] border border-[#E5DEC9] rounded-xl shadow-2xs overflow-hidden">
        {filteredRecords.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#5C6E67] space-y-1">
            <History className="w-8 h-8 text-[#8C9B94] mx-auto mb-2" />
            <p className="font-semibold text-[#2D3733]">No matching field service records found</p>
            <p>Adjust your search filters or record completed maintenance visits to populate the logbook.</p>
          </div>
        ) : (
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E5DEC9] bg-[#F4F0E6] text-[11px] font-mono-data text-[#5C6E67] uppercase tracking-wider">
                  <th className="py-3 px-4 font-semibold">Slip Date</th>
                  <th className="py-3 px-4 font-semibold">Customer & Locality</th>
                  <th className="py-3 px-4 font-semibold">Category</th>
                  <th className="py-3 px-4 font-semibold">Work & Replaced Filters</th>
                  <th className="py-3 px-4 font-semibold">Diagnostics / TDS</th>
                  <th className="py-3 px-4 font-semibold">Charges</th>
                  <th className="py-3 px-4 font-semibold">Settlement</th>
                  <th className="py-3 px-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDE7DA] text-xs">
                {filteredRecords.map((rec) => {
                  const cust = customerMap.get(rec.customerId);
                  return (
                    <tr key={rec.id} className="hover:bg-[#F4F0E6]/70 transition-colors">
                      {/* Visit Date */}
                      <td className="py-3.5 px-4 font-mono-data font-semibold text-[#1B2421]">
                        {formatDisplayDate(rec.serviceDate)}
                      </td>

                      {/* Customer */}
                      <td className="py-3.5 px-4">
                        <strong
                          onClick={() => cust && onOpenCustomerDetail(cust)}
                          className={`block font-bold text-[#1B2421] ${
                            cust ? 'hover:text-[#165B50] cursor-pointer' : ''
                          }`}
                        >
                          {rec.customerName}
                        </strong>
                        <div className="text-[11px] text-[#5C6E67] flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono-data">{rec.customerPhone}</span>
                          {cust?.locality && (
                            <>
                              <span>·</span>
                              <span>{cust.locality}</span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4">
                        <span className="font-medium text-[#163830] block">
                          {rec.serviceCategory}
                        </span>
                        <span className="text-[10px] text-[#5C6E67] font-mono-data">
                          {rec.recommendedIntervalDays || 90}d interval
                        </span>
                      </td>

                      {/* Work & Parts */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <p className="font-medium text-[#2D3733] truncate">{rec.workPerformed}</p>
                        {rec.filtersReplaced ? (
                          <p className="text-[11px] text-[#165B50] font-mono-data truncate mt-0.5">
                            Parts: {rec.filtersReplaced}
                          </p>
                        ) : (
                          <span className="text-[10px] text-[#8C9B94]">No parts replaced</span>
                        )}
                      </td>

                      {/* Diagnostics / TDS */}
                      <td className="py-3.5 px-4 max-w-[160px]">
                        {rec.technicianNotes ? (
                          <div className="text-[11px] font-mono-data text-[#1B2421] truncate" title={rec.technicianNotes}>
                            {rec.technicianNotes}
                          </div>
                        ) : (
                          <span className="text-[11px] text-[#8C9B94] font-mono-data">—</span>
                        )}
                      </td>

                      {/* Charges */}
                      <td className="py-3.5 px-4 font-mono-data">
                        <strong className="text-[#1B2421] text-xs font-bold">₹{rec.totalAmount}</strong>
                        <div className="text-[10px] text-[#5C6E67]">
                          ₹{rec.serviceCharge} labor + ₹{rec.partsCharge} parts
                        </div>
                      </td>

                      {/* Payment Status (Unboxed Typography) */}
                      <td className="py-3.5 px-4 font-mono-data text-[11px]">
                        <span
                          className={`font-semibold ${
                            rec.paymentStatus === 'Paid'
                              ? 'text-[#165B50]'
                              : rec.paymentStatus === 'Pending'
                              ? 'text-[#B45309]'
                              : 'text-[#8B1E1E]'
                          }`}
                        >
                          {rec.paymentStatus}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setSelectedRecord(rec)}
                          className="px-2.5 py-1 bg-[#F4F0E6] hover:bg-[#EDE7DA] text-[#1B2421] font-semibold rounded text-[11px] border border-[#DDD6C5] transition-colors"
                        >
                          Inspection Slip
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Mobile Service Record Cards (md:hidden) */}
      {filteredRecords.length > 0 && (
        <div className="md:hidden space-y-3">
          {filteredRecords.map((rec) => {
            const cust = customerMap.get(rec.customerId);
            return (
              <div
                key={rec.id}
                className="bg-[#FAF8F3] border border-[#E5DEC9] rounded-xl p-4 shadow-2xs space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div onClick={() => cust && onOpenCustomerDetail(cust)} className="cursor-pointer">
                    <span className="font-mono-data text-[10px] text-[#5C6E67] bg-[#F4F0E6] px-1.5 py-0.5 rounded border border-[#E5DEC9]">
                      {formatDisplayDate(rec.serviceDate)}
                    </span>
                    <h3 className="font-bold text-sm text-[#1B2421] mt-1">{rec.customerName}</h3>
                    <p className="text-[11px] text-[#5C6E67]">
                      {rec.customerPhone} {cust?.locality ? `· ${cust.locality}` : ''}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono-data font-bold shrink-0 ${
                      rec.paymentStatus === 'Paid'
                        ? 'bg-[#EBF7F2] text-[#165B50] border border-[#C6EAD8]'
                        : rec.paymentStatus === 'Pending'
                          ? 'bg-amber-50 text-[#B45309] border border-amber-200'
                          : 'bg-rose-50 text-[#8B1E1E] border border-rose-200'
                    }`}
                  >
                    ₹{rec.totalAmount} · {rec.paymentStatus}
                  </span>
                </div>

                <div className="text-[11px] text-[#5C6E67] pt-2 border-t border-[#F0EBE0] space-y-1">
                  <p><strong className="text-[#1B2421]">{rec.serviceCategory}</strong>: {rec.workPerformed}</p>
                  {rec.filtersReplaced && (
                    <p className="text-[10px] text-[#165B50]">Parts: {rec.filtersReplaced}</p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-[#5C6E67] font-mono-data">
                    Next Due: {formatDisplayDate(rec.nextReminderDate)}
                  </span>
                  <button
                    onClick={() => setSelectedRecord(rec)}
                    className="py-1.5 px-3 bg-[#F4F0E6] hover:bg-[#EDE7DA] text-[#1B2421] font-semibold rounded-lg text-xs border border-[#DDD6C5]"
                  >
                    Inspection Slip
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Certified Inspection Slip Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#0C231F]/65 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-lg bg-[#FAF8F3] rounded-2xl shadow-2xl border border-[#DDD6C5] overflow-hidden my-6 flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 bg-[#0C231F] text-[#FAF8F3] flex items-center justify-between shrink-0 border-b border-[#1C3E37]">
              <div>
                <div className="text-[10px] text-[#7EE787] font-mono-data uppercase tracking-wider">
                  Verified Inspection Slip
                </div>
                <h3 className="font-editorial text-xl font-bold tracking-tight text-[#FAF8F3]">
                  Service Audit Record
                </h3>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="text-[#86AB9F] hover:text-[#FAF8F3] p-1.5 rounded hover:bg-[#174238] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Slip Body */}
            <div className="p-6 space-y-4 text-xs text-[#1B2421]">
              <div className="p-4 bg-[#F4F0E6] rounded-xl border border-[#E5DEC9] space-y-2">
                <div className="flex items-baseline justify-between border-b border-[#DDD6C5] pb-2">
                  <div>
                    <span className="font-editorial font-bold text-sm text-[#1B2421]">
                      {selectedRecord.customerName}
                    </span>
                    <p className="font-mono-data text-[11px] text-[#5C6E67]">{selectedRecord.customerPhone}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-mono-data font-bold text-xs text-[#1B2421]">
                      {formatDisplayDate(selectedRecord.serviceDate)}
                    </span>
                    <p className="text-[10px] text-[#165B50] font-semibold">{selectedRecord.serviceCategory}</p>
                  </div>
                </div>

                {selectedRecord.customerAddress && (
                  <p className="text-[11px] text-[#5C6E67] pt-1">
                    Address: {selectedRecord.customerAddress}
                  </p>
                )}
              </div>

              {selectedRecord.problemReported && (
                <div>
                  <span className="font-semibold text-[#5C6E67] block mb-0.5">Problem Reported:</span>
                  <p className="p-2.5 bg-[#F4F0E6] rounded border border-[#E5DEC9]">
                    {selectedRecord.problemReported}
                  </p>
                </div>
              )}

              <div>
                <span className="font-semibold text-[#5C6E67] block mb-0.5">Work Conducted:</span>
                <p className="p-2.5 bg-[#F4F0E6] rounded border border-[#E5DEC9] font-medium">
                  {selectedRecord.workPerformed}
                </p>
              </div>

              {selectedRecord.filtersReplaced && (
                <div>
                  <span className="font-semibold text-[#5C6E67] block mb-0.5">Filters / Parts Replaced:</span>
                  <p className="p-2.5 bg-[#F4F0E6] rounded border border-[#E5DEC9] font-mono-data text-[#165B50]">
                    {selectedRecord.filtersReplaced}
                  </p>
                </div>
              )}

              {selectedRecord.technicianNotes && (
                <div>
                  <span className="font-semibold text-[#5C6E67] block mb-0.5">Water Purity & Diagnostic Readings:</span>
                  <p className="p-2.5 bg-[#EBF7F2] rounded border border-[#C6EAD8] text-[#163830] font-mono-data font-medium">
                    {selectedRecord.technicianNotes}
                  </p>
                </div>
              )}

              {/* Financial Breakdown */}
              <div className="grid grid-cols-3 gap-3 p-3 bg-[#F4F0E6] rounded-xl border border-[#E5DEC9] font-mono-data">
                <div>
                  <span className="text-[10px] text-[#5C6E67] block">Service Labor</span>
                  <strong className="text-xs text-[#1B2421]">₹{selectedRecord.serviceCharge}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-[#5C6E67] block">Components</span>
                  <strong className="text-xs text-[#1B2421]">₹{selectedRecord.partsCharge}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-[#5C6E67] block">Total Amount</span>
                  <strong className="text-xs text-[#163830] font-bold">₹{selectedRecord.totalAmount}</strong>
                  <span className="text-[10px] text-[#165B50] block">({selectedRecord.paymentStatus})</span>
                </div>
              </div>

              {/* Audit Meta */}
              <div className="pt-2 border-t border-[#EDE7DA] flex items-center justify-between text-[11px] text-[#5C6E67] font-mono-data">
                <span>Interval: {selectedRecord.recommendedIntervalDays}d</span>
                <span>
                  Next Reminder: <strong className="text-[#1B2421]">{formatDisplayDate(selectedRecord.nextReminderDate)}</strong>
                  {selectedRecord.isDateOverridden && ' (Overridden)'}
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const receiptText = [
                      `*Aqua Plus RO Tech • Service Receipt*`,
                      `Customer: ${selectedRecord.customerName}`,
                      `Date: ${formatDisplayDate(selectedRecord.serviceDate)}`,
                      `Category: ${selectedRecord.serviceCategory}`,
                      `Work: ${selectedRecord.workPerformed}`,
                      selectedRecord.filtersReplaced ? `Parts: ${selectedRecord.filtersReplaced}` : '',
                      selectedRecord.technicianNotes ? `Readings: ${selectedRecord.technicianNotes}` : '',
                      `Total: ₹${selectedRecord.totalAmount} (${selectedRecord.paymentStatus})`,
                      `Next Due: ${formatDisplayDate(selectedRecord.nextReminderDate)}`,
                    ]
                      .filter(Boolean)
                      .join('\n');
                    navigator.clipboard?.writeText(receiptText);
                  }}
                  className="px-3.5 py-2 bg-[#163830] hover:bg-[#0E2822] text-[#FAF8F3] font-bold rounded-lg text-xs transition-colors"
                >
                  Copy WhatsApp Receipt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
