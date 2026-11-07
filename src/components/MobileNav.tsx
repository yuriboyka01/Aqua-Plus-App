import React from 'react';
import { LayoutDashboard, Users, Wrench, BellRing, Settings, Package } from 'lucide-react';
import { ActiveTab } from './Sidebar';

interface MobileNavProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenAddCustomer: () => void;
  onOpenRecordService: () => void;
  pendingCount: number;
  lowStockCount?: number;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  activeTab,
  setActiveTab,
  onOpenRecordService,
  pendingCount,
  lowStockCount = 0,
}) => {
  return (
    <nav aria-label="Main navigation" className="fixed bottom-0 inset-x-0 z-40 bg-[#0C231F] border-t border-[#1C3E37] px-2 py-2 md:hidden shadow-xl flex items-center justify-around">
      <button
        onClick={() => setActiveTab('dashboard')}
        aria-current={activeTab === 'dashboard' ? 'page' : undefined}
        className={`flex flex-col items-center justify-center py-1 px-2 rounded min-w-[60px] min-h-12 rounded-lg transition-colors ${
          activeTab === 'dashboard' ? 'text-[#7EE787] font-semibold' : 'text-[#86AB9F]'
        }`}
      >
        <LayoutDashboard className="w-5 h-5" />
        <span className="text-xs mt-1 font-medium">Home</span>
      </button>

      <button
        onClick={() => setActiveTab('customers')}
        aria-current={activeTab === 'customers' ? 'page' : undefined}
        className={`flex flex-col items-center justify-center py-1 px-2 min-w-[60px] min-h-12 rounded-lg transition-colors ${
          activeTab === 'customers' ? 'text-[#7EE787] font-semibold' : 'text-[#86AB9F]'
        }`}
      >
        <Users className="w-5 h-5" />
        <span className="text-xs mt-1 font-medium">Customers</span>
      </button>

      {/* Floating Center Service Recorder with Tactile Amber Accent */}
      <button
        onClick={onOpenRecordService}
        aria-label="Record service visit"
        className="flex flex-col items-center justify-center -mt-6 bg-[#C25E00] hover:bg-[#A34F00] text-[#FAF8F3] w-14 h-14 rounded-full shadow-lg border-2 border-[#FAF8F3] active:scale-95 transition-transform"
        title="Record Completed Service Visit"
      >
        <Wrench className="w-5 h-5" />
      </button>

      <button
        onClick={() => setActiveTab('inventory')}
        aria-current={activeTab === 'inventory' ? 'page' : undefined}
        className={`relative flex flex-col items-center justify-center py-1 px-2 min-w-[55px] min-h-12 rounded-lg transition-colors ${
          activeTab === 'inventory' ? 'text-[#7EE787] font-semibold' : 'text-[#86AB9F]'
        }`}
      >
        <Package className="w-5 h-5" />
        {lowStockCount > 0 && (
          <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-[#F6D285]" />
        )}
        <span className="text-xs mt-1 font-medium">Stock</span>
      </button>

      <button
        onClick={() => setActiveTab('reminders')}
        aria-current={activeTab === 'reminders' ? 'page' : undefined}
        className={`relative flex flex-col items-center justify-center py-1 px-2 min-w-[60px] min-h-12 rounded-lg transition-colors ${
          activeTab === 'reminders' ? 'text-[#7EE787] font-semibold' : 'text-[#86AB9F]'
        }`}
      >
        <BellRing className="w-5 h-5" />
        {pendingCount > 0 && (
          <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-[#E07A5F]" />
        )}
        <span className="text-xs mt-1 font-medium">Reminders</span>
      </button>

      <button
        onClick={() => setActiveTab('settings')}
        aria-current={activeTab === 'settings' ? 'page' : undefined}
        className={`flex flex-col items-center justify-center py-1 px-2 min-w-[60px] min-h-12 rounded-lg transition-colors ${
          activeTab === 'settings' ? 'text-[#7EE787] font-semibold' : 'text-[#86AB9F]'
        }`}
      >
        <Settings className="w-5 h-5" />
        <span className="text-xs mt-1 font-medium">Settings</span>
      </button>
    </nav>
  );
};
