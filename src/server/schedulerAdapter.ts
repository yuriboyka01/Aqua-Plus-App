import {
  Customer,
  Reminder,
  ServiceRecord,
  MessageAttempt,
  AppSettings,
  OwnerReport,
} from '../types/index.ts';
import {
  evaluateReminderEligibility,
  generateIdempotencyKey,
  buildDailyOwnerDigestSummary,
} from '../utils/businessLogic.ts';
import { getTodayKolkata, getDaysUntilDate } from '../utils/dateUtils.ts';
import { sendWhatsAppTemplateMessage, getWhatsAppIntegrationStatus } from './whatsappAdapter.ts';
import { sendOwnerDailyReportEmail } from './emailAdapter.ts';

export type ReminderUpdate = { id: string; status: any; messageStatus: any; errorMessage?: string };

/** Called right after each dispatch so the outcome is persisted even if the run crashes later. */
export type DispatchResultHandler = (
  attempt: Omit<MessageAttempt, 'id'>,
  reminderUpdate: ReminderUpdate
) => Promise<void>;

export interface BatchProcessingResult {
  status: 'completed' | 'partial_failure';
  runTimestamp: string;
  reportDate: string;
  totalRemindersEvaluated: number;
  eligibleCount: number;
  messagesSent: number;
  messagesFailed: number;
  skippedCount: number;
  persistenceFailures: number;
  unknownOutcomes: number;
  skipReasons: Record<string, number>;
  reportSummary: string;
  emailDeliveryStatus: string;
  createdAttempts: Omit<MessageAttempt, 'id'>[];
  updatedReminders: { id: string; status: any; messageStatus: any; errorMessage?: string }[];
  ownerReport: Omit<OwnerReport, 'id'>;
}

/**
 * Runs the daily server-side scheduled reminder evaluation and owner digest compilation.
 * Safe against repeated executions on the same day through idempotency checks.
 */
export async function executeScheduledDailyBatch(params: {
  customers: Customer[];
  reminders: Reminder[];
  serviceRecords: ServiceRecord[];
  pastAttempts: MessageAttempt[];
  settings: AppSettings;
  ownerId: string;
  claimDispatch?: (idempotencyKey: string) => Promise<boolean>;
  onDispatchResult?: DispatchResultHandler;
  dispatchMessage?: typeof sendWhatsAppTemplateMessage;
  whatsappConfigured?: boolean;
}): Promise<BatchProcessingResult> {
  const { customers, reminders, serviceRecords, pastAttempts, settings, ownerId, claimDispatch, onDispatchResult } = params;
  const dispatchMessage = params.dispatchMessage || sendWhatsAppTemplateMessage;

  const persistDispatch: DispatchResultHandler = async (attempt, reminderUpdate) => {
    if (!onDispatchResult) return;
    await onDispatchResult(attempt, reminderUpdate);
  };
  const today = getTodayKolkata();
  const runTimestamp = new Date().toISOString();

  const customerMap = new Map<string, Customer>();
  customers.forEach((c) => customerMap.set(c.id, c));

  const whatsappStatus = getWhatsAppIntegrationStatus();
  const isWhatsAppLive = params.whatsappConfigured ?? whatsappStatus.status === 'configured';

  let eligibleCount = 0;
  let messagesSent = 0;
  let messagesFailed = 0;
  let skippedCount = 0;
  let persistenceFailures = 0;
  let unknownOutcomes = 0;
  const skipReasons: Record<string, number> = {};

  const createdAttempts: Omit<MessageAttempt, 'id'>[] = [];
  const updatedReminders: { id: string; status: any; messageStatus: any; errorMessage?: string }[] = [];

  // 1. Process Reminders
  for (const rem of reminders) {
    // If a previous provider result could not be durably recorded, stop the
    // batch. Its reservation remains processing and blocks an automatic resend.
    if (persistenceFailures > 0) break;
    const cust = customerMap.get(rem.customerId);
    const linkedService = rem.serviceRecordId
      ? serviceRecords.find((service) => service.id === rem.serviceRecordId && service.customerId === rem.customerId)
      : undefined;
    const currentCycle = !!cust?.lastServiceDate && !!cust?.nextReminderDate &&
      rem.lastServiceDate === cust.lastServiceDate && rem.reminderDate === cust.nextReminderDate &&
      (!rem.serviceRecordId || (!!linkedService && linkedService.serviceDate === cust.lastServiceDate));
    if (!currentCycle) {
      skippedCount++;
      const reason = 'Reminder does not match the customer current service cycle.';
      skipReasons[reason] = (skipReasons[reason] || 0) + 1;
      continue;
    }
    const eligibility = evaluateReminderEligibility(rem, cust, pastAttempts, isWhatsAppLive);

    if (eligibility.isEligible && cust) {
      eligibleCount++;
      const idempotencyKey = generateIdempotencyKey(
        cust.id,
        rem.serviceRecordId || rem.id,
        rem.reminderDate
      );

      if (claimDispatch && !(await claimDispatch(idempotencyKey))) {
        skippedCount++;
        const reason = 'This reminder has already been claimed by a previous batch run.';
        skipReasons[reason] = (skipReasons[reason] || 0) + 1;
        continue;
      }

      // Attempt dispatch
      const dispatchResult = await dispatchMessage({
        recipientPhone: cust.primaryPhone,
        customerName: cust.fullName,
        lastServiceDate: rem.lastServiceDate || 'previous visit',
        businessPhone: settings.primaryPhone,
      });

      if (dispatchResult.success) {
        messagesSent++;
        createdAttempts.push({
          customerId: cust.id,
          customerName: cust.fullName,
          customerPhone: cust.primaryPhone,
          reminderId: rem.id,
          serviceRecordId: rem.serviceRecordId,
          idempotencyKey,
          provider: 'whatsapp_cloud_api',
          templateName: 'service_maintenance_reminder',
          language: 'en',
          status: 'success',
          providerMessageId: dispatchResult.providerMessageId,
          attemptedAt: runTimestamp,
          ownerId,
        });

        updatedReminders.push({
          id: rem.id,
          status: 'sent',
          messageStatus: 'sent',
        });
        try { await persistDispatch(createdAttempts[createdAttempts.length - 1], updatedReminders[updatedReminders.length - 1]); }
        catch { persistenceFailures++; console.error(JSON.stringify({ severity: 'ERROR', message: 'Dispatch persistence failed; reservation retained for manual reconciliation.', reminderId: rem.id })); }
      } else {
        messagesFailed++;
        const outcomeUnknown = dispatchResult.status === 'unknown';
        if (outcomeUnknown) unknownOutcomes++;
        createdAttempts.push({
          customerId: cust.id,
          customerName: cust.fullName,
          customerPhone: cust.primaryPhone,
          reminderId: rem.id,
          serviceRecordId: rem.serviceRecordId,
          idempotencyKey,
          provider: 'whatsapp_cloud_api',
          templateName: 'service_maintenance_reminder',
          language: 'en',
          status: outcomeUnknown ? 'unknown' : 'failed',
          errorDetails: dispatchResult.error || (outcomeUnknown ? 'Provider outcome unknown; manual reconciliation required.' : 'Failed dispatch'),
          attemptedAt: runTimestamp,
          ownerId,
        });

        updatedReminders.push({
          id: rem.id,
          status: 'failed',
          messageStatus: 'failed',
          errorMessage: dispatchResult.error,
        });
        try { await persistDispatch(createdAttempts[createdAttempts.length - 1], updatedReminders[updatedReminders.length - 1]); }
        catch { persistenceFailures++; console.error(JSON.stringify({ severity: 'ERROR', message: 'Dispatch persistence failed; reservation retained for manual reconciliation.', reminderId: rem.id })); }
      }
    } else {
      skippedCount++;
      const primaryReason = eligibility.reasons[0] || 'Ineligible';
      skipReasons[primaryReason] = (skipReasons[primaryReason] || 0) + 1;
    }
  }

  // 2. Prepare metrics for Daily Report
  const completedToday = serviceRecords.filter((s) => s.serviceDate === today);
  const activeReminders = reminders.filter((r) => r.status !== 'superseded');
  const dueToday = activeReminders.filter((r) => r.reminderDate === today);
  const overdueList = activeReminders.filter((r) => getDaysUntilDate(r.reminderDate) < 0 && r.status !== 'sent');
  const upcomingNext14 = activeReminders.filter((r) => {
    const days = getDaysUntilDate(r.reminderDate);
    return days > 0 && days <= 14;
  });
  const manualContactsToday = reminders.filter((r) => r.status === 'contacted_manually');
  const consentNeedingAttention = customers.filter(
    (c) => c.status === 'active' && !c.whatsappConsent
  );

  const sentAttemptsList: MessageAttempt[] = createdAttempts
    .filter((a) => a.status === 'success')
    .map((a, i) => ({ ...a, id: `temp_${i}` }));

  const failedAttemptsList: MessageAttempt[] = createdAttempts
    .filter((a) => a.status === 'failed')
    .map((a, i) => ({ ...a, id: `temp_${i}` }));

  // 3. Generate summary text
  const reportSummary = buildDailyOwnerDigestSummary({
    reportDate: today,
    businessName: settings.businessName,
    totalCustomers: customers.filter((c) => c.status === 'active').length,
    completedToday,
    dueToday,
    upcomingNext14,
    overdueList,
    sentToday: sentAttemptsList,
    failedToday: failedAttemptsList,
    manualContactsToday,
    consentNeedingAttention,
  });

  // 4. Attempt Email Dispatch to Owner
  let emailDeliveryStatus = 'not_configured';
  if (settings.ownerNotificationEmail && settings.ownerEmailConfirmed) {
    const emailResult = await sendOwnerDailyReportEmail({
      recipientEmail: settings.ownerNotificationEmail,
      subject: `[AquaPlus Daily Digest] ${today} - ${dueToday.length} Due, ${overdueList.length} Overdue`,
      textContent: reportSummary,
      reportDate: today,
    });
    emailDeliveryStatus = emailResult.status;
  }

  const ownerReport: Omit<OwnerReport, 'id'> = {
    reportDate: today,
    generatedAt: runTimestamp,
    recipientEmail: settings.ownerNotificationEmail || settings.businessEmail,
    status: emailDeliveryStatus as any,
    totalCustomers: customers.filter((c) => c.status === 'active').length,
    completedToday: completedToday.length,
    dueToday: dueToday.length,
    upcomingCount: upcomingNext14.length,
    overdueCount: overdueList.length,
    messagesSentCount: messagesSent,
    messagesFailedCount: messagesFailed,
    manualFollowUpsCount: manualContactsToday.length,
    consentAttentionCount: consentNeedingAttention.length,
    summaryText: reportSummary,
    ownerId,
  };

  return {
    status: persistenceFailures || unknownOutcomes ? 'partial_failure' : 'completed',
    runTimestamp,
    reportDate: today,
    totalRemindersEvaluated: reminders.length,
    eligibleCount,
    messagesSent,
    messagesFailed,
    skippedCount,
    persistenceFailures,
    unknownOutcomes,
    skipReasons,
    reportSummary,
    emailDeliveryStatus,
    createdAttempts,
    updatedReminders,
    ownerReport,
  };
}
