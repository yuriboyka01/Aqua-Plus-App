export type ServiceCategory =
  | 'Routine Filter Change'
  | 'Pre-Filter Service'
  | 'RO Membrane Replacement'
  | 'Pump / Electrical Repair'
  | 'Full Service & Sanitization'
  | 'General Maintenance & TDS Check'
  | 'Installation / Relocation'
  | 'Other Service';

export type PaymentStatus = 'Paid' | 'Pending' | 'Partial';

export type CustomerStatus = 'active' | 'archived';

export type ReminderStatus =
  | 'upcoming'
  | 'due_today'
  | 'overdue'
  | 'paused'
  | 'sent'
  | 'failed'
  | 'contacted_manually'
  | 'superseded';

export type MessageDispatchStatus = 'not_sent' | 'pending' | 'sent' | 'failed';

export type GatewayConfigStatus =
  | 'not_configured'
  | 'configured'
  | 'connected'
  | 'disabled'
  | 'error';

export interface Customer {
  id: string;
  customerId: string; // e.g. "AP-1001"
  fullName: string;
  primaryPhone: string;
  alternatePhone?: string;
  address: string;
  locality: string; // Madurai area like Thirunagar, Anna Nagar, KK Nagar
  customerNotes?: string;
  purifierBrand: string; // e.g. Kent, Aquaguard, Pureit, Havells, Livpure, Aqua Plus
  purifierModel?: string;
  installationDate?: string; // YYYY-MM-DD
  registrationDate: string; // YYYY-MM-DD
  whatsappConsent: boolean;
  emailConsent?: boolean;
  consentTimestamp?: string;
  consentSource?: string; // e.g., "In-person visit", "Phone agreement", "Work order form"
  status: CustomerStatus;
  defaultIntervalDays?: number; // Customer specific override, e.g. 90
  lastServiceDate?: string; // YYYY-MM-DD
  nextReminderDate?: string; // YYYY-MM-DD
  remindersPaused?: boolean;
  isSampleData?: boolean;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceRecord {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  serviceDate: string; // YYYY-MM-DD
  serviceCategory: ServiceCategory;
  problemReported?: string;
  workPerformed: string;
  filtersReplaced?: string;
  serviceCharge: number;
  partsCharge: number;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  technicianNotes?: string;
  recommendedIntervalDays: number;
  calculatedNextReminderDate: string; // YYYY-MM-DD
  nextReminderDate: string; // YYYY-MM-DD (actual or manual override)
  isDateOverridden: boolean;
  internalNotes?: string;
  isSampleData?: boolean;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Reminder {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerLocality: string;
  serviceRecordId?: string;
  serviceCategory?: ServiceCategory;
  lastServiceDate?: string;
  reminderDate: string; // YYYY-MM-DD
  status: ReminderStatus;
  manualContactNotes?: string;
  manualContactDate?: string;
  lastAttemptDate?: string;
  messageStatus: MessageDispatchStatus;
  errorMessage?: string;
  isSampleData?: boolean;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface MessageAttempt {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  reminderId?: string;
  serviceRecordId?: string;
  idempotencyKey: string;
  provider: 'whatsapp_cloud_api' | 'manual_phone_call' | 'fallback_link';
  templateName: string;
  language: 'en' | 'ta';
  status: 'success' | 'failed' | 'unknown' | 'simulated_blocked';
  providerMessageId?: string;
  providerDeliveryStatus?: 'sent' | 'delivered' | 'read' | 'failed';
  errorDetails?: string;
  attemptedAt: string;
  ownerId: string;
}

export interface MessageDeliveryEvent {
  id: string;
  providerMessageId: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipientPhone?: string;
  errorCode?: string;
  createdAt: string;
}

export interface OwnerReport {
  id: string;
  reportDate: string; // YYYY-MM-DD
  generatedAt: string;
  recipientEmail: string;
  status: 'generated' | 'sent' | 'failed' | 'not_configured';
  totalCustomers: number;
  completedToday: number;
  dueToday: number;
  upcomingCount: number;
  overdueCount: number;
  messagesSentCount: number;
  messagesFailedCount: number;
  manualFollowUpsCount: number;
  consentAttentionCount: number;
  summaryText: string;
  ownerId: string;
}

export interface AppSettings {
  id: string;
  businessName: string;
  location: string;
  businessAddress: string;
  primaryPhone: string;
  secondaryPhone: string;
  businessEmail: string;
  website: string;
  ownerNotificationEmail: string;
  ownerEmailConfirmed: boolean;
  dailyReportTime: string; // e.g. "09:00"
  timezone: string; // "Asia/Kolkata"
  currency: string; // "INR"
  defaultIntervalDays: number; // e.g. 90
  categoryIntervals: Record<string, number>;
  whatsappTemplateEn: string;
  whatsappTemplateTa: string;
  whatsappStatus: GatewayConfigStatus;
  whatsappPhoneNumberId?: string;
  whatsappBusinessAccountId?: string;
  whatsappAccessTokenMasked?: string;
  emailStatus: GatewayConfigStatus;
  scheduledProcessingEnabled: boolean;
  lastScheduledRun?: string;
  ownerId: string;
  updatedAt: string;
}

export interface AuditEvent {
  id: string;
  action: string;
  details: string;
  entityType: 'Customer' | 'ServiceRecord' | 'Reminder' | 'Settings' | 'BatchScheduler';
  entityId?: string;
  ownerId: string;
  timestamp: string;
}

export interface DashboardMetrics {
  totalCustomers: number;
  servicesCompletedThisMonth: number;
  servicesDueToday: number;
  servicesDueSoon: number; // next 14 days
  overdueFollowUps: number;
  messagesSentSuccessfully: number;
  failedMessagesRequiringAttention: number;
  contactedManuallyCount: number;
}
