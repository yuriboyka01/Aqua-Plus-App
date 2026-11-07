import React from 'react';
import {
  LayoutDashboard,
  Users,
  Wrench,
  History,
  BellRing,
  FileText,
  Settings,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Droplets,
  LogOut,
  MapPin,
  Package,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export type ActiveTab =
  | 'dashboard'
  | 'customers'
  | 'inventory'
  | 'record_service'
  | 'service_history'
  | 'reminders'
  | 'daily_reports'
  | 'settings'
  | 'automated_tests';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  dueTodayCount: number;
  overdueCount: number;
  inventoryLowStockCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  collapsed,
  setCollapsed,
  dueTodayCount,
  overdueCount,
  inventoryLowStockCount = 0,
}) => {
  const { currentUser, logOut, signInWithGoogle } = useAuth();
  const [showMore, setShowMore] = React.useState(false);

  const navItems = [
    {
      id: 'dashboard' as ActiveTab,
      label: 'Dashboard',
      sublabel: 'Daily overview',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'customers' as ActiveTab,
      label: 'Customers',
      sublabel: 'Customer directory',
      icon: Users,
      badge: null,
    },
    {
      id: 'inventory' as ActiveTab,
      label: 'Inventory',
      sublabel: 'Parts & stock levels',
      icon: Package,
      badge: inventoryLowStockCount > 0 ? `${inventoryLowStockCount} low` : null,
      badgeColor: 'text-[#F6D285]',
    },
    {
      id: 'record_service' as ActiveTab,
      label: 'Record service',
      sublabel: 'Log a completed visit',
      icon: Wrench,
      badge: null,
    },
    {
      id: 'service_history' as ActiveTab,
      label: 'Service history',
      sublabel: 'Past visits',
      icon: History,
      badge: null,
    },
    {
      id: 'reminders' as ActiveTab,
      label: 'Reminders',
      sublabel: 'Due and upcoming',
      icon: BellRing,
      badge: dueTodayCount + overdueCount > 0 ? `${dueTodayCount + overdueCount}` : null,
      badgeColor: overdueCount > 0 ? 'text-[#FF8B8B]' : 'text-[#F6D285]',
    },
    {
      id: 'daily_reports' as ActiveTab,
      label: 'Daily reports',
      sublabel: 'Owner summaries',
      icon: FileText,
      badge: null,
    },
    {
      id: 'settings' as ActiveTab,
      label: 'Settings',
      sublabel: 'Business and messaging',
      icon: Settings,
      badge: null,
    },
    {
      id: 'automated_tests' as ActiveTab,
      label: 'System checks',
      sublabel: 'Business logic checks',
      icon: ShieldCheck,
      badge: '11/11',
      badgeColor: 'text-[#9EE8C8]',
    },
  ];
  const primaryItems = navItems.slice(0, 6);
  const secondaryItems = navItems.slice(6);
  const renderNavItem = (item: (typeof navItems)[number]) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    return (
      <button
        key={item.id}
        onClick={() => setActiveTab(item.id)}
        aria-current={isActive ? 'page' : undefined}
        className={`w-full min-h-12 flex items-center gap-3 px-3.5 py-2.5 rounded text-left transition-all relative ${
          isActive
            ? 'bg-[#174238] text-[#FAF8F3] font-semibold shadow-inner'
            : 'text-[#B4CBC3] hover:text-[#FAF8F3] hover:bg-[#12332C]'
        }`}
        title={collapsed ? item.label : undefined}
      >
        {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-[#7EE787] rounded-r" />}
        <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-[#7EE787]' : 'text-[#86AB9F]'}`} />
        {!collapsed && (
          <div className="flex-1 truncate">
            <div className="text-sm tracking-tight">{item.label}</div>
            <div className="text-xs text-[#7A9C91] font-normal truncate">{item.sublabel}</div>
          </div>
        )}
        {!collapsed && item.badge && (
          <span className={`text-[11px] font-mono-data font-bold ${item.badgeColor || 'text-[#7EE787]'}`}>
            {item.badge}
          </span>
        )}
      </button>
    );
  };
  const secondaryActive = secondaryItems.some((item) => item.id === activeTab);

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-30 flex flex-col bg-[#0C231F] text-[#FAF8F3] transition-all duration-200 border-r border-[#1C3E37] ${
        collapsed ? 'w-20' : 'w-64'
      } hidden md:flex`}
    >
      {/* Brand Header */}
      <div className="h-18 flex items-center justify-between px-5 border-b border-[#1C3E37]/80">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 rounded-md bg-white border border-[#23584B] flex items-center justify-center shrink-0 overflow-hidden">
            <img src="/aqua-plus-logo.jpg" alt="Aqua Plus RO Tech" className="w-full h-full object-contain" />
          </div>
          {!collapsed && (
            <div className="truncate">
              <h1 className="font-editorial font-bold text-base text-[#FAF8F3] tracking-tight">
                AquaPlus <span className="font-sans text-[11px] font-normal text-[#86AB9F]">OS</span>
              </h1>
              <p className="text-[10px] text-[#86AB9F] font-mono-data truncate">RO Tech • Madurai</p>
            </div>
          )}
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-[#86AB9F] hover:text-[#FAF8F3] hover:bg-[#174238] p-1.5 rounded transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation List */}
      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-3 py-5 space-y-1">
        {primaryItems.map(renderNavItem)}
        <button
          type="button"
          aria-expanded={showMore || secondaryActive}
          aria-label={collapsed ? 'More navigation' : undefined}
          onClick={() => setShowMore((open) => !open)}
          className="w-full min-h-12 flex items-center gap-3 px-3.5 py-2.5 rounded text-left text-[#B4CBC3] hover:text-[#FAF8F3] hover:bg-[#12332C] transition-colors"
          title={collapsed ? 'More' : undefined}
        >
          <MoreHorizontal className="w-4 h-4 shrink-0 text-[#86AB9F]" />
          {!collapsed && <span className="text-sm">More</span>}
          {!collapsed && <span className="ml-auto text-xs text-[#7A9C91]">{showMore || secondaryActive ? '−' : '+'}</span>}
        </button>
        {(showMore || secondaryActive) && secondaryItems.map(renderNavItem)}
      </nav>

      {/* Footer / Account Presence */}
      <div className="p-3.5 border-t border-[#1C3E37]/80 bg-[#0A1D1A]">
        {!collapsed ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="truncate">
                <p className="font-semibold text-[#FAF8F3] truncate">
                  {currentUser?.displayName || 'Aqua Plus Owner'}
                </p>
                <p className="text-[10px] text-[#86AB9F] truncate">
                  {currentUser ? 'Cloud Verified' : 'Local Preview'}
                </p>
              </div>
              {currentUser ? (
                <button
                  onClick={logOut}
                  className="text-[#86AB9F] hover:text-[#FF8B8B] p-1 rounded transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  onClick={signInWithGoogle}
                  className="text-[10px] text-[#7EE787] hover:underline font-semibold"
                >
                  Sign In
                </button>
              )}
            </div>
            <div className="text-[10px] text-[#5A7B71] flex items-center gap-1 font-mono-data">
              <MapPin className="w-3 h-3 text-[#7EE787]" />
              <span>Madurai 625006</span>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            {currentUser ? (
              <button
                onClick={logOut}
                className="text-[#86AB9F] hover:text-[#FF8B8B] p-2 rounded"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={signInWithGoogle}
                className="text-[#7EE787] p-2"
                title="Sign In"
              >
                <Droplets className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
