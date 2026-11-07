import React, { useState } from 'react';
import { X, Calendar, PauseCircle, PlayCircle, PhoneCall, Check, MessageSquare } from 'lucide-react';
import { Reminder } from '../types';
import { formatDisplayDate } from '../utils/dateUtils';

interface ReminderActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  reminder: Reminder | null;
  onReschedule: (reminderId: string, customerId: string, newDate: string, reason: string) => Promise<void>;
  onPauseToggle: (reminderId: string, customerId: string, isPaused: boolean) => Promise<void>;
  onMarkManualContact: (reminderId: string, notes: string) => Promise<void>;
  onOpenWhatsAppPreview: (reminder: Reminder) => void;
}

export const ReminderActionModal: React.FC<ReminderActionModalProps> = ({
  isOpen,
  onClose,
  reminder,
  onReschedule,
  onPauseToggle,
  onMarkManualContact,
  onOpenWhatsAppPreview,
}) => {
  if (!isOpen || !reminder) return null;

  const [activeAction, setActiveAction] = useState<'reschedule' | 'manual_contact' | null>('reschedule');
  const [newDate, setNewDate] = useState(reminder.reminderDate);
  const [rescheduleReason, setRescheduleReason] = useState('Customer requested later date');
  const [callNotes, setCallNotes] = useState('Customer answered call; requested service visit next week.');
  const [submitting, setSubmitting] = useState(false);

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate) return;
    setSubmitting(true);
    try {
      await onReschedule(reminder.id, reminder.customerId, newDate, rescheduleReason);
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to reschedule reminder.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!callNotes.trim()) return;
    setSubmitting(true);
    try {
      await onMarkManualContact(reminder.id, callNotes);
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to save manual contact.');
    } finally {
      setSubmitting(false);
    }
  };

  const isPaused = reminder.status === 'paused';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#0C231F]/65 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg bg-[#FAF8F3] rounded-2xl shadow-2xl border border-[#DDD6C5] overflow-hidden flex flex-col my-6">
        {/* Header */}
        <div className="px-6 py-4 bg-[#0C231F] text-[#FAF8F3] flex items-center justify-between shrink-0 border-b border-[#1C3E37]">
          <div>
            <div className="text-[10px] text-[#7EE787] font-mono-data uppercase tracking-wider">
              Dispatch Schedule Action
            </div>
            <h2 className="font-editorial text-xl font-bold tracking-tight text-[#FAF8F3]">
              {reminder.customerName}
            </h2>
            <p className="text-xs text-[#86AB9F] font-mono-data mt-0.5">
              Scheduled Date: {formatDisplayDate(reminder.reminderDate)} · {reminder.customerLocality}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[#86AB9F] hover:text-[#FAF8F3] p-1.5 rounded hover:bg-[#174238] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Tabs */}
        <div className="flex border-b border-[#E5DEC9] bg-[#F4F0E6] text-xs font-semibold">
          <button
            onClick={() => setActiveAction('reschedule')}
            className={`flex-1 py-3 text-center transition-colors ${
              activeAction === 'reschedule'
                ? 'bg-[#FAF8F3] text-[#163830] font-bold border-b-2 border-[#163830]'
                : 'text-[#5C6E67] hover:text-[#1B2421]'
            }`}
          >
            Reschedule Next Date
          </button>
          <button
            onClick={() => setActiveAction('manual_contact')}
            className={`flex-1 py-3 text-center transition-colors ${
              activeAction === 'manual_contact'
                ? 'bg-[#FAF8F3] text-[#163830] font-bold border-b-2 border-[#163830]'
                : 'text-[#5C6E67] hover:text-[#1B2421]'
            }`}
          >
            Log Phone Follow-up
          </button>
        </div>

        {/* Body */}
        <div className="p-6 text-xs text-[#1B2421]">
          {activeAction === 'reschedule' && (
            <form onSubmit={handleRescheduleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#2D3733] mb-1">
                  New Reminder Date
                </label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F4F0E6] border border-[#DDD6C5] rounded-md font-mono-data text-[#1B2421] focus:outline-none focus:border-[#163830]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#2D3733] mb-1">
                  Reschedule Reason
                </label>
                <input
                  type="text"
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F4F0E6] border border-[#DDD6C5] rounded-md text-[#1B2421] focus:outline-none focus:border-[#163830]"
                  placeholder="e.g. Customer requested call back after weekend"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-[#5C6E67] hover:bg-[#F4F0E6] rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-bold text-[#FAF8F3] bg-[#163830] hover:bg-[#0E2822] rounded flex items-center gap-1.5 transition-colors"
                >
                  <Check className="w-4 h-4 text-[#7EE787]" />
                  <span>{submitting ? 'Updating...' : 'Save New Date'}</span>
                </button>
              </div>
            </form>
          )}

          {activeAction === 'manual_contact' && (
            <form onSubmit={handleManualContactSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#2D3733] mb-1">
                  Manual Phone Call Follow-Up Notes
                </label>
                <textarea
                  rows={3}
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F4F0E6] border border-[#DDD6C5] rounded-md text-[#1B2421] focus:outline-none focus:border-[#163830]"
                  placeholder="e.g. Called customer at 10 AM. Confirmed water flow is fine; asked to come on Saturday for pre-filter replacement."
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-[#5C6E67] hover:bg-[#F4F0E6] rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-bold text-[#FAF8F3] bg-[#163830] hover:bg-[#0E2822] rounded flex items-center gap-1.5 transition-colors"
                >
                  <Check className="w-4 h-4 text-[#7EE787]" />
                  <span>{submitting ? 'Saving...' : 'Mark Contacted'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Quick Option Bar */}
          <div className="mt-5 pt-4 border-t border-[#EDE7DA] flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={async () => {
                await onPauseToggle(reminder.id, reminder.customerId, !isPaused);
                onClose();
              }}
              className="text-[#5C6E67] hover:text-[#1B2421] font-medium flex items-center gap-1.5 transition-colors"
            >
              {isPaused ? (
                <>
                  <PlayCircle className="w-4 h-4 text-[#165B50]" />
                  <span>Resume Reminders</span>
                </>
              ) : (
                <>
                  <PauseCircle className="w-4 h-4 text-[#B45309]" />
                  <span>Pause Reminders</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenWhatsAppPreview(reminder);
              }}
              className="text-[#163830] hover:text-[#0C231F] font-bold flex items-center gap-1 transition-colors"
            >
              <MessageSquare className="w-4 h-4 text-[#165B50]" />
              <span>Preview & Send WhatsApp</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
