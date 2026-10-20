import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Check, User, Phone, MapPin, Tag, ShieldCheck } from 'lucide-react';
import { Customer } from '../types';
import { MADURAI_LOCALITIES, POPULAR_RO_BRANDS } from '../lib/constants';
import { findDuplicatePhoneCustomer } from '../utils/businessLogic';
import { getTodayKolkata } from '../utils/dateUtils';

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (customerData: Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'ownerId'>) => Promise<void>;
  existingCustomers: Customer[];
  customerToEdit?: Customer | null;
}

export const CustomerModal: React.FC<CustomerModalProps> = ({
  isOpen,
  onClose,
  onSave,
  existingCustomers,
  customerToEdit,
}) => {
  const isEditing = !!customerToEdit;
  const today = getTodayKolkata();

  const [customerId, setCustomerId] = useState('');
  const [fullName, setFullName] = useState('');
  const [primaryPhone, setPrimaryPhone] = useState('');
  const [alternatePhone, setAlternatePhone] = useState('');
  const [address, setAddress] = useState('');
  const [locality, setLocality] = useState('Thirunagar');
  const [customLocality, setCustomLocality] = useState('');
  const [purifierBrand, setPurifierBrand] = useState('Aqua Plus RO (Custom)');
  const [purifierModel, setPurifierModel] = useState('');
  const [installationDate, setInstallationDate] = useState('');
  const [registrationDate, setRegistrationDate] = useState(today);
  const [whatsappConsent, setWhatsappConsent] = useState(false);
  const [consentSource, setConsentSource] = useState('In-person service visit agreement');
  const [defaultIntervalDays, setDefaultIntervalDays] = useState(90);
  const [customerNotes, setCustomerNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [duplicateWarningDismissed, setDuplicateWarningDismissed] = useState(false);

  useEffect(() => {
    if (customerToEdit) {
      setCustomerId(customerToEdit.customerId || '');
      setFullName(customerToEdit.fullName || '');
      setPrimaryPhone(customerToEdit.primaryPhone || '');
      setAlternatePhone(customerToEdit.alternatePhone || '');
      setAddress(customerToEdit.address || '');
      if (MADURAI_LOCALITIES.includes(customerToEdit.locality)) {
        setLocality(customerToEdit.locality);
        setCustomLocality('');
      } else {
        setLocality('Other');
        setCustomLocality(customerToEdit.locality || '');
      }
      setPurifierBrand(customerToEdit.purifierBrand || 'Aqua Plus RO (Custom)');
      setPurifierModel(customerToEdit.purifierModel || '');
      setInstallationDate(customerToEdit.installationDate || '');
      setRegistrationDate(customerToEdit.registrationDate || today);
      setWhatsappConsent(customerToEdit.whatsappConsent ?? false);
      setConsentSource(customerToEdit.consentSource || 'In-person service visit agreement');
      setDefaultIntervalDays(customerToEdit.defaultIntervalDays || 90);
      setCustomerNotes(customerToEdit.customerNotes || '');
    } else {
      const nextNum = existingCustomers.length + 1001;
      setCustomerId(`AP-${nextNum}`);
      setFullName('');
      setPrimaryPhone('');
      setAlternatePhone('');
      setAddress('');
      setLocality('Thirunagar');
      setCustomLocality('');
      setPurifierBrand('Aqua Plus RO (Custom)');
      setPurifierModel('');
      setInstallationDate('');
      setRegistrationDate(today);
      setWhatsappConsent(false);
      setConsentSource('In-person service visit agreement');
      setDefaultIntervalDays(90);
      setCustomerNotes('');
    }
    setDuplicateWarningDismissed(false);
    setSaveError(null);
  }, [customerToEdit, isOpen, existingCustomers.length]);

  if (!isOpen) return null;

  // Duplicate phone detection
  const duplicateMatch = !duplicateWarningDismissed
    ? findDuplicatePhoneCustomer(primaryPhone, existingCustomers, customerToEdit?.id)
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    if (!fullName.trim() || !primaryPhone.trim()) {
      setSaveError('Please provide customer full name and primary phone number.');
      return;
    }

    if (duplicateMatch && !duplicateWarningDismissed) {
      return;
    }

    setSubmitting(true);
    try {
      const finalLocality = locality === 'Other' ? (customLocality.trim() || 'Madurai') : locality;
      const consentTimestamp = !whatsappConsent
        ? undefined
        : customerToEdit?.whatsappConsent
          ? customerToEdit.consentTimestamp
          : new Date().toISOString();
      const recordedConsentSource = !whatsappConsent
        ? undefined
        : customerToEdit?.whatsappConsent
          ? customerToEdit.consentSource
          : consentSource;

      await onSave({
        customerId: customerId.trim() || `AP-${Date.now().toString().slice(-4)}`,
        fullName: fullName.trim(),
        primaryPhone: primaryPhone.trim(),
        alternatePhone: alternatePhone.trim() || undefined,
        address: address.trim(),
        locality: finalLocality,
        customerNotes: customerNotes.trim() || undefined,
        purifierBrand: purifierBrand.trim(),
        purifierModel: purifierModel.trim() || undefined,
        installationDate: installationDate || undefined,
        registrationDate: registrationDate || today,
        whatsappConsent,
        consentTimestamp,
        consentSource: recordedConsentSource,
        status: customerToEdit?.status || 'active',
        defaultIntervalDays: Number(defaultIntervalDays) || 90,
        lastServiceDate: customerToEdit?.lastServiceDate,
        nextReminderDate: customerToEdit?.nextReminderDate,
        remindersPaused: customerToEdit?.remindersPaused || false,
      });
      onClose();
    } catch (err: any) {
      console.error(err);
      const msg = err?.message || 'Failed to save customer record. Please check details and retry.';
      setSaveError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#0C231F]/65 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[#FAF8F3] rounded-2xl shadow-2xl border border-[#DDD6C5] overflow-hidden my-6 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-[#0C231F] text-[#FAF8F3] flex items-center justify-between shrink-0 border-b border-[#1C3E37]">
          <div>
            <div className="text-[10px] text-[#7EE787] font-mono-data uppercase tracking-wider">
              {isEditing ? 'Update Client Record' : 'Client Registration'}
            </div>
            <h2 className="font-editorial text-xl font-bold tracking-tight text-[#FAF8F3]">
              {isEditing ? `Edit Customer: ${customerToEdit.fullName}` : 'Register New Customer'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#86AB9F] hover:text-[#FAF8F3] p-1.5 rounded hover:bg-[#174238] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-xs text-[#1B2421]">
          {/* Error Alert Banner */}
          {saveError && (
            <div className="p-4 bg-[#FEE2E2] border border-[#FCA5A5] rounded-xl text-[#991B1B] space-y-1">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Failed to Save Customer</p>
                  <p className="text-[11px] leading-relaxed break-words">{saveError}</p>
                </div>
              </div>
            </div>
          )}
          {/* Duplicate Phone Notice */}
          {duplicateMatch && (
            <div className="p-4 bg-[#FFF5E6] border border-[#F6D285] rounded-xl text-[#8C4A00] space-y-2">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-[#C25E00] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">Possible Duplicate Phone Detected</p>
                  <p>
                    A customer with phone <span className="font-mono-data font-bold">{primaryPhone}</span> already exists:
                  </p>
                  <p className="font-semibold text-[#1B2421]">
                    {duplicateMatch.fullName} ({duplicateMatch.customerId}) in {duplicateMatch.locality}
                  </p>
                  <button
                    type="button"
                    onClick={() => setDuplicateWarningDismissed(true)}
                    className="mt-1 px-3 py-1 bg-[#F6D285] hover:bg-[#EDB856] text-[#613300] font-bold rounded text-[11px] transition-colors"
                  >
                    Acknowledge & Save Anyway
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Core Info */}
          <div className="space-y-3 bg-[#F4F0E6] p-4 rounded-xl border border-[#E5DEC9]">
            <span className="font-editorial font-bold text-sm text-[#1B2421] block border-b border-[#DDD6C5] pb-1.5">
              1. Customer Identity & Contact
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-[#2D3733] mb-1">
                  Customer ID Reference
                </label>
                <input
                  type="text"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF8F3] border border-[#DDD6C5] rounded font-mono-data"
                  placeholder="e.g. AP-1005"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-[#2D3733] mb-1">
                  Customer Full Name *
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF8F3] border border-[#DDD6C5] rounded"
                  placeholder="e.g. R. Murugesan"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-[#2D3733] mb-1">
                  Primary Phone (WhatsApp) *
                </label>
                <input
                  type="tel"
                  value={primaryPhone}
                  onChange={(e) => {
                    setPrimaryPhone(e.target.value);
                    setDuplicateWarningDismissed(false);
                  }}
                  className="w-full px-3 py-2 bg-[#FAF8F3] border border-[#DDD6C5] rounded font-mono-data"
                  placeholder="e.g. 98421 45670"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-[#2D3733] mb-1">
                  Alternate Phone (Optional)
                </label>
                <input
                  type="tel"
                  value={alternatePhone}
                  onChange={(e) => setAlternatePhone(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF8F3] border border-[#DDD6C5] rounded font-mono-data"
                  placeholder="e.g. 0452 2480000"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block font-semibold text-[#2D3733] mb-1">
                  Madurai Locality *
                </label>
                <select
                  value={locality}
                  onChange={(e) => setLocality(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF8F3] border border-[#DDD6C5] rounded"
                >
                  {MADURAI_LOCALITIES.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                  <option value="Other">Other Madurai locality...</option>
                </select>
                {locality === 'Other' && (
                  <input
                    type="text"
                    value={customLocality}
                    onChange={(e) => setCustomLocality(e.target.value)}
                    placeholder="Enter locality / neighborhood"
                    className="mt-2 w-full px-3 py-1.5 bg-[#FAF8F3] border border-[#DDD6C5] rounded"
                  />
                )}
              </div>

              <div>
                <label className="block font-semibold text-[#2D3733] mb-1">
                  Street Address & Landmark
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="House number, Street, Near landmark"
                  className="w-full px-3 py-2 bg-[#FAF8F3] border border-[#DDD6C5] rounded"
                />
              </div>
            </div>
          </div>

          {/* Purifier Machine Specifications */}
          <div className="space-y-3 bg-[#F4F0E6] p-4 rounded-xl border border-[#E5DEC9]">
            <span className="font-editorial font-bold text-sm text-[#1B2421] block border-b border-[#DDD6C5] pb-1.5">
              2. Purifier System Specifications
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-[#2D3733] mb-1">Brand</label>
                <select
                  value={purifierBrand}
                  onChange={(e) => setPurifierBrand(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF8F3] border border-[#DDD6C5] rounded"
                >
                  {POPULAR_RO_BRANDS.map((brand) => (
                    <option key={brand} value={brand}>
                      {brand}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#2D3733] mb-1">Model / Specs</label>
                <input
                  type="text"
                  value={purifierModel}
                  onChange={(e) => setPurifierModel(e.target.value)}
                  placeholder="e.g. Grand Plus 12L / Copper Alkaline"
                  className="w-full px-3 py-2 bg-[#FAF8F3] border border-[#DDD6C5] rounded"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#2D3733] mb-1">Default Interval (Days)</label>
                <input
                  type="number"
                  min="30"
                  max="365"
                  step="15"
                  value={defaultIntervalDays}
                  onChange={(e) => setDefaultIntervalDays(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-[#FAF8F3] border border-[#DDD6C5] rounded font-mono-data"
                />
              </div>
            </div>
          </div>

          {/* Consent Recording */}
          <div className="space-y-3 bg-[#EBF7F2] p-4 rounded-xl border border-[#C6EAD8]">
            <span className="font-editorial font-bold text-sm text-[#163830] block border-b border-[#C6EAD8] pb-1.5">
              3. Service Reminder Consent & Channel
            </span>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={whatsappConsent}
                onChange={(e) => setWhatsappConsent(e.target.checked)}
                className="mt-0.5 rounded text-[#163830]"
              />
              <span className="text-[#163830]">
                <strong>Customer Consents to WhatsApp Maintenance Reminders:</strong> Agreed to receive service follow-ups when routine checks are due.
              </span>
            </label>

            <div>
              <label className="block text-[#165B50] font-semibold mb-1">Consent Recorded Via</label>
              <select
                value={consentSource}
                onChange={(e) => setConsentSource(e.target.value)}
                className="w-full px-3 py-1.5 bg-[#FAF8F3] border border-[#C6EAD8] rounded text-[#163830]"
              >
                <option value="In-person service visit agreement">In-person service visit agreement</option>
                <option value="Phone call agreement">Agreed over phone call</option>
                <option value="Installation order sheet">Installation work order signed</option>
                <option value="WhatsApp chat confirmation">WhatsApp chat confirmation</option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block font-semibold text-[#2D3733] mb-1">
              Field & Directions Notes
            </label>
            <textarea
              rows={2}
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              placeholder="e.g. High borewell TDS (1100 ppm), preferred timing after 5 PM."
              className="w-full px-3 py-2 bg-[#F4F0E6] border border-[#DDD6C5] rounded"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-[#DDD6C5] flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-[#5C6E67] hover:text-[#1B2421]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-[#163830] hover:bg-[#0E2822] text-[#FAF8F3] font-bold text-xs rounded-lg shadow-sm flex items-center gap-2 transition-all active:scale-98 disabled:opacity-50"
            >
              <Check className="w-4 h-4 text-[#7EE787]" />
              <span>{submitting ? 'Saving...' : isEditing ? 'Update Client Record' : 'Save Customer Record'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
