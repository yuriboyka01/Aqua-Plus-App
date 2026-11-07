import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Filter,
  Plus,
  Phone,
  MessageSquare,
  Wrench,
  Download,
  Archive,
  RotateCcw,
  ShieldCheck,
  Calendar,
  ChevronRight,
  ArrowUpDown,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { Customer, ServiceRecord, Reminder } from '../types';
import { formatDisplayDate, getDaysSinceDate, getDaysUntilDate } from '../utils/dateUtils';
import { exportCustomersToCsv } from '../utils/csvExport';
import { MADURAI_LOCALITIES, POPULAR_RO_BRANDS } from '../lib/constants';

interface CustomersPageProps {
  customers: Customer[];
  serviceRecords: ServiceRecord[];
  reminders: Reminder[];
  onOpenAddCustomer: () => void;
  onEditCustomer: (customer: Customer) => void;
  onOpenCustomerDetail: (customer: Customer) => void;
  onRecordServiceForCustomer: (customer: Customer) => void;
  onArchiveToggle: (customer: Customer) => void;
  initialSearch?: string;
}

export const CustomersPage: React.FC<CustomersPageProps> = ({
  customers,
  serviceRecords,
  reminders,
  onOpenAddCustomer,
  onEditCustomer,
  onOpenCustomerDetail,
  onRecordServiceForCustomer,
  onArchiveToggle,
  initialSearch = '',
}) => {
  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('active');
  const [localityFilter, setLocalityFilter] = useState<string>('all');
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'reminder' | 'service' | 'name'>('reminder');

  // Sync with global Navbar search input
  React.useEffect(() => {
    setSearch(initialSearch);
  }, [initialSearch]);

  // Filtered and sorted customers
  const processedCustomers = useMemo(() => {
    let list = customers.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (localityFilter !== 'all' && c.locality !== localityFilter) return false;
      if (brandFilter !== 'all' && c.purifierBrand !== brandFilter) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = c.fullName.toLowerCase().includes(q);
        const matchPhone = c.primaryPhone.includes(q) || (c.alternatePhone && c.alternatePhone.includes(q));
        const matchId = c.customerId.toLowerCase().includes(q);
        const matchLoc = (c.locality || '').toLowerCase().includes(q);
        const matchBrand = (c.purifierBrand || '').toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchId && !matchLoc && !matchBrand) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      if (sortBy === 'reminder') {
        const dateA = a.nextReminderDate || '9999';
        const dateB = b.nextReminderDate || '9999';
        return dateA.localeCompare(dateB);
      }
      if (sortBy === 'service') {
        const dateA = a.lastServiceDate || '';
        const dateB = b.lastServiceDate || '';
        return dateB.localeCompare(dateA);
      }
      return a.fullName.localeCompare(b.fullName);
    });

    return list;
  }, [customers, statusFilter, localityFilter, brandFilter, search, sortBy]);

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-[#E5DEC9] pb-4">
        <div>
          <h1 className="font-editorial text-2xl font-bold text-[#1B2421]">
            Customer Directory & Purifier Ledger
          </h1>
          <p className="text-xs text-[#5C6E67] mt-0.5">
            Operational client records, purifier specifications, and recorded reminder consents across Madurai.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => exportCustomersToCsv(processedCustomers)}
            disabled={processedCustomers.length === 0}
            className="px-3.5 py-2 bg-[#F4F0E6] hover:bg-[#EDE7DA] text-[#2D3733] text-xs font-semibold rounded border border-[#DDD6C5] flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5 text-[#5C6E67]" />
            <span>Export Ledger CSV</span>
          </button>

          <button
            onClick={onOpenAddCustomer}
            className="px-4 py-2 bg-[#163830] hover:bg-[#0E2822] text-[#FAF8F3] text-xs font-bold rounded shadow-sm flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4 text-[#7EE787]" />
            <span>New Customer</span>
          </button>
        </div>
      </div>

      {/* Filter and Control Bar (Clean Segmented Paper Design) */}
      <div className="bg-[#F4F0E6] border border-[#E5DEC9] rounded-xl p-4 space-y-3 shadow-2xs">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Box */}
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-[#7A8C84] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by customer name, phone, locality, brand..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-[#FAF8F3] border border-[#DDD6C5] rounded-md focus:outline-none focus:border-[#163830] text-[#1B2421]"
            />
          </div>

          {/* Status Selection */}
          <div className="md:col-span-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 text-xs bg-[#FAF8F3] border border-[#DDD6C5] rounded-md text-[#2D3733]"
            >
              <option value="active">Active Purifiers</option>
              <option value="archived">Archived Accounts</option>
              <option value="all">All Records</option>
            </select>
          </div>

          {/* Locality Selection */}
          <div className="md:col-span-3">
            <select
              value={localityFilter}
              onChange={(e) => setLocalityFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#FAF8F3] border border-[#DDD6C5] rounded-md text-[#2D3733]"
            >
              <option value="all">All Madurai Localities</option>
              {MADURAI_LOCALITIES.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Selection */}
          <div className="md:col-span-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-3 py-2 text-xs bg-[#FAF8F3] border border-[#DDD6C5] rounded-md text-[#2D3733]"
            >
              <option value="reminder">Sort by Next Due</option>
              <option value="service">Sort by Last Service</option>
              <option value="name">Sort by Name</option>
            </select>
          </div>
        </div>

        {/* Brand Quick Links */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#E5DEC9] text-xs text-[#5C6E67]">
          <span>Purifier Brand:</span>
          <button
            onClick={() => setBrandFilter('all')}
            className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
              brandFilter === 'all'
                ? 'bg-[#163830] text-[#FAF8F3] font-semibold'
                : 'bg-[#FAF8F3] text-[#2D3733] hover:bg-[#EDE7DA]'
            }`}
          >
            All
          </button>
          {['Aqua Plus RO (Custom)', 'Kent RO', 'Aquaguard (Eureka Forbes)', 'Livpure'].map((b) => (
            <button
              key={b}
              onClick={() => setBrandFilter(b)}
              className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                brandFilter === b
                  ? 'bg-[#163830] text-[#FAF8F3] font-semibold'
                  : 'bg-[#FAF8F3] text-[#2D3733] hover:bg-[#EDE7DA]'
              }`}
            >
              {b.split(' ')[0]}
            </button>
          ))}
          {(search || localityFilter !== 'all' || brandFilter !== 'all' || statusFilter !== 'active') && (
            <button
              onClick={() => {
                setSearch('');
                setStatusFilter('active');
                setLocalityFilter('all');
                setBrandFilter('all');
              }}
              className="ml-auto text-[11px] font-semibold text-[#165B50] hover:underline"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Customer Field Ledger (Clean Table & Card Hybrid) */}
      <div className="bg-[#FAF8F3] border border-[#E5DEC9] rounded-xl shadow-2xs overflow-hidden">
        {processedCustomers.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#5C6E67] space-y-2">
            <Users className="w-8 h-8 mx-auto text-[#8C9B94]" />
            <p className="font-semibold text-[#2D3733]">No customer records matched your query.</p>
            <p>Try clearing filters or register a new customer in Madurai.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E5DEC9] bg-[#F4F0E6] text-[11px] font-mono-data text-[#5C6E67] uppercase tracking-wider">
                  <th className="py-3 px-4 font-semibold">Ref · Customer</th>
                  <th className="py-3 px-4 font-semibold">Phone & Locality</th>
                  <th className="py-3 px-4 font-semibold">Purifier System</th>
                  <th className="py-3 px-4 font-semibold">Last Visited</th>
                  <th className="py-3 px-4 font-semibold">Next Scheduled</th>
                  <th className="py-3 px-4 font-semibold">Consent</th>
                  <th className="py-3 px-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDE7DA] text-xs">
                {processedCustomers.map((cust) => {
                  const daysSince = cust.lastServiceDate ? getDaysSinceDate(cust.lastServiceDate) : null;
                  const daysUntil = cust.nextReminderDate ? getDaysUntilDate(cust.nextReminderDate) : null;
                  const isOverdue = daysUntil !== null && daysUntil < 0;
                  const isDueToday = daysUntil === 0;

                  return (
                    <tr
                      key={cust.id}
                      className="hover:bg-[#F4F0E6]/70 transition-colors group"
                    >
                      {/* Customer ID & Name */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono-data text-[10px] text-[#5C6E67]">
                            {cust.customerId}
                          </span>
                        </div>
                        <h3
                          onClick={() => onOpenCustomerDetail(cust)}
                          className="font-bold text-[#1B2421] hover:text-[#165B50] cursor-pointer mt-0.5 text-xs"
                        >
                          {cust.fullName}
                        </h3>
                        {cust.status === 'archived' && (
                          <span className="text-[10px] text-[#8B1E1E] font-medium block">Archived</span>
                        )}
                      </td>

                      {/* Phone & Locality */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono-data font-semibold text-[#1B2421]">
                          {cust.primaryPhone}
                        </div>
                        <div className="text-[11px] text-[#5C6E67] mt-0.5">
                          {cust.locality || 'Madurai'}
                        </div>
                      </td>

                      {/* Purifier System */}
                      <td className="py-3.5 px-4">
                        <span className="font-medium text-[#1B2421] block">
                          {cust.purifierBrand}
                        </span>
                        {cust.purifierModel && (
                          <span className="text-[11px] text-[#5C6E67] block truncate max-w-[150px]">
                            {cust.purifierModel}
                          </span>
                        )}
                      </td>

                      {/* Last Service */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono-data text-[#1B2421]">
                          {formatDisplayDate(cust.lastServiceDate)}
                        </span>
                        {daysSince !== null && (
                          <span className="text-[10px] text-[#5C6E67] block">
                            {daysSince}d elapsed
                          </span>
                        )}
                      </td>

                      {/* Next Scheduled Due Date */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono-data font-semibold text-[#1B2421] block">
                          {formatDisplayDate(cust.nextReminderDate)}
                        </span>
                        {daysUntil !== null && (
                          <span
                            className={`text-[10px] font-mono-data font-bold ${
                              isOverdue
                                ? 'text-[#8B1E1E]'
                                : isDueToday
                                ? 'text-[#B45309]'
                                : 'text-[#165B50]'
                            }`}
                          >
                            {isOverdue
                              ? `${Math.abs(daysUntil)}d Overdue`
                              : isDueToday
                              ? 'Due Today!'
                              : `In ${daysUntil}d`}
                          </span>
                        )}
                      </td>

                      {/* Consent (Unboxed Typography) */}
                      <td className="py-3.5 px-4">
                        {cust.whatsappConsent ? (
                          <span className="text-[11px] text-[#165B50] font-medium flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5 text-[#165B50]" />
                            <span>Recorded</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-[#8C9B94] font-normal">
                            Not captured
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onRecordServiceForCustomer(cust)}
                            className="px-2.5 py-1 bg-[#163830] hover:bg-[#0E2822] text-[#FAF8F3] text-[11px] font-bold rounded transition-colors flex items-center gap-1"
                            title="Record completed service visit"
                          >
                            <Wrench className="w-3 h-3 text-[#7EE787]" />
                            <span>Visit</span>
                          </button>

                          <button
                            onClick={() => onOpenCustomerDetail(cust)}
                            className="px-2.5 py-1 bg-[#F4F0E6] hover:bg-[#EDE7DA] text-[#2D3733] text-[11px] font-semibold rounded border border-[#DDD6C5] transition-colors"
                          >
                            View
                          </button>

                          <button
                            onClick={() => onEditCustomer(cust)}
                            className="p-1 text-[#7A8C84] hover:text-[#163830] rounded transition-colors text-[11px]"
                            title="Edit customer details"
                          >
                            Edit
                          </button>

                          <button
                            onClick={() => onArchiveToggle(cust)}
                            className="p-1 text-[#7A8C84] hover:text-[#8B1E1E] rounded transition-colors text-[11px]"
                            title={cust.status === 'archived' ? 'Restore customer' : 'Archive customer'}
                          >
                            {cust.status === 'archived' ? (
                              <RotateCcw className="w-3.5 h-3.5 text-[#165B50]" />
                            ) : (
                              <Archive className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
