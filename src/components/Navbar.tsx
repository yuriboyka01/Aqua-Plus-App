import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Plus,
  Wrench,
  Calendar,
  LogIn,
  LogOut,
  Database,
  CheckCircle2,
  X,
  History,
  Settings,
  ShoppingBag,
} from 'lucide-react';
import { formatDisplayDate, getTodayKolkata } from '../utils/dateUtils';
import { ActiveTab } from './Sidebar';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onOpenAddCustomer: () => void;
  onOpenRecordService: () => void;
  onOpenSeedDataModal: () => void;
  hasSampleData: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  searchQuery,
  setSearchQuery,
  onOpenAddCustomer,
  onOpenRecordService,
  onOpenSeedDataModal,
  hasSampleData,
}) => {
  const todayStr = getTodayKolkata();
  const { currentUser, signInWithGoogle, logOut } = useAuth();
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);

  // Global Ctrl+K / Cmd+K search shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (window.innerWidth < 640) {
          setMobileSearchOpen(true);
          setTimeout(() => mobileSearchInputRef.current?.focus(), 50);
        } else {
          searchInputRef.current?.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (
      activeTab !== 'customers' &&
      activeTab !== 'inventory' &&
      activeTab !== 'wholesale_sales' &&
      value.trim().length > 0
    ) {
      setActiveTab('customers');
    }
  };

  const getSearchPlaceholder = (defaultPlaceholder: string) => {
    if (activeTab === 'inventory') return 'Search spare parts, categories, bins...';
    if (activeTab === 'wholesale_sales') return 'Search wholesale bills, technicians, spare parts...';
    return defaultPlaceholder;
  };

  return (
    <header className="sticky top-0 z-20 bg-[#FAF8F3]/95 backdrop-blur-md border-b border-[#E5DEC9]">
      <div className="px-4 lg:px-8 h-18 flex items-center justify-between gap-4">
        {/* Brand & Mobile Title */}
        <div className="flex items-center gap-3">
          <div className="md:hidden flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-md bg-white border border-[#D5CDBC] flex items-center justify-center overflow-hidden shrink-0">
              <img src="/aqua-plus-logo.jpg" alt="Aqua Plus RO Tech" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <span className="font-editorial font-bold text-[#0E2822] text-sm tracking-tight whitespace-nowrap block">
                AquaPlus <span className="font-sans text-[11px] font-normal text-[#5C6E67]">RO Tech</span>
              </span>
            </div>
          </div>

          {/* Desktop Location Kicker (shown on wide 2xl screens so 1280px header stays roomy) */}
          <div className="hidden 2xl:flex items-center gap-2 text-xs text-[#5C6E67] min-w-0">
            <span className="font-editorial italic text-[#1B2421] whitespace-nowrap">Field Operations</span>
            <span className="text-[#C5BDAA]">/</span>
            <span className="font-medium text-[#2D3733] truncate">Thirunagar 3rd Stop, near BATA showroom, Madurai</span>
          </div>
        </div>

        {/* Search Input (Tactile Paper Input with Ctrl+K & Clear) */}
        <div className="flex-1 min-w-[160px] max-w-md hidden sm:block">
          <div className="relative">
            <Search className="w-4 h-4 text-[#7A8C84] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={getSearchPlaceholder('Search purifiers, phone numbers, Madurai localities...')}
              className="w-full pl-9 pr-16 py-2 text-xs bg-[#F4F0E6] border border-[#DDD6C5] rounded-md focus:outline-none focus:ring-1 focus:ring-[#163830] focus:border-[#163830] text-[#1B2421] placeholder:text-[#8C9B94] transition-all"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#7A8C84] hover:text-[#1B2421] transition-colors"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <kbd className="hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono-data text-[#7A8C84] bg-[#FAF8F3] border border-[#DDD6C5] rounded absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                Ctrl K
              </kbd>
            )}
          </div>
        </div>

        {/* Date, Status & Primary Actions */}
        <div className="flex items-center gap-2 lg:gap-3">
          {/* Mobile Search Toggle */}
          <button
            type="button"
            onClick={() => {
              setMobileSearchOpen((prev) => !prev);
              if (!mobileSearchOpen) {
                setTimeout(() => mobileSearchInputRef.current?.focus(), 50);
              }
            }}
            className={`sm:hidden p-2 rounded transition-colors ${
              mobileSearchOpen || searchQuery
                ? 'bg-[#163830] text-[#FAF8F3]'
                : 'text-[#5C6E67] hover:bg-[#F4F0E6]'
            }`}
            title="Toggle search"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Mobile Service History Logbook Switcher */}
          <button
            type="button"
            onClick={() => setActiveTab('service_history')}
            className={`sm:hidden p-2 rounded transition-colors ${
              activeTab === 'service_history'
                ? 'bg-[#163830] text-[#FAF8F3]'
                : 'text-[#5C6E67] hover:bg-[#F4F0E6]'
            }`}
            title="Service History Logbook"
          >
            <History className="w-4 h-4" />
          </button>

          {/* Mobile Settings Switcher */}
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            aria-label="Settings"
            className={`sm:hidden p-2 rounded transition-colors ${
              activeTab === 'settings'
                ? 'bg-[#163830] text-[#FAF8F3]'
                : 'text-[#5C6E67] hover:bg-[#F4F0E6]'
            }`}
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Mobile Quick Add Customer */}
          <button
            type="button"
            onClick={onOpenAddCustomer}
            className="sm:hidden p-2 rounded text-[#163830] bg-[#F4F0E6] border border-[#DDD6C5] hover:bg-[#EDE7DA] transition-colors"
            title="Add Customer"
          >
            <Plus className="w-4 h-4" />
          </button>

          {/* Date Display (Unboxed Editorial Typography) */}
          <div className="hidden lg:flex items-center gap-2 text-xs text-[#2D3733] whitespace-nowrap shrink-0">
            <Calendar className="w-3.5 h-3.5 text-[#5C6E67] shrink-0" />
            <span className="font-mono-data font-semibold text-[#1B2421] whitespace-nowrap">
              {formatDisplayDate(todayStr)}
            </span>
          </div>

          {/* Sample Data Indicator */}
          {hasSampleData && (
            <button
              onClick={onOpenSeedDataModal}
              className="text-[11px] font-medium text-[#B45309] hover:text-[#92400E] bg-[#FDF6B2]/40 border border-[#FDE047] px-2.5 py-1 rounded transition-colors hidden sm:flex items-center gap-1.5"
              title="Sample preview data active"
            >
              <Database className="w-3 h-3 text-[#B45309]" />
              <span>Sample Mode</span>
            </button>
          )}

          {/* Authentication State (Sidebar footer displays signed-in user on lg/xl; show compact chip on 2xl) */}
          {currentUser ? (
            <div className="hidden 2xl:flex items-center gap-2 px-2.5 py-1 bg-[#F4F0E6] border border-[#E5DEC9] rounded text-xs text-[#2D3733] shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#165B50]" />
              <span className="font-medium truncate max-w-[120px]">
                {currentUser.displayName || 'Owner'}
              </span>
              <button
                onClick={logOut}
                className="text-[#7A8C84] hover:text-[#8B1E1E] ml-1 transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={signInWithGoogle}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FAF8F3] hover:bg-[#F4F0E6] text-[#2D3733] border border-[#DDD6C5] text-xs font-semibold rounded transition-colors shadow-2xs"
              title="Authenticate with Google for live cloud persistence"
            >
              <LogIn className="w-3.5 h-3.5 text-[#163830]" />
              <span>Sign In</span>
            </button>
          )}

          {/* Secondary: Wholesale Sales */}
          <button
            type="button"
            onClick={() => setActiveTab('wholesale_sales')}
            className={`hidden lg:inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded border whitespace-nowrap shrink-0 transition-colors ${
              activeTab === 'wholesale_sales'
                ? 'bg-[#EBF7F2] text-[#0C231F] border-[#165B50]'
                : 'bg-[#F4F0E6] hover:bg-[#EDE7DA] text-[#1B2421] border-[#D5CDBC]'
            }`}
            title="Open Wholesale Sales & Technician Billing"
          >
            <ShoppingBag className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'wholesale_sales' ? 'text-[#165B50]' : 'text-[#C25E00]'}`} />
            <span>Wholesale</span>
          </button>

          {/* Secondary: Add Customer */}
          <button
            onClick={onOpenAddCustomer}
            className="hidden md:inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#F4F0E6] hover:bg-[#EDE7DA] text-[#1B2421] text-xs font-semibold rounded border border-[#D5CDBC] whitespace-nowrap shrink-0 transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-[#163830] shrink-0" />
            <span>New Customer</span>
          </button>

          {/* Primary Action: Record Service (hidden on <640px where MobileNav has the centered Record FAB) */}
          <button
            onClick={onOpenRecordService}
            className="hidden sm:inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 bg-[#163830] hover:bg-[#0E2822] text-[#FAF8F3] text-xs font-bold rounded shadow-sm whitespace-nowrap shrink-0 transition-all active:scale-98"
          >
            <Wrench className="w-3.5 h-3.5 text-[#7EE787] shrink-0" />
            <span>Record Service</span>
          </button>
        </div>
      </div>

      {/* Expandable Mobile Search Bar (sm:hidden) */}
      {mobileSearchOpen && (
        <div className="sm:hidden px-4 pb-3 pt-1 border-t border-[#E5DEC9] bg-[#F4F0E6]/60 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-[#7A8C84] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={mobileSearchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={getSearchPlaceholder('Search customers, phones, localities...')}
              className="w-full pl-8 pr-8 py-1.5 text-xs bg-[#FAF8F3] border border-[#DDD6C5] rounded-md text-[#1B2421] placeholder:text-[#8C9B94] focus:outline-none focus:border-[#163830]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#7A8C84] hover:text-[#1B2421]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setMobileSearchOpen(false)}
            className="text-xs text-[#5C6E67] hover:text-[#1B2421] px-2 py-1 font-semibold"
          >
            Done
          </button>
        </div>
      )}
    </header>
  );
};
