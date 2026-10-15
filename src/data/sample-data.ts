import {
  BusinessSettings,
  Customer,
  DashboardStats,
  ReminderItem,
  Service,
} from '@/types';

export const TODAY = '2026-10-14';

export const sampleCustomers: Customer[] = [
  {
    id: 'c1',
    name: 'Murugan Sundaram',
    phone: '9842156780',
    address: '14, East Veli Street, Simmakkal, Madurai - 625001',
    area: 'Simmakkal',
    landmark: 'Near Periyar Bus Stand / Meenakshi Temple',
    latitude: 9.9252,
    longitude: 78.1198,
    roBrand: 'Kent',
    roModel: 'Grand Plus RO+UV',
    installDate: '2024-03-15',
    notes: 'Prefers morning service between 9 AM and 11 AM.',
    createdAt: '2024-03-15T09:00:00.000Z',
  },
  {
    id: 'c2',
    name: 'Kavitha Ramachandran',
    phone: '9443218765',
    address: '28, 4th Cross Street, KK Nagar, Madurai - 625020',
    area: 'KK Nagar',
    landmark: 'Opposite Apollo Hospital / 4th Cross',
    latitude: 9.9328,
    longitude: 78.1504,
    roBrand: 'Aquaguard',
    roModel: 'Geneus Alkaline',
    installDate: '2024-08-20',
    notes: 'High TDS borewell water area (around 950 ppm).',
    createdAt: '2024-08-20T10:30:00.000Z',
  },
  {
    id: 'c3',
    name: 'Senthil Kumar',
    phone: '9789012345',
    address: '5, Alagar Kovil Main Road, Tallakulam, Madurai - 625002',
    area: 'Tallakulam',
    landmark: 'Alagar Kovil Rd, Near Outpost Police Station',
    latitude: 9.9366,
    longitude: 78.1347,
    roBrand: 'Pureit',
    roModel: 'Copper+ Eco Mineral RO',
    installDate: '2025-01-10',
    notes: 'Annual Maintenance Contract customer.',
    createdAt: '2025-01-10T11:00:00.000Z',
  },
  {
    id: 'c4',
    name: 'Meenakshi Sundaresan',
    phone: '8903456712',
    address: '42, North Masi Street, Madurai - 625001',
    area: 'North Masi',
    landmark: 'Near Town Hall Rd junction',
    latitude: 9.9234,
    longitude: 78.1165,
    roBrand: 'LivPure',
    roModel: 'Glo Star RO+UV+Mineralizer',
    installDate: '2024-11-05',
    notes: 'Sediment filter clogs quickly due to borewell silt.',
    createdAt: '2024-11-05T14:15:00.000Z',
  },
  {
    id: 'c5',
    name: 'Karthik Raja',
    phone: '9865098765',
    address: '12B, Kuruvikaran Salai, Anna Nagar, Madurai - 625020',
    area: 'Anna Nagar',
    landmark: 'Near Ambika Theatre / Kuruvikaran Salai',
    latitude: 9.9189,
    longitude: 78.1481,
    roBrand: 'AO Smith',
    roModel: 'Z9 Green RO',
    installDate: '2025-02-18',
    notes: 'Under company warranty until February 2027.',
    createdAt: '2025-02-18T16:00:00.000Z',
  },
  {
    id: 'c6',
    name: 'Anitha Vijayakumar',
    phone: '7373012984',
    address: '8/21, Bypass Road, Ponmeni, Madurai - 625016',
    area: 'Ponmeni',
    landmark: 'Near Bypass Rd flyover',
    latitude: 9.9095,
    longitude: 78.0932,
    roBrand: 'Blue Star',
    roModel: 'Aristo RO+UV',
    installDate: '2024-05-12',
    notes: 'Needs WhatsApp reminder 3 days in advance.',
    createdAt: '2024-05-12T10:00:00.000Z',
  },
  {
    id: 'c7',
    name: 'Balasubramanian R.',
    phone: '9488234510',
    address: '19, Vaigai Vadakarai, Sellur, Madurai - 625002',
    area: 'Sellur',
    landmark: 'Vaigai Vadakarai bank',
    latitude: 9.9392,
    longitude: 78.1215,
    roBrand: 'Kent',
    roModel: 'Prime Plus Alkaline',
    installDate: '2025-04-02',
    notes: 'Commercial tea shop installation.',
    createdAt: '2025-04-02T08:30:00.000Z',
  },
  {
    id: 'c8',
    name: 'Priya Dharshini',
    phone: '9944512398',
    address: '67, Melakkal Main Road, Kochadai, Madurai - 625016',
    area: 'Kochadai',
    landmark: 'Near Fenner India / Melakkal Main Rd',
    latitude: 9.9287,
    longitude: 78.0821,
    roBrand: 'Aquaguard',
    roModel: 'Enhance RO+UV',
    installDate: '2024-09-14',
    notes: 'Requested technician to check inlet tap pressure.',
    createdAt: '2024-09-14T15:20:00.000Z',
  },
  {
    id: 'c9',
    name: 'Saravanan Pandian',
    phone: '8122345670',
    address: '103, Agrini Apartments, Andalpuram, Madurai - 625003',
    area: 'Andalpuram',
    landmark: 'Opposite Agrini Club House',
    latitude: 9.9042,
    longitude: 78.0991,
    roBrand: 'Pureit',
    roModel: 'Ultima Mineral RO+UV',
    installDate: '2025-03-25',
    notes: 'Always pays immediately via GPay / UPI.',
    createdAt: '2025-03-25T12:00:00.000Z',
  },
  {
    id: 'c10',
    name: 'Lakshmi Narayanan',
    phone: '9655123489',
    address: '31, South Veli Street, South Gate, Madurai - 625001',
    area: 'South Gate',
    landmark: 'Near South Gate police junction',
    latitude: 9.9145,
    longitude: 78.1189,
    roBrand: 'LivPure',
    roModel: 'Bolt+ Star Alkaline',
    installDate: '2024-06-30',
    notes: 'Water booster pump also checked during service.',
    createdAt: '2024-06-30T17:00:00.000Z',
  },
  {
    id: 'c11',
    name: 'Venkatesh Babu',
    phone: '9003412876',
    address: '4A, GST Road, Thirunagar, Madurai - 625006',
    area: 'Thirunagar',
    landmark: 'Opposite Thirunagar 3rd Stop',
    latitude: 9.8795,
    longitude: 78.0754,
    roBrand: 'AO Smith',
    roModel: 'ProPlanet P4',
    installDate: '2025-05-10',
    notes: 'Prefers weekend appointments.',
    createdAt: '2025-05-10T09:30:00.000Z',
  },
  {
    id: 'c12',
    name: 'Revathi Muthu',
    phone: '9843076512',
    address: '55, Main Road, Villapuram, Madurai - 625012',
    area: 'Villapuram',
    landmark: 'Near Housing Board Bus Terminus',
    latitude: 9.8974,
    longitude: 78.1256,
    roBrand: 'Blue Star',
    roModel: 'Majesty RO+UV',
    installDate: '2024-12-01',
    notes: 'Elderly customer, call 30 mins before arrival.',
    createdAt: '2024-12-01T11:45:00.000Z',
  },
];

export const sampleServices: Service[] = [
  {
    id: 's1',
    customerId: 'c1',
    customerName: 'Murugan Sundaram',
    serviceType: 'Filter Change',
    roBrand: 'Kent',
    roModel: 'Grand Plus RO+UV',
    serviceDate: '2026-10-14',
    nextServiceDate: '2027-01-12',
    workPerformed: 'Replaced sediment filter and pre-carbon filter. Checked membrane TDS.',
    partsReplaced: 'Spun Filter 5 Micron, Carbon Block',
    serviceCharge: 850,
    paymentStatus: 'Paid',
    serviceIntervalDays: 90,
    createdAt: '2026-10-14T10:30:00.000Z',
  },
  {
    id: 's2',
    customerId: 'c2',
    customerName: 'Kavitha Ramachandran',
    serviceType: 'Maintenance',
    roBrand: 'Aquaguard',
    roModel: 'Geneus Alkaline',
    serviceDate: '2026-10-14',
    nextServiceDate: '2027-01-12',
    workPerformed: 'Full system descaling, tube sanitization, output TDS adjusted to 120 ppm.',
    partsReplaced: 'Alkaline Cartridge Recharge',
    serviceCharge: 650,
    paymentStatus: 'Paid',
    serviceIntervalDays: 90,
    createdAt: '2026-10-14T12:00:00.000Z',
  },
  {
    id: 's3',
    customerId: 'c3',
    customerName: 'Senthil Kumar',
    serviceType: 'AMC Service',
    roBrand: 'Pureit',
    roModel: 'Copper+ Eco Mineral RO',
    serviceDate: '2026-07-16',
    nextServiceDate: '2026-10-14',
    workPerformed: 'Quarterly AMC inspection, flow rate check, UV lamp testing.',
    partsReplaced: 'None (Under AMC)',
    serviceCharge: 0,
    paymentStatus: 'Paid',
    serviceIntervalDays: 90,
    createdAt: '2026-07-16T11:15:00.000Z',
  },
  {
    id: 's4',
    customerId: 'c4',
    customerName: 'Meenakshi Sundaresan',
    serviceType: 'Filter Change',
    roBrand: 'LivPure',
    roModel: 'Glo Star RO+UV+Mineralizer',
    serviceDate: '2026-07-16',
    nextServiceDate: '2026-10-14',
    workPerformed: 'Sediment filter replacement, auto-flushing check.',
    partsReplaced: 'Sediment Candle 10 inch',
    serviceCharge: 450,
    paymentStatus: 'Paid',
    serviceIntervalDays: 90,
    createdAt: '2026-07-16T14:40:00.000Z',
  },
  {
    id: 's5',
    customerId: 'c5',
    customerName: 'Karthik Raja',
    serviceType: 'Repair',
    roBrand: 'AO Smith',
    roModel: 'Z9 Green RO',
    serviceDate: '2026-07-01',
    nextServiceDate: '2026-09-29',
    workPerformed: 'Booster pump connector repair, leak sealing.',
    partsReplaced: 'Elbow Connectors, Teflon Tape',
    serviceCharge: 700,
    paymentStatus: 'Paid',
    serviceIntervalDays: 90,
    createdAt: '2026-07-01T15:00:00.000Z',
  },
  {
    id: 's6',
    customerId: 'c6',
    customerName: 'Anitha Vijayakumar',
    serviceType: 'Filter Change',
    roBrand: 'Blue Star',
    roModel: 'Aristo RO+UV',
    serviceDate: '2026-06-16',
    nextServiceDate: '2026-09-14',
    workPerformed: 'Sediment and pre-carbon replaced, taste adjuster tuned.',
    partsReplaced: 'Sediment + Pre-carbon Filter Pack',
    serviceCharge: 950,
    paymentStatus: 'Paid',
    serviceIntervalDays: 90,
    createdAt: '2026-06-16T09:45:00.000Z',
  },
  {
    id: 's7',
    customerId: 'c7',
    customerName: 'Balasubramanian R.',
    serviceType: 'Maintenance',
    roBrand: 'Kent',
    roModel: 'Prime Plus Alkaline',
    serviceDate: '2026-07-11',
    nextServiceDate: '2026-10-09',
    workPerformed: 'Commercial unit high-pressure pump service and post-carbon flush.',
    partsReplaced: 'Post Carbon Filter',
    serviceCharge: 1200,
    paymentStatus: 'Partial',
    serviceIntervalDays: 90,
    createdAt: '2026-07-11T13:20:00.000Z',
  },
  {
    id: 's8',
    customerId: 'c8',
    customerName: 'Priya Dharshini',
    serviceType: 'Maintenance',
    roBrand: 'Aquaguard',
    roModel: 'Enhance RO+UV',
    serviceDate: '2026-07-22',
    nextServiceDate: '2026-10-20',
    workPerformed: 'UV lamp voltage check, clean water tank washed.',
    partsReplaced: 'None',
    serviceCharge: 350,
    paymentStatus: 'Paid',
    serviceIntervalDays: 90,
    createdAt: '2026-07-22T16:10:00.000Z',
  },
  {
    id: 's9',
    customerId: 'c9',
    customerName: 'Saravanan Pandian',
    serviceType: 'Filter Change',
    roBrand: 'Pureit',
    roModel: 'Ultima Mineral RO+UV',
    serviceDate: '2026-07-28',
    nextServiceDate: '2026-10-26',
    workPerformed: 'German III stage kit renewal.',
    partsReplaced: 'Pureit Germkill Kit 2',
    serviceCharge: 1600,
    paymentStatus: 'Paid',
    serviceIntervalDays: 90,
    createdAt: '2026-07-28T10:00:00.000Z',
  },
  {
    id: 's10',
    customerId: 'c10',
    customerName: 'Lakshmi Narayanan',
    serviceType: 'Repair',
    roBrand: 'LivPure',
    roModel: 'Bolt+ Star Alkaline',
    serviceDate: '2026-08-05',
    nextServiceDate: '2026-11-03',
    workPerformed: 'Solenoid valve replacement and booster pump wiring repair.',
    partsReplaced: 'SV 24V DC Valve',
    serviceCharge: 850,
    paymentStatus: 'Pending',
    serviceIntervalDays: 90,
    createdAt: '2026-08-05T17:30:00.000Z',
  },
  {
    id: 's11',
    customerId: 'c11',
    customerName: 'Venkatesh Babu',
    serviceType: 'Installation',
    roBrand: 'AO Smith',
    roModel: 'ProPlanet P4',
    serviceDate: '2026-08-10',
    nextServiceDate: '2026-11-08',
    workPerformed: 'New unit installation with 3-way diverter valve and input pressure test.',
    partsReplaced: 'Brass Diverter Valve, 5m Tubing',
    serviceCharge: 600,
    paymentStatus: 'Paid',
    serviceIntervalDays: 90,
    createdAt: '2026-08-10T14:00:00.000Z',
  },
  {
    id: 's12',
    customerId: 'c12',
    customerName: 'Revathi Muthu',
    serviceType: 'AMC Service',
    roBrand: 'Blue Star',
    roModel: 'Majesty RO+UV',
    serviceDate: '2026-08-30',
    nextServiceDate: '2026-11-28',
    workPerformed: 'Routine AMC service, TDS balance check (borewell water 820 -> 90 ppm).',
    partsReplaced: 'None',
    serviceCharge: 0,
    paymentStatus: 'Paid',
    serviceIntervalDays: 90,
    createdAt: '2026-08-30T11:00:00.000Z',
  },
  {
    id: 's13',
    customerId: 'c1',
    customerName: 'Murugan Sundaram',
    serviceType: 'Maintenance',
    roBrand: 'Kent',
    roModel: 'Grand Plus RO+UV',
    serviceDate: '2026-05-10',
    nextServiceDate: '2026-08-08',
    workPerformed: 'General service and tank wash.',
    partsReplaced: 'None',
    serviceCharge: 300,
    paymentStatus: 'Paid',
    serviceIntervalDays: 90,
    createdAt: '2026-05-10T10:00:00.000Z',
  },
  {
    id: 's14',
    customerId: 'c2',
    customerName: 'Kavitha Ramachandran',
    serviceType: 'Filter Change',
    roBrand: 'Aquaguard',
    roModel: 'Geneus Alkaline',
    serviceDate: '2026-05-15',
    nextServiceDate: '2026-08-13',
    workPerformed: 'Pre-filter candle replacement.',
    partsReplaced: 'Spun Filter',
    serviceCharge: 350,
    paymentStatus: 'Paid',
    serviceIntervalDays: 90,
    createdAt: '2026-05-15T15:30:00.000Z',
  },
  {
    id: 's15',
    customerId: 'c3',
    customerName: 'Senthil Kumar',
    serviceType: 'Repair',
    roBrand: 'Pureit',
    roModel: 'Copper+ Eco Mineral RO',
    serviceDate: '2026-04-18',
    nextServiceDate: '2026-07-16',
    workPerformed: 'Replaced adapter SMPS power supply.',
    partsReplaced: '24V 2.5A SMPS Power Supply',
    serviceCharge: 950,
    paymentStatus: 'Paid',
    serviceIntervalDays: 90,
    createdAt: '2026-04-18T16:45:00.000Z',
  },
];

export function calculateNextServiceDate(serviceDate: string, intervalDays: number): string {
  const datePart = serviceDate.split('T')[0];
  const [year, month, day] = datePart.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + intervalDays);
  return d.toISOString().split('T')[0];
}

export function formatDate(isoDate: string): string {
  if (!isoDate) return '';
  const datePart = isoDate.split('T')[0];
  const parts = datePart.split('-');
  if (parts.length !== 3) return isoDate;
  const [yearStr, monthStr, dayStr] = parts;
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const day = parseInt(dayStr, 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return isoDate;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const formattedDay = day < 10 ? `0${day}` : `${day}`;
  return `${formattedDay} ${months[month]} ${year}`;
}

export function getDaysDifference(date1: string, date2: string): number {
  const d1Part = date1.split('T')[0].split('-').map(Number);
  const d2Part = date2.split('T')[0].split('-').map(Number);
  const utc1 = Date.UTC(d1Part[0], d1Part[1] - 1, d1Part[2]);
  const utc2 = Date.UTC(d2Part[0], d2Part[1] - 1, d2Part[2]);
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((utc2 - utc1) / msPerDay);
}

export function getCustomerById(id: string): Customer | undefined {
  return sampleCustomers.find((c) => c.id === id);
}

export function getServicesByCustomerId(id: string): Service[] {
  return sampleServices.filter((s) => s.customerId === id);
}

// Derive active reminders from the latest service for each customer
function generateReminders(): ReminderItem[] {
  // Map customers to their latest service
  const latestServiceMap = new Map<string, Service>();
  for (const s of sampleServices) {
    const existing = latestServiceMap.get(s.customerId);
    if (!existing || s.serviceDate > existing.serviceDate) {
      latestServiceMap.set(s.customerId, s);
    }
  }

  const reminders: ReminderItem[] = [];

  for (const customer of sampleCustomers) {
    const service = latestServiceMap.get(customer.id);
    const lastServiceDate = service ? service.serviceDate : customer.installDate;
    const nextServiceDate = service
      ? service.nextServiceDate
      : calculateNextServiceDate(customer.installDate, 90);

    const daysSinceService = getDaysDifference(lastServiceDate, TODAY);
    const daysUntilDue = getDaysDifference(TODAY, nextServiceDate);

    let status: 'upcoming' | 'due_today' | 'overdue';
    if (daysUntilDue < 0) {
      status = 'overdue';
    } else if (daysUntilDue === 0) {
      status = 'due_today';
    } else {
      status = 'upcoming';
    }

    reminders.push({
      id: `rem-${customer.id}`,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      lastServiceDate,
      nextServiceDate,
      daysSinceService,
      daysUntilDue,
      status,
      reminderSent: daysUntilDue <= 0,
    });
  }

  return reminders.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
}

export const sampleReminders: ReminderItem[] = generateReminders();

export const defaultSettings: BusinessSettings = {
  businessName: 'Aqua Plus RO Tech',
  ownerName: 'Nisanth',
  defaultIntervalDays: 90,
  reminderDaysBefore: 3,
  whatsappEnabled: true,
  phone: '7010329920',
};

export const sampleDashboardStats: DashboardStats = {
  totalCustomers: sampleCustomers.length,
  completedToday: sampleServices.filter((s) => s.serviceDate === TODAY).length,
  dueToday: sampleReminders.filter((r) => r.status === 'due_today').length,
  overdue: sampleReminders.filter((r) => r.status === 'overdue').length,
};
