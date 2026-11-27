import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  onSnapshot,
  writeBatch,
  getDocs,
  getDoc,
  runTransaction,
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
  AuditEntityType,
  InventoryItem,
  WholesaleSale,
  WholesaleSaleInput,
  PaymentStatus,
  validateWholesaleSale,
} from '../types';
import { BUSINESS_OWNER_ID, DEFAULT_SETTINGS } from '../lib/constants';
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

function withTimeout<T>(
  promise: Promise<T>,
  ms = 12000,
  errorMsg = 'Database operation timed out. Please check your network connection or sign in again.'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(errorMsg)), ms)),
  ]);
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
    await withTimeout(setDoc(doc(db, path, docId), newCustomer));
    recordAuditEvent(
      'CUSTOMER_CREATED',
      `Registered customer ${newCustomer.fullName} (${newCustomer.primaryPhone}) in ${newCustomer.locality}`,
      'Customer',
      docId,
      ownerId
    ).catch((e) => console.warn('Non-blocking audit log notice:', e));
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
    await withTimeout(
      updateDoc(doc(db, path, customerId), {
        ...updates,
        updatedAt: nowIso,
      })
    );
    recordAuditEvent(
      'CUSTOMER_UPDATED',
      `Updated details for customer ${updates.fullName || customerId}`,
      'Customer',
      customerId,
      ownerId
    ).catch((e) => console.warn('Non-blocking audit log notice:', e));
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
  entityType: AuditEntityType,
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
// INVENTORY
// -------------------------------------------------------------

export function subscribeInventory(
  ownerIdOrCallback: string | ((items: InventoryItem[]) => void),
  callbackOrOnError?: ((items: InventoryItem[]) => void) | ((err: any) => void),
  onErrorFn?: (err: any) => void
): () => void {
  let ownerId: string;
  let callback: (items: InventoryItem[]) => void;
  let onError: ((err: any) => void) | undefined;

  if (typeof ownerIdOrCallback === 'function') {
    ownerId = BUSINESS_OWNER_ID;
    callback = ownerIdOrCallback;
    onError = typeof callbackOrOnError === 'function' ? (callbackOrOnError as (err: any) => void) : undefined;
  } else {
    ownerId = ownerIdOrCallback || BUSINESS_OWNER_ID;
    callback = callbackOrOnError as (items: InventoryItem[]) => void;
    onError = onErrorFn;
  }

  // Support guest owner / offline demo preview
  if (!ownerId || ownerId === 'guest_owner') {
    if (callback) {
      callback(getInitialSampleInventory(ownerId || 'guest_owner'));
    }
    return () => {};
  }

  const path = 'inventory';
  const q = collection(db, path);

  return onSnapshot(
    q,
    (snapshot) => {
      const items: InventoryItem[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() } as InventoryItem);
      });
      // Sort alphabetically by spare part name
      items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      callback(items);
    },
    (error) => {
      console.warn(`Firestore subscription notice [${path}]:`, error.message);
      if (onError) onError(error);
    }
  );
}

export async function addInventoryItem(
  data: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt' | 'ownerId'> & { id?: string; createdAt?: string; updatedAt?: string; ownerId?: string },
  ownerId: string = BUSINESS_OWNER_ID
): Promise<string> {
  const path = 'inventory';
  const nowIso = new Date().toISOString();

  const docRef = data.id
    ? doc(db, path, data.id)
    : doc(collection(db, path));
  const docId = docRef.id;

  const trimmedLocation = data.storageLocation?.trim();
  const trimmedNotes = data.notes?.trim();
  const newItem: InventoryItem = {
    ...data,
    id: docId,
    ownerId: data.ownerId || ownerId,
    quantity: Math.max(0, Number(data.quantity) || 0),
    lowStockThreshold: Math.max(0, Number(data.lowStockThreshold) || 0),
    unitCost: Math.max(0, Number(data.unitCost) || 0),
    sellingPrice: Math.max(0, Number(data.sellingPrice) || 0),
    createdAt: data.createdAt || nowIso,
    updatedAt: nowIso,
  };
  if (trimmedLocation) newItem.storageLocation = trimmedLocation;
  else delete newItem.storageLocation;
  if (trimmedNotes) newItem.notes = trimmedNotes;
  else delete newItem.notes;
  for (const key of Object.keys(newItem) as (keyof InventoryItem)[]) {
    if (newItem[key] === undefined) delete newItem[key];
  }

  try {
    await withTimeout(setDoc(docRef, newItem));
    recordAuditEvent(
      'INVENTORY_ITEM_CREATED',
      `Registered spare part "${newItem.name}" (${newItem.category}) with initial quantity of ${newItem.quantity} (unit cost: ₹${newItem.unitCost}, selling: ₹${newItem.sellingPrice})`,
      'InventoryItem',
      docId,
      ownerId
    ).catch((e) => console.warn('Non-blocking audit log notice:', e));
    return docId;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `${path}/${docId}`);
  }
}

export async function updateInventoryItem(
  itemId: string,
  updates: Partial<Omit<InventoryItem, 'id' | 'createdAt'>>,
  ownerId: string = BUSINESS_OWNER_ID
): Promise<void> {
  const path = 'inventory';
  const fullPath = `${path}/${itemId}`;
  const nowIso = new Date().toISOString();

  const sanitized: Record<string, any> = { ...updates };
  delete sanitized.id;
  delete sanitized.createdAt;

  if (sanitized.quantity !== undefined) {
    sanitized.quantity = Math.max(0, Number(sanitized.quantity) || 0);
  }
  if (sanitized.lowStockThreshold !== undefined) {
    sanitized.lowStockThreshold = Math.max(0, Number(sanitized.lowStockThreshold) || 0);
  }
  if (sanitized.unitCost !== undefined) {
    sanitized.unitCost = Math.max(0, Number(sanitized.unitCost) || 0);
  }
  if (sanitized.sellingPrice !== undefined) {
    sanitized.sellingPrice = Math.max(0, Number(sanitized.sellingPrice) || 0);
  }
  if ('storageLocation' in sanitized) {
    const trimmed = typeof sanitized.storageLocation === 'string' ? sanitized.storageLocation.trim() : '';
    sanitized.storageLocation = trimmed ? trimmed : deleteField();
  }
  if ('notes' in sanitized) {
    const trimmed = typeof sanitized.notes === 'string' ? sanitized.notes.trim() : '';
    sanitized.notes = trimmed ? trimmed : deleteField();
  }
  for (const key of Object.keys(sanitized)) {
    if (sanitized[key] === undefined) delete sanitized[key];
  }

  try {
    await withTimeout(
      updateDoc(doc(db, path, itemId), {
        ...sanitized,
        updatedAt: nowIso,
      })
    );
    recordAuditEvent(
      'INVENTORY_ITEM_UPDATED',
      `Updated inventory details for spare part "${updates.name || itemId}"`,
      'InventoryItem',
      itemId,
      ownerId
    ).catch((e) => console.warn('Non-blocking audit log notice:', e));
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, fullPath);
  }
}

export async function adjustInventoryQuantity(
  itemId: string,
  delta: number,
  reason: string = 'Manual stock adjustment',
  ownerId: string = BUSINESS_OWNER_ID
): Promise<{ previousQuantity: number; newQuantity: number; clamped: boolean }> {
  const path = 'inventory';
  const docRef = doc(db, path, itemId);
  const nowIso = new Date().toISOString();

  let prevQty = 0;
  let newQty = 0;
  let itemName = itemId;
  let wasClamped = false;

  try {
    await withTimeout(
      runTransaction(db, async (transaction) => {
        const itemSnap = await transaction.get(docRef);
        if (!itemSnap.exists()) {
          throw new Error(`Inventory item with ID "${itemId}" was not found.`);
        }
        const data = itemSnap.data() as InventoryItem;
        itemName = data.name || itemId;
        prevQty = Number(data.quantity) || 0;

        const rawNewQty = prevQty + delta;
        newQty = Math.max(0, rawNewQty);
        wasClamped = rawNewQty < 0;

        const adjUpdate: Record<string, any> = {
          quantity: newQty,
          updatedAt: nowIso,
        };
        if ((data as any).storageLocation === null) adjUpdate.storageLocation = deleteField();
        if ((data as any).notes === null) adjUpdate.notes = deleteField();
        if ((data as any).isSampleData === null) adjUpdate.isSampleData = deleteField();
        transaction.update(docRef, adjUpdate);
      })
    );

    const sign = delta >= 0 ? `+${delta}` : `${delta}`;
    const clampNote = wasClamped ? ' (clamped to 0 minimum)' : '';
    await recordAuditEvent(
      'INVENTORY_STOCK_ADJUSTED',
      `Stock adjusted for "${itemName}": ${prevQty} -> ${newQty} (${sign})${clampNote}. Reason: ${reason}`,
      'InventoryItem',
      itemId,
      ownerId
    ).catch((e) => console.warn('Non-blocking audit log notice:', e));

    return { previousQuantity: prevQty, newQuantity: newQty, clamped: wasClamped };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${path}/${itemId}`);
  }
}

export async function deleteInventoryItem(
  itemId: string,
  ownerId: string = BUSINESS_OWNER_ID
): Promise<void> {
  const path = 'inventory';
  const fullPath = `${path}/${itemId}`;

  try {
    await withTimeout(deleteDoc(doc(db, path, itemId)));
    recordAuditEvent(
      'INVENTORY_ITEM_DELETED',
      `Deleted inventory spare part record ${itemId}`,
      'InventoryItem',
      itemId,
      ownerId
    ).catch((e) => console.warn('Non-blocking audit log notice:', e));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, fullPath);
  }
}

export async function getInventoryItem(
  itemId: string
): Promise<InventoryItem | null> {
  const path = 'inventory';
  try {
    const snap = await withTimeout(getDoc(doc(db, path, itemId)));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as InventoryItem;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `${path}/${itemId}`);
  }
}

// -------------------------------------------------------------
// WHOLESALE / TECHNICIAN SPARE PARTS SALES
// -------------------------------------------------------------

export interface WholesaleSaleResult {
  saleId: string;
  billNumber: string;
  stockChanges: {
    itemId: string;
    itemName: string;
    previousQuantity: number;
    newQuantity: number;
    deducted: number;
  }[];
}

export function subscribeWholesaleSales(
  ownerId: string,
  callback: (sales: WholesaleSale[]) => void,
  onError?: (err: any) => void
) {
  if (!ownerId || ownerId === 'guest_owner') {
    callback([]);
    return () => {};
  }
  const path = 'wholesaleSales';
  const q = collection(db, path);

  return onSnapshot(
    q,
    (snapshot) => {
      const sales: WholesaleSale[] = [];
      snapshot.forEach((docSnap) => {
        sales.push({ id: docSnap.id, ...docSnap.data() } as WholesaleSale);
      });
      sales.sort((a, b) => {
        const dateCmp = (b.saleDate || '').localeCompare(a.saleDate || '');
        if (dateCmp !== 0) return dateCmp;
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      });
      callback(sales);
    },
    (error) => {
      console.warn(`Firestore subscription notice [${path}]:`, error.message);
      if (onError) onError(error);
    }
  );
}

/**
 * Records a wholesale/counter sale to a technician and atomically deducts
 * every sold spare part's quantity from the `inventory` collection inside a
 * single Firestore transaction.
 */
export async function recordWholesaleSale(
  saleInput: WholesaleSaleInput,
  ownerId: string = BUSINESS_OWNER_ID
): Promise<WholesaleSaleResult> {
  const validation = validateWholesaleSale(saleInput);
  if (!validation.isValid) {
    const firstError = Object.values(validation.errors).find(Boolean) || 'Invalid wholesale sale details.';
    throw new Error(firstError);
  }

  const saleId = generateDocId('ws');
  const datePart = saleInput.saleDate.replace(/-/g, '').slice(2);
  const billNumber = `WS-${datePart}-${saleId.slice(-4).toUpperCase()}`;
  const nowIso = new Date().toISOString();

  const requestedByItem = new Map<string, number>();
  for (const line of saleInput.items) {
    requestedByItem.set(line.itemId, (requestedByItem.get(line.itemId) || 0) + line.quantity);
  }

  const normalizedItems = saleInput.items.map((line) => ({
    itemId: line.itemId,
    itemName: line.itemName.trim(),
    category: line.category,
    quantity: line.quantity,
    unitPrice: Math.max(0, Number(line.unitPrice) || 0),
    lineTotal: Math.max(0, Number(line.lineTotal) || 0),
  }));

  const totalUnits = normalizedItems.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const totalAmount = Math.max(0, Number(saleInput.totalAmount) || 0);

  const saleDoc: WholesaleSale = {
    id: saleId,
    billNumber,
    saleDate: saleInput.saleDate,
    technicianName: saleInput.technicianName.trim(),
    items: normalizedItems,
    totalUnits,
    subtotal,
    isCustomTotal: Boolean(saleInput.isCustomTotal),
    totalAmount,
    paymentStatus: saleInput.paymentStatus,
    ownerId,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const trimmedPhone = saleInput.technicianPhone?.trim();
  if (trimmedPhone) saleDoc.technicianPhone = trimmedPhone;
  const trimmedNotes = saleInput.notes?.trim();
  if (trimmedNotes) saleDoc.notes = trimmedNotes;
  if (saleInput.isSampleData) saleDoc.isSampleData = true;

  const stockChanges: WholesaleSaleResult['stockChanges'] = [];

  try {
    await withTimeout(
      runTransaction(db, async (transaction) => {
        stockChanges.length = 0;

        const itemEntries = Array.from(requestedByItem.entries());
        const snapshots = await Promise.all(
          itemEntries.map(([itemId]) => transaction.get(doc(db, 'inventory', itemId)))
        );

        const updatesToApply: { itemId: string; newQuantity: number; invData: InventoryItem }[] = [];
        for (let i = 0; i < itemEntries.length; i++) {
          const [itemId, qtyNeeded] = itemEntries[i];
          const snap = snapshots[i];
          if (!snap.exists()) {
            throw new Error(`Spare part "${itemId}" was not found in inventory.`);
          }
          const invData = snap.data() as InventoryItem;
          const prevQty = Number(invData.quantity) || 0;
          if (prevQty < qtyNeeded) {
            throw new Error(
              `Insufficient stock for "${invData.name}": ${prevQty} available, ${qtyNeeded} requested.`
            );
          }
          const newQty = prevQty - qtyNeeded;
          updatesToApply.push({ itemId, newQuantity: newQty, invData });
          stockChanges.push({
            itemId,
            itemName: invData.name,
            previousQuantity: prevQty,
            newQuantity: newQty,
            deducted: qtyNeeded,
          });
        }

        for (const upd of updatesToApply) {
          const invUpdate: Record<string, any> = {
            quantity: upd.newQuantity,
            updatedAt: nowIso,
          };
          if ((upd.invData as any).storageLocation === null) invUpdate.storageLocation = deleteField();
          if ((upd.invData as any).notes === null) invUpdate.notes = deleteField();
          if ((upd.invData as any).isSampleData === null) invUpdate.isSampleData = deleteField();
          transaction.update(doc(db, 'inventory', upd.itemId), invUpdate);
        }
        transaction.set(doc(db, 'wholesaleSales', saleId), saleDoc);
      })
    );

    const itemsSummary = stockChanges
      .map((s) => `${s.deducted}x ${s.itemName} (${s.previousQuantity}->${s.newQuantity})`)
      .join(', ');
    recordAuditEvent(
      'WHOLESALE_SALE_RECORDED',
      `Bill ${billNumber} to ${saleDoc.technicianName} (Rs.${totalAmount}, ${saleDoc.paymentStatus}): ${itemsSummary}`,
      'WholesaleSale',
      saleId,
      ownerId
    ).catch((e) => console.warn('Non-blocking audit log notice:', e));

    return { saleId, billNumber, stockChanges };
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message.startsWith('Insufficient stock') || err.message.includes('was not found in inventory'))
    ) {
      throw err;
    }
    handleFirestoreError(err, OperationType.WRITE, `wholesaleSales/${saleId}`);
  }
}

export async function updateWholesaleSalePaymentStatus(
  saleId: string,
  paymentStatus: PaymentStatus,
  ownerId: string = BUSINESS_OWNER_ID
): Promise<void> {
  const path = 'wholesaleSales';
  const nowIso = new Date().toISOString();

  try {
    await withTimeout(
      updateDoc(doc(db, path, saleId), {
        paymentStatus,
        updatedAt: nowIso,
      })
    );
    recordAuditEvent(
      'WHOLESALE_PAYMENT_UPDATED',
      `Updated wholesale bill ${saleId} payment status to ${paymentStatus}`,
      'WholesaleSale',
      saleId,
      ownerId
    ).catch((e) => console.warn('Non-blocking audit log notice:', e));
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${path}/${saleId}`);
  }
}

export const SAMPLE_INVENTORY_ITEMS: Omit<InventoryItem, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'inv_sample_spun_5u',
    name: '5µ PP Spun Filter Cartridge (10-inch)',
    category: 'spun_filter',
    quantity: 42,
    lowStockThreshold: 15,
    unitCost: 45,
    sellingPrice: 120,
    storageLocation: 'Bin A-01',
    notes: 'Standard 10" pre-filter cartridge for outer bowl. Fast-moving consumable; replaced quarterly.',
    isSampleData: true,
    ownerId: 'aquaplus-business',
  },
  {
    id: 'inv_sample_ro_mem_75',
    name: '75 GPD TFC Residential RO Membrane',
    category: 'ro_membrane',
    quantity: 4,
    lowStockThreshold: 6,
    unitCost: 680,
    sellingPrice: 1450,
    storageLocation: 'Cabinet B-01',
    notes: 'High-rejection thin-film composite membrane for domestic units. Low stock warning!',
    isSampleData: true,
    ownerId: 'aquaplus-business',
  },
  {
    id: 'inv_sample_ro_mem_100',
    name: '100 GPD Hi-TDS Commercial RO Membrane',
    category: 'ro_membrane',
    quantity: 8,
    lowStockThreshold: 3,
    unitCost: 890,
    sellingPrice: 1850,
    storageLocation: 'Cabinet B-01',
    notes: 'Heavy duty membrane for borewell water areas with input TDS exceeding 1500 ppm.',
    isSampleData: true,
    ownerId: 'aquaplus-business',
  },
  {
    id: 'inv_sample_sediment_10',
    name: '10" Inline Sediment Filter (Push-Fit)',
    category: 'sediment_filter',
    quantity: 24,
    lowStockThreshold: 8,
    unitCost: 110,
    sellingPrice: 260,
    storageLocation: 'Bin A-02',
    notes: 'Pre-treatment stage 1 filter inside cabinet. Removes sand, silt, and rust particles.',
    isSampleData: true,
    ownerId: 'aquaplus-business',
  },
  {
    id: 'inv_sample_carbon_cto',
    name: '10" CTO Carbon Block Filter Cartridge',
    category: 'carbon_block',
    quantity: 19,
    lowStockThreshold: 8,
    unitCost: 135,
    sellingPrice: 290,
    storageLocation: 'Bin A-03',
    notes: 'Activated coconut shell carbon block. Adsorbs chlorine, volatile organic compounds, and bad odor.',
    isSampleData: true,
    ownerId: 'aquaplus-business',
  },
  {
    id: 'inv_sample_post_carbon',
    name: 'Post Carbon & Silver Nano Taste Enhancer',
    category: 'post_carbon',
    quantity: 15,
    lowStockThreshold: 5,
    unitCost: 155,
    sellingPrice: 320,
    storageLocation: 'Bin A-04',
    notes: 'Final polishing cartridge for crisp sweet water taste and bacteriostatic protection.',
    isSampleData: true,
    ownerId: 'aquaplus-business',
  },
  {
    id: 'inv_sample_pump_100gpd',
    name: '100 GPD 24V DC Diaphragm Booster Pump',
    category: 'booster_pump',
    quantity: 0,
    lowStockThreshold: 3,
    unitCost: 1150,
    sellingPrice: 2200,
    storageLocation: 'Shelf C-01',
    notes: 'Kemflo/BNQS heavy duty diaphragm booster pump. OUT OF STOCK - urgent distributor PO needed.',
    isSampleData: true,
    ownerId: 'aquaplus-business',
  },
  {
    id: 'inv_sample_smps_24v',
    name: '24V 2.5A SMPS DC Power Adapter',
    category: 'smps_adapter',
    quantity: 2,
    lowStockThreshold: 4,
    unitCost: 320,
    sellingPrice: 650,
    storageLocation: 'Shelf C-02',
    notes: 'Wide voltage range (140V-300V AC) SMPS with built-in surge suppressor. Low stock warning!',
    isSampleData: true,
    ownerId: 'aquaplus-business',
  },
  {
    id: 'inv_sample_fr_450',
    name: 'Flow Restrictor FR-450 (Push-Fit 1/4")',
    category: 'flow_restrictor',
    quantity: 5,
    lowStockThreshold: 6,
    unitCost: 35,
    sellingPrice: 110,
    storageLocation: 'Drawer D-01',
    notes: '450 cc/min reject water restrictor for 75 GPD domestic RO membranes. Low stock warning!',
    isSampleData: true,
    ownerId: 'aquaplus-business',
  },
  {
    id: 'inv_sample_tubing_14',
    name: '1/4" Food-Grade PE RO Tubing (100m Roll)',
    category: 'fittings_tubing',
    quantity: 6,
    lowStockThreshold: 2,
    unitCost: 420,
    sellingPrice: 800,
    storageLocation: 'Rack E-01',
    notes: 'NSF certified high-pressure food grade polyethylene tubing for all connections.',
    isSampleData: true,
    ownerId: 'aquaplus-business',
  },
  {
    id: 'inv_sample_fittings_pack',
    name: '1/4" Quick-Connect Elbow & Equal Tee Fittings (Pack of 20)',
    category: 'fittings_tubing',
    quantity: 14,
    lowStockThreshold: 5,
    unitCost: 180,
    sellingPrice: 360,
    storageLocation: 'Drawer D-02',
    notes: 'Push-fit connectors with stainless steel grab ring and EPDM food grade O-rings.',
    isSampleData: true,
    ownerId: 'aquaplus-business',
  },
  {
    id: 'inv_sample_alkaline_copper',
    name: 'Copper + Alkaline pH Balancing Mineral Infuser',
    category: 'other',
    quantity: 0,
    lowStockThreshold: 3,
    unitCost: 380,
    sellingPrice: 750,
    storageLocation: 'Bin A-05',
    notes: 'Enriches RO permeate with essential minerals (Ca, Mg, Cu) and balances pH to 7.5-8.5. OUT OF STOCK.',
    isSampleData: true,
    ownerId: 'aquaplus-business',
  },
];

export function getInitialSampleInventory(ownerId = 'guest_owner'): InventoryItem[] {
  const nowIso = new Date().toISOString();
  return SAMPLE_INVENTORY_ITEMS.map((item) => ({
    ...item,
    ownerId,
    createdAt: nowIso,
    updatedAt: nowIso,
  }));
}

// -------------------------------------------------------------
// SAMPLE DATA SEED & PURGE (Clearly Separated)
// -------------------------------------------------------------

export function getInitialSampleDataSet(ownerId = 'guest_owner'): {
  customers: Customer[];
  serviceRecords: ServiceRecord[];
  reminders: Reminder[];
  inventory: InventoryItem[];
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

  const inventory = getInitialSampleInventory(ownerId);
  return { customers, serviceRecords, reminders, inventory };
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

  // Inventory sample seeds
  const sampleInventory = getInitialSampleInventory(ownerId);
  for (const inv of sampleInventory) {
    batch.set(doc(db, 'inventory', inv.id), inv);
  }

  await batch.commit();
  await recordAuditEvent('SAMPLE_DATA_LOADED', 'Seeded Madurai sample customers, service history, and spare parts inventory', 'Customer', 'sample', ownerId);
}

export async function purgeSampleData(
  customers: Customer[],
  services: ServiceRecord[],
  reminders: Reminder[],
  ownerId: string,
  inventory?: InventoryItem[]
): Promise<number> {
  const sampleCustIds = customers.filter(c => c.isSampleData).map(c => c.id);
  const sampleSrvIds = services.filter(s => s.isSampleData).map(s => s.id);
  const sampleRemIds = reminders.filter(r => r.isSampleData).map(r => r.id);

  let sampleInvIds: string[] = [];
  if (inventory && inventory.length > 0) {
    sampleInvIds = inventory.filter(i => i.isSampleData).map(i => i.id);
  } else {
    try {
      const invSnap = await getDocs(query(collection(db, 'inventory'), where('isSampleData', '==', true)));
      invSnap.forEach(d => sampleInvIds.push(d.id));
    } catch (err) {
      console.warn('Could not query sample inventory items for purge:', err);
    }
  }

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
  for (const invId of sampleInvIds) {
    await deleteDoc(doc(db, 'inventory', invId));
    deletedCount++;
  }

  await recordAuditEvent('SAMPLE_DATA_PURGED', `Removed ${deletedCount} sample test documents`, 'Customer', 'sample', ownerId);
  return deletedCount;
}
