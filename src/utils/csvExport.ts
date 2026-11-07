import { Customer, ServiceRecord } from '../types';
import { formatDisplayDate } from './dateUtils';

function escapeCsvCell(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportCustomersToCsv(customers: Customer[]): void {
  const headers = [
    'Customer ID',
    'Full Name',
    'Primary Phone',
    'Alternate Phone',
    'Locality',
    'Address',
    'Purifier Brand',
    'Purifier Model',
    'Installation Date',
    'Registration Date',
    'WhatsApp Consent',
    'Consent Source',
    'Consent Timestamp',
    'Default Interval (Days)',
    'Last Service Date',
    'Next Reminder Date',
    'Status',
    'Notes',
  ];

  const rows = customers.map((c) => [
    escapeCsvCell(c.customerId),
    escapeCsvCell(c.fullName),
    escapeCsvCell(c.primaryPhone),
    escapeCsvCell(c.alternatePhone || ''),
    escapeCsvCell(c.locality || ''),
    escapeCsvCell(c.address || ''),
    escapeCsvCell(c.purifierBrand || ''),
    escapeCsvCell(c.purifierModel || ''),
    escapeCsvCell(formatDisplayDate(c.installationDate)),
    escapeCsvCell(formatDisplayDate(c.registrationDate)),
    escapeCsvCell(c.whatsappConsent ? 'Yes' : 'No'),
    escapeCsvCell(c.consentSource || ''),
    escapeCsvCell(c.consentTimestamp || ''),
    escapeCsvCell(c.defaultIntervalDays || 90),
    escapeCsvCell(formatDisplayDate(c.lastServiceDate)),
    escapeCsvCell(formatDisplayDate(c.nextReminderDate)),
    escapeCsvCell(c.status),
    escapeCsvCell(c.customerNotes || ''),
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  downloadBlob(csvContent, `AquaPlus_Customers_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8;');
}

export function exportServiceRecordsToCsv(records: ServiceRecord[]): void {
  const headers = [
    'Record ID',
    'Service Date',
    'Customer Name',
    'Customer Phone',
    'Service Category',
    'Problem Reported',
    'Work Performed',
    'Filters/Parts Replaced',
    'Service Charge (INR)',
    'Parts Charge (INR)',
    'Total Amount (INR)',
    'Payment Status',
    'Recommended Interval (Days)',
    'Calculated Reminder Date',
    'Actual Reminder Date',
    'Manual Date Override',
    'Technician Notes',
  ];

  const rows = records.map((r) => [
    escapeCsvCell(r.id),
    escapeCsvCell(formatDisplayDate(r.serviceDate)),
    escapeCsvCell(r.customerName),
    escapeCsvCell(r.customerPhone),
    escapeCsvCell(r.serviceCategory),
    escapeCsvCell(r.problemReported || ''),
    escapeCsvCell(r.workPerformed),
    escapeCsvCell(r.filtersReplaced || ''),
    escapeCsvCell(r.serviceCharge),
    escapeCsvCell(r.partsCharge),
    escapeCsvCell(r.totalAmount),
    escapeCsvCell(r.paymentStatus),
    escapeCsvCell(r.recommendedIntervalDays),
    escapeCsvCell(formatDisplayDate(r.calculatedNextReminderDate)),
    escapeCsvCell(formatDisplayDate(r.nextReminderDate)),
    escapeCsvCell(r.isDateOverridden ? 'Yes' : 'No'),
    escapeCsvCell(r.technicianNotes || ''),
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  downloadBlob(csvContent, `AquaPlus_Service_History_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8;');
}

function downloadBlob(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
