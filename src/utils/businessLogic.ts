import { Customer, ServiceRecord, Reminder, AppSettings, MessageAttempt } from '../types/index.ts';
import { formatDisplayDate, getDaysSinceDate, getDaysUntilDate, getTodayKolkata } from './dateUtils.ts';

/**
 * Normalizes phone numbers to comparable digits (e.g., "+91 70103 29920" -> "7010329920")
 */
export function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';
  const digitsOnly = phone.replace(/\D/g, '');
  // If starts with 91 and has 12 digits, strip country code for matching
  if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    return digitsOnly.substring(2);
  }
  // If starts with 0 and 11 digits
  if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
    return digitsOnly.substring(1);
  }
  return digitsOnly;
}

/**
 * Checks whether an incoming phone number duplicates an existing customer's number
 */
export function findDuplicatePhoneCustomer(
  phone: string,
  existingCustomers: Customer[],
  excludeCustomerId?: string
): Customer | null {
  const normalizedTarget = normalizePhoneNumber(phone);
  if (!normalizedTarget || normalizedTarget.length < 7) return null;

  for (const c of existingCustomers) {
    if (excludeCustomerId && c.id === excludeCustomerId) continue;
    if (c.status === 'archived') continue;

    const normPrimary = normalizePhoneNumber(c.primaryPhone);
    const normAlt = c.alternatePhone ? normalizePhoneNumber(c.alternatePhone) : '';

    if (normPrimary === normalizedTarget || (normAlt && normAlt === normalizedTarget)) {
      return c;
    }
  }
  return null;
}

/**
 * Generates deterministic idempotency key for preventing duplicate reminder dispatches
 */
export function generateIdempotencyKey(
  customerId: string,
  serviceRecordId: string,
  reminderDate: string,
  messageType = 'whatsapp_maintenance_reminder'
): string {
  return `${customerId}_${serviceRecordId}_${reminderDate}_${messageType}`;
}

/** Historical sent/manual-contact records are retained; only unsent queue entries retire. */
export function shouldSupersedeReminder(status: string | undefined): boolean {
  return status === 'upcoming' || status === 'due_today' || status === 'overdue' || status === 'paused' || status === 'failed';
}

/**
 * Evaluates whether a reminder is eligible for automatic WhatsApp dispatch
 */
export interface EligibilityCheckResult {
  isEligible: boolean;
  reasons: string[];
}

export function evaluateReminderEligibility(
  reminder: Reminder,
  customer: Customer | undefined,
  existingAttempts: MessageAttempt[] = [],
  whatsappGatewayConnected = false
): EligibilityCheckResult {
  const reasons: string[] = [];

  if (!customer) {
    reasons.push('Customer record not found.');
    return { isEligible: false, reasons };
  }

  if (customer.isSampleData || reminder.isSampleData) {
    reasons.push('Sample data is never eligible for outbound messaging.');
  }

  if (customer.status !== 'active') {
    reasons.push('Customer is archived.');
  }

  if (reminder.status === 'superseded') {
    reasons.push('Reminder belongs to a superseded service cycle.');
  }

  // A reminder is current only when its service date and scheduled date match
  // the customer snapshot. Missing legacy links fail closed when service dates exist.
  if (customer.lastServiceDate && reminder.lastServiceDate !== customer.lastServiceDate) {
    reasons.push('Reminder does not match the customer’s current service cycle.');
  }
  if (customer.nextReminderDate && reminder.reminderDate !== customer.nextReminderDate) {
    reasons.push('Reminder date does not match the customer’s current reminder date.');
  }

  if (customer.remindersPaused || reminder.status === 'paused') {
    reasons.push('Reminders are currently paused for this customer.');
  }

  if (!customer.whatsappConsent) {
    reasons.push('Customer has not provided recorded consent for WhatsApp reminders.');
  }

  const cleanPhone = normalizePhoneNumber(customer.primaryPhone);
  if (!cleanPhone || cleanPhone.length < 10) {
    reasons.push('Invalid phone number format.');
  }

  // Check if due or overdue (reminderDate <= today)
  const daysUntil = getDaysUntilDate(reminder.reminderDate);
  if (daysUntil > 0) {
    reasons.push(`Service is not due yet (due in ${daysUntil} days on ${formatDisplayDate(reminder.reminderDate)}).`);
  }

  // Idempotency check: verify this specific reminder has not already succeeded
  const idemKey = generateIdempotencyKey(
    customer.id,
    reminder.serviceRecordId || reminder.id,
    reminder.reminderDate
  );

  const alreadySucceeded = existingAttempts.some(
    (att) => att.idempotencyKey === idemKey && att.status === 'success'
  );

  if (alreadySucceeded || reminder.status === 'sent' || reminder.messageStatus === 'sent') {
    reasons.push('Reminder has already been sent successfully for this service date.');
  }

  if (reminder.status === 'contacted_manually') {
    reasons.push('Customer was already contacted manually via phone call.');
  }

  if (!whatsappGatewayConnected) {
    reasons.push('WhatsApp Business Cloud API is not connected or enabled.');
  }

  return {
    isEligible: reasons.length === 0,
    reasons,
  };
}

/**
 * Replaces variables in message templates
 */
export function renderWhatsAppMessage(
  template: string,
  variables: {
    customerName: string;
    lastServiceDate: string;
    businessPhone: string;
    businessName: string;
    purifierBrand?: string;
  }
): string {
  return template
    .replace(/\{\{customer_name\}\}/g, variables.customerName || 'Valued Customer')
    .replace(/\{\{last_service_date\}\}/g, variables.lastServiceDate || 'recent date')
    .replace(/\{\{business_phone\}\}/g, variables.businessPhone || '+91 70103 29920')
    .replace(/\{\{business_name\}\}/g, variables.businessName || 'Aqua Plus RO Tech')
    .replace(/\{\{purifier_brand\}\}/g, variables.purifierBrand || 'RO Water Purifier');
}

/**
 * Generates clean text for daily owner summary
 */
export function buildDailyOwnerDigestSummary(params: {
  reportDate: string;
  businessName: string;
  totalCustomers: number;
  completedToday: ServiceRecord[];
  dueToday: Reminder[];
  upcomingNext14: Reminder[];
  overdueList: Reminder[];
  sentToday: MessageAttempt[];
  failedToday: MessageAttempt[];
  manualContactsToday: Reminder[];
  consentNeedingAttention: Customer[];
}): string {
  const {
    reportDate,
    businessName,
    totalCustomers,
    completedToday,
    dueToday,
    upcomingNext14,
    overdueList,
    sentToday,
    failedToday,
    manualContactsToday,
    consentNeedingAttention,
  } = params;

  const lines: string[] = [];
  lines.push(`=======================================================`);
  lines.push(`DAILY SERVICE & REMINDER REPORT - ${businessName}`);
  lines.push(`Date: ${formatDisplayDate(reportDate)} (Asia/Kolkata)`);
  lines.push(`=======================================================`);
  lines.push(``);
  lines.push(`OPERATIONAL OVERVIEW`);
  lines.push(`---------------------`);
  lines.push(`- Total Active Customers: ${totalCustomers}`);
  lines.push(`- Services Completed Today: ${completedToday.length}`);
  lines.push(`- Customers Due for Service Today: ${dueToday.length}`);
  lines.push(`- Overdue Follow-ups: ${overdueList.length}`);
  lines.push(`- Upcoming Services (Next 14 Days): ${upcomingNext14.length}`);
  lines.push(`- WhatsApp Submissions Accepted Today: ${sentToday.length}`);
  lines.push(`- Failed/Pending Reminders: ${failedToday.length}`);
  lines.push(`- Customers Contacted Manually Today: ${manualContactsToday.length}`);
  lines.push(`- Customers Without Reminder Consent: ${consentNeedingAttention.length}`);
  lines.push(``);

  if (dueToday.length > 0) {
    lines.push(`CUSTOMERS DUE TODAY (${dueToday.length}):`);
    dueToday.forEach((r, idx) => {
      lines.push(
        `  ${idx + 1}. ${r.customerName} | Phone: ${r.customerPhone} | Locality: ${r.customerLocality || 'Madurai'} | Last Service: ${formatDisplayDate(r.lastServiceDate)} (${getDaysSinceDate(r.lastServiceDate)} days ago)`
      );
    });
    lines.push(``);
  }

  if (overdueList.length > 0) {
    lines.push(`OVERDUE CUSTOMERS (${overdueList.length}):`);
    overdueList.slice(0, 15).forEach((r, idx) => {
      lines.push(
        `  ${idx + 1}. ${r.customerName} | Phone: ${r.customerPhone} | Locality: ${r.customerLocality || 'Madurai'} | Scheduled: ${formatDisplayDate(r.reminderDate)} (${Math.abs(getDaysUntilDate(r.reminderDate))} days overdue)`
      );
    });
    if (overdueList.length > 15) {
      lines.push(`  ... and ${overdueList.length - 15} more overdue records.`);
    }
    lines.push(``);
  }

  if (completedToday.length > 0) {
    lines.push(`SERVICES COMPLETED TODAY (${completedToday.length}):`);
    completedToday.forEach((s, idx) => {
      lines.push(
        `  ${idx + 1}. ${s.customerName} - ${s.serviceCategory} | ₹${s.totalAmount} (${s.paymentStatus}) | Work: ${s.workPerformed || 'Regular service'}`
      );
    });
    lines.push(``);
  }

  if (failedToday.length > 0) {
    lines.push(`MESSAGING FAILURES REQUIRING ATTENTION (${failedToday.length}):`);
    failedToday.forEach((f, idx) => {
      lines.push(`  ${idx + 1}. ${f.customerName} (${f.customerPhone}): ${f.errorDetails || 'Failed to dispatch'}`);
    });
    lines.push(``);
  }

  lines.push(`Generated securely by AquaPlus Service.`);
  return lines.join('\n');
}
