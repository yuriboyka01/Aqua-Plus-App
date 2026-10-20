import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Building,
  Mail,
  Clock,
  MessageSquare,
  ShieldCheck,
  Save,
  Check,
  AlertTriangle,
  Send,
  Database,
  ExternalLink,
  Phone,
  MapPin,
  RefreshCw,
  Server,
  Globe,
  Sliders,
  FileSpreadsheet,
} from 'lucide-react';
import { AppSettings, Customer, ServiceRecord } from '../types';
import { DEFAULT_SERVICE_CATEGORIES } from '../lib/constants';
import { exportCustomersToCsv, exportServiceRecordsToCsv } from '../utils/csvExport';
import { useAuth } from '../context/AuthContext';
import {
  fetchIntegrationStatus,
  testWhatsAppIntegration,
  testEmailIntegration,
  getApiBaseUrl,
  setApiBaseUrl,
} from '../services/apiService';

interface SettingsPageProps {
  settings: AppSettings;
  onSaveSettings: (updated: Partial<AppSettings>) => Promise<void>;
  customers: Customer[];
  serviceRecords: ServiceRecord[];
  onOpenSeedDataModal: () => void;
  hasSampleData: boolean;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  settings,
  onSaveSettings,
  customers,
  serviceRecords,
  onOpenSeedDataModal,
  hasSampleData,
}) => {
  const { currentUser, isOwner } = useAuth();

  // Local state for editable settings
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  // Integration testing state
  const [integrationStatuses, setIntegrationStatuses] = useState<{
    whatsapp: { status: string; details: string };
    email: { status: string; details: string };
  }>({
    whatsapp: { status: 'not_configured', details: 'Checking status...' },
    email: { status: 'not_configured', details: 'Checking status...' },
  });

  const [testPhone, setTestPhone] = useState('7010329920');
  const [testEmail, setTestEmail] = useState('aquaplusrosales@gmail.com');
  const [testingWa, setTestingWa] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [waTestOutput, setWaTestOutput] = useState<string | null>(null);
  const [emailTestOutput, setEmailTestOutput] = useState<string | null>(null);
  const [apiBaseUrl, setApiBaseUrlState] = useState(getApiBaseUrl());
  const [apiBaseUrlSaved, setApiBaseUrlSaved] = useState(false);

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('aquaplus_api_base_url');
      if (saved && (saved.includes(' ') || saved.includes('http: /') || saved.includes('10.137.168'))) {
        localStorage.removeItem('aquaplus_api_base_url');
        setApiBaseUrlState('');
      }
    }
    loadIntegrationStatus();
  }, []);

  const loadIntegrationStatus = async () => {
    try {
      const res = await fetchIntegrationStatus();
      setIntegrationStatuses({
        whatsapp: {
          status: res.whatsapp?.status || 'not_configured',
          details: res.whatsapp?.details || 'Credentials not verified in server environment',
        },
        email: {
          status: res.email?.status || 'not_configured',
          details: res.email?.details || 'SMTP credentials not configured on server',
        },
      });
    } catch {
      // fallback
    }
  };

  const handleChange = (field: keyof AppSettings, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleCategoryIntervalChange = (category: string, days: number) => {
    setFormData((prev) => ({
      ...prev,
      categoryIntervals: {
        ...prev.categoryIntervals,
        [category]: Number(days) || 90,
      },
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);
    try {
      await onSaveSettings(formData);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      alert('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleTestWhatsApp = async () => {
    setTestingWa(true);
    setWaTestOutput(null);
    try {
      const res = await testWhatsAppIntegration(testPhone, 'AquaPlus Owner Test');
      if (res.success) {
        setWaTestOutput(`Accepted by Meta; delivery is not confirmed until a webhook status arrives. Message ID: ${res.providerMessageId}`);
      } else {
        setWaTestOutput(`Gateway response: ${res.error || 'Failed to dispatch'}`);
      }
    } catch (e: any) {
      setWaTestOutput(`Error: ${e.message}`);
    } finally {
      setTestingWa(false);
    }
  };

  const handleTestEmail = async () => {
    setTestingEmail(true);
    setEmailTestOutput(null);
    try {
      const res = await testEmailIntegration(testEmail);
      if (res.success) {
        setEmailTestOutput('Daily report test email successfully sent.');
      } else {
        setEmailTestOutput(`Provider response: ${res.error || 'Email credentials not configured'}`);
      }
    } catch (e: any) {
      setEmailTestOutput(`Error: ${e.message}`);
    } finally {
      setTestingEmail(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl pb-16">
      {/* Editorial Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-[#E5DEC9] pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#5C6E67] mb-1">
            <span className="font-editorial italic text-[#1B2421]">Aqua Plus RO Tech</span>
            <span>·</span>
            <span>Technical Configuration Sheet</span>
            <span>·</span>
            <span className="font-mono-data text-[#165B50] font-semibold">Madurai Central Office</span>
          </div>
          <h1 className="font-editorial text-2xl font-bold text-[#1B2421] tracking-tight">
            Business Identity & Operational Settings
          </h1>
          <p className="text-xs text-[#5C6E67] mt-0.5">
            Maintenance interval matrix, Meta WhatsApp Cloud API credentials, bilingual reminder templates, and daily report timing.
          </p>
        </div>

        {savedSuccess && (
          <div className="px-3.5 py-2 bg-[#EBF7F2] text-[#163830] border border-[#C6EAD8] rounded text-xs font-bold flex items-center gap-1.5 animate-in fade-in shrink-0">
            <Check className="w-4 h-4 text-[#165B50]" />
            <span>Settings Saved!</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* SECTION 1: Business Identity & Shop Profile */}
        <div className="bg-[#FAF8F3] border border-[#E5DEC9] rounded-xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[#EDE7DA] text-[#1B2421]">
            <Building className="w-4 h-4 text-[#165B50]" />
            <h2 className="font-bold text-xs">1. Business Profile & Madurai Headquarters</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-[#2D3733] mb-1">Business Name *</label>
              <input
                type="text"
                value={formData.businessName}
                onChange={(e) => handleChange('businessName', e.target.value)}
                className="w-full px-3 py-2 bg-[#F4F0E6] border border-[#DDD6C5] rounded-md focus:outline-none focus:border-[#163830] text-[#1B2421]"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-[#2D3733] mb-1">City / Region *</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => handleChange('location', e.target.value)}
                className="w-full px-3 py-2 bg-[#F4F0E6] border border-[#DDD6C5] rounded-md focus:outline-none focus:border-[#163830] text-[#1B2421]"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-[#2D3733] mb-1">Shop / Business Address *</label>
              <input
                type="text"
                value={formData.businessAddress}
                onChange={(e) => handleChange('businessAddress', e.target.value)}
                className="w-full px-3 py-2 bg-[#F4F0E6] border border-[#DDD6C5] rounded-md focus:outline-none focus:border-[#163830] text-[#1B2421]"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-[#2D3733] mb-1">Primary Business Phone *</label>
              <input
                type="text"
                value={formData.primaryPhone}
                onChange={(e) => handleChange('primaryPhone', e.target.value)}
                className="w-full px-3 py-2 bg-[#F4F0E6] border border-[#DDD6C5] rounded-md font-mono-data text-[#1B2421]"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-[#2D3733] mb-1">Secondary Business Phone</label>
              <input
                type="text"
                value={formData.secondaryPhone}
                onChange={(e) => handleChange('secondaryPhone', e.target.value)}
                className="w-full px-3 py-2 bg-[#F4F0E6] border border-[#DDD6C5] rounded-md font-mono-data text-[#1B2421]"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#2D3733] mb-1">Official Business Email</label>
              <input
                type="email"
                value={formData.businessEmail}
                onChange={(e) => handleChange('businessEmail', e.target.value)}
                className="w-full px-3 py-2 bg-[#F4F0E6] border border-[#DDD6C5] rounded-md font-mono-data text-[#1B2421]"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#2D3733] mb-1">Business Website</label>
              <input
                type="url"
                value={formData.website}
                onChange={(e) => handleChange('website', e.target.value)}
                className="w-full px-3 py-2 bg-[#F4F0E6] border border-[#DDD6C5] rounded-md text-[#1B2421]"
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: Maintenance Intervals & Scheduling Cadence */}
        <div className="bg-[#FAF8F3] border border-[#E5DEC9] rounded-xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[#EDE7DA] text-[#1B2421]">
            <Clock className="w-4 h-4 text-[#165B50]" />
            <h2 className="font-bold text-xs">2. Service Interval Matrix & Cadence Rules</h2>
          </div>

          <p className="text-xs text-[#5C6E67]">
            Default maintenance intervals in days. Each individual service record and customer can also override these defaults.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {DEFAULT_SERVICE_CATEGORIES.map((cat) => {
              const currentDays = formData.categoryIntervals?.[cat.category] || cat.defaultDays;
              return (
                <div key={cat.category} className="p-3 bg-[#F4F0E6] border border-[#DDD6C5] rounded-lg text-xs space-y-2">
                  <span className="font-semibold text-[#1B2421] block truncate">{cat.category}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="15"
                      max="730"
                      step="15"
                      value={currentDays}
                      onChange={(e) => handleCategoryIntervalChange(cat.category, Number(e.target.value))}
                      className="w-20 px-2.5 py-1 text-xs bg-[#FAF8F3] border border-[#DDD6C5] rounded font-bold font-mono-data text-[#1B2421] focus:border-[#163830]"
                    />
                    <span className="text-[#5C6E67] font-mono-data text-[11px]">days</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTION 3: Bilingual WhatsApp Reminder Templates */}
        <div className="bg-[#FAF8F3] border border-[#E5DEC9] rounded-xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[#EDE7DA] text-[#1B2421]">
            <MessageSquare className="w-4 h-4 text-[#165B50]" />
            <h2 className="font-bold text-xs">3. Bilingual WhatsApp Reminder Templates (EN & TA)</h2>
          </div>

          <div className="text-[11px] text-[#5C6E67] flex flex-wrap items-center gap-2">
            <span>Available Variables:</span>
            <code className="bg-[#F4F0E6] px-1.5 py-0.5 rounded font-mono-data text-[#163830]">{'{{customer_name}}'}</code>
            <code className="bg-[#F4F0E6] px-1.5 py-0.5 rounded font-mono-data text-[#163830]">{'{{last_service_date}}'}</code>
            <code className="bg-[#F4F0E6] px-1.5 py-0.5 rounded font-mono-data text-[#163830]">{'{{business_phone}}'}</code>
            <code className="bg-[#F4F0E6] px-1.5 py-0.5 rounded font-mono-data text-[#163830]">{'{{business_name}}'}</code>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-[#1B2421] mb-1">
                English Message Template
              </label>
              <textarea
                rows={3}
                value={formData.whatsappTemplateEn}
                onChange={(e) => handleChange('whatsappTemplateEn', e.target.value)}
                className="w-full px-3 py-2 bg-[#F4F0E6] border border-[#DDD6C5] rounded-md font-sans-ui text-xs text-[#1B2421] focus:border-[#163830]"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#1B2421] mb-1">
                Tamil Message Template (தமிழ்)
              </label>
              <textarea
                rows={3}
                value={formData.whatsappTemplateTa}
                onChange={(e) => handleChange('whatsappTemplateTa', e.target.value)}
                className="w-full px-3 py-2 bg-[#F4F0E6] border border-[#DDD6C5] rounded-md font-sans-ui text-xs text-[#1B2421] focus:border-[#163830]"
              />
            </div>
          </div>
        </div>

        {/* SECTION 4: Meta WhatsApp Cloud API Integration Adapter */}
        <div className="bg-[#FAF8F3] border border-[#E5DEC9] rounded-xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#EDE7DA]">
            <div className="flex items-center gap-2 text-[#1B2421]">
              <MessageSquare className="w-4 h-4 text-[#165B50]" />
              <h2 className="font-bold text-xs">4. Meta WhatsApp Business Cloud API Gateway</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadIntegrationStatus}
                title="Refresh integration status"
                className="text-[#165B50] hover:text-[#0E2822] p-1 rounded transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono-data text-[11px] text-[#5C6E67]">
                Status: {integrationStatuses.whatsapp.status === 'configured' ? 'Credentials present (connectivity unverified)' : 'Not configured'}
              </span>
            </div>
          </div>

          <p className="text-xs text-[#5C6E67] leading-relaxed">
            {integrationStatuses.whatsapp.details}
          </p>

          {/* Direct Cloud Gateway Mode */}
          <div className="bg-[#EBF7F2] p-3.5 rounded-lg border border-[#C6EAD8] space-y-2 text-xs text-[#163830]">
            <div className="flex items-center justify-between">
              <span className="font-bold flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-[#165B50]" />
                <span>Gateway Connection: Direct Meta Cloud API (24/7 Autonomous)</span>
              </span>
              <span className="font-mono-data text-[10px] bg-[#165B50] text-[#FAF8F3] px-2 py-0.5 rounded-full font-bold">
                Online
              </span>
            </div>
            <p className="text-[11px] text-[#2D5A4C] leading-relaxed">
              Mobile dispatches connect directly to the Meta WhatsApp Business Cloud API. No local PC, Wi-Fi IP, or manual server URL setup is required. Dispatches work seamlessly on 4G, 5G, and Wi-Fi.
            </p>

            {/* Optional Advanced URL Configuration */}
            <details className="mt-2 text-[11px] text-[#5C6E67]">
              <summary className="cursor-pointer hover:text-[#163830] font-semibold flex items-center gap-1">
                <Server className="w-3 h-3" />
                <span>Advanced: Custom Backend Server Override (Optional)</span>
              </summary>
              <div className="mt-2 pt-2 border-t border-[#C6EAD8] space-y-2">
                <p className="text-[10px] text-[#5C6E67]">
                  Leave empty to use the permanent direct Cloud API gateway.
                </p>
                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <input
                    type="url"
                    value={apiBaseUrl}
                    onChange={(e) => setApiBaseUrlState(e.target.value)}
                    placeholder="e.g. https://your-cloud-run.app or leave empty"
                    className="w-full px-3 py-1.5 text-xs bg-[#FAF8F3] border border-[#DDD6C5] rounded font-mono-data text-[#1B2421]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setApiBaseUrl(apiBaseUrl);
                      setApiBaseUrlSaved(true);
                      setTimeout(() => setApiBaseUrlSaved(false), 2500);
                      loadIntegrationStatus();
                    }}
                    className="w-full sm:w-auto px-3.5 py-1.5 bg-[#163830] hover:bg-[#0E2822] text-[#FAF8F3] font-semibold rounded text-xs flex items-center justify-center gap-1.5 transition-colors shrink-0"
                  >
                    <Check className="w-3.5 h-3.5 text-[#7EE787]" />
                    <span>{apiBaseUrlSaved ? 'Saved' : 'Save'}</span>
                  </button>
                </div>
              </div>
            </details>
          </div>

          <div className="bg-[#F4F0E6] p-3.5 rounded-lg border border-[#DDD6C5] space-y-3 text-xs">
            <span className="font-semibold text-[#2D3733] block">Live test message (restricted to WHATSAPP_TEST_RECIPIENT):</span>
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <input
                type="text"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="Phone e.g. 7010329920"
                className="w-full sm:w-60 px-3 py-1.5 text-xs bg-[#FAF8F3] border border-[#DDD6C5] rounded font-mono-data text-[#1B2421]"
              />
              <button
                type="button"
                onClick={handleTestWhatsApp}
                disabled={testingWa}
                className="w-full sm:w-auto px-3.5 py-1.5 bg-[#163830] hover:bg-[#0E2822] text-[#FAF8F3] font-semibold rounded text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5 text-[#7EE787]" />
                <span>{testingWa ? 'Testing...' : 'Test WhatsApp Gateway'}</span>
              </button>
            </div>
            {waTestOutput && (
              <p className="text-[11px] text-[#1B2421] bg-[#FAF8F3] p-2.5 rounded border border-[#DDD6C5] font-mono-data">
                {waTestOutput}
              </p>
            )}
          </div>
        </div>

        {/* SECTION 5: Owner Daily Report & Notification Schedule */}
        <div className="bg-[#FAF8F3] border border-[#E5DEC9] rounded-xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#EDE7DA]">
            <div className="flex items-center gap-2 text-[#1B2421]">
              <Mail className="w-4 h-4 text-[#165B50]" />
              <h2 className="font-bold text-xs">5. Owner Morning Digest & Email Provider</h2>
            </div>
            <span className="font-mono-data text-[11px] text-[#5C6E67]">
              Status: {integrationStatuses.email.status === 'configured' ? 'Credentials present (connectivity unverified)' : 'Not configured'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-[#2D3733] mb-1">
                Owner Digest Email Recipient *
              </label>
              <input
                type="email"
                value={formData.ownerNotificationEmail}
                onChange={(e) => handleChange('ownerNotificationEmail', e.target.value)}
                className="w-full px-3 py-2 bg-[#F4F0E6] border border-[#DDD6C5] rounded-md font-mono-data text-[#1B2421]"
                required
              />
              <p className="text-[11px] text-[#5C6E67] mt-1">
                Proposed default: aquaplusrosales@gmail.com
              </p>
            </div>

            <div>
              <label className="block font-semibold text-[#2D3733] mb-1">
                Daily Report Send Time (Asia/Kolkata)
              </label>
              <input
                type="time"
                value={formData.dailyReportTime}
                onChange={(e) => handleChange('dailyReportTime', e.target.value)}
                className="w-full px-3 py-2 bg-[#F4F0E6] border border-[#DDD6C5] rounded-md font-mono-data text-[#1B2421]"
              />
              <p className="text-[11px] text-[#5C6E67] mt-1">Proposed default: 09:00 AM</p>
            </div>
          </div>

          <div className="p-3 bg-[#F4F0E6] rounded-lg border border-[#DDD6C5] text-xs">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.ownerEmailConfirmed}
                onChange={(e) => handleChange('ownerEmailConfirmed', e.target.checked)}
                className="mt-0.5 w-4 h-4 text-[#163830] rounded"
              />
              <span className="text-[#2D3733]">
                <strong>Confirm Recipient Email Address:</strong> I confirm that{' '}
                <span className="font-mono-data">{formData.ownerNotificationEmail}</span> is the authorized owner recipient for daily service and reminder digests.
              </span>
            </label>
          </div>

          <div className="bg-[#F4F0E6] p-3.5 rounded-lg border border-[#DDD6C5] space-y-3 text-xs">
            <span className="font-semibold text-[#2D3733] block">Test Owner Email Delivery:</span>
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className="w-full sm:w-72 px-3 py-1.5 text-xs bg-[#FAF8F3] border border-[#DDD6C5] rounded font-mono-data text-[#1B2421]"
              />
              <button
                type="button"
                onClick={handleTestEmail}
                disabled={testingEmail}
                className="w-full sm:w-auto px-3.5 py-1.5 bg-[#163830] hover:bg-[#0E2822] text-[#FAF8F3] font-semibold rounded text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5 text-[#7EE787]" />
                <span>{testingEmail ? 'Sending...' : 'Send Test Digest'}</span>
              </button>
            </div>
            {emailTestOutput && (
              <p className="text-[11px] text-[#1B2421] bg-[#FAF8F3] p-2.5 rounded border border-[#DDD6C5] font-mono-data">
                {emailTestOutput}
              </p>
            )}
          </div>
        </div>

        {/* SECTION 6: Data Export & Sample Data Management */}
        <div className="bg-[#FAF8F3] border border-[#E5DEC9] rounded-xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[#EDE7DA] text-[#1B2421]">
            <Database className="w-4 h-4 text-[#165B50]" />
            <h2 className="font-bold text-xs">6. Data Export & Operational Backups</h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => exportCustomersToCsv(customers)}
              className="px-3.5 py-2 bg-[#F4F0E6] hover:bg-[#EDE7DA] text-[#1B2421] text-xs font-semibold rounded border border-[#DDD6C5] transition-colors"
            >
              Export Customers CSV ({customers.length})
            </button>

            <button
              type="button"
              onClick={() => exportServiceRecordsToCsv(serviceRecords)}
              className="px-3.5 py-2 bg-[#F4F0E6] hover:bg-[#EDE7DA] text-[#1B2421] text-xs font-semibold rounded border border-[#DDD6C5] transition-colors"
            >
              Export Service History CSV ({serviceRecords.length})
            </button>

            <button
              type="button"
              onClick={onOpenSeedDataModal}
              className="px-3.5 py-2 text-xs font-semibold rounded border border-[#DDD6C5] bg-[#F4F0E6] hover:bg-[#EDE7DA] text-[#2D3733] transition-colors"
            >
              {hasSampleData ? 'Manage / Purge Sample Data' : 'Load Sample Preview Data'}
            </button>
          </div>
        </div>

        {/* SECTION 7: Single-Owner Security Account */}
        <div className="bg-[#0C231F] text-[#FAF8F3] border border-[#1A3D35] rounded-xl p-5 shadow-2xs space-y-3 text-xs">
          <div className="flex items-center gap-2 text-[#7EE787] pb-2 border-b border-[#1C3E37]">
            <ShieldCheck className="w-4 h-4" />
            <h2 className="font-semibold text-xs font-mono-data uppercase tracking-wider">
              7. Business Account Security
            </h2>
          </div>
          <p className="text-[#B4CBC3] leading-relaxed">
            Only verified business accounts below can sign in. All authorized accounts share the same customer, service, reminder, report, and settings records.
          </p>
          <div className="bg-[#174238] p-3 rounded border border-[#23584B] space-y-1 font-mono-data text-[11px] text-[#A9C7BE]">
            <p>
              Authorized owner accounts:
            </p>
            <p className="text-[#FAF8F3]">nisanth.t9c@gmail.com</p>
            <p className="text-[#FAF8F3]">aquaplusrosales@gmail.com</p>
            <p className="text-[#FAF8F3]">vishaalchinnan@gmail.com</p>
            <p>Signed-in User UID: {currentUser?.uid || 'guest_owner'}</p>
            <p>Active Session Email: {currentUser?.email || 'Authenticated Owner'}</p>
          </div>
        </div>

        {/* Tactile Sticky Save Bar */}
        <div className="sticky bottom-4 bg-[#FAF8F3]/95 backdrop-blur-md p-4 rounded-xl border border-[#DDD6C5] shadow-lg flex items-center justify-between">
          <span className="text-xs text-[#5C6E67]">
            Ensure all parameters are saved before navigating.
          </span>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-[#C25E00] hover:bg-[#A34F00] text-[#FAF8F3] font-bold text-xs rounded shadow-sm flex items-center gap-2 transition-all active:scale-98 disabled:opacity-50"
          >
            <Save className="w-4 h-4 text-[#FFD8B2]" />
            <span>{saving ? 'Saving...' : 'Save Configuration Sheet'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
