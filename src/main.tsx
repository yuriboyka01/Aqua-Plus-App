import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';

if (Capacitor.isNativePlatform()) {
  CapacitorUpdater.notifyAppReady().catch(console.error);
}

class ProductionErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0C231F] text-[#FAF8F3] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#143538] border border-[#1E484C] rounded-2xl p-6 space-y-4">
            <h1 className="font-editorial text-xl font-bold text-[#FF8B8B]">
              Application Runtime Error
            </h1>
            <p className="text-xs text-[#B4CBC3] font-mono-data break-words">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-[#C25E00] text-[#FAF8F3] text-xs font-bold rounded-lg"
            >
              Reload AquaPlus Service
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ProductionErrorBoundary>
      <App />
    </ProductionErrorBoundary>
  </StrictMode>
);
