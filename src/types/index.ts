export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  area?: string;
  landmark?: string;
  latitude?: number;
  longitude?: number;
  roBrand: string;
  roModel: string;
  installDate: string; // ISO date
  notes: string;
  createdAt: string;
}

export type ServiceType = 'Installation' | 'Maintenance' | 'Repair' | 'Filter Change' | 'AMC Service';

export type PaymentStatus = 'Paid' | 'Pending' | 'Partial';

export interface Service {
  id: string;
  customerId: string;
  customerName: string;
  serviceType: ServiceType;
  roBrand: string;
  roModel: string;
  serviceDate: string; // ISO date
  nextServiceDate: string; // ISO date
  workPerformed: string;
  partsReplaced: string;
  serviceCharge: number;
  paymentStatus: PaymentStatus;
  serviceIntervalDays: number;
  createdAt: string;
}

export interface ReminderItem {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  lastServiceDate: string;
  nextServiceDate: string;
  daysSinceService: number;
  daysUntilDue: number;
  status: 'upcoming' | 'due_today' | 'overdue';
  reminderSent: boolean;
}

export interface BusinessSettings {
  businessName: string;
  ownerName: string;
  defaultIntervalDays: number;
  reminderDaysBefore: number;
  whatsappEnabled: boolean;
  phone: string;
}

export interface DashboardStats {
  totalCustomers: number;
  completedToday: number;
  dueToday: number;
  overdue: number;
}
