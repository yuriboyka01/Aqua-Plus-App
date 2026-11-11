import { AppSettings, ServiceCategory } from '../types/index.ts';

// Application Version & Repository Release Metadata
export const APP_VERSION = '0.0.7';
export const APP_REPO_OWNER = 'yuriboyka01';
export const APP_REPO_NAME = 'Aqua-Plus-App';
export const APP_REPO_URL = `https://github.com/${APP_REPO_OWNER}/${APP_REPO_NAME}`;
export const APP_RELEASES_URL = `${APP_REPO_URL}/releases`;
export const APP_LATEST_RELEASE_URL = `${APP_REPO_URL}/releases/latest`;
export const GITHUB_API_LATEST_RELEASE = `https://api.github.com/repos/${APP_REPO_OWNER}/${APP_REPO_NAME}/releases/latest`;

// Stable tenant key shared by the authorized Aqua Plus business accounts.
export const BUSINESS_OWNER_ID = 'aquaplus-business';

export const BUSINESS_CONFIG = {
  businessName: 'Aqua Plus RO Tech',
  location: 'Madurai, Tamil Nadu, India',
  businessAddress: 'Thirunagar 3rd Stop, near BATA showroom, Madurai-625006',
  primaryPhone: '+91 70103 29920',
  secondaryPhone: '+91 63857 86516',
  businessEmail: 'aquaplusrosales@gmail.com',
  website: 'https://www.aquaplusrotech.shop/',
  timezone: 'Asia/Kolkata',
  currency: 'INR',
  currencySymbol: '₹',
};

export const DEFAULT_SERVICE_CATEGORIES: { category: ServiceCategory; defaultDays: number; description: string }[] = [
  {
    category: 'Routine Filter Change',
    defaultDays: 90,
    description: 'Sediment and pre-carbon filter replacement with sanitization',
  },
  {
    category: 'Pre-Filter Service',
    defaultDays: 60,
    description: 'Spun cartridge clean/replacement for high-turbidity water',
  },
  {
    category: 'RO Membrane Replacement',
    defaultDays: 365,
    description: 'TFC RO Membrane renewal with flow restrictor calibration',
  },
  {
    category: 'Pump / Electrical Repair',
    defaultDays: 180,
    description: 'Booster pump, SMPS power supply, solenoid valve servicing',
  },
  {
    category: 'Full Service & Sanitization',
    defaultDays: 120,
    description: 'Complete system overhaul, tank chemical sanitization, TDS test',
  },
  {
    category: 'General Maintenance & TDS Check',
    defaultDays: 90,
    description: 'Input vs Output TDS testing, leak detection, flushing',
  },
  {
    category: 'Installation / Relocation',
    defaultDays: 90,
    description: 'New machine setup, inlet piping, baseline pressure test',
  },
  {
    category: 'Other Service',
    defaultDays: 90,
    description: 'Custom troubleshooting and component maintenance',
  },
];

export const DEFAULT_CATEGORY_INTERVALS: Record<string, number> = {
  'Routine Filter Change': 90,
  'Pre-Filter Service': 60,
  'RO Membrane Replacement': 365,
  'Pump / Electrical Repair': 180,
  'Full Service & Sanitization': 120,
  'General Maintenance & TDS Check': 90,
  'Installation / Relocation': 90,
  'Other Service': 90,
};

export const DEFAULT_WHATSAPP_TEMPLATE_EN =
  'Hello {{customer_name}}, this is Aqua Plus RO Tech, Madurai. Our records show that your RO purifier was last serviced on {{last_service_date}}. Your scheduled maintenance reminder is due. Would you like to arrange a service visit? Contact us at {{business_phone}}. Thank you for choosing Aqua Plus RO Tech.';

export const DEFAULT_WHATSAPP_TEMPLATE_TA =
  'வணக்கம் {{customer_name}}, அக்வா பிளஸ் RO டெக், மதுரை. உங்கள் RO வாட்டர் பியூரிஃபையர் கடைசியாக {{last_service_date}} அன்று சர்வீஸ் செய்யப்பட்டது. அடுத்த பராமரிப்புக்கான காலம் வந்துவிட்டது. சர்வீஸ் செய்ய விரும்பினால் எங்களை {{business_phone}} என்ற எண்ணில் தொடர்பு கொள்ளவும். நன்றி - அக்வா பிளஸ் RO டெக், மதுரை.';

export const MADURAI_LOCALITIES = [
  'Thirunagar',
  'Anna Nagar',
  'KK Nagar',
  'Villapuram',
  'K.Pudur',
  'Teppakulam',
  'Sellur',
  'Goripalayam',
  'Tallakulam',
  'Simmakkal',
  'South Gate',
  'Mahal Area',
  'Jaihindpuram',
  'Pasumalai',
  'Tirupparankunram',
  'Avaniyapuram',
  'Samayanallur',
  'Othakadai',
  'Mattuthavani',
  'Arapalayam',
  'Kalavasal',
  'SS Colony',
  'Ellis Nagar',
  'Kochadai',
];

export const POPULAR_RO_BRANDS = [
  'Aqua Plus RO (Custom)',
  'Kent RO',
  'Aquaguard (Eureka Forbes)',
  'Pureit (HUL)',
  'Havells',
  'Livpure',
  'AO Smith',
  'Blue Star',
  'V-Guard',
  'Nasaka',
  'Cruze RO',
  'Generic / Custom Assembled',
];

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'app_settings',
  businessName: BUSINESS_CONFIG.businessName,
  location: BUSINESS_CONFIG.location,
  businessAddress: BUSINESS_CONFIG.businessAddress,
  primaryPhone: BUSINESS_CONFIG.primaryPhone,
  secondaryPhone: BUSINESS_CONFIG.secondaryPhone,
  businessEmail: BUSINESS_CONFIG.businessEmail,
  website: BUSINESS_CONFIG.website,
  ownerNotificationEmail: BUSINESS_CONFIG.businessEmail,
  ownerEmailConfirmed: false,
  dailyReportTime: '09:00',
  timezone: BUSINESS_CONFIG.timezone,
  currency: BUSINESS_CONFIG.currency,
  defaultIntervalDays: 90,
  categoryIntervals: DEFAULT_CATEGORY_INTERVALS,
  whatsappTemplateEn: DEFAULT_WHATSAPP_TEMPLATE_EN,
  whatsappTemplateTa: DEFAULT_WHATSAPP_TEMPLATE_TA,
  whatsappStatus: 'not_configured',
  whatsappPhoneNumberId: '',
  whatsappBusinessAccountId: '',
  whatsappAccessTokenMasked: '',
  emailStatus: 'not_configured',
  scheduledProcessingEnabled: true,
  lastScheduledRun: '',
  ownerId: '',
  updatedAt: new Date().toISOString(),
};
