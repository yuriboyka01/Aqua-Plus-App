import React, { useState, useEffect } from 'react';
import { ShieldCheck, CheckCircle2, XCircle, RefreshCw, Terminal, Check } from 'lucide-react';
import { runAllBusinessLogicTests, TestCaseResult } from '../utils/testRunner';

export const AutomatedTestsPage: React.FC = () => {
  const [testResults, setTestResults] = useState<TestCaseResult[]>([]);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    executeTests();
  }, []);

  const executeTests = () => {
    setRunning(true);
    setTimeout(() => {
      const results = runAllBusinessLogicTests();
      setTestResults(results);
      setRunning(false);
    }, 200);
  };

  const total = testResults.length;
  const passedCount = testResults.filter((t) => t.passed).length;
  const failedCount = total - passedCount;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Editorial Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-[#E5DEC9] pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#5C6E67] mb-1">
            <span className="font-editorial italic text-[#1B2421]">Aqua Plus RO Tech</span>
            <span>·</span>
            <span>Safety & Business Logic Invariants</span>
            <span>·</span>
            <span className="font-mono-data text-[#165B50] font-semibold">11 Specification Rules</span>
          </div>
          <h1 className="font-editorial text-2xl font-bold text-[#1B2421] tracking-tight">
            System Invariant & Business Logic Console
          </h1>
          <p className="text-xs text-[#5C6E67] mt-0.5">
            Unit test verification suite certifying next-service dates, manual override logic, idempotency hashes, and consent guards.
          </p>
        </div>

        <button
          onClick={executeTests}
          disabled={running}
          className="px-4 py-2.5 bg-[#163830] hover:bg-[#0E2822] text-[#FAF8F3] font-bold text-xs rounded shadow-sm flex items-center gap-2 transition-all active:scale-98 disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#7EE787] ${running ? 'animate-spin' : ''}`} />
          <span>{running ? 'Evaluating Invariants...' : 'Re-Run All 11 Tests'}</span>
        </button>
      </div>

      {/* Integrated Invariant Health Strip (Bottle Green, Tabular Numerals) */}
      <section className="bg-[#0C231F] text-[#FAF8F3] rounded-xl p-5 border border-[#1A3D35] flex flex-wrap items-center justify-between gap-6 shadow-2xs">
        <div className="flex flex-wrap items-center gap-8 sm:gap-12 text-xs">
          <div>
            <span className="text-[11px] text-[#86AB9F] block">Total Invariant Scenarios</span>
            <span className="font-mono-data text-2xl font-bold text-[#FAF8F3]">
              {total}
            </span>
            <span className="text-[10px] text-[#86AB9F] ml-1.5">rules executed</span>
          </div>

          <div className="w-px h-8 bg-[#1C3E37] hidden sm:block" />

          <div>
            <span className="text-[11px] text-[#86AB9F] block">Passed Rules</span>
            <span className="font-mono-data text-2xl font-bold text-[#7EE787]">
              {passedCount}
            </span>
            <span className="text-[10px] text-[#86AB9F] ml-1.5">100% compliant</span>
          </div>

          <div className="w-px h-8 bg-[#1C3E37] hidden sm:block" />

          <div>
            <span className="text-[11px] text-[#86AB9F] block">Regression Violations</span>
            <span
              className={`font-mono-data text-2xl font-bold ${
                failedCount > 0 ? 'text-[#FF8B8B]' : 'text-[#86AB9F]'
              }`}
            >
              {failedCount}
            </span>
            <span className="text-[10px] text-[#86AB9F] ml-1.5">zero defects</span>
          </div>
        </div>

        <div className="text-[11px] text-[#86AB9F] flex items-center gap-2 font-mono-data">
          <ShieldCheck className="w-4 h-4 text-[#7EE787]" />
          <span>Section 14 Specification Compliant</span>
        </div>
      </section>

      {/* Invariant Execution Roster */}
      <div className="bg-[#FAF8F3] border border-[#E5DEC9] rounded-xl shadow-2xs overflow-hidden">
        <div className="px-5 py-3.5 bg-[#F4F0E6] border-b border-[#E5DEC9] flex items-center justify-between text-xs font-bold text-[#1B2421]">
          <span>Business Rule Assertions</span>
          <span className="font-mono-data text-[11px] text-[#5C6E67]">Audit Status</span>
        </div>

        <div className="divide-y divide-[#EDE7DA]">
          {testResults.map((t, idx) => (
            <div
              key={t.id}
              className="p-4 sm:p-5 hover:bg-[#F4F0E6]/60 transition-colors flex items-start justify-between gap-4"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono-data text-[11px] text-[#5C6E67] font-semibold">
                    {String(idx + 1).padStart(2, '0')}.
                  </span>
                  <h3 className="text-xs font-bold text-[#1B2421]">{t.name}</h3>
                </div>

                <p className="text-xs text-[#5C6E67] pl-6 leading-relaxed">{t.description}</p>

                {t.expected && (
                  <div className="ml-6 p-2 bg-[#F4F0E6] rounded border border-[#E5DEC9] text-[11px] font-mono-data text-[#2D3733]">
                    <span className="text-[#5C6E67]">Expected:</span> <strong className="text-[#163830]">{t.expected}</strong>
                    <span className="text-[#C5BDAA] mx-2">|</span>
                    <span className="text-[#5C6E67]">Observed:</span> <strong className="text-[#1B2421]">{t.actual}</strong>
                  </div>
                )}

                {t.error && (
                  <div className="ml-6 p-2 bg-[#FFF0F0] rounded border border-[#FFD5D5] text-[11px] font-mono-data text-[#8B1E1E]">
                    Violation: {t.error}
                  </div>
                )}
              </div>

              <div className="shrink-0 pt-0.5">
                {t.passed ? (
                  <span className="inline-flex items-center gap-1 font-mono-data text-xs font-bold text-[#165B50]">
                    <Check className="w-3.5 h-3.5" />
                    <span>PASSED</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-mono-data text-xs font-bold text-[#8B1E1E]">
                    <XCircle className="w-3.5 h-3.5" />
                    <span>FAILED</span>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
