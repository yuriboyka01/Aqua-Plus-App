import React, { useState } from 'react';
import { X, FileText, Mail, Copy, Check, Calendar, Users, AlertCircle } from 'lucide-react';
import { OwnerReport } from '../types';
import { formatDisplayDate } from '../utils/dateUtils';
import { testEmailIntegration } from '../services/apiService';

interface DailyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: OwnerReport | null;
}

export const DailyReportModal: React.FC<DailyReportModalProps> = ({ isOpen, onClose, report }) => {
  if (!isOpen || !report) return null;

  const [copied, setCopied] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatusMsg, setEmailStatusMsg] = useState<string | null>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(report.summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendEmailTest = async () => {
    setSendingEmail(true);
    setEmailStatusMsg(null);
    try {
      const res = await testEmailIntegration(report.recipientEmail);
      if (res.success) {
        setEmailStatusMsg('Report email successfully dispatched to owner address.');
      } else {
        setEmailStatusMsg(res.error || 'Email SMTP credentials not configured on the server.');
      }
    } catch (err: any) {
      setEmailStatusMsg(err?.message || 'Failed to dispatch email');
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#0C231F]/65 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[#FAF8F3] rounded-2xl shadow-2xl border border-[#DDD6C5] overflow-hidden my-6 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-[#0C231F] text-[#FAF8F3] flex items-center justify-between shrink-0 border-b border-[#1C3E37]">
          <div>
            <div className="text-[10px] text-[#7EE787] font-mono-data uppercase tracking-wider">
              Morning Briefing Dossier
            </div>
            <h2 className="font-editorial text-xl font-bold tracking-tight text-[#FAF8F3]">
              Daily Operational Digest Report
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
        <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs text-[#1B2421]">
          {/* Integrated Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-[#F4F0E6] border border-[#DDD6C5] rounded-xl font-mono-data">
              <span className="text-[10px] text-[#5C6E67] block">Registered Fleet</span>
              <span className="font-bold text-sm text-[#1B2421]">{report.totalCustomers}</span>
            </div>
            <div className="p-3 bg-[#F4F0E6] border border-[#DDD6C5] rounded-xl font-mono-data">
              <span className="text-[10px] text-[#B45309] block">Due Today</span>
              <span className="font-bold text-sm text-[#B45309]">{report.dueToday}</span>
            </div>
            <div className="p-3 bg-[#F4F0E6] border border-[#DDD6C5] rounded-xl font-mono-data">
              <span className="text-[10px] text-[#8B1E1E] block">Overdue</span>
              <span className="font-bold text-sm text-[#8B1E1E]">{report.overdueCount}</span>
            </div>
            <div className="p-3 bg-[#F4F0E6] border border-[#DDD6C5] rounded-xl font-mono-data">
              <span className="text-[10px] text-[#165B50] block">Done Today</span>
              <span className="font-bold text-sm text-[#165B50]">{report.completedToday}</span>
            </div>
          </div>

          {/* Delivery Status Banner */}
          <div className="p-3 bg-[#F4F0E6] border border-[#DDD6C5] rounded-xl text-xs flex items-center justify-between">
            <div>
              <span className="text-[#5C6E67]">Recipient:</span>{' '}
              <strong className="text-[#1B2421] font-mono-data">{report.recipientEmail}</strong>
            </div>
            <span className="font-mono-data text-[11px] text-[#165B50] font-semibold">
              {report.status === 'sent' ? 'Dispatched via Email' : 'Report Compiled'}
            </span>
          </div>

          {/* Report Text Display (Industrial Terminal Box) */}
          <div className="bg-[#0C231F] text-[#E0EFEA] border border-[#1C3E37] p-4 rounded-xl font-mono-data text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-80 selection:bg-[#163830]">
            {report.summaryText}
          </div>

          {/* Email Feedback */}
          {emailStatusMsg && (
            <div className="p-3 bg-[#F4F0E6] text-[#1B2421] rounded-lg text-xs border border-[#DDD6C5] font-mono-data">
              {emailStatusMsg}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleCopy}
              className="px-3.5 py-2 bg-[#F4F0E6] hover:bg-[#EDE7DA] text-[#1B2421] text-xs font-semibold rounded border border-[#DDD6C5] flex items-center gap-1.5 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#165B50]" /> : <Copy className="w-3.5 h-3.5 text-[#165B50]" />}
              <span>{copied ? 'Copied' : 'Copy Full Report Text'}</span>
            </button>

            <button
              type="button"
              onClick={handleSendEmailTest}
              disabled={sendingEmail}
              className="px-4 py-2 bg-[#163830] hover:bg-[#0E2822] text-[#FAF8F3] text-xs font-bold rounded shadow-sm flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Mail className="w-3.5 h-3.5 text-[#7EE787]" />
              <span>{sendingEmail ? 'Connecting...' : 'Send Test Email Now'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
