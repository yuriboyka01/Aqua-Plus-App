import React, { useState } from 'react';
import { X, Database, Trash2, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { Customer, ServiceRecord, Reminder } from '../types';

interface SeedDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  hasSampleData: boolean;
  onSeedData: () => Promise<void>;
  onPurgeData: () => Promise<number>;
}

export const SeedDataModal: React.FC<SeedDataModalProps> = ({
  isOpen,
  onClose,
  hasSampleData,
  onSeedData,
  onPurgeData,
}) => {
  if (!isOpen) return null;

  const [loading, setLoading] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  const handleSeed = async () => {
    setLoading(true);
    setResultMsg(null);
    try {
      await onSeedData();
      setResultMsg('Successfully loaded Madurai sample customers and service history for preview.');
    } catch (err: any) {
      setResultMsg(`Error loading sample data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePurge = async () => {
    setLoading(true);
    setResultMsg(null);
    try {
      const count = await onPurgeData();
      setResultMsg(`Successfully purged all sample test records (${count} documents removed). Your database is now completely clean.`);
    } catch (err: any) {
      setResultMsg(`Error purging sample data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#0C231F]/65 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-md bg-[#FAF8F3] rounded-2xl shadow-2xl border border-[#DDD6C5] overflow-hidden my-6 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-[#0C231F] text-[#FAF8F3] flex items-center justify-between shrink-0 border-b border-[#1C3E37]">
          <div>
            <div className="text-[10px] text-[#7EE787] font-mono-data uppercase tracking-wider">
              Database Maintenance
            </div>
            <h2 className="font-editorial text-xl font-bold tracking-tight text-[#FAF8F3]">
              Sample Data Controls
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#86AB9F] hover:text-[#FAF8F3] p-1.5 rounded hover:bg-[#174238] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-xs text-[#1B2421]">
          <p className="leading-relaxed">
            In accordance with production data integrity principles, sample preview customers are tagged with an <code className="bg-[#F4F0E6] text-[#163830] px-1.5 py-0.5 rounded font-mono-data">isSampleData: true</code> flag.
          </p>

          <div className="p-3.5 bg-[#F4F0E6] border border-[#DDD6C5] rounded-xl">
            <span className="font-semibold text-[#2D3733] block mb-1">Current State:</span>
            {hasSampleData ? (
              <span className="text-[#8C4A00] font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-[#C25E00]" />
                Sample test records are currently present in your database.
              </span>
            ) : (
              <span className="text-[#163830] font-bold flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-[#165B50]" />
                Clean State: No sample data present.
              </span>
            )}
          </div>

          {resultMsg && (
            <div className="p-3 bg-[#EBF7F2] border border-[#C6EAD8] text-[#163830] rounded-lg font-medium text-xs">
              {resultMsg}
            </div>
          )}

          <div className="pt-2 space-y-2">
            {hasSampleData ? (
              <button
                type="button"
                onClick={handlePurge}
                disabled={loading}
                className="w-full py-2.5 px-4 bg-[#8B1E1E] hover:bg-[#721818] text-[#FAF8F3] font-bold rounded shadow-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{loading ? 'Cleaning...' : 'Purge All Sample Data Now'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSeed}
                disabled={loading}
                className="w-full py-2.5 px-4 bg-[#163830] hover:bg-[#0E2822] text-[#FAF8F3] font-bold rounded shadow-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4 text-[#7EE787]" />
                <span>{loading ? 'Loading...' : 'Load Madurai Sample Records'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
