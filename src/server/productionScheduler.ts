import { createHash } from 'node:crypto';
import type { DocumentData, DocumentReference, QuerySnapshot } from 'firebase-admin/firestore';
import type { AppSettings, AuditEvent, Customer, MessageAttempt, Reminder, ServiceRecord } from '../types/index.ts';
import { DEFAULT_SETTINGS } from '../lib/constants.ts';
import { getTodayKolkata } from '../utils/dateUtils.ts';
import { executeScheduledDailyBatch } from './schedulerAdapter.ts';
import type { DispatchResultHandler } from './schedulerAdapter.ts';
import { getWhatsAppIntegrationStatus } from './whatsappAdapter.ts';
import { getAdminDb } from './firebaseAdmin.ts';

/** A failed WhatsApp dispatch is retried on later runs until it has been attempted this many times. */
const MAX_DISPATCH_ATTEMPTS = 3;

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function rows<T>(snapshot: QuerySnapshot<DocumentData>): T[] {
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as T));
}

export interface ProductionBatchSummary {
  status: 'completed' | 'partial_failure' | 'reconciliation_required' | 'already_completed' | 'disabled' | 'not_configured';
  reportDate: string;
  totalRemindersEvaluated: number;
  eligibleCount: number;
  messagesSent: number;
  messagesFailed: number;
  persistenceFailures?: number;
  unknownOutcomes?: number;
  skippedCount: number;
  emailDeliveryStatus?: string;
}

function emptySummary(status: ProductionBatchSummary['status'], reportDate: string): ProductionBatchSummary {
  return {
    status,
    reportDate,
    totalRemindersEvaluated: 0,
    eligibleCount: 0,
    messagesSent: 0,
    messagesFailed: 0,
    skippedCount: 0,
  };
}

export async function runProductionDailyBatch(ownerId: string): Promise<ProductionBatchSummary> {
  const reportDate = getTodayKolkata();

  // Do not burn today's run (or lock it as "completed") when nothing can be delivered.
  if (getWhatsAppIntegrationStatus().status !== 'configured') {
    return emptySummary('not_configured', reportDate);
  }

  const db = getAdminDb();
  const runId = `run_${hash(`${ownerId}:${reportDate}`)}`;
  const runRef = db.collection('schedulerRuns').doc(runId);
  const runTimestamp = new Date().toISOString();

  const acquired = await db.runTransaction(async (transaction) => {
    const current = await transaction.get(runRef);
    if (current.exists && current.data()?.status === 'completed') return 'completed';
    if (current.exists && current.data()?.status === 'reconciliation_required') return 'reconciliation_required';
    if (current.exists && current.data()?.status === 'running') {
      const startedAt = Date.parse(current.data()?.startedAt || '');
      if (Number.isFinite(startedAt) && Date.now() - startedAt < 10 * 60_000) return 'running';
    }
    transaction.set(runRef, {
      ownerId,
      reportDate,
      status: 'running',
      startedAt: runTimestamp,
      updatedAt: runTimestamp,
    }, { merge: true });
    return 'acquired';
  });

  if (acquired === 'completed') return emptySummary('already_completed', reportDate);
  if (acquired === 'reconciliation_required') return emptySummary('reconciliation_required', reportDate);
  if (acquired === 'running') throw new Error('A daily batch is already running for this owner and date.');

  try {
    const [customersSnapshot, remindersSnapshot, servicesSnapshot, attemptsSnapshot, settingsSnapshot] = await Promise.all([
      db.collection('customers').get(),
      db.collection('reminders').get(),
      db.collection('serviceRecords').get(),
      db.collection('messageAttempts').get(),
      db.collection('settings').doc('app_settings').get(),
    ]);

    const settings = settingsSnapshot.exists
      ? { ...DEFAULT_SETTINGS, ...settingsSnapshot.data(), id: settingsSnapshot.id } as AppSettings
      : { ...DEFAULT_SETTINGS, ownerId };
    if (!settings.scheduledProcessingEnabled) {
      await runRef.set({ status: 'disabled', updatedAt: new Date().toISOString() }, { merge: true });
      return emptySummary('disabled', reportDate);
    }

    const customers = rows<Customer>(customersSnapshot);
    const reminders = rows<Reminder>(remindersSnapshot);
    const serviceRecords = rows<ServiceRecord>(servicesSnapshot);
    const pastAttempts = rows<MessageAttempt>(attemptsSnapshot);

    const reservationRefFor = (idempotencyKey: string) =>
      db.collection('messageReservations').doc(`reservation_${hash(`${ownerId}:${idempotencyKey}`)}`);
    const claimedReservationRefs = new Map<string, DocumentReference>();

    // At-most-once claim. A previously *failed* send may be claimed again (up to MAX_DISPATCH_ATTEMPTS);
    // a reservation stuck in "processing" is never re-sent automatically because the outcome is unknown.
    const claimDispatch = async (idempotencyKey: string): Promise<boolean> => {
      return db.runTransaction(async (transaction) => {
        // Look up the idempotency key across old per-user and new shared-business
        // reservations so enabling shared accounts cannot resend an earlier message.
        const reservations = await transaction.get(
          db.collection('messageReservations').where('idempotencyKey', '==', idempotencyKey)
        );
        const existing = reservations.docs[0];
        const now = new Date().toISOString();
        if (!existing) {
          const reservationRef = reservationRefFor(idempotencyKey);
          transaction.create(reservationRef, {
            ownerId,
            idempotencyKey,
            status: 'processing',
            attemptCount: 1,
            startedAt: now,
          });
          claimedReservationRefs.set(idempotencyKey, reservationRef);
          return true;
        }
        const data = existing.data() || {};
        const attemptCount = typeof data.attemptCount === 'number' ? data.attemptCount : 1;
        if (data.status === 'failed' && attemptCount < MAX_DISPATCH_ATTEMPTS) {
          transaction.update(existing.ref, {
            status: 'processing',
            attemptCount: attemptCount + 1,
            startedAt: now,
          });
          claimedReservationRefs.set(idempotencyKey, existing.ref);
          return true;
        }
        return false;
      });
    };

    // Persist each outcome immediately, so a crash later in the run cannot lose it.
    const recordDispatch: DispatchResultHandler = async (attempt, reminderUpdate) => {
      const finishedAt = new Date().toISOString();
      const reservationRef = claimedReservationRefs.get(attempt.idempotencyKey) || reservationRefFor(attempt.idempotencyKey);
      const attemptRef = db.collection('messageAttempts').doc(
        `attempt_${hash(`${ownerId}:${attempt.idempotencyKey}:${attempt.attemptedAt}`)}`
      );
      const batch = db.batch();
      batch.update(reservationRef, {
        status: attempt.status === 'success' ? 'sent' : attempt.status === 'unknown' ? 'processing' : 'failed',
        providerMessageId: attempt.providerMessageId || null,
        errorDetails: attempt.errorDetails || null,
        finishedAt,
      });
      batch.set(attemptRef, { ...attempt, id: attemptRef.id });
      batch.update(db.collection('reminders').doc(reminderUpdate.id), { ...reminderUpdate, updatedAt: finishedAt });
      await batch.commit();
    };

    const result = await executeScheduledDailyBatch({
      customers,
      reminders,
      serviceRecords,
      pastAttempts,
      settings,
      ownerId,
      claimDispatch,
      onDispatchResult: recordDispatch,
    });

    const reportId = `report_${hash(`${ownerId}:${reportDate}`)}`;
    const reportRef = db.collection('ownerReports').doc(reportId);
    await reportRef.set({ ...result.ownerReport, id: reportId }, { merge: true });
    await db.collection('settings').doc('app_settings').set({
      ...settings,
      ownerId,
      lastScheduledRun: result.runTimestamp,
      updatedAt: result.runTimestamp,
    }, { merge: true });

    const audit: Omit<AuditEvent, 'id'> = {
      action: 'DAILY_BATCH_COMPLETED',
      details: `Completed daily batch for ${reportDate}: ${result.messagesSent} sent, ${result.messagesFailed} failed.`,
      entityType: 'BatchScheduler',
      entityId: runId,
      ownerId,
      timestamp: result.runTimestamp,
    };
    await db.collection('auditEvents').add(audit);
    await runRef.set({
      status: result.status === 'partial_failure' ? 'reconciliation_required' : 'completed',
      reportId,
      totalRemindersEvaluated: result.totalRemindersEvaluated,
      eligibleCount: result.eligibleCount,
      messagesSent: result.messagesSent,
      messagesFailed: result.messagesFailed,
      persistenceFailures: result.persistenceFailures,
      unknownOutcomes: result.unknownOutcomes,
      skippedCount: result.skippedCount,
      emailDeliveryStatus: result.emailDeliveryStatus,
      completedAt: new Date().toISOString(),
    }, { merge: true });

    return {
      status: result.status,
      reportDate,
      totalRemindersEvaluated: result.totalRemindersEvaluated,
      eligibleCount: result.eligibleCount,
      messagesSent: result.messagesSent,
      messagesFailed: result.messagesFailed,
      persistenceFailures: result.persistenceFailures,
      unknownOutcomes: result.unknownOutcomes,
      skippedCount: result.skippedCount,
      emailDeliveryStatus: result.emailDeliveryStatus,
    };
  } catch (error) {
    await runRef.set({
      status: 'failed',
      error: error instanceof Error ? error.message.slice(0, 500) : 'Unknown batch failure',
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    throw error;
  }
}
