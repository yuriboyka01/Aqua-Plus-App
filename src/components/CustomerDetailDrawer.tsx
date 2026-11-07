import React from 'react';
import {
  X,
  Phone,
  MessageSquare,
  Wrench,
  Edit,
  Archive,
  RotateCcw,
  Calendar,
  MapPin,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  PauseCircle,
  PlayCircle,
  Tag,
} from 'lucide-react';
import { Customer, ServiceRecord, Reminder } from '../types';
import { formatDisplayDate, formatDisplayDateTime, getDaysSinceDate, getDaysUntilDate } from '../utils/dateUtils';

interface CustomerDetailDrawerProps {
  customer: Customer | null;
  onClose: () => void;
  serviceHistory: ServiceRecord[];
  reminders: Reminder[];
  onEdit: (customer: Customer) => void;
  onRecordServiceForCustomer: (customer: Customer) => void;
  onArchiveToggle: (customer: Customer) => void;
  onPauseToggle: (customer: Customer) => void;
}

export const CustomerDetailDrawer: React.FC<CustomerDetailDrawerProps> = ({
  customer,
  onClose,
  serviceHistory,
  reminders,
  onEdit,
  onRecordServiceForCustomer,
  onArchiveToggle,
  onPauseToggle,
}) => {
  if (!customer) return null;

  const daysSinceService = customer.lastServiceDate ? getDaysSinceDate(customer.lastServiceDate) : null;
  const daysUntilNext = customer.nextReminderDate ? getDaysUntilDate(customer.nextReminderDate) : null;

  const cleanPhone = customer.primaryPhone.replace(/\D/g, '');
  const waPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#0C231F]/60 backdrop-blur-xs">
      <div className="w-full max-w-2xl bg-[#FAF8F3] h-full shadow-2xl flex flex-col border-l border-[#DDD6C5] animate-in slide-in-from-right duration-200">
        {/* Drawer Header (Deep Bottle Green) */}
        <div className="p-6 bg-[#0C231F] text-[#FAF8F3] shrink-0 border-b border-[#1C3E37]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs text-[#86AB9F]">
                <span className="font-mono-data text-[#7EE787] font-semibold">
                  {customer.customerId}
                </span>
                <span>·</span>
                <span>{customer.locality || 'Madurai'}</span>
                {customer.status === 'archived' && (
                  <>
                    <span>·</span>
                    <span className="text-[#FF8B8B] font-semibold">Archived</span>
                  </>
                )}
                {customer.remindersPaused && (
                  <>
                    <span>·</span>
                    <span className="text-[#F6D285] font-semibold">Reminders Paused</span>
                  </>
                )}
              </div>
              <h2 className="font-editorial text-2xl font-bold text-[#FAF8F3] mt-1 tracking-tight">
                {customer.fullName}
              </h2>
              {customer.address && (
                <p className="text-xs text-[#B4CBC3] flex items-center gap-1.5 mt-1">
                  <MapPin className="w-3.5 h-3.5 text-[#7EE787] shrink-0" />
                  <span>{customer.address}</span>
                </p>
              )}
            </div>

            <button
              onClick={onClose}
              className="text-[#86AB9F] hover:text-[#FAF8F3] p-1.5 rounded hover:bg-[#174238] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Action Ribbon */}
          <div className="flex flex-wrap items-center gap-2 mt-5 pt-4 border-t border-[#1C3E37]">
            <a
              href={`tel:${customer.primaryPhone}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#174238] hover:bg-[#205246] text-[#FAF8F3] text-xs font-semibold rounded border border-[#2B685A] transition-colors"
            >
              <Phone className="w-3.5 h-3.5 text-[#7EE787]" />
              <span className="font-mono-data">{customer.primaryPhone}</span>
            </a>

            <a
              href={`https://wa.me/${waPhone}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#174238] hover:bg-[#205246] text-[#FAF8F3] text-xs font-semibold rounded border border-[#2B685A] transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5 text-[#7EE787]" />
              <span>WhatsApp</span>
            </a>

            <button
              onClick={() => onRecordServiceForCustomer(customer)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#C25E00] hover:bg-[#A34F00] text-[#FAF8F3] text-xs font-bold rounded shadow-sm transition-all"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Record Service</span>
            </button>

            <button
              onClick={() => onEdit(customer)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#12332C] hover:bg-[#1A423A] text-[#B4CBC3] hover:text-[#FAF8F3] text-xs font-medium rounded transition-colors"
            >
              <Edit className="w-3 h-3" />
              <span>Edit</span>
            </button>

            <button
              onClick={() => onPauseToggle(customer)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#12332C] hover:bg-[#1A423A] text-[#B4CBC3] hover:text-[#FAF8F3] text-xs font-medium rounded transition-colors"
            >
              {customer.remindersPaused ? (
                <>
                  <PlayCircle className="w-3 h-3 text-[#7EE787]" />
                  <span>Resume</span>
                </>
              ) : (
                <>
                  <PauseCircle className="w-3 h-3 text-[#F6D285]" />
                  <span>Pause</span>
                </>
              )}
            </button>

            <button
              onClick={() => onArchiveToggle(customer)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#12332C] hover:bg-[#1A423A] text-[#86AB9F] hover:text-[#FF8B8B] text-xs font-medium rounded transition-colors ml-auto"
            >
              {customer.status === 'archived' ? (
                <>
                  <RotateCcw className="w-3 h-3 text-[#7EE787]" />
                  <span>Restore</span>
                </>
              ) : (
                <>
                  <Archive className="w-3 h-3" />
                  <span>Archive</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Purifier & Service Metrics Card (Warm Paper Layout) */}
          <div className="bg-[#F4F0E6] border border-[#E5DEC9] rounded-xl p-5 space-y-4">
            <div className="flex items-baseline justify-between border-b border-[#DDD6C5] pb-2">
              <span className="font-editorial font-bold text-sm text-[#1B2421]">
                Purifier System & Location Specifications
              </span>
              <span className="text-xs text-[#5C6E67] font-mono-data">
                Registered: {formatDisplayDate(customer.registrationDate)}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-[#5C6E67] block">Brand</span>
                <span className="font-bold text-[#1B2421] block mt-0.5">
                  {customer.purifierBrand || 'Aqua Plus RO'}
                </span>
              </div>
              <div>
                <span className="text-[#5C6E67] block">Model / Tank</span>
                <span className="font-medium text-[#1B2421] block mt-0.5">
                  {customer.purifierModel || 'Standard 12L'}
                </span>
              </div>
              <div>
                <span className="text-[#5C6E67] block">Service Interval</span>
                <span className="font-mono-data font-bold text-[#1B2421] block mt-0.5">
                  {customer.defaultIntervalDays || 90} Days
                </span>
              </div>
              <div>
                <span className="text-[#5C6E67] block">Recorded Visits</span>
                <span className="font-mono-data font-bold text-[#1B2421] block mt-0.5">
                  {serviceHistory.length}
                </span>
              </div>
            </div>

            {/* Service Rhythm Status Bar */}
            <div className="pt-3 border-t border-[#DDD6C5] flex flex-wrap items-center justify-between gap-3 text-xs">
              <div>
                <span className="text-[#5C6E67]">Last Service Visit:</span>{' '}
                <strong className="font-mono-data text-[#1B2421]">
                  {formatDisplayDate(customer.lastServiceDate)}
                </strong>
                {daysSinceService !== null && (
                  <span className="text-[#7A8C84] ml-1">({daysSinceService} days ago)</span>
                )}
              </div>

              <div>
                <span className="text-[#5C6E67]">Next Reminder Due:</span>{' '}
                <strong
                  className={`font-mono-data font-bold ${
                    daysUntilNext !== null && daysUntilNext < 0
                      ? 'text-[#8B1E1E]'
                      : daysUntilNext === 0
                      ? 'text-[#B45309]'
                      : 'text-[#165B50]'
                  }`}
                >
                  {formatDisplayDate(customer.nextReminderDate)}
                </strong>
                {daysUntilNext !== null && (
                  <span className="ml-1 text-[11px] font-mono-data">
                    ({daysUntilNext < 0 ? `${Math.abs(daysUntilNext)}d overdue` : `in ${daysUntilNext}d`})
                  </span>
                )}
              </div>
            </div>

            {/* Consent Status */}
            <div className="pt-2 text-xs text-[#5C6E67] flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ShieldCheck
                  className={`w-4 h-4 ${
                    customer.whatsappConsent ? 'text-[#165B50]' : 'text-[#8C9B94]'
                  }`}
                />
                <span>
                  WhatsApp Reminder Consent:{' '}
                  <strong className={customer.whatsappConsent ? 'text-[#165B50]' : 'text-[#8C9B94]'}>
                    {customer.whatsappConsent ? 'Recorded Agreement' : 'Not Granted'}
                  </strong>
                </span>
              </div>
              {customer.consentSource && (
                <span className="text-[11px] text-[#7A8C84]">Source: {customer.consentSource}</span>
              )}
            </div>

            {customer.customerNotes && (
              <div className="pt-2 border-t border-[#DDD6C5] text-xs">
                <span className="text-[#5C6E67] block font-semibold mb-1">Field Notes:</span>
                <p className="bg-[#FAF8F3] p-2.5 rounded border border-[#DDD6C5] text-[#2D3733] leading-relaxed">
                  {customer.customerNotes}
                </p>
              </div>
            )}
          </div>

          {/* Chronological Maintenance Record (Organized Service History Timeline) */}
          <div className="space-y-4">
            <div className="flex items-baseline justify-between border-b border-[#E5DEC9] pb-2">
              <h3 className="font-editorial text-base font-bold text-[#1B2421]">
                Maintenance History ({serviceHistory.length})
              </h3>
              <button
                onClick={() => onRecordServiceForCustomer(customer)}
                className="text-xs font-semibold text-[#165B50] hover:text-[#0C231F]"
              >
                + Record New Visit
              </button>
            </div>

            {serviceHistory.length === 0 ? (
              <div className="p-8 bg-[#F4F0E6] border border-[#E5DEC9] rounded-xl text-center text-xs text-[#5C6E67]">
                <p className="font-semibold text-[#2D3733]">No historical service visits logged yet.</p>
                <p className="mt-1">
                  When you complete a filter change, membrane replacement, or TDS check, record it here.
                </p>
                <button
                  onClick={() => onRecordServiceForCustomer(customer)}
                  className="mt-3 px-3.5 py-1.5 bg-[#163830] text-[#FAF8F3] text-xs font-semibold rounded"
                >
                  Log First Service Visit
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {serviceHistory.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-4 bg-[#FAF8F3] border border-[#E5DEC9] rounded-xl shadow-2xs space-y-2 hover:border-[#C5BDAA] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-[#1B2421]">
                            {rec.serviceCategory}
                          </span>
                          <span className="text-[#5C6E67] font-mono-data text-xs">
                            · {formatDisplayDate(rec.serviceDate)}
                          </span>
                        </div>
                      </div>
                      <span className="font-mono-data text-xs font-bold text-[#163830]">
                        ₹{rec.totalAmount} ({rec.paymentStatus})
                      </span>
                    </div>

                    <div className="text-xs text-[#2D3733] space-y-1">
                      {rec.workPerformed && (
                        <p>
                          <span className="text-[#5C6E67]">Work:</span> {rec.workPerformed}
                        </p>
                      )}
                      {rec.filtersReplaced && (
                        <p>
                          <span className="text-[#5C6E67]">Replaced:</span> {rec.filtersReplaced}
                        </p>
                      )}
                      {rec.technicianNotes && (
                        <div className="text-[11px] text-[#165B50] font-mono-data bg-[#F4F0E6] p-2 rounded border border-[#E5DEC9]">
                          {rec.technicianNotes}
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-[#F0EBE0] flex items-center justify-between text-[11px] text-[#5C6E67]">
                      <span>Labor ₹{rec.serviceCharge} + Parts ₹{rec.partsCharge}</span>
                      <span>
                        Next Due:{' '}
                        <strong className="font-mono-data text-[#1B2421]">
                          {formatDisplayDate(rec.nextReminderDate)}
                        </strong>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
