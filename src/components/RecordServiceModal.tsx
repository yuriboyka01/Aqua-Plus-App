import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Wrench,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Sparkles,
  Tag,
  ShieldCheck,
  Droplets,
  AlertCircle,
  Search,
} from 'lucide-react';
import { Customer, ServiceCategory, PaymentStatus, ServiceRecord, InventoryItem } from '../types';
import { DEFAULT_SERVICE_CATEGORIES } from '../lib/constants';
import { calculateNextReminderDate, formatDisplayDate, getTodayKolkata } from '../utils/dateUtils';

interface RecordServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  preselectedCustomer?: Customer | null;
  inventory?: InventoryItem[];
  onSave: (
    recordData: Omit<ServiceRecord, 'id' | 'createdAt' | 'updatedAt' | 'ownerId'>,
    customer: Customer,
    usedParts?: { itemId: string; quantity: number }[]
  ) => Promise<void>;
}

export const RecordServiceModal: React.FC<RecordServiceModalProps> = ({
  isOpen,
  onClose,
  customers,
  preselectedCustomer,
  inventory = [],
  onSave,
}) => {
  const today = getTodayKolkata();
  const formRef = useRef<HTMLFormElement>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [savedRecord, setSavedRecord] = useState<{ customerName: string; reminderDate: string } | null>(null);

  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [serviceDate, setServiceDate] = useState(today);
  const [serviceCategory, setServiceCategory] = useState<ServiceCategory>('Routine Filter Change');
  const [problemReported, setProblemReported] = useState('Routine scheduled maintenance and TDS check');
  const [workPerformed, setWorkPerformed] = useState('');
  const [filtersReplaced, setFiltersReplaced] = useState('');
  const [serviceCharge, setServiceCharge] = useState<number>(350);
  const [partsCharge, setPartsCharge] = useState<number>(600);
  const [totalAmount, setTotalAmount] = useState<number>(950);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('Paid');
  const [inletTds, setInletTds] = useState<string>('720');
  const [outputTds, setOutputTds] = useState<string>('42');
  const [pumpPressure, setPumpPressure] = useState<string>('80');
  const [intervalDays, setIntervalDays] = useState<number>(90);
  const [isDateOverridden, setIsDateOverridden] = useState<boolean>(false);
  const [manualOverrideDate, setManualOverrideDate] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [usedParts, setUsedParts] = useState<{ itemId: string; quantity: number }[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers;
    const q = customerSearch.toLowerCase().trim();
    return customers.filter(
      (c) =>
        c.fullName.toLowerCase().includes(q) ||
        c.primaryPhone.includes(q) ||
        c.customerId.toLowerCase().includes(q) ||
        (c.locality || '').toLowerCase().includes(q)
    );
  }, [customers, customerSearch]);

  const tdsReductionPercent = useMemo(() => {
    const inVal = parseFloat(inletTds);
    const outVal = parseFloat(outputTds);
    if (!isNaN(inVal) && !isNaN(outVal) && inVal > 0 && inVal >= outVal) {
      return Math.round(((inVal - outVal) / inVal) * 100);
    }
    return null;
  }, [inletTds, outputTds]);

  const formSteps = [
    { short: 'Visit', full: 'Customer and visit details' },
    { short: 'Work', full: 'Work performed' },
    { short: 'Charges', full: 'Charges and payment' },
    { short: 'Reminder', full: 'Next reminder' },
    { short: 'Readings', full: 'Technical readings' },
  ];

  useEffect(() => {
    if (!isOpen) return;
    setSavedRecord(null);
    setActiveStep(0);
  }, [isOpen]);

  useEffect(() => {
    const form = formRef.current;
    if (!form || !isOpen || savedRecord) return;

    const sections = Array.from(form.querySelectorAll<HTMLElement>('[data-service-step]'));
    const observer = new IntersectionObserver((entries) => {
      const current = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (current) setActiveStep(Number(current.target.getAttribute('data-service-step')) - 1);
    }, { root: form, rootMargin: '-8% 0px -70% 0px', threshold: 0 });

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [isOpen, savedRecord]);

  // Active customer object
  const activeCustomer = customers.find((c) => c.id === selectedCustomerId) || preselectedCustomer;

  useEffect(() => {
    if (preselectedCustomer) {
      setSelectedCustomerId(preselectedCustomer.id);
      if (preselectedCustomer.defaultIntervalDays) {
        setIntervalDays(preselectedCustomer.defaultIntervalDays);
      }
    } else if (customers.length > 0 && !selectedCustomerId) {
      setSelectedCustomerId(customers[0].id);
    }
  }, [preselectedCustomer, customers, isOpen]);

  // Adjust interval when category changes
  useEffect(() => {
    const catConfig = DEFAULT_SERVICE_CATEGORIES.find((c) => c.category === serviceCategory);
    if (catConfig) {
      if (activeCustomer?.defaultIntervalDays) {
        setIntervalDays(activeCustomer.defaultIntervalDays);
      } else {
        setIntervalDays(catConfig.defaultDays);
      }
    }
  }, [serviceCategory, activeCustomer]);

  // Auto calculate total collected
  useEffect(() => {
    setTotalAmount(Number(serviceCharge || 0) + Number(partsCharge || 0));
  }, [serviceCharge, partsCharge]);

  if (!isOpen) return null;

  const calculatedNextDate = calculateNextReminderDate(serviceDate, intervalDays);
  const finalNextReminderDate = isDateOverridden && manualOverrideDate ? manualOverrideDate : calculatedNextDate;

  const handleQuickAddPart = (partName: string) => {
    if (!filtersReplaced.includes(partName)) {
      setFiltersReplaced((prev) => (prev ? `${prev}, ${partName}` : partName));
    }
  };

  const handleSelectInventoryPart = (invItem: InventoryItem) => {
    if (!filtersReplaced.includes(invItem.name)) {
      setFiltersReplaced((prev) => (prev ? `${prev}, ${invItem.name}` : invItem.name));
    }
    setUsedParts((prev) => {
      const existing = prev.find((p) => p.itemId === invItem.id);
      if (existing) {
        return prev.map((p) => (p.itemId === invItem.id ? { ...p, quantity: p.quantity + 1 } : p));
      }
      return [...prev, { itemId: invItem.id, quantity: 1 }];
    });
    if (invItem.sellingPrice > 0) {
      setPartsCharge((prev) => Math.max(0, (Number(prev) || 0) + invItem.sellingPrice));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    if (!activeCustomer) {
      setValidationError('Please select a customer for this service visit.');
      return;
    }
    if (!workPerformed.trim()) {
      setValidationError('Please describe the work conducted during this service visit.');
      return;
    }

    setSubmitting(true);
    try {
      // Assemble technician findings
      const findingsList: string[] = [];
      if (inletTds && outputTds) findingsList.push(`Inlet TDS: ${inletTds} ppm, Output TDS: ${outputTds} ppm`);
      if (pumpPressure) findingsList.push(`Pump Pressure: ${pumpPressure} PSI`);

      await onSave(
        {
          customerId: activeCustomer.id,
          customerName: activeCustomer.fullName,
          customerPhone: activeCustomer.primaryPhone,
          customerAddress: activeCustomer.address,
          serviceDate,
          serviceCategory,
          problemReported: problemReported.trim() || undefined,
          workPerformed: workPerformed.trim(),
          filtersReplaced: filtersReplaced.trim() || undefined,
          serviceCharge: Number(serviceCharge) || 0,
          partsCharge: Number(partsCharge) || 0,
          totalAmount: Number(totalAmount) || 0,
          paymentStatus,
          technicianNotes: findingsList.length > 0 ? findingsList.join(' · ') : undefined,
          recommendedIntervalDays: Number(intervalDays) || 90,
          calculatedNextReminderDate: calculatedNextDate,
          nextReminderDate: finalNextReminderDate,
          isDateOverridden,
        },
        activeCustomer,
        usedParts
      );
      setSavedRecord({ customerName: activeCustomer.fullName, reminderDate: finalNextReminderDate });
    } catch (err: any) {
      console.error(err);
      setValidationError(err?.message || 'Failed to save service record. Please check details and retry.');
    } finally {
      setSubmitting(false);
    }
  };

  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#0C231F]/65 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[#FAF8F3] rounded-2xl shadow-2xl border border-[#DDD6C5] overflow-hidden my-6 max-h-[92vh] flex flex-col">
        {/* Header (Deep Bottle Green) */}
        <div className="px-6 py-4 bg-[#0C231F] text-[#FAF8F3] flex items-center justify-between shrink-0 border-b border-[#1C3E37]">
          <div>
            <div className="text-[10px] text-[#7EE787] font-mono-data uppercase tracking-wider">
              Field Operations Ticket
            </div>
            <h2 className="font-editorial text-xl font-bold tracking-tight text-[#FAF8F3]">
              Record Completed Service Visit
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#86AB9F] hover:text-[#FAF8F3] p-1.5 rounded hover:bg-[#174238] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {savedRecord ? (
          <div role="status" aria-live="polite" className="flex-1 overflow-y-auto p-6 sm:p-10 flex items-center justify-center">
            <div className="max-w-md w-full text-center space-y-5">
              <div className="mx-auto w-16 h-16 rounded-full bg-[#EBF7F2] border border-[#C6EAD8] flex items-center justify-center text-[#165B50]">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <div className="space-y-2">
                <h3 className="font-editorial text-2xl font-bold text-[#163830]">Service visit recorded</h3>
                <p className="text-sm text-[#5C6E67]">
                  The visit for <strong className="text-[#1B2421]">{savedRecord.customerName}</strong> has been saved.
                </p>
              </div>
              <div className="bg-[#EBF7F2] border border-[#C6EAD8] rounded-xl p-4">
                <span className="block text-xs text-[#165B50]">Next maintenance reminder</span>
                <strong className="block mt-1 font-mono-data text-lg text-[#163830]">
                  {formatDisplayDate(savedRecord.reminderDate)}
                </strong>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="min-h-11 px-7 py-3 bg-[#163830] hover:bg-[#0E2822] text-[#FAF8F3] font-bold text-sm rounded-lg shadow-sm transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
        /* Scrollable Form Body */
        <form ref={formRef} onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 text-sm text-[#1B2421]">
          <nav aria-label="Service record progress" className="sticky top-0 z-10 -mx-5 sm:-mx-6 px-5 sm:px-6 py-2 bg-[#FAF8F3]/95 backdrop-blur border-b border-[#E5DEC9]">
            <ol className="grid grid-cols-5 gap-1.5">
              {formSteps.map((step, index) => (
                <li key={step.short}>
                  <button
                    type="button"
                    aria-label={`Go to step ${index + 1}: ${step.full}`}
                    aria-current={activeStep === index ? 'step' : undefined}
                    onClick={() => formRef.current?.querySelector<HTMLElement>(`#service-step-${index + 1}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    className={`w-full min-h-11 px-1 py-1 rounded-lg flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 text-xs font-semibold transition-colors ${
                      activeStep === index
                        ? 'bg-[#163830] text-[#FAF8F3]'
                        : index < activeStep
                          ? 'bg-[#EBF7F2] text-[#165B50]'
                          : 'bg-[#F4F0E6] text-[#5C6E67] hover:bg-[#EDE7DA]'
                    }`}
                  >
                    <span className="font-mono-data">{index + 1}</span>
                    <span>{step.short}</span>
                  </button>
                </li>
              ))}
            </ol>
            <p className="sr-only" aria-live="polite">Step {activeStep + 1} of {formSteps.length}: {formSteps[activeStep].full}</p>
          </nav>

          {validationError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="font-semibold">{validationError}</span>
              </div>
              <button
                type="button"
                onClick={() => setValidationError(null)}
                className="text-[11px] font-bold text-rose-800 hover:underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* STEP 1: Customer & Visit Date */}
          <div id="service-step-1" data-service-step="1" className="scroll-mt-20 space-y-3 bg-[#F4F0E6] p-4 rounded-xl border border-[#E5DEC9]">
            <div className="flex items-baseline justify-between border-b border-[#DDD6C5] pb-1.5">
              <span className="font-editorial font-bold text-sm text-[#1B2421]">
                1. Customer & Appointment Details
              </span>
              <span className="text-[10px] text-[#5C6E67]">Required</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-[#2D3733] mb-1">
                  Customer Account *
                </label>
                {preselectedCustomer ? (
                  <div className="p-2.5 bg-[#FAF8F3] rounded border border-[#DDD6C5]">
                    <span className="font-bold text-[#1B2421] block">{preselectedCustomer.fullName}</span>
                    <span className="text-[11px] text-[#5C6E67] font-mono-data">
                      {preselectedCustomer.customerId} · {preselectedCustomer.primaryPhone} ({preselectedCustomer.locality})
                    </span>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-[#7A8C84] absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={customerSearch}
                        onChange={(e) => {
                          setCustomerSearch(e.target.value);
                          const q = e.target.value.toLowerCase().trim();
                          if (q) {
                            const firstMatch = customers.find(
                              (c) =>
                                c.fullName.toLowerCase().includes(q) ||
                                c.primaryPhone.includes(q) ||
                                c.customerId.toLowerCase().includes(q) ||
                                (c.locality || '').toLowerCase().includes(q)
                            );
                            if (firstMatch) setSelectedCustomerId(firstMatch.id);
                          }
                        }}
                        placeholder="Filter by name, phone, or locality..."
                        className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-[#FAF8F3] border border-[#DDD6C5] rounded-md text-[#1B2421]"
                      />
                    </div>
                    <select
                      value={selectedCustomerId}
                      onChange={(e) => setSelectedCustomerId(e.target.value)}
                      className="w-full px-3 py-2 bg-[#FAF8F3] border border-[#DDD6C5] rounded-md font-medium text-[#1B2421] focus:border-[#163830] text-xs"
                      required
                    >
                      {filteredCustomers.length === 0 ? (
                        <option value="" disabled>No matching customers found</option>
                      ) : (
                        filteredCustomers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.fullName} ({c.customerId}) — {c.locality} [{c.primaryPhone}]
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold text-[#2D3733] mb-1">
                  Service Visit Date *
                </label>
                <input
                  type="date"
                  value={serviceDate}
                  onChange={(e) => setServiceDate(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF8F3] border border-[#DDD6C5] rounded-md font-mono-data text-[#1B2421]"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-[#2D3733] mb-1">
                Service Category *
              </label>
              <select
                value={serviceCategory}
                onChange={(e) => setServiceCategory(e.target.value as ServiceCategory)}
                className="w-full px-3 py-2 bg-[#FAF8F3] border border-[#DDD6C5] rounded-md text-[#1B2421]"
              >
                {DEFAULT_SERVICE_CATEGORIES.map((cat) => (
                  <option key={cat.category} value={cat.category}>
                    {cat.category} (Standard {cat.defaultDays}d interval)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* STEP 2: Work Conducted & Parts Replaced */}
          <div id="service-step-2" data-service-step="2" className="scroll-mt-20 space-y-3 bg-[#F4F0E6] p-4 rounded-xl border border-[#E5DEC9]">
            <div className="flex items-baseline justify-between border-b border-[#DDD6C5] pb-1.5">
              <span className="font-editorial font-bold text-sm text-[#1B2421]">
                2. Work Conducted & Filters Replaced
              </span>
              <span className="text-[10px] text-[#5C6E67]">Required</span>
            </div>

            <div>
              <label className="block font-semibold text-[#2D3733] mb-1">
                Work Performed *
              </label>
              <textarea
                rows={2}
                value={workPerformed}
                onChange={(e) => setWorkPerformed(e.target.value)}
                placeholder="e.g. Replaced spun pre-filter, backwashed RO membrane, cleaned housing, tested pressure switch."
                className="w-full px-3 py-2 bg-[#FAF8F3] border border-[#DDD6C5] rounded-md focus:border-[#163830] text-[#1B2421]"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-[#2D3733] mb-1">
                Components or Cartridges Replaced
              </label>
              <input
                type="text"
                value={filtersReplaced}
                onChange={(e) => setFiltersReplaced(e.target.value)}
                placeholder="e.g. 5-Micron Spun PP, Pre-Carbon 10 inch, FR 450"
                className="w-full px-3 py-2 bg-[#FAF8F3] border border-[#DDD6C5] rounded-md text-[#1B2421]"
              />

              {/* Store Inventory Spare Parts Picker */}
              {inventory.length > 0 && (
                <div className="pt-2 border-t border-[#DDD6C5]/60 mt-2 space-y-1.5">
                  <span className="text-[10px] font-semibold text-[#0C231F] block">
                    Available Store Inventory (Select to add & deduct stock):
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1 bg-[#FAF8F3] rounded border border-[#DDD6C5]">
                    {inventory.map((inv) => {
                      const isUsed = usedParts.some((p) => p.itemId === inv.id);
                      const usedQty = usedParts.find((p) => p.itemId === inv.id)?.quantity || 0;
                      return (
                        <button
                          key={inv.id}
                          type="button"
                          onClick={() => handleSelectInventoryPart(inv)}
                          disabled={inv.quantity <= 0}
                          className={`px-2.5 py-1 text-[11px] rounded border transition-colors flex items-center gap-1 ${
                            isUsed
                              ? 'bg-[#163830] text-[#FAF8F3] border-[#163830]'
                              : inv.quantity <= 0
                                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                : 'bg-white hover:bg-[#FAF8F3] text-[#1F2421] border-[#DDD6C5]'
                          }`}
                          title={`Available: ${inv.quantity} in stock`}
                        >
                          <span>{inv.name}</span>
                          <span className="font-mono text-[10px] text-[#C25E00] font-bold">₹{inv.sellingPrice}</span>
                          {isUsed && (
                            <span className="ml-1 px-1 py-0.2 bg-[#7EE787] text-[#0C231F] rounded-full text-[9px] font-bold">
                              ×{usedQty}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Quick Component Tags */}
              <div className="flex flex-wrap items-center gap-1.5 pt-2">
                <span className="text-[10px] text-[#5C6E67]">Quick insert:</span>
                {[
                  '5µ Spun Filter',
                  'Carbon Block',
                  'TFC RO Membrane',
                  'Post-Carbon / Mineral',
                  'Flow Restrictor 450',
                  'Booster Pump SMPS',
                ].map((part) => (
                  <button
                    key={part}
                    type="button"
                    onClick={() => handleQuickAddPart(part)}
                    className="min-h-10 px-3 py-2 rounded text-xs bg-[#FAF8F3] hover:bg-[#EDE7DA] text-[#2D3733] border border-[#DDD6C5] transition-colors"
                  >
                    + {part}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* STEP 3: Charges, Billing & Payment */}
          <div id="service-step-3" data-service-step="3" className="scroll-mt-20 space-y-3 bg-[#F4F0E6] p-4 rounded-xl border border-[#E5DEC9]">
            <div className="flex items-baseline justify-between border-b border-[#DDD6C5] pb-1.5">
              <span className="font-editorial font-bold text-sm text-[#1B2421]">
                3. Charges & Settlement (INR ₹)
              </span>
              <span className="text-[10px] text-[#5C6E67]">Audit Ledger</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block font-semibold text-[#5C6E67] mb-1">
                  Service / Labor (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={serviceCharge}
                  onChange={(e) => setServiceCharge(Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-[#FAF8F3] border border-[#DDD6C5] rounded-md font-mono-data text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#5C6E67] mb-1">
                  Parts / Filters (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={partsCharge}
                  onChange={(e) => setPartsCharge(Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-[#FAF8F3] border border-[#DDD6C5] rounded-md font-mono-data text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#1B2421] mb-1">
                  Total Collected (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-[#FAF8F3] border border-[#DDD6C5] rounded-md font-mono-data font-bold text-[#163830] text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#5C6E67] mb-1">
                  Payment Status
                </label>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
                  className="w-full px-3 py-1.5 bg-[#FAF8F3] border border-[#DDD6C5] rounded-md font-medium text-xs text-[#1B2421]"
                >
                  <option value="Paid">Paid</option>
                  <option value="Pending">Pending</option>
                  <option value="Partial">Partial</option>
                </select>
              </div>
            </div>
          </div>

          {/* STEP 4: Next Maintenance Reminder Schedule & Live Preview */}
          <div id="service-step-4" data-service-step="4" className="scroll-mt-20 space-y-3 bg-[#EBF7F2] p-4 rounded-xl border border-[#C6EAD8]">
            <div className="flex items-baseline justify-between border-b border-[#C6EAD8] pb-1.5">
              <span className="font-editorial font-bold text-sm text-[#163830]">
                4. Next Maintenance Reminder Rhythm
              </span>
              <label className="flex items-center gap-1.5 text-xs text-[#165B50] cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDateOverridden}
                  onChange={(e) => {
                    setIsDateOverridden(e.target.checked);
                    if (e.target.checked && !manualOverrideDate) {
                      setManualOverrideDate(calculatedNextDate);
                    }
                  }}
                  className="rounded text-[#163830]"
                />
                <span className="font-medium">Override Date</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-[#163830] mb-1">
                  Recommended Interval (Days)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="15"
                    max="730"
                    step="15"
                    value={intervalDays}
                    onChange={(e) => setIntervalDays(Number(e.target.value))}
                    className="w-24 px-3 py-1.5 bg-[#FAF8F3] border border-[#C6EAD8] rounded font-mono-data font-bold text-[#163830]"
                  />
                  <div className="flex gap-1">
                    {[60, 90, 120, 180, 365].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setIntervalDays(d)}
                        className={`min-h-10 min-w-12 px-2 py-2 rounded text-xs font-mono-data transition-colors ${
                          intervalDays === d
                            ? 'bg-[#163830] text-[#FAF8F3] font-bold'
                            : 'bg-[#FAF8F3] text-[#163830] hover:bg-[#D5EFE3]'
                        }`}
                      >
                        {d}d
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#163830] mb-1">
                  {isDateOverridden ? 'Manually Overridden Reminder Date' : 'Calculated Next Reminder Date'}
                </label>
                {isDateOverridden ? (
                  <input
                    type="date"
                    value={manualOverrideDate || calculatedNextDate}
                    onChange={(e) => setManualOverrideDate(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#FAF8F3] border border-[#E07A5F] rounded font-mono-data font-bold text-[#C25E00]"
                  />
                ) : (
                  <div className="p-2 bg-[#FAF8F3] rounded border border-[#C6EAD8] flex items-center justify-between font-mono-data">
                    <span className="font-bold text-[#163830]">
                      {formatDisplayDate(calculatedNextDate)}
                    </span>
                    <span className="text-[10px] text-[#165B50]">
                      ({intervalDays} days from service)
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* STEP 5: Technical Quality Readings (Optional) */}
          <div id="service-step-5" data-service-step="5" className="scroll-mt-20 space-y-3 bg-[#F4F0E6] p-4 rounded-xl border border-[#E5DEC9]">
            <div className="flex items-center justify-between border-b border-[#DDD6C5] pb-1.5">
              <span className="font-editorial font-bold text-sm text-[#1B2421]">
                5. Water Quality & Technical Readings (Optional)
              </span>
              {tdsReductionPercent !== null && (
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-mono-data font-bold ${
                    tdsReductionPercent >= 85
                      ? 'bg-[#EBF7F2] text-[#165B50] border border-[#C6EAD8]'
                      : 'bg-amber-50 text-[#B45309] border border-amber-200'
                  }`}
                >
                  {tdsReductionPercent}% TDS Rejection
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] text-[#5C6E67] mb-1">Inlet TDS (ppm)</label>
                <input
                  type="text"
                  value={inletTds}
                  onChange={(e) => setInletTds(e.target.value)}
                  placeholder="e.g. 850"
                  className="w-full px-2.5 py-1.5 bg-[#FAF8F3] border border-[#DDD6C5] rounded font-mono-data"
                />
              </div>

              <div>
                <label className="block text-[11px] text-[#5C6E67] mb-1">Output TDS (ppm)</label>
                <input
                  type="text"
                  value={outputTds}
                  onChange={(e) => setOutputTds(e.target.value)}
                  placeholder="e.g. 45"
                  className="w-full px-2.5 py-1.5 bg-[#FAF8F3] border border-[#DDD6C5] rounded font-mono-data font-semibold text-[#165B50]"
                />
              </div>

              <div>
                <label className="block text-[11px] text-[#5C6E67] mb-1">Pump Pressure (PSI)</label>
                <input
                  type="text"
                  value={pumpPressure}
                  onChange={(e) => setPumpPressure(e.target.value)}
                  placeholder="e.g. 80"
                  className="w-full px-2.5 py-1.5 bg-[#FAF8F3] border border-[#DDD6C5] rounded font-mono-data"
                />
              </div>
            </div>
          </div>

          {/* Actions Bar */}
          <div className="pt-3 border-t border-[#DDD6C5] flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="min-h-11 px-4 py-2 text-sm font-semibold text-[#5C6E67] hover:text-[#1B2421] transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="min-h-11 px-6 py-3 bg-[#163830] hover:bg-[#0E2822] text-[#FAF8F3] font-bold text-sm rounded-lg shadow-sm flex items-center gap-2 transition-all active:scale-98 disabled:opacity-50"
            >
              <Check className="w-4 h-4 text-[#7EE787]" />
              <span>{submitting ? 'Recording Visit...' : 'Save Service Record'}</span>
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
};
