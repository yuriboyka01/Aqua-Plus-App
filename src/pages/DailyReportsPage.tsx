import React from 'react';
import {
  FileText,
  Play,
  Mail,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Eye,
  ShieldCheck,
  Server,
  Info,
  ChevronRight,
  ArrowRight,
} from 'lucide-react';
import { OwnerReport, AppSettings } from '../types';
import { formatDisplayDate, formatDisplayDateTime } from '../utils/dateUtils';

interface DailyReportsPageProps {
  reports: OwnerReport[];
  settings: AppSettings;
  onRunBatch: () => Promise<void>;
  onOpenReport: (report: OwnerReport) => void;
  batchRunning: boolean;
}

export const DailyReportsPage: React.FC<DailyReportsPageProps> = ({
  reports,
  settings,
  onRunBatch,
  onOpenReport,
  batchRunning,
}) => {
  return (
    <div className="space-y-6 max-w-7xl">
      {/* Editorial Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-[#E5DEC9] pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#5C6E67] mb-1">
            <span className="font-editorial italic text-[#1B2421]">Aqua Plus RO Tech</span>
            <span>·</span>
            <span>Morning Operational Digest</span>
            <span>·</span>
            <span className="font-mono-data text-[#2D3733] font-semibold">{reports.length} archived digests</span>
          </div>
          <h1 className="font-editorial text-2xl font-bold text-[#1B2421] tracking-tight">
            Owner Briefing Dossiers & Scheduled Processing
          </h1>
          <p className="text-xs text-[#5C6E67] mt-0.5">
            Automated morning operational summaries for Aqua Plus RO Tech owner (Scheduled at {settings.dailyReportTime || '09:00'} AM Asia/Kolkata).
          </p>
        </div>

        {/* Primary Action Button (Warm Amber) */}
        <button
          onClick={onRunBatch}
          disabled={batchRunning}
          className="px-4 py-2.5 bg-[#C25E00] hover:bg-[#A34F00] text-[#FAF8F3] text-xs font-bold rounded shadow-sm flex items-center gap-2 transition-all active:scale-98 disabled:opacity-50 shrink-0"
        >
          <Play className="w-3.5 h-3.5 text-[#FFD8B2]" />
          <span>{batchRunning ? 'Executing Batch Cycle...' : 'Run Morning Batch & Generate Report'}</span>
        </button>
      </div>

      {/* Scheduler Technical Specifications Dossier */}
      <div className="bg-[#0C231F] text-[#FAF8F3] border border-[#1A3D35] rounded-xl p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#7EE787] font-semibold text-xs">
            <Server className="w-4 h-4" />
            <span className="font-mono-data uppercase tracking-wider text-[11px]">
              Cloud Scheduler & Daily Batch Engine
            </span>
          </div>
          <span className="text-[11px] text-[#86AB9F] font-mono-data">
            Status: {settings.scheduledProcessingEnabled ? 'Active' : 'Standby'}
          </span>
        </div>

        <p className="text-xs text-[#B4CBC3] leading-relaxed max-w-3xl">
          The reminder processing routine runs independently on the server via Asia/Kolkata timezone rules. It scans eligible customer reminders, executes idempotency-guarded message dispatches, and compiles the daily digest report sent to <strong className="text-[#FAF8F3] font-mono-data">{settings.ownerNotificationEmail || 'aquaplusrosales@gmail.com'}</strong>.
        </p>

        <div className="pt-2 border-t border-[#1C3E37] flex flex-wrap items-center gap-6 text-[11px] text-[#86AB9F] font-mono-data">
          <div>
            Timezone: <strong className="text-[#FAF8F3]">Asia/Kolkata</strong>
          </div>
          <div className="w-px h-3.5 bg-[#1C3E37]" />
          <div>
            Target Delivery: <strong className="text-[#FAF8F3]">{settings.dailyReportTime} AM</strong>
          </div>
          <div className="w-px h-3.5 bg-[#1C3E37]" />
          <div>
            Last Triggered:{' '}
            <strong className="text-[#7EE787]">
              {settings.lastScheduledRun ? formatDisplayDateTime(settings.lastScheduledRun) : 'Ready for trigger'}
            </strong>
          </div>
        </div>
      </div>

      {/* Reports Ledger */}
      <div className="bg-[#FAF8F3] border border-[#E5DEC9] rounded-xl shadow-2xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#E5DEC9] bg-[#F4F0E6] flex items-center justify-between">
          <span className="text-xs font-bold text-[#1B2421]">
            Morning Operational Reports ({reports.length})
          </span>
          <span className="text-[11px] text-[#5C6E67] font-mono-data">
            Permanent Firestore History
          </span>
        </div>

        {reports.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#5C6E67] space-y-2">
            <FileText className="w-8 h-8 text-[#8C9B94] mx-auto" />
            <p className="font-semibold text-[#1B2421]">No morning reports generated yet</p>
            <p>Click "Run Morning Batch & Generate Report" above to compile your first briefing.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#EDE7DA]">
            {reports.map((rpt) => (
              <div
                key={rpt.id}
                className="p-5 hover:bg-[#F4F0E6]/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    <span className="font-editorial text-base font-bold text-[#1B2421]">
                      {formatDisplayDate(rpt.reportDate)} Briefing
                    </span>
                    <span className="text-[11px] font-mono-data text-[#165B50] font-semibold">
                      · {rpt.status === 'sent' ? 'Dispatched via Email' : 'Compiled'}
                    </span>
                  </div>

                  <p className="text-xs text-[#5C6E67]">
                    Recipient: <strong className="text-[#2D3733] font-mono-data">{rpt.recipientEmail}</strong> · Generated at{' '}
                    <span className="font-mono-data">{formatDisplayDateTime(rpt.generatedAt)}</span>
                  </p>

                  <div className="flex flex-wrap items-center gap-4 text-[11px] text-[#5C6E67] pt-1 font-mono-data">
                    <span>
                      Due Today: <strong className="text-[#B45309]">{rpt.dueToday}</strong>
                    </span>
                    <span>·</span>
                    <span>
                      Overdue: <strong className="text-[#8B1E1E]">{rpt.overdueCount}</strong>
                    </span>
                    <span>·</span>
                    <span>
                      Completed Today: <strong className="text-[#165B50]">{rpt.completedToday}</strong>
                    </span>
                    <span>·</span>
                    <span>
                      WhatsApp Accepted by Meta: <strong className="text-[#163830]">{rpt.messagesSentCount}</strong>
                    </span>
                    <span>·</span>
                    <span>
                      Manual Follow-ups: <strong>{rpt.manualFollowUpsCount}</strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onOpenReport(rpt)}
                    className="px-3.5 py-2 bg-[#163830] hover:bg-[#0E2822] text-[#FAF8F3] font-semibold rounded text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5 text-[#7EE787]" />
                    <span>View Dossier</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
