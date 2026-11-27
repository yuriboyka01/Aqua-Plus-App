import React from 'react';
import { LayoutDashboard, Wrench, BellRing, ShoppingBag, Package } from 'lucide-react';
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
  const navBtnClass = (isActive: boolean) =>
    `relative flex-1 flex flex-col items-center justify-center py-1.5 px-1 min-h-12 rounded-xl transition-all ${
      isActive
        ? 'text-[#7EE787] font-semibold bg-[#174238]/70'
        : 'text-[#86AB9F] hover:text-[#FAF8F3]'
    }`;

  return (
    <nav
      aria-label="Main navigation"
      className="fixed bottom-0 inset-x-0 z-40 bg-[#0C231F]/95 backdrop-blur-md border-t border-[#1C3E37] px-1.5 pt-1.5 pb-safe md:hidden shadow-[0_-8px_24px_rgba(12,35,31,0.28)] flex items-center gap-0.5"
    >
      <button
        type="button"
        onClick={() => setActiveTab('dashboard')}
        aria-current={activeTab === 'dashboard' ? 'page' : undefined}
        className={navBtnClass(activeTab === 'dashboard')}
      >
        <LayoutDashboard className="w-4 h-4" />
        <span className="text-[10px] mt-1 leading-none">Home</span>
      </button>

      <button
        type="button"
        onClick={() => setActiveTab('inventory')}
        aria-current={activeTab === 'inventory' ? 'page' : undefined}
        className={navBtnClass(activeTab === 'inventory')}
      >
        <Package className="w-4 h-4" />
        {lowStockCount > 0 && (
          <span className="absolute top-1 right-2.5 min-w-[14px] h-3.5 px-1 rounded-full bg-[#F6D285] text-[#0C231F] font-mono-data text-[9px] font-bold flex items-center justify-center">
            {lowStockCount > 9 ? '9+' : lowStockCount}
          </span>
        )}
        <span className="text-[10px] mt-1 leading-none">Stock</span>
      </button>

      {/* Floating Center Service Recorder with Tactile Amber Accent */}
      <div className="px-1 shrink-0">
        <button
          type="button"
          onClick={onOpenRecordService}
          aria-label="Record service visit"
          className="flex items-center justify-center -mt-6 bg-[#C25E00] hover:bg-[#A34F00] text-[#FAF8F3] w-13 h-13 rounded-full shadow-lg border-2 border-[#FAF8F3] active:scale-95 transition-transform"
          title="Record Completed Service Visit"
        >
          <Wrench className="w-5 h-5" />
        </button>
      </div>

      <button
        type="button"
        onClick={() => setActiveTab('wholesale_sales')}
        aria-current={activeTab === 'wholesale_sales' ? 'page' : undefined}
        className={navBtnClass(activeTab === 'wholesale_sales')}
      >
        <ShoppingBag className="w-4 h-4" />
        <span className="text-[10px] mt-1 leading-none">Wholesale</span>
      </button>

      <button
        type="button"
        onClick={() => setActiveTab('reminders')}
        aria-current={activeTab === 'reminders' ? 'page' : undefined}
        className={navBtnClass(activeTab === 'reminders')}
      >
        <BellRing className="w-4 h-4" />
        {pendingCount > 0 && (
          <span className="absolute top-1 right-2.5 min-w-[14px] h-3.5 px-1 rounded-full bg-[#E07A5F] text-white font-mono-data text-[9px] font-bold flex items-center justify-center">
            {pendingCount > 9 ? '9+' : pendingCount}
          </span>
        )}
        <span className="text-[10px] mt-1 leading-none">Queue</span>
      </button>
    </nav>
  );
};
