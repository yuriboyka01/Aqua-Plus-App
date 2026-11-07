import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  Customer,
  ServiceRecord,
  Reminder,
  MessageAttempt,
  AppSettings,
  OwnerReport,
  AuditEvent,
} from '../types';
import { DEFAULT_SETTINGS } from '../lib/constants';
import { calculateNextReminderDate, getTodayKolkata } from '../utils/dateUtils';
import { shouldSupersedeReminder } from '../utils/businessLogic';

/**
 * Generate a clean alphanumeric ID
 */
export function generateDocId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${randomStr}`;
}

// -------------------------------------------------------------
// CUSTOMERS
// -------------------------------------------------------------

export function subscribeCustomers(
  ownerId: string,
  callback: (customers: Customer[]) => void,
  onError?: (err: any) => void
) {
  if (!ownerId || ownerId === 'guest_owner') {
    return () => {};
  }
  const path = 'customers';
  const q = collection(db, path);

  return onSnapshot(
    q,
    (snapshot) => {
      const customers: Customer[] = [];
      snapshot.forEach((docSnap) => {
        customers.push({ id: docSnap.id, ...docSnap.data() } as Customer);
      });
      customers.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      callback(customers);
    },
    (error) => {
      console.warn(`Firestore subscription notice [${path}]:`, error.message);
      if (onError) onError(error);
    }
  );
}

export async function addCustomer(
  data: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>,
  ownerId: string
): Promise<string> {
  const path = 'customers';
  const docId = generateDocId('cust');
  const nowIso = new Date().toISOString();

  const newCustomer: Customer = {
    ...data,
    id: docId,
    ownerId,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  try {
    await setDoc(doc(db, path, docId), newCustomer);
    await recordAuditEvent(
      'CUSTOMER_CREATED',
      `Registered customer ${newCustomer.fullName} (${newCustomer.primaryPhone}) in ${newCustomer.locality}`,
      'Customer',
      docId,
      ownerId
    );
    return docId;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `${path}/${docId}`);
  }
}

export async function updateCustomer(
  customerId: string,
  updates: Partial<Customer>,
  ownerId: string
): Promise<void> {
  const path = 'customers';
  const fullPath = `${path}/${customerId}`;
  const nowIso = new Date().toISOString();

  try {
    await updateDoc(doc(db, path, customerId), {
      ...updates,
      updatedAt: nowIso,
    });
    await recordAuditEvent(
      'CUSTOMER_UPDATED',
      `Updated details for customer ${updates.fullName || customerId}`,
      'Customer',
      customerId,
      ownerId
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, fullPath);
  }
}

export async function archiveCustomer(customerId: string, ownerId: string): Promise<void> {
  await updateCustomer(customerId, { status: 'archived' }, ownerId);
}

export async function restoreCustomer(customerId: string, ownerId: string): Promise<void> {
  await updateCustomer(customerId, { status: 'active' }, ownerId);
}

// -------------------------------------------------------------
// SERVICE RECORDS
// -------------------------------------------------------------

export function subscribeServiceRecords(
  ownerId: string,
  callback: (records: ServiceRecord[]) => void,
  onError?: (err: any) => void
) {
  if (!ownerId || ownerId === 'guest_owner') {
    return () => {};
  }
  const path = 'serviceRecords';
  const q = collection(db, path);

  return onSnapshot(
    q,
    (snapshot) => {
      const records: ServiceRecord[] = [];
      snapshot.forEach((docSnap) => {
        records.push({ id: docSnap.id, ...docSnap.data() } as ServiceRecord);
      });
      records.sort((a, b) => (b.serviceDate || '').localeCompare(a.serviceDate || ''));
      callback(records);
    },
    (error) => {
      console.warn(`Firestore subscription notice [${path}]:`, error.message);
      if (onError) onError(error);
    }
  );
}

export async function recordCompletedService(
  recordData: Omit<ServiceRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ownerId: string,
  customer: Customer
): Promise<string> {
  const sPath = 'serviceRecords';
  const cPath = 'customers';
  const rPath = 'reminders';

  const serviceId = generateDocId('srv');
  const reminderId = generateDocId('rem');
  const nowIso = new Date().toISOString();

  const newServiceRecord: ServiceRecord = {
    ...recordData,
    id: serviceId,
    ownerId,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const finalReminderDate = recordData.nextReminderDate;

  const newReminder: Reminder = {
    id: reminderId,
    customerId: customer.id,
    customerName: customer.fullName,
    customerPhone: customer.primaryPhone,
    customerLocality: customer.locality || 'Madurai',
    serviceRecordId: serviceId,
    serviceCategory: recordData.serviceCategory,
    lastServiceDate: recordData.serviceDate,
    reminderDate: finalReminderDate,
    status: 'upcoming',
    messageStatus: 'not_sent',
    ownerId,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  try {
    const batch = writeBatch(db);
    const oldReminders = await getDocs(query(collection(db, rPath), where('customerId', '==', customer.id)));
    oldReminders.docs.forEach((reminderSnap) => {
      const reminder = reminderSnap.data() as Reminder;
      if (shouldSupersedeReminder(reminder.status)) {
        batch.update(reminderSnap.ref, { status: 'superseded', updatedAt: nowIso });
      }
    });

    // 1. Save historical service record
    batch.set(doc(db, sPath, serviceId), newServiceRecord);

    // 2. Update customer's latest service metrics
    batch.update(doc(db, cPath, customer.id), {
      lastServiceDate: recordData.serviceDate,
      nextReminderDate: finalReminderDate,
      updatedAt: nowIso,
    });

    // 3. Create or update scheduled reminder
    batch.set(doc(db, rPath, reminderId), newReminder);

    await batch.commit();

    await recordAuditEvent(
      'SERVICE_RECORDED',
      `Recorded ${recordData.serviceCategory} for ${customer.fullName} (₹${recordData.totalAmount}). Next reminder set to ${finalReminderDate}.`,
      'ServiceRecord',
      serviceId,
      ownerId
    );

    return serviceId;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${sPath}/${serviceId}`);
  }
}

// -------------------------------------------------------------
// REMINDERS
// -------------------------------------------------------------

export function subscribeReminders(
  ownerId: string,
  callback: (reminders: Reminder[]) => void,
  onError?: (err: any) => void
) {
  if (!ownerId || ownerId === 'guest_owner') {
    return () => {};
  }
  const path = 'reminders';
  const q = collection(db, path);

  return onSnapshot(
    q,
    (snapshot) => {
      const reminders: Reminder[] = [];
      snapshot.forEach((docSnap) => {
        reminders.push({ id: docSnap.id, ...docSnap.data() } as Reminder);
      });
      reminders.sort((a, b) => (a.reminderDate || '').localeCompare(b.reminderDate || ''));
      callback(reminders);
    },
    (error) => {
      console.warn(`Firestore subscription notice [${path}]:`, error.message);
      if (onError) onError(error);
    }
  );
}

export async function rescheduleReminder(
  reminderId: string,
  customerId: string,
  newReminderDate: string,
  reason: string,
  ownerId: string
): Promise<void> {
  const rPath = 'reminders';
  const cPath = 'customers';
  const nowIso = new Date().toISOString();

  try {
    const batch = writeBatch(db);
    batch.update(doc(db, rPath, reminderId), {
      reminderDate: newReminderDate,
      status: 'upcoming',
      messageStatus: 'not_sent',
      updatedAt: nowIso,
    });

    batch.update(doc(db, cPath, customerId), {
      nextReminderDate: newReminderDate,
      updatedAt: nowIso,
    });

    await batch.commit();

    await recordAuditEvent(
      'REMINDER_RESCHEDULED',
      `Rescheduled reminder to ${newReminderDate}. Reason: ${reason || 'Owner updated'}`,
      'Reminder',
      reminderId,
      ownerId
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${rPath}/${reminderId}`);
  }
}

export async function togglePauseReminder(
  reminderId: string,
  customerId: string,
  pause: boolean,
  ownerId: string
): Promise<void> {
  const rPath = 'reminders';
  const cPath = 'customers';
  const nowIso = new Date().toISOString();

  try {
    const batch = writeBatch(db);
    batch.update(doc(db, rPath, reminderId), {
      status: pause ? 'paused' : 'upcoming',
      updatedAt: nowIso,
    });

    batch.update(doc(db, cPath, customerId), {
      remindersPaused: pause,
      updatedAt: nowIso,
    });

    await batch.commit();

    await recordAuditEvent(
      pause ? 'REMINDER_PAUSED' : 'REMINDER_RESUMED',
      `${pause ? 'Paused' : 'Resumed'} reminders for customer ${customerId}`,
      'Reminder',
      reminderId,
      ownerId
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${rPath}/${reminderId}`);
  }
}

export async function markReminderContactedManually(
  reminderId: string,
  notes: string,
  ownerId: string
): Promise<void> {
  const path = 'reminders';
  const nowIso = new Date().toISOString();

  try {
    await updateDoc(doc(db, path, reminderId), {
      status: 'contacted_manually',
      manualContactNotes: notes,
      manualContactDate: nowIso,
      updatedAt: nowIso,
    });

    await recordAuditEvent(
      'REMINDER_MANUAL_CONTACT',
      `Marked customer contacted via phone: ${notes}`,
      'Reminder',
      reminderId,
      ownerId
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${path}/${reminderId}`);
  }
}

// -------------------------------------------------------------
// MESSAGE ATTEMPTS
// -------------------------------------------------------------

export function subscribeMessageAttempts(
  ownerId: string,
  callback: (attempts: MessageAttempt[]) => void,
  onError?: (err: any) => void
) {
  const path = 'messageAttempts';
  const q = collection(db, path);

  return onSnapshot(
    q,
    (snapshot) => {
      const attempts: MessageAttempt[] = [];
      snapshot.forEach((docSnap) => {
        attempts.push({ id: docSnap.id, ...docSnap.data() } as MessageAttempt);
      });
      attempts.sort((a, b) => (b.attemptedAt || '').localeCompare(a.attemptedAt || ''));
      callback(attempts);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeMessageDeliveryStatus(
  ownerId: string,
  callback: (statuses: { providerMessageId: string; status: 'sent' | 'delivered' | 'read' | 'failed' }[]) => void,
  onError?: (err: any) => void
) {
  const path = 'messageDeliveryStatus';
  return onSnapshot(query(collection(db, path), where('ownerId', '==', ownerId)), (snapshot) => {
    callback(snapshot.docs.map((item) => item.data() as { providerMessageId: string; status: 'sent' | 'delivered' | 'read' | 'failed' }));
  }, (error) => { if (onError) onError(error); });
}

export async function recordMessageAttempt(
  data: Omit<MessageAttempt, 'id'>,
  ownerId: string
): Promise<string> {
  const path = 'messageAttempts';
  const docId = generateDocId('msg');

  const attempt: MessageAttempt = {
    ...data,
    id: docId,
    ownerId,
  };

  try {
    await setDoc(doc(db, path, docId), attempt);
    return docId;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `${path}/${docId}`);
  }
}

// -------------------------------------------------------------
// SETTINGS
// -------------------------------------------------------------

export function subscribeSettings(
  ownerId: string,
  callback: (settings: AppSettings) => void,
  onError?: (err: any) => void
) {
  const path = 'settings';
  const docId = 'app_settings';

  return onSnapshot(
    doc(db, path, docId),
    (docSnap) => {
      if (docSnap.exists()) {
        callback({ id: docSnap.id, ...docSnap.data() } as AppSettings);
      } else {
        // Return default configuration
        callback({
          ...DEFAULT_SETTINGS,
          ownerId,
        });
      }
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, `${path}/${docId}`);
    }
  );
}

export async function saveSettings(
  settings: Partial<AppSettings>,
  ownerId: string
): Promise<void> {
  const path = 'settings';
  const docId = 'app_settings';
  const nowIso = new Date().toISOString();

  try {
    await setDoc(
      doc(db, path, docId),
      {
        ...DEFAULT_SETTINGS,
        ...settings,
        ownerId,
        updatedAt: nowIso,
      },
      { merge: true }
    );

    await recordAuditEvent(
      'SETTINGS_UPDATED',
      'Updated business settings and integration configurations',
      'Settings',
      docId,
      ownerId
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${path}/${docId}`);
  }
}

// -------------------------------------------------------------
// OWNER REPORTS
// -------------------------------------------------------------

export function subscribeOwnerReports(
  ownerId: string,
  callback: (reports: OwnerReport[]) => void,
  onError?: (err: any) => void
) {
  const path = 'ownerReports';
  const q = collection(db, path);

  return onSnapshot(
    q,
    (snapshot) => {
      const reports: OwnerReport[] = [];
      snapshot.forEach((docSnap) => {
        reports.push({ id: docSnap.id, ...docSnap.data() } as OwnerReport);
      });
      reports.sort((a, b) => (b.reportDate || '').localeCompare(a.reportDate || ''));
      callback(reports);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function saveOwnerReport(
  reportData: Omit<OwnerReport, 'id'>,
  ownerId: string
): Promise<string> {
  const path = 'ownerReports';
  const docId = generateDocId(`rpt_${reportData.reportDate}`);

  try {
    await setDoc(doc(db, path, docId), {
      ...reportData,
      id: docId,
      ownerId,
    });
    return docId;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `${path}/${docId}`);
  }
}

// -------------------------------------------------------------
// AUDIT LOGS
// -------------------------------------------------------------

export function subscribeAuditEvents(
  ownerId: string,
  callback: (events: AuditEvent[]) => void,
  onError?: (err: any) => void
) {
  const path = 'auditEvents';
  const q = collection(db, path);

  return onSnapshot(
    q,
    (snapshot) => {
      const events: AuditEvent[] = [];
      snapshot.forEach((docSnap) => {
        events.push({ id: docSnap.id, ...docSnap.data() } as AuditEvent);
      });
      events.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
      callback(events);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function recordAuditEvent(
  action: string,
  details: string,
  entityType: 'Customer' | 'ServiceRecord' | 'Reminder' | 'Settings' | 'BatchScheduler',
  entityId: string,
  ownerId: string
): Promise<void> {
  const path = 'auditEvents';
  const docId = generateDocId('audit');

  const event: AuditEvent = {
    id: docId,
    action,
    details,
    entityType,
    entityId,
    ownerId,
    timestamp: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, path, docId), event);
  } catch (err) {
    console.warn('Could not record audit log: ', err);
  }
}

// -------------------------------------------------------------
// SAMPLE DATA SEED & PURGE (Clearly Separated)
// -------------------------------------------------------------

export function getInitialSampleDataSet(ownerId = 'guest_owner'): {
  customers: Customer[];
  serviceRecords: ServiceRecord[];
  reminders: Reminder[];
} {
  const today = getTodayKolkata();
  const nowIso = new Date().toISOString();

  const c1Id = 'cust_sample_1';
  const c2Id = 'cust_sample_2';
  const c3Id = 'cust_sample_3';
  const c4Id = 'cust_sample_4';

  const customers: Customer[] = [
    {
      id: c1Id,
      customerId: 'AP-1001',
      fullName: 'R. Murugesan',
      primaryPhone: '9842145670',
      alternatePhone: '9842145671',
      address: '14/B, Alagappan Nagar, Thirunagar',
      locality: 'Thirunagar',
      customerNotes: 'Prefers evening visits after 5 PM. Domestic RO 12L.',
      purifierBrand: 'Kent RO',
      purifierModel: 'Grand Plus (Mineral RO)',
      installationDate: '2024-03-10',
      registrationDate: '2024-03-10',
      whatsappConsent: true,
      emailConsent: false,
      consentTimestamp: nowIso,
      consentSource: 'In-person service visit agreement',
      status: 'active',
      defaultIntervalDays: 90,
      lastServiceDate: '2026-07-15',
      nextReminderDate: today,
      remindersPaused: false,
      isSampleData: true,
      ownerId,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: c2Id,
      customerId: 'AP-1002',
      fullName: 'S. Meenakshi Sundaram',
      primaryPhone: '9443218765',
      address: '28, 4th Cross Street, KK Nagar',
      locality: 'KK Nagar',
      customerNotes: 'Borewell water input TDS 1100 ppm. Check sediment filter often.',
      purifierBrand: 'Aqua Plus RO (Custom)',
      purifierModel: 'Copper Alkaline 15LPH',
      installationDate: '2023-11-20',
      registrationDate: '2023-11-20',
      whatsappConsent: true,
      consentTimestamp: nowIso,
      consentSource: 'Installation order sheet',
      status: 'active',
      defaultIntervalDays: 90,
      lastServiceDate: '2026-06-01',
      nextReminderDate: '2026-09-01',
      remindersPaused: false,
      isSampleData: true,
      ownerId,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: c3Id,
      customerId: 'AP-1003',
      fullName: 'Dr. K. Venkatesh',
      primaryPhone: '9789012345',
      address: '102, HIG Colony, Anna Nagar',
      locality: 'Anna Nagar',
      customerNotes: 'Clinic water dispenser RO system.',
      purifierBrand: 'Aquaguard (Eureka Forbes)',
      purifierModel: 'Geneus RO+UV+UF',
      installationDate: '2025-01-15',
      registrationDate: '2025-01-15',
      whatsappConsent: true,
      consentTimestamp: nowIso,
      consentSource: 'WhatsApp consent message reply',
      status: 'active',
      defaultIntervalDays: 90,
      lastServiceDate: '2026-08-20',
      nextReminderDate: calculateNextReminderDate('2026-08-20', 90),
      remindersPaused: false,
      isSampleData: true,
      ownerId,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: c4Id,
      customerId: 'AP-1004',
      fullName: 'P. Anandhan',
      primaryPhone: '9944087654',
      address: '7, Meenakshi Nagar, Villapuram',
      locality: 'Villapuram',
      customerNotes: 'Customer requested phone call only, no WhatsApp messaging.',
      purifierBrand: 'Livpure',
      purifierModel: 'Glo RO+UV',
      installationDate: '2024-08-05',
      registrationDate: '2024-08-05',
      whatsappConsent: false,
      status: 'active',
      defaultIntervalDays: 90,
      lastServiceDate: '2026-07-10',
      nextReminderDate: today,
      remindersPaused: false,
      isSampleData: true,
      ownerId,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  const serviceRecords: ServiceRecord[] = [
    {
      id: 'srv_sample_1',
      customerId: c1Id,
      customerName: 'R. Murugesan',
      customerPhone: '9842145670',
      customerAddress: '14/B, Alagappan Nagar, Thirunagar',
      serviceDate: '2026-07-15',
      serviceCategory: 'Routine Filter Change',
      problemReported: 'Routine scheduled maintenance and TDS check',
      workPerformed: 'Replaced sediment filter, cleaned pre-carbon filter, flushed RO membrane',
      filtersReplaced: 'Spun filter (5 micron), Carbon block',
      serviceCharge: 350,
      partsCharge: 600,
      totalAmount: 950,
      paymentStatus: 'Paid',
      technicianNotes: 'Inlet TDS: 680 ppm, Output TDS: 45 ppm. Water flow healthy.',
      recommendedIntervalDays: 90,
      calculatedNextReminderDate: today,
      nextReminderDate: today,
      isDateOverridden: false,
      isSampleData: true,
      ownerId,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'srv_sample_2',
      customerId: c2Id,
      customerName: 'S. Meenakshi Sundaram',
      customerPhone: '9443218765',
      customerAddress: '28, 4th Cross Street, KK Nagar',
      serviceDate: '2026-06-01',
      serviceCategory: 'RO Membrane Replacement',
      problemReported: 'High output TDS and slow tank filling',
      workPerformed: 'Replaced 75 GPD TFC membrane, flow restrictor 450, and post-carbon mineral cartridge',
      filtersReplaced: '75 GPD Membrane, FR-450, Post Carbon',
      serviceCharge: 400,
      partsCharge: 1650,
      totalAmount: 2050,
      paymentStatus: 'Paid',
      technicianNotes: 'Inlet TDS: 1120 ppm, Output TDS: 55 ppm. Booster pump pressure 80 PSI.',
      recommendedIntervalDays: 90,
      calculatedNextReminderDate: '2026-09-01',
      nextReminderDate: '2026-09-01',
      isDateOverridden: false,
      isSampleData: true,
      ownerId,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  const reminders: Reminder[] = [
    {
      id: 'rem_sample_1',
      customerId: c1Id,
      customerName: 'R. Murugesan',
      customerPhone: '9842145670',
      customerLocality: 'Thirunagar',
      serviceRecordId: 'srv_sample_1',
      serviceCategory: 'Routine Filter Change',
      lastServiceDate: '2026-07-15',
      reminderDate: today,
      status: 'due_today',
      messageStatus: 'not_sent',
      isSampleData: true,
      ownerId,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'rem_sample_2',
      customerId: c2Id,
      customerName: 'S. Meenakshi Sundaram',
      customerPhone: '9443218765',
      customerLocality: 'KK Nagar',
      serviceRecordId: 'srv_sample_2',
      serviceCategory: 'RO Membrane Replacement',
      lastServiceDate: '2026-06-01',
      reminderDate: '2026-09-01',
      status: 'overdue',
      messageStatus: 'not_sent',
      isSampleData: true,
      ownerId,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'rem_sample_3',
      customerId: c3Id,
      customerName: 'Dr. K. Venkatesh',
      customerPhone: '9789012345',
      customerLocality: 'Anna Nagar',
      serviceCategory: 'Routine Filter Change',
      lastServiceDate: '2026-08-20',
      reminderDate: calculateNextReminderDate('2026-08-20', 90),
      status: 'upcoming',
      messageStatus: 'not_sent',
      isSampleData: true,
      ownerId,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'rem_sample_4',
      customerId: c4Id,
      customerName: 'P. Anandhan',
      customerPhone: '9944087654',
      customerLocality: 'Villapuram',
      serviceCategory: 'Routine Filter Change',
      lastServiceDate: '2026-07-10',
      reminderDate: today,
      status: 'due_today',
      messageStatus: 'not_sent',
      isSampleData: true,
      ownerId,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  return { customers, serviceRecords, reminders };
}

export async function seedSampleData(ownerId: string): Promise<void> {
  const today = getTodayKolkata();
  const nowIso = new Date().toISOString();

  // Madurai sample customer seeds
  const sampleCustomers = [
    {
      customerId: 'AP-1001',
      fullName: 'R. Murugesan',
      primaryPhone: '9842145670',
      alternatePhone: '9842145671',
      address: '14/B, Alagappan Nagar, Thirunagar',
      locality: 'Thirunagar',
      customerNotes: 'Prefers evening visits after 5 PM. Domestic RO 12L.',
      purifierBrand: 'Kent RO',
      purifierModel: 'Grand Plus (Mineral RO)',
      installationDate: '2024-03-10',
      registrationDate: '2024-03-10',
      whatsappConsent: true,
      emailConsent: false,
      consentTimestamp: nowIso,
      consentSource: 'In-person service visit agreement',
      status: 'active' as const,
      defaultIntervalDays: 90,
      lastServiceDate: '2026-07-15',
      nextReminderDate: today, // Due today!
      remindersPaused: false,
      isSampleData: true,
    },
    {
      customerId: 'AP-1002',
      fullName: 'S. Meenakshi Sundaram',
      primaryPhone: '9443218765',
      address: '28, 4th Cross Street, KK Nagar',
      locality: 'KK Nagar',
      customerNotes: 'Borewell water input TDS 1100 ppm. Check sediment filter often.',
      purifierBrand: 'Aqua Plus RO (Custom)',
      purifierModel: 'Copper Alkaline 15LPH',
      installationDate: '2023-11-20',
      registrationDate: '2023-11-20',
      whatsappConsent: true,
      consentTimestamp: nowIso,
      consentSource: 'Installation order sheet',
      status: 'active' as const,
      defaultIntervalDays: 90,
      lastServiceDate: '2026-06-01',
      nextReminderDate: '2026-09-01', // Overdue!
      remindersPaused: false,
      isSampleData: true,
    },
    {
      customerId: 'AP-1003',
      fullName: 'Dr. K. Venkatesh',
      primaryPhone: '9789012345',
      address: '102, HIG Colony, Anna Nagar',
      locality: 'Anna Nagar',
      customerNotes: 'Clinic water dispenser RO system.',
      purifierBrand: 'Aquaguard (Eureka Forbes)',
      purifierModel: 'Geneus RO+UV+UF',
      installationDate: '2025-01-15',
      registrationDate: '2025-01-15',
      whatsappConsent: true,
      consentTimestamp: nowIso,
      consentSource: 'WhatsApp consent message reply',
      status: 'active' as const,
      defaultIntervalDays: 90,
      lastServiceDate: '2026-08-20',
      nextReminderDate: calculateNextReminderDate('2026-08-20', 90), // Upcoming!
      remindersPaused: false,
      isSampleData: true,
    },
    {
      customerId: 'AP-1004',
      fullName: 'P. Anandhan',
      primaryPhone: '9944087654',
      address: '7, Meenakshi Nagar, Villapuram',
      locality: 'Villapuram',
      customerNotes: 'Customer requested phone call only, no WhatsApp messaging.',
      purifierBrand: 'Livpure',
      purifierModel: 'Glo RO+UV',
      installationDate: '2024-08-05',
      registrationDate: '2024-08-05',
      whatsappConsent: false, // NO consent!
      status: 'active' as const,
      defaultIntervalDays: 90,
      lastServiceDate: '2026-07-10',
      nextReminderDate: today,
      remindersPaused: false,
      isSampleData: true,
    },
  ];

  const batch = writeBatch(db);

  for (const cData of sampleCustomers) {
    const custId = generateDocId('cust');
    const custDoc: Customer = {
      ...cData,
      id: custId,
      ownerId,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    batch.set(doc(db, 'customers', custId), custDoc);

    // Initial service record
    const srvId = generateDocId('srv');
    const srvDoc: ServiceRecord = {
      id: srvId,
      customerId: custId,
      customerName: cData.fullName,
      customerPhone: cData.primaryPhone,
      customerAddress: cData.address,
      serviceDate: cData.lastServiceDate,
      serviceCategory: 'Routine Filter Change',
      problemReported: 'Routine scheduled maintenance and TDS check',
      workPerformed: 'Replaced sediment filter, cleaned pre-carbon filter, flushed RO membrane',
      filtersReplaced: 'Spun filter (5 micron), Carbon block',
      serviceCharge: 350,
      partsCharge: 600,
      totalAmount: 950,
      paymentStatus: 'Paid',
      technicianNotes: 'Inlet TDS: 680 ppm, Output TDS: 45 ppm. Water flow healthy.',
      recommendedIntervalDays: cData.defaultIntervalDays,
      calculatedNextReminderDate: cData.nextReminderDate,
      nextReminderDate: cData.nextReminderDate,
      isDateOverridden: false,
      isSampleData: true,
      ownerId,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    batch.set(doc(db, 'serviceRecords', srvId), srvDoc);

    // Reminder
    const remId = generateDocId('rem');
    const remDoc: Reminder = {
      id: remId,
      customerId: custId,
      customerName: cData.fullName,
      customerPhone: cData.primaryPhone,
      customerLocality: cData.locality,
      serviceRecordId: srvId,
      serviceCategory: 'Routine Filter Change',
      lastServiceDate: cData.lastServiceDate,
      reminderDate: cData.nextReminderDate,
      status: cData.nextReminderDate === today ? 'due_today' : (cData.nextReminderDate < today ? 'overdue' : 'upcoming'),
      messageStatus: 'not_sent',
      isSampleData: true,
      ownerId,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    batch.set(doc(db, 'reminders', remId), remDoc);
  }

  await batch.commit();
  await recordAuditEvent('SAMPLE_DATA_LOADED', 'Seeded Madurai sample customers for testing', 'Customer', 'sample', ownerId);
}

export async function purgeSampleData(
  customers: Customer[],
  services: ServiceRecord[],
  reminders: Reminder[],
  ownerId: string
): Promise<number> {
  const sampleCustIds = customers.filter(c => c.isSampleData).map(c => c.id);
  const sampleSrvIds = services.filter(s => s.isSampleData).map(s => s.id);
  const sampleRemIds = reminders.filter(r => r.isSampleData).map(r => r.id);

  let deletedCount = 0;
  for (const cid of sampleCustIds) {
    await deleteDoc(doc(db, 'customers', cid));
    deletedCount++;
  }
  for (const sid of sampleSrvIds) {
    await deleteDoc(doc(db, 'serviceRecords', sid));
    deletedCount++;
  }
  for (const rid of sampleRemIds) {
    await deleteDoc(doc(db, 'reminders', rid));
    deletedCount++;
  }

  await recordAuditEvent('SAMPLE_DATA_PURGED', `Removed ${deletedCount} sample test documents`, 'Customer', 'sample', ownerId);
  return deletedCount;
}
