import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-aquaplus-service-os';
const OWNER_EMAIL = 'nisanth.t9c@gmail.com';
const OWNER_ID = 'aquaplus-business';
let testEnv: RulesTestEnvironment;

function ownerDb() {
  return testEnv.authenticatedContext('authorized-owner', {
    email: OWNER_EMAIL,
    email_verified: true,
  }).firestore();
}

function unverifiedOwnerDb() {
  return testEnv.authenticatedContext('unverified-owner', {
    email: OWNER_EMAIL,
    email_verified: false,
  }).firestore();
}

function validCustomer(id: string, isSampleData = false) {
  return {
    id,
    customerId: isSampleData ? 'AP-SAMPLE' : 'AP-REAL',
    fullName: 'Rules Test Customer',
    primaryPhone: '9876543210',
    status: 'active',
    ownerId: OWNER_ID,
    isSampleData,
    createdAt: '2026-10-19T00:00:00.000Z',
    updatedAt: '2026-10-19T00:00:00.000Z',
  };
}

function validServiceRecord(id: string, customerId: string, isSampleData = false) {
  return {
    id,
    customerId,
    serviceDate: '2026-10-01',
    serviceCategory: 'Routine Filter Change',
    serviceCharge: 100,
    partsCharge: 50,
    totalAmount: 150,
    ownerId: OWNER_ID,
    isSampleData,
    createdAt: '2026-10-19T00:00:00.000Z',
    updatedAt: '2026-10-19T00:00:00.000Z',
  };
}

function validReminder(id: string, customerId: string, isSampleData = false) {
  return {
    id,
    customerId,
    reminderDate: '2026-10-01',
    status: 'overdue',
    messageStatus: 'not_sent',
    ownerId: OWNER_ID,
    isSampleData,
    createdAt: '2026-10-19T00:00:00.000Z',
    updatedAt: '2026-10-19T00:00:00.000Z',
  };
}

before(async () => {
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
  if (!emulatorHost) {
    throw new Error('Firestore rules tests must run through the local Firebase Emulator, not production.');
  }
  const [host, portValue] = emulatorHost.split(':');
  const port = Number(portValue);
  if (!host || !Number.isInteger(port) || port <= 0) {
    throw new Error(`Unexpected FIRESTORE_EMULATOR_HOST value: ${emulatorHost}`);
  }
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host,
      port,
      rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'),
    },
  });
});

after(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'customers', 'c-real'), validCustomer('c-real'));
    await setDoc(doc(db, 'customers', 'c-sample'), validCustomer('c-sample', true));
    await setDoc(doc(db, 'serviceRecords', 's-real'), validServiceRecord('s-real', 'c-real'));
    await setDoc(doc(db, 'serviceRecords', 's-sample'), validServiceRecord('s-sample', 'c-sample', true));
    await setDoc(doc(db, 'reminders', 'r-real'), validReminder('r-real', 'c-real'));
    await setDoc(doc(db, 'reminders', 'r-sample'), validReminder('r-sample', 'c-sample', true));
    await setDoc(doc(db, 'messageAttempts', 'm-real'), {
      id: 'm-real',
      customerId: 'c-real',
      idempotencyKey: 'c-real_s-real_2026-10-01_whatsapp',
      ownerId: OWNER_ID,
    });
  });
});

test('unauthenticated clients cannot read customer records', async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, 'customers', 'c-real')));
});

test('non-allowlisted users cannot read customer records', async () => {
  const db = testEnv.authenticatedContext('attacker', {
    email: 'attacker@example.com',
    email_verified: true,
  }).firestore();
  await assertFails(getDoc(doc(db, 'customers', 'c-real')));
});

test('allowlisted accounts must have verified email addresses', async () => {
  await assertFails(getDoc(doc(unverifiedOwnerDb(), 'customers', 'c-real')));
});

test('verified allowlisted owner can read existing business records', async () => {
  await assertSucceeds(getDoc(doc(ownerDb(), 'customers', 'c-real')));
});

test('valid owner updates to real customer, service, and reminder records remain allowed', async () => {
  const db = ownerDb();
  await assertSucceeds(updateDoc(doc(db, 'customers', 'c-real'), { fullName: 'Updated Test Customer' }));
  await assertSucceeds(updateDoc(doc(db, 'serviceRecords', 's-real'), { serviceCharge: 125, partsCharge: 50, totalAmount: 175 }));
  await assertSucceeds(updateDoc(doc(db, 'reminders', 'r-real'), { status: 'paused' }));
});

test('customer updates reject unknown fields', async () => {
  await assertFails(updateDoc(doc(ownerDb(), 'customers', 'c-real'), {
    extraMaliciousAdminFlag: true,
  }));
});

test('all service charge fields must be numeric, non-negative, and within the cap', async () => {
  const db = ownerDb();
  const serviceRef = doc(db, 'serviceRecords', 's-real');
  await assertFails(updateDoc(serviceRef, { serviceCharge: -1 }));
  await assertFails(updateDoc(serviceRef, { partsCharge: -1 }));
  await assertFails(updateDoc(serviceRef, { totalAmount: -1 }));
  await assertFails(updateDoc(serviceRef, { serviceCharge: 1_000_001 }));
  await assertFails(updateDoc(serviceRef, { partsCharge: 1_000_001 }));
  await assertFails(updateDoc(serviceRef, { totalAmount: 1_000_001 }));
  await assertFails(updateDoc(serviceRef, { serviceCharge: '100' }));
  await assertSucceeds(updateDoc(serviceRef, { serviceCharge: 125 }));
});

test('owners cannot hard-delete real customers, service records, or reminders', async () => {
  const db = ownerDb();
  await assertFails(deleteDoc(doc(db, 'customers', 'c-real')));
  await assertFails(deleteDoc(doc(db, 'serviceRecords', 's-real')));
  await assertFails(deleteDoc(doc(db, 'reminders', 'r-real')));
});

test('owners cannot promote real records to sample data to bypass delete protection', async () => {
  const db = ownerDb();
  await assertFails(updateDoc(doc(db, 'customers', 'c-real'), { isSampleData: true }));
  await assertFails(updateDoc(doc(db, 'serviceRecords', 's-real'), { isSampleData: true }));
  await assertFails(updateDoc(doc(db, 'reminders', 'r-real'), { isSampleData: true }));
  await assertFails(deleteDoc(doc(db, 'customers', 'c-real')));
  await assertFails(deleteDoc(doc(db, 'serviceRecords', 's-real')));
  await assertFails(deleteDoc(doc(db, 'reminders', 'r-real')));
});

test('owners can delete explicitly marked sample records', async () => {
  const db = ownerDb();
  await assertSucceeds(deleteDoc(doc(db, 'customers', 'c-sample')));
  await assertSucceeds(deleteDoc(doc(db, 'serviceRecords', 's-sample')));
  await assertSucceeds(deleteDoc(doc(db, 'reminders', 'r-sample')));
});

test('message-attempt history is append-only', async () => {
  const db = ownerDb();
  await assertFails(updateDoc(doc(db, 'messageAttempts', 'm-real'), { status: 'failed' }));
  await assertFails(deleteDoc(doc(db, 'messageAttempts', 'm-real')));
});

test('a superseded reminder cannot be reopened', async () => {
  const db = ownerDb();
  const reminderRef = doc(db, 'reminders', 'r-real');
  await assertSucceeds(updateDoc(reminderRef, { status: 'superseded' }));
  await assertFails(updateDoc(reminderRef, { status: 'overdue' }));
});

test('a service record must reference an existing customer', async () => {
  const db = ownerDb();
  await assertFails(setDoc(doc(db, 'serviceRecords', 's-ghost'), validServiceRecord('s-ghost', 'missing-customer')));
});

test('allowlisted owner can list collections without query filters', async () => {
  const db = ownerDb();
  await assertSucceeds(getDocs(collection(db, 'customers')));
  await assertSucceeds(getDocs(collection(db, 'serviceRecords')));
  await assertSucceeds(getDocs(collection(db, 'reminders')));
  await assertSucceeds(getDocs(collection(db, 'messageAttempts')));
  await assertSucceeds(getDocs(collection(db, 'ownerReports')));
  await assertSucceeds(getDocs(collection(db, 'auditEvents')));
});

test('unauthenticated or non-allowlisted clients cannot list collections', async () => {
  const unauthDb = testEnv.unauthenticatedContext().firestore();
  await assertFails(getDocs(collection(unauthDb, 'customers')));
  await assertFails(getDocs(collection(unauthDb, 'serviceRecords')));

  const attackerDb = testEnv.authenticatedContext('attacker', {
    email: 'attacker@example.com',
    email_verified: true,
  }).firestore();
  await assertFails(getDocs(collection(attackerDb, 'customers')));
  await assertFails(getDocs(collection(attackerDb, 'serviceRecords')));
});
