import React, { useState } from 'react';
import {
  X,
  MessageSquare,
  Send,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Copy,
  Check,
  Globe,
} from 'lucide-react';
import { Customer, Reminder, AppSettings } from '../types';
import { renderWhatsAppMessage, generateIdempotencyKey } from '../utils/businessLogic';
import { formatDisplayDate } from '../utils/dateUtils';
import { sendWhatsAppReminder } from '../services/apiService';

interface DirectWhatsAppPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  reminder: Reminder | null;
  customer: Customer | null;
  settings: AppSettings;
}

export const DirectWhatsAppPreviewModal: React.FC<DirectWhatsAppPreviewModalProps> = ({
  isOpen,
  onClose,
  reminder,
  customer,
  settings,
}) => {
  if (!isOpen || !reminder || !customer) return null;

  const [language, setLanguage] = useState<'en' | 'ta'>('en');
  const [copied, setCopied] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [apiResult, setApiResult] = useState<{ success: boolean; message: string } | null>(null);

  const cleanPhone = customer.primaryPhone.replace(/\D/g, '');
  const waPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

  // Render message using active template
  const rawTemplate = language === 'en' ? settings.whatsappTemplateEn : settings.whatsappTemplateTa;
  const renderedMessage = renderWhatsAppMessage(rawTemplate, {
    customerName: customer.fullName,
    lastServiceDate: formatDisplayDate(reminder.lastServiceDate || customer.lastServiceDate),
    businessPhone: settings.primaryPhone,
    businessName: settings.businessName,
    purifierBrand: customer.purifierBrand,
  });

  const idempotencyKey = generateIdempotencyKey(
    customer.id,
    reminder.serviceRecordId || reminder.id,
    reminder.reminderDate
  );

  const directWhatsAppUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(renderedMessage)}`;

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(renderedMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTriggerApiSend = async () => {
    setDispatching(true);
    setApiResult(null);
    try {
      const res = await sendWhatsAppReminder(customer.id, reminder.id, language);
      if (res.success) {
        setApiResult({
          success: true,
          message: `Accepted by Meta. Delivery confirmation will appear when Meta reports it. Message ID: ${res.providerMessageId || 'Not provided'}`,
        });
      } else {
        setApiResult({
          success: false,
          message: res.error || 'Meta WhatsApp Cloud API reported a failure or credentials are not configured.',
        });
      }
    } catch (err: any) {
      setApiResult({
        success: false,
        message: err?.message || 'Failed to dispatch via Meta API',
      });
    } finally {
      setDispatching(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#0C231F]/65 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-xl bg-[#FAF8F3] rounded-2xl shadow-2xl border border-[#DDD6C5] overflow-hidden my-6 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-[#0C231F] text-[#FAF8F3] flex items-center justify-between shrink-0 border-b border-[#1C3E37]">
          <div>
            <div className="text-[10px] text-[#7EE787] font-mono-data uppercase tracking-wider">
              Outbound Client Dispatch
            </div>
            <h2 className="font-editorial text-xl font-bold tracking-tight text-[#FAF8F3]">
              WhatsApp Reminder Message
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#86AB9F] hover:text-[#FAF8F3] p-1.5 rounded hover:bg-[#174238] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto text-xs text-[#1B2421]">
          {/* Recipient Overview */}
          <div className="flex items-center justify-between bg-[#F4F0E6] p-3.5 rounded-lg border border-[#DDD6C5]">
            <div>
              <span className="text-[#5C6E67] block text-[11px]">Recipient</span>
              <strong className="text-[#1B2421] text-sm block">{customer.fullName}</strong>
              <p className="font-mono-data text-[#5C6E67] mt-0.5">
                +{waPhone} ({customer.locality})
              </p>
            </div>
            <div className="text-right">
              <span className="text-[#5C6E67] block text-[11px]">Target Service Date</span>
              <span className="font-mono-data font-bold text-[#163830]">
                {formatDisplayDate(reminder.reminderDate)}
              </span>
            </div>
          </div>

          {/* Consent Status Warning */}
          {!customer.whatsappConsent && (
            <div className="p-3 bg-[#FFF5E6] border border-[#F6D285] rounded-lg text-[#8C4A00] flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-[#C25E00] shrink-0 mt-0.5" />
              <div>
                <strong>Warning: No Recorded WhatsApp Consent</strong>
                <p className="mt-0.5 text-[11px]">
                  This customer has not recorded consent for automated WhatsApp reminders. Direct manual phone call is recommended.
                </p>
              </div>
            </div>
          )}

          {/* Language Selector (Clean Segmented Control) */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#2D3733] flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-[#165B50]" />
              Language Template:
            </span>
            <div className="flex items-center gap-1 bg-[#F4F0E6] p-1 rounded-md border border-[#DDD6C5]">
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  language === 'en'
                    ? 'bg-[#163830] text-[#FAF8F3] font-semibold'
                    : 'text-[#5C6E67] hover:text-[#1B2421]'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setLanguage('ta')}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  language === 'ta'
                    ? 'bg-[#163830] text-[#FAF8F3] font-semibold'
                    : 'text-[#5C6E67] hover:text-[#1B2421]'
                }`}
              >
                தமிழ் (Tamil)
              </button>
            </div>
          </div>

          {/* Rendered Preview Box */}
          <div className="bg-[#F4F0E6] border border-[#DDD6C5] rounded-xl p-4 relative space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#163830]">
                Outbound Message Body
              </span>
              <button
                type="button"
                onClick={handleCopyMessage}
                className="text-[11px] text-[#165B50] hover:text-[#0C231F] flex items-center gap-1 font-semibold"
              >
                {copied ? <Check className="w-3 h-3 text-[#165B50]" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy Text'}</span>
              </button>
            </div>
            <p className="text-xs text-[#1B2421] leading-relaxed whitespace-pre-line bg-[#FAF8F3] p-3.5 rounded-lg border border-[#DDD6C5] font-sans-ui">
              {renderedMessage}
            </p>
            <div className="text-[10px] text-[#5C6E67] font-mono-data flex items-center justify-between pt-1">
              <span>Idempotency Hash: {idempotencyKey.slice(0, 28)}...</span>
              <span>Template: service_maintenance_reminder</span>
            </div>
          </div>

          {/* API Response Alert */}
          {apiResult && (
            <div
              className={`p-3 rounded-lg text-xs border ${
                apiResult.success
                  ? 'bg-[#EBF7F2] text-[#163830] border-[#C6EAD8]'
                  : 'bg-[#FFF0F0] text-[#8B1E1E] border-[#FFD5D5]'
              }`}
            >
              <strong className="block mb-0.5">
                {apiResult.success ? 'Provider Accepted' : 'Provider Response / Notice'}
              </strong>
              <span>{apiResult.message}</span>
            </div>
          )}

          {/* Action Options */}
          <div className="space-y-2 pt-2">
            <div className="flex flex-col sm:flex-row items-center gap-2">
              {/* Direct Link Option (Warm Amber Accent) */}
              <a
                href={customer.whatsappConsent ? directWhatsAppUrl : undefined}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!customer.whatsappConsent}
                className={`w-full sm:flex-1 py-2.5 px-4 ${customer.whatsappConsent ? 'bg-[#C25E00] hover:bg-[#A34F00]' : 'bg-[#8B8D8C] cursor-not-allowed'} text-[#FAF8F3] text-xs font-bold rounded shadow-sm flex items-center justify-center gap-2 transition-all active:scale-98 text-center`}
              >
                <ExternalLink className="w-4 h-4 text-[#FFD8B2]" />
                <span>{customer.whatsappConsent ? 'Open in WhatsApp (Direct)' : 'WhatsApp consent required'}</span>
              </a>

              {/* Meta Cloud API Send */}
              <button
                type="button"
                onClick={handleTriggerApiSend}
                disabled={dispatching || !customer.whatsappConsent}
                className="w-full sm:flex-1 py-2.5 px-4 bg-[#163830] hover:bg-[#0E2822] disabled:opacity-50 text-[#FAF8F3] text-xs font-bold rounded shadow-sm flex items-center justify-center gap-2 transition-colors"
              >
                <Send className="w-4 h-4 text-[#7EE787]" />
                <span>{dispatching ? 'Verifying Gateway...' : 'Send via Meta Cloud API'}</span>
              </button>
            </div>

            <p className="text-[11px] text-[#5C6E67] text-center">
              "Open in WhatsApp" directly launches WhatsApp Web or mobile app with the pre-composed template.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
