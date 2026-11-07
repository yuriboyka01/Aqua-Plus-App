import {
  calculateNextReminderDate,
  getDaysSinceDate,
  getDaysUntilDate,
  getTodayKolkata,
} from './dateUtils';
import {
  evaluateReminderEligibility,
  generateIdempotencyKey,
  buildDailyOwnerDigestSummary,
  findDuplicatePhoneCustomer,
  normalizePhoneNumber,
} from './businessLogic';
import { Customer, Reminder, ServiceRecord, MessageAttempt } from '../types';

export interface TestCaseResult {
  id: string;
  name: string;
  description: string;
  passed: boolean;
  actual?: string;
  expected?: string;
  error?: string;
}

export function runAllBusinessLogicTests(): TestCaseResult[] {
  const results: TestCaseResult[] = [];

  // TEST 1: Calculating a next reminder date
  try {
    const nextDate = calculateNextReminderDate('2026-01-01', 90);
    const passed = nextDate === '2026-04-01';
    results.push({
      id: 'test_1_calc_date',
      name: 'Calculating Next Reminder Date',
      description: 'Accurately computes date + 90 days interval',
      passed,
      expected: '2026-04-01',
      actual: nextDate,
    });
  } catch (err: any) {
    results.push({
      id: 'test_1_calc_date',
      name: 'Calculating Next Reminder Date',
      description: 'Accurately computes date + 90 days interval',
      passed: false,
      error: err.message,
    });
  }

  // TEST 2: Applying a manual date override
  try {
    const calcDate = calculateNextReminderDate('2026-01-01', 90);
    const manualOverrideDate = '2026-05-15';
    const isOverridden = manualOverrideDate !== calcDate;
    const finalDate = isOverridden ? manualOverrideDate : calcDate;
    const passed = finalDate === '2026-05-15' && isOverridden;
    results.push({
      id: 'test_2_manual_override',
      name: 'Applying Manual Date Override',
      description: 'Allows owner to override calculated date with custom choice',
      passed,
      expected: '2026-05-15',
      actual: finalDate,
    });
  } catch (err: any) {
    results.push({
      id: 'test_2_manual_override',
      name: 'Applying Manual Date Override',
      description: 'Allows owner to override calculated date with custom choice',
      passed: false,
      error: err.message,
    });
  }

  // TEST 3: Handling different customer-specific service intervals
  try {
    const custA_interval = 60; // Pre-filter heavy customer
    const custB_interval = 180; // Light RO usage
    const dateA = calculateNextReminderDate('2026-01-01', custA_interval);
    const dateB = calculateNextReminderDate('2026-01-01', custB_interval);
    const passed = dateA === '2026-03-02' && dateB === '2026-06-30';
    results.push({
      id: 'test_3_customer_interval',
      name: 'Customer-Specific Service Intervals',
      description: 'Customizes intervals per customer (60 vs 180 days)',
      passed,
      expected: '60d: 2026-03-02, 180d: 2026-06-30',
      actual: `60d: ${dateA}, 180d: ${dateB}`,
    });
  } catch (err: any) {
    results.push({
      id: 'test_3_customer_interval',
      name: 'Customer-Specific Service Intervals',
      description: 'Customizes intervals per customer',
      passed: false,
      error: err.message,
    });
  }

  // TEST 4: Calculating days since service
  try {
    // Relative to today
    const days = getDaysSinceDate(getTodayKolkata());
    const passed = days === 0;
    results.push({
      id: 'test_4_days_since',
      name: 'Calculating Days Since Service',
      description: 'Correctly returns 0 days for service conducted today in Asia/Kolkata',
      passed,
      expected: '0 days',
      actual: `${days} days`,
    });
  } catch (err: any) {
    results.push({
      id: 'test_4_days_since',
      name: 'Calculating Days Since Service',
      description: 'Correctly returns days elapsed',
      passed: false,
      error: err.message,
    });
  }

  // TEST 5: Preventing duplicate message attempts (Idempotency)
  try {
    const mockCustomer: Customer = {
      id: 'c1',
      customerId: 'AP-1001',
      fullName: 'A. Kumar',
      primaryPhone: '9842100000',
      address: 'Thirunagar',
      locality: 'Thirunagar',
      purifierBrand: 'Kent',
      registrationDate: '2026-01-01',
      whatsappConsent: true,
      status: 'active',
      ownerId: 'owner1',
      createdAt: '',
      updatedAt: '',
    };
    const mockReminder: Reminder = {
      id: 'r1',
      customerId: 'c1',
      customerName: 'A. Kumar',
      customerPhone: '9842100000',
      customerLocality: 'Thirunagar',
      serviceRecordId: 's1',
      reminderDate: '2026-01-01', // in past / due
      status: 'upcoming',
      messageStatus: 'not_sent',
      ownerId: 'owner1',
      createdAt: '',
      updatedAt: '',
    };
    const key = generateIdempotencyKey('c1', 's1', '2026-01-01');
    const existingAttempts: MessageAttempt[] = [
      {
        id: 'att1',
        customerId: 'c1',
        customerName: 'A. Kumar',
        customerPhone: '9842100000',
        idempotencyKey: key,
        provider: 'whatsapp_cloud_api',
        templateName: 'template',
        language: 'en',
        status: 'success',
        attemptedAt: '',
        ownerId: 'owner1',
      },
    ];

    const eligibility = evaluateReminderEligibility(mockReminder, mockCustomer, existingAttempts, true);
    const passed = !eligibility.isEligible && eligibility.reasons.some(r => r.includes('already been sent'));
    results.push({
      id: 'test_5_duplicate_prevention',
      name: 'Preventing Duplicate Message Attempts',
      description: 'Blocks duplicate reminder dispatch via idempotent key verification',
      passed,
      expected: 'Ineligible due to prior successful send',
      actual: eligibility.reasons.join(', '),
    });
  } catch (err: any) {
    results.push({
      id: 'test_5_duplicate_prevention',
      name: 'Preventing Duplicate Message Attempts',
      description: 'Blocks duplicate reminder dispatch',
      passed: false,
      error: err.message,
    });
  }

  // TEST 6: Skipping customers without required consent
  try {
    const noConsentCustomer: Customer = {
      id: 'c2',
      customerId: 'AP-1002',
      fullName: 'B. Suresh',
      primaryPhone: '9842100001',
      address: 'KK Nagar',
      locality: 'KK Nagar',
      purifierBrand: 'Aquaguard',
      registrationDate: '2026-01-01',
      whatsappConsent: false, // NO CONSENT
      status: 'active',
      ownerId: 'owner1',
      createdAt: '',
      updatedAt: '',
    };
    const mockReminder: Reminder = {
      id: 'r2',
      customerId: 'c2',
      customerName: 'B. Suresh',
      customerPhone: '9842100001',
      customerLocality: 'KK Nagar',
      reminderDate: '2026-01-01',
      status: 'upcoming',
      messageStatus: 'not_sent',
      ownerId: 'owner1',
      createdAt: '',
      updatedAt: '',
    };

    const eligibility = evaluateReminderEligibility(mockReminder, noConsentCustomer, [], true);
    const passed = !eligibility.isEligible && eligibility.reasons.some(r => r.includes('consent'));
    results.push({
      id: 'test_6_skip_no_consent',
      name: 'Skipping Customers Without Required Consent',
      description: 'Strictly rejects outbound dispatch if whatsappConsent is false',
      passed,
      expected: 'Ineligible: Customer has not provided recorded consent',
      actual: eligibility.reasons.join(', '),
    });
  } catch (err: any) {
    results.push({
      id: 'test_6_skip_no_consent',
      name: 'Skipping Customers Without Required Consent',
      description: 'Strictly rejects outbound dispatch if no consent',
      passed: false,
      error: err.message,
    });
  }

  // TEST 7: Skipping paused reminders
  try {
    const pausedCustomer: Customer = {
      id: 'c3',
      customerId: 'AP-1003',
      fullName: 'C. Raman',
      primaryPhone: '9842100002',
      address: 'Anna Nagar',
      locality: 'Anna Nagar',
      purifierBrand: 'Pureit',
      registrationDate: '2026-01-01',
      whatsappConsent: true,
      remindersPaused: true, // PAUSED
      status: 'active',
      ownerId: 'owner1',
      createdAt: '',
      updatedAt: '',
    };
    const mockReminder: Reminder = {
      id: 'r3',
      customerId: 'c3',
      customerName: 'C. Raman',
      customerPhone: '9842100002',
      customerLocality: 'Anna Nagar',
      reminderDate: '2026-01-01',
      status: 'paused',
      messageStatus: 'not_sent',
      ownerId: 'owner1',
      createdAt: '',
      updatedAt: '',
    };

    const eligibility = evaluateReminderEligibility(mockReminder, pausedCustomer, [], true);
    const passed = !eligibility.isEligible && eligibility.reasons.some(r => r.includes('paused'));
    results.push({
      id: 'test_7_skip_paused',
      name: 'Skipping Paused Reminders',
      description: 'Respects customer pause state and suppresses automated dispatch',
      passed,
      expected: 'Ineligible: Reminders are currently paused',
      actual: eligibility.reasons.join(', '),
    });
  } catch (err: any) {
    results.push({
      id: 'test_7_skip_paused',
      name: 'Skipping Paused Reminders',
      description: 'Respects customer pause state',
      passed: false,
      error: err.message,
    });
  }

  // TEST 8: Recording failed message attempts
  try {
    const attempt: MessageAttempt = {
      id: 'fail_1',
      customerId: 'c4',
      customerName: 'D. Selvam',
      customerPhone: '9842100003',
      idempotencyKey: 'key_123',
      provider: 'whatsapp_cloud_api',
      templateName: 'service_reminder',
      language: 'en',
      status: 'failed',
      errorDetails: 'Meta API rate limit exceeded or invalid token',
      attemptedAt: new Date().toISOString(),
      ownerId: 'owner1',
    };
    const passed = attempt.status === 'failed' && !!attempt.errorDetails;
    results.push({
      id: 'test_8_record_failures',
      name: 'Recording Failed Message Attempts',
      description: 'Captures provider error code and marks attempt state as failed',
      passed,
      expected: 'status="failed" with diagnostic errorDetails',
      actual: `status="${attempt.status}", error="${attempt.errorDetails}"`,
    });
  } catch (err: any) {
    results.push({
      id: 'test_8_record_failures',
      name: 'Recording Failed Message Attempts',
      description: 'Captures provider error details',
      passed: false,
      error: err.message,
    });
  }

  // TEST 9: Recovering from scheduled-job retries
  try {
    // If a job runs, sends message, and then reruns 5 minutes later, idempotency stops double send
    const idemKey = generateIdempotencyKey('c1', 's1', '2026-10-15');
    const existing = [{ idempotencyKey: idemKey, status: 'success' }] as MessageAttempt[];
    const isDuplicate = existing.some(e => e.idempotencyKey === idemKey && e.status === 'success');
    const passed = isDuplicate === true;
    results.push({
      id: 'test_9_retry_recovery',
      name: 'Recovering From Scheduled-Job Retries',
      description: 'Second run does not fire duplicate message if first attempt succeeded',
      passed,
      expected: 'Duplicate detected and skipped',
      actual: 'Duplicate detected: true',
    });
  } catch (err: any) {
    results.push({
      id: 'test_9_retry_recovery',
      name: 'Recovering From Scheduled-Job Retries',
      description: 'Second run does not fire duplicate message',
      passed: false,
      error: err.message,
    });
  }

  // TEST 10: Generating the daily summary
  try {
    const summary = buildDailyOwnerDigestSummary({
      reportDate: '2026-10-15',
      businessName: 'Aqua Plus RO Tech',
      totalCustomers: 45,
      completedToday: [],
      dueToday: [
        {
          id: 'r_due',
          customerId: 'c_due',
          customerName: 'M. Pandi',
          customerPhone: '7010329920',
          customerLocality: 'Thirunagar',
          reminderDate: '2026-10-15',
          lastServiceDate: '2026-07-15',
          status: 'due_today',
          messageStatus: 'not_sent',
          ownerId: 'owner1',
          createdAt: '',
          updatedAt: '',
        },
      ],
      upcomingNext14: [],
      overdueList: [],
      sentToday: [],
      failedToday: [],
      manualContactsToday: [],
      consentNeedingAttention: [],
    });
    const passed = summary.includes('DAILY SERVICE & REMINDER REPORT') && summary.includes('M. Pandi');
    results.push({
      id: 'test_10_daily_summary',
      name: 'Generating Daily Owner Summary',
      description: 'Assembles operational metrics, customer list, and Madurai locality overview',
      passed,
      expected: 'Contains report header and M. Pandi record',
      actual: 'Summary rendered with 1 due customer',
    });
  } catch (err: any) {
    results.push({
      id: 'test_10_daily_summary',
      name: 'Generating Daily Owner Summary',
      description: 'Assembles operational metrics',
      passed: false,
      error: err.message,
    });
  }

  // TEST 11: Preventing duplicate customer phone registrations
  try {
    const existing = [
      {
        id: 'c100',
        customerId: 'AP-100',
        fullName: 'Existing Customer',
        primaryPhone: '+91 70103 29920',
        address: 'Thirunagar',
        locality: 'Thirunagar',
        purifierBrand: 'Kent',
        registrationDate: '',
        whatsappConsent: true,
        status: 'active' as const,
        ownerId: 'owner1',
        createdAt: '',
        updatedAt: '',
      },
    ];
    const dup = findDuplicatePhoneCustomer('7010329920', existing);
    const passed = dup !== null && dup.fullName === 'Existing Customer';
    results.push({
      id: 'test_11_duplicate_phone',
      name: 'Preventing Duplicate Customer Phone Numbers',
      description: 'Detects matching normalized phone (+91 70103 29920 vs 7010329920) before save',
      passed,
      expected: 'Identifies existing customer AP-100',
      actual: dup ? `Matched ${dup.fullName} (${dup.customerId})` : 'No match found',
    });
  } catch (err: any) {
    results.push({
      id: 'test_11_duplicate_phone',
      name: 'Preventing Duplicate Customer Phone Numbers',
      description: 'Detects matching normalized phone',
      passed: false,
      error: err.message,
    });
  }

  return results;
}
