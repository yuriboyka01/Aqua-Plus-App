import React, { lazy, Suspense, useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { MobileNav } from './components/MobileNav';

// Modals are loaded only when opened to keep the initial workspace bundle small.
const CustomerModal = lazy(() => import('./components/CustomerModal').then((module) => ({ default: module.CustomerModal })));
const CustomerDetailDrawer = lazy(() => import('./components/CustomerDetailDrawer').then((module) => ({ default: module.CustomerDetailDrawer })));
const RecordServiceModal = lazy(() => import('./components/RecordServiceModal').then((module) => ({ default: module.RecordServiceModal })));
const ReminderActionModal = lazy(() => import('./components/ReminderActionModal').then((module) => ({ default: module.ReminderActionModal })));
const DirectWhatsAppPreviewModal = lazy(() => import('./components/DirectWhatsAppPreviewModal').then((module) => ({ default: module.DirectWhatsAppPreviewModal })));
const DailyReportModal = lazy(() => import('./components/DailyReportModal').then((module) => ({ default: module.DailyReportModal })));
const SeedDataModal = lazy(() => import('./components/SeedDataModal').then((module) => ({ default: module.SeedDataModal })));

// Pages
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const CustomersPage = lazy(() => import('./pages/CustomersPage').then((module) => ({ default: module.CustomersPage })));
const ServiceHistoryPage = lazy(() => import('./pages/ServiceHistoryPage').then((module) => ({ default: module.ServiceHistoryPage })));
const RemindersQueuePage = lazy(() => import('./pages/RemindersQueuePage').then((module) => ({ default: module.RemindersQueuePage })));
const DailyReportsPage = lazy(() => import('./pages/DailyReportsPage').then((module) => ({ default: module.DailyReportsPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })));
const AutomatedTestsPage = lazy(() => import('./pages/AutomatedTestsPage').then((module) => ({ default: module.AutomatedTestsPage })));
const InventoryPage = lazy(() => import('./pages/InventoryPage').then((module) => ({ default: module.InventoryPage })));

// Types and Services
import {
  Customer,
  ServiceRecord,
  Reminder,
  MessageAttempt,
  AppSettings,
  OwnerReport,
  InventoryItem,
  getStockStatus,
} from './types';
import {
  subscribeCustomers,
  subscribeServiceRecords,
  subscribeReminders,
  subscribeMessageAttempts,
  subscribeMessageDeliveryStatus,
  subscribeSettings,
  subscribeOwnerReports,
  addCustomer,
  updateCustomer,
  archiveCustomer,
  restoreCustomer,
  recordCompletedService,
  rescheduleReminder,
  togglePauseReminder,
  markReminderContactedManually,
  saveSettings,
  seedSampleData,
  purgeSampleData,
  subscribeInventory,
  addInventoryItem,
  updateInventoryItem,
  adjustInventoryQuantity,
  deleteInventoryItem,
} from './services/dbService';
import { testFirestoreConnection } from './lib/firebase';
import { runDailyBatch } from './services/apiService';
import { BUSINESS_OWNER_ID, DEFAULT_SETTINGS } from './lib/constants';
import { getTodayKolkata, getDaysUntilDate } from './utils/dateUtils';
import { Droplets, LogIn, ShieldAlert, Sparkles, KeyRound, Mail, CheckCircle2, Eye, EyeOff } from 'lucide-react';

function AquaPlusApp() {
  const {
    currentUser,
    loading: authLoading,
    signInWithGoogle,
    signInWithEmail,
    sendPasswordReset,
    logOut,
    isOwner,
    authError,
    clearAuthError,
  } = useAuth();

  // Login form state
  const [authMethod, setAuthMethod] = useState<'password' | 'google'>('password');
  const [loginEmail, setLoginEmail] = useState('nisanth.t9c@gmail.com');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [submittingPassword, setSubmittingPassword] = useState(false);

  // App Navigation
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Firestore Data State
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [serviceRecords, setServiceRecords] = useState<ServiceRecord[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [messageAttempts, setMessageAttempts] = useState<MessageAttempt[]>([]);
  const [deliveryStatuses, setDeliveryStatuses] = useState<{ providerMessageId: string; status: 'sent' | 'delivered' | 'read' | 'failed' }[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [ownerReports, setOwnerReports] = useState<OwnerReport[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  // Modals state
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);
  const [selectedCustomerForDetail, setSelectedCustomerForDetail] = useState<Customer | null>(null);

  const [isRecordServiceModalOpen, setIsRecordServiceModalOpen] = useState(false);
  const [preselectedCustomerForService, setPreselectedCustomerForService] = useState<Customer | null>(null);

  const [selectedReminderForAction, setSelectedReminderForAction] = useState<Reminder | null>(null);
  const [reminderForWhatsApp, setReminderForWhatsApp] = useState<Reminder | null>(null);
  const [customerForWhatsApp, setCustomerForWhatsApp] = useState<Customer | null>(null);

  const [selectedReportForView, setSelectedReportForView] = useState<OwnerReport | null>(null);
  const [isSeedModalOpen, setIsSeedModalOpen] = useState(false);
  const [batchRunning, setBatchRunning] = useState(false);
  const [toast, setToast] = useState<{ title: string; message: string; tone: 'success' | 'warning' | 'error' } | null>(null);

  const showToast = (title: string, message: string, tone: 'success' | 'warning' | 'error' = 'success') => {
    setToast({ title, message, tone });
  };

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Test Firestore Connection on boot
  useEffect(() => {
    testFirestoreConnection();
  }, []);

  // Subscribe to real-time collections ONLY when authenticated
  useEffect(() => {
    if (authLoading || !currentUser || !isOwner) return;

    const effectiveOwnerId = BUSINESS_OWNER_ID;

    const unsubCustomers = subscribeCustomers(effectiveOwnerId, setCustomers);
    const unsubServices = subscribeServiceRecords(effectiveOwnerId, setServiceRecords);
    const unsubReminders = subscribeReminders(effectiveOwnerId, setReminders);
    const unsubMessages = subscribeMessageAttempts(effectiveOwnerId, setMessageAttempts);
    const unsubDelivery = subscribeMessageDeliveryStatus(effectiveOwnerId, setDeliveryStatuses);
    const unsubSettings = subscribeSettings(effectiveOwnerId, setSettings);
    const unsubReports = subscribeOwnerReports(effectiveOwnerId, setOwnerReports);
    const unsubInventory = subscribeInventory(effectiveOwnerId, setInventory);

    return () => {
      unsubCustomers();
      unsubServices();
      unsubReminders();
      unsubMessages();
      unsubDelivery();
      unsubSettings();
      unsubReports();
      unsubInventory();
    };
  }, [currentUser, authLoading, isOwner]);

  const attemptsWithDelivery = messageAttempts.map((attempt) => ({
    ...attempt,
    providerDeliveryStatus: deliveryStatuses.find((delivery) => delivery.providerMessageId === attempt.providerMessageId)?.status,
  }));

  // Sync selectedCustomerForDetail when customers list updates
  useEffect(() => {
    if (selectedCustomerForDetail) {
      const updated = customers.find((c) => c.id === selectedCustomerForDetail.id);
      if (updated) setSelectedCustomerForDetail(updated);
    }
  }, [customers]);

  const hasSampleData = customers.some((c) => c.isSampleData) || inventory.some((i) => i.isSampleData);

  // Reminders badges
  const todayStr = getTodayKolkata();
  const dueTodayCount = reminders.filter(
    (r) => r.reminderDate === todayStr && r.status !== 'superseded' && r.status !== 'sent' && r.status !== 'contacted_manually' && r.status !== 'paused'
  ).length;
  const overdueCount = reminders.filter(
    (r) => getDaysUntilDate(r.reminderDate) < 0 && r.status !== 'superseded' && r.status !== 'sent' && r.status !== 'contacted_manually' && r.status !== 'paused'
  ).length;
  const inventoryLowStockCount = inventory.filter(
    (item) => getStockStatus(item) === 'low_stock' || getStockStatus(item) === 'out_of_stock'
  ).length;

  // Handlers
  const handleOpenAddCustomer = () => {
    setCustomerToEdit(null);
    setIsCustomerModalOpen(true);
  };

  const handleEditCustomer = (cust: Customer) => {
    setCustomerToEdit(cust);
    setIsCustomerModalOpen(true);
  };

  const handleSaveCustomer = async (data: any) => {
    const effectiveOwnerId = BUSINESS_OWNER_ID;
    if (customerToEdit) {
      await updateCustomer(customerToEdit.id, data, effectiveOwnerId);
    } else {
      await addCustomer(data, effectiveOwnerId);
    }
  };

  const handleOpenRecordService = (targetCustomer?: Customer | null) => {
    setPreselectedCustomerForService(targetCustomer || null);
    setIsRecordServiceModalOpen(true);
  };

  const handleSaveServiceRecord = async (
    recordData: any,
    customer: Customer,
    usedParts?: { itemId: string; quantity: number }[]
  ) => {
    const effectiveOwnerId = BUSINESS_OWNER_ID;
    await recordCompletedService(recordData, effectiveOwnerId, customer);
    if (usedParts && usedParts.length > 0) {
      for (const part of usedParts) {
        try {
          await adjustInventoryQuantity(
            part.itemId,
            -part.quantity,
            effectiveOwnerId,
            `Used in service visit for ${customer.fullName}`
          );
        } catch (err) {
          console.warn(`Failed to deduct inventory for ${part.itemId}:`, err);
        }
      }
    }
  };

  const handleArchiveToggle = async (customer: Customer) => {
    const effectiveOwnerId = BUSINESS_OWNER_ID;
    if (customer.status === 'archived') {
      await restoreCustomer(customer.id, effectiveOwnerId);
    } else {
      await archiveCustomer(customer.id, effectiveOwnerId);
    }
  };

  const handleCustomerPauseToggle = async (customer: Customer) => {
    const effectiveOwnerId = BUSINESS_OWNER_ID;
    const isPaused = !customer.remindersPaused;
    await updateCustomer(customer.id, { remindersPaused: isPaused }, effectiveOwnerId);
  };

  const handleTriggerDailyBatch = async () => {
    setBatchRunning(true);
    try {
      const batchResult = await runDailyBatch();
      if (batchResult.status === 'already_completed') {
        showToast('Morning Batch Current', `Today's batch (${batchResult.reportDate}) was already completed.`, 'success');
      } else if (batchResult.status === 'reconciliation_required' || batchResult.status === 'partial_failure') {
        showToast(
          'Reconciliation Required',
          `${batchResult.persistenceFailures || 0} dispatch result(s) unsaved; ${batchResult.unknownOutcomes || 0} outcome(s) unknown (${batchResult.reportDate}).`,
          'warning'
        );
      } else if (batchResult.status === 'not_configured') {
        showToast('WhatsApp Not Configured', 'Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID on the server, then retry.', 'warning');
      } else if (batchResult.status === 'disabled') {
        showToast('Scheduler Paused', 'Scheduled processing is currently disabled in Settings.', 'warning');
      } else {
        showToast(
          `Morning Batch Completed (${batchResult.reportDate})`,
          `Eligible: ${batchResult.eligibleCount} · Sent: ${batchResult.messagesSent} · Failed: ${batchResult.messagesFailed} · Skipped: ${batchResult.skippedCount}`,
          'success'
        );
      }
    } catch (err: any) {
      console.error(err);
      showToast('Batch Processing Error', err.message || 'Could not complete daily batch run.', 'error');
    } finally {
      setBatchRunning(false);
    }
  };

  // If user is not logged in, render the login & welcome portal
  if (!currentUser || !isOwner) {
    const handlePasswordSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!loginEmail || !loginPassword) return;
      try {
        setSubmittingPassword(true);
        await signInWithEmail(loginEmail, loginPassword);
      } catch {
        // Error state handled inside AuthContext
      } finally {
        setSubmittingPassword(false);
      }
    };

    const handleSendReset = async () => {
      if (!loginEmail) return;
      const success = await sendPasswordReset(loginEmail);
      if (success) {
        setResetSent(true);
      }
    };

    return (
      <div className="min-h-screen bg-[#0A1D1E] text-slate-100 flex flex-col justify-center items-center p-4 selection:bg-teal-500 selection:text-white">
        <div className="w-full max-w-md bg-[#0F292B] border border-[#1B3E42] rounded-2xl p-6 md:p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-20 h-20 rounded-full bg-white border-2 border-cyan-300 flex items-center justify-center mx-auto shadow-lg overflow-hidden">
              <img src="/aqua-plus-logo.jpg" alt="Aqua Plus RO Tech" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              AquaPlus Service
            </h1>
            <p className="text-xs text-teal-300 font-medium">
              Aqua Plus RO Tech â€¢ Thirunagar 5th Stop, Madurai
            </p>
          </div>

          <div className="bg-[#143538] p-4 rounded-xl border border-[#1E484C] text-xs text-slate-300 space-y-1.5 leading-relaxed">
            <p className="font-semibold text-white flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-teal-400" />
              {currentUser ? 'Access Restricted' : 'Owner-Only Authorization Portal'}
            </p>
            <p>
              {currentUser
                ? 'This account is not authorized for Aqua Plus business records. Sign out and use an authorized business account.'
                : 'Manage customer records, RO purifier service histories, and automated reminder schedules.'}
            </p>
          </div>

          {authError && (
            <div className="p-3 bg-rose-950/80 border border-rose-800 rounded-lg text-rose-200 text-xs leading-relaxed">
              {authError}
            </div>
          )}

          {resetSent && (
            <div className="p-3 bg-teal-950/80 border border-teal-700 rounded-lg text-teal-200 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
              <span>Password setup link sent to {loginEmail}. Check your inbox!</span>
            </div>
          )}

          {currentUser ? (
            <div className="pt-2">
              <button
                onClick={logOut}
                disabled={authLoading}
                className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm rounded-xl shadow-md flex items-center justify-center gap-2 transition-all"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign Out ({currentUser.email})</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4 pt-1">
              {/* Method Switcher */}
              <div className="grid grid-cols-2 p-1 bg-[#143538] border border-[#1E484C] rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMethod('password');
                    clearAuthError();
                  }}
                  className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                    authMethod === 'password'
                      ? 'bg-teal-500 text-[#0F292B] shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Password Login</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMethod('google');
                    clearAuthError();
                  }}
                  className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                    authMethod === 'google'
                      ? 'bg-teal-500 text-[#0F292B] shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Google Sign-In</span>
                </button>
              </div>

              {authMethod === 'password' ? (
                <form onSubmit={handlePasswordSubmit} className="space-y-3.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Business Owner Email
                    </label>
                    <select
                      value={loginEmail}
                      onChange={(e) => {
                        setLoginEmail(e.target.value);
                        setResetSent(false);
                      }}
                      className="w-full bg-[#143538] border border-[#1E484C] text-slate-100 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-teal-400"
                    >
                      <option value="nisanth.t9c@gmail.com">nisanth.t9c@gmail.com (Nisanth)</option>
                      <option value="aquaplusrosales@gmail.com">aquaplusrosales@gmail.com (Aqua Plus)</option>
                      <option value="vishaalchinnan@gmail.com">vishaalchinnan@gmail.com (Vishaal)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Account Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="Enter your password"
                        required
                        className="w-full bg-[#143538] border border-[#1E484C] text-slate-100 rounded-xl px-3 py-2.5 text-xs pr-10 focus:outline-none focus:border-teal-400"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submittingPassword || authLoading || !loginPassword}
                    className="w-full py-3 px-4 bg-teal-500 hover:bg-teal-400 text-[#0F292B] font-bold text-sm rounded-xl shadow-md flex items-center justify-center gap-2 transition-all transform active:scale-98 disabled:opacity-50"
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>{submittingPassword ? 'Signing in...' : 'Sign In with Password'}</span>
                  </button>

                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={handleSendReset}
                      className="text-[11px] text-teal-300 hover:text-teal-200 underline underline-offset-2 transition-colors"
                    >
                      Need to set or reset your password? Send email link
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-3">
                  <p className="text-[11px] text-slate-400 leading-normal text-center">
                    Uses your Google account. (Requires your domain/IP in Firebase Authorized Domains).
                  </p>
                  <button
                    type="button"
                    onClick={signInWithGoogle}
                    disabled={authLoading}
                    className="w-full py-3 px-4 bg-teal-500 hover:bg-teal-400 text-[#0F292B] font-bold text-sm rounded-xl shadow-md flex items-center justify-center gap-2.5 transition-all transform active:scale-98 disabled:opacity-50"
                  >
                    <LogIn className="w-5 h-5" />
                    <span>{authLoading ? 'Verifying...' : 'Sign In with Google Account'}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="text-center pt-1">
            <p className="text-[11px] text-teal-400/60 font-mono">
              Authorized business accounts only
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F3] text-[#1B2421] flex flex-col antialiased">
      {/* Desktop Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        dueTodayCount={dueTodayCount}
        overdueCount={overdueCount}
        inventoryLowStockCount={inventoryLowStockCount}
      />

      {/* Main App Layout */}
      <div
        className={`flex-1 flex flex-col transition-all duration-200 ${
          sidebarCollapsed ? 'md:pl-20' : 'md:pl-64'
        } pb-16 md:pb-6`}
      >
        {/* Navbar */}
        <Navbar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onOpenAddCustomer={handleOpenAddCustomer}
          onOpenRecordService={() => handleOpenRecordService()}
          onOpenSeedDataModal={() => setIsSeedModalOpen(true)}
          hasSampleData={hasSampleData}
        />

        {/* Main Content Area */}
        <main className="flex-1 p-4 lg:p-6 max-w-7xl w-full mx-auto">
          {toast && (
            <div
              role="status"
              aria-live="polite"
              className={`mb-4 p-3.5 rounded-xl border shadow-sm flex items-start justify-between gap-3 text-xs transition-all ${
                toast.tone === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                  : toast.tone === 'warning'
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-[#EBF7F2] border-[#C6EAD8] text-[#163830]'
              }`}
            >
              <div className="space-y-0.5">
                <p className="font-bold">{toast.title}</p>
                <p className="font-mono-data text-[11px] opacity-90">{toast.message}</p>
              </div>
              <button
                type="button"
                onClick={() => setToast(null)}
                className="text-[11px] font-bold px-2 py-0.5 rounded hover:bg-black/5 shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}
          <Suspense fallback={<div className="py-12 text-center text-sm text-[#5C6E67]">Loading workspace...</div>}>
          {activeTab === 'dashboard' && (
            <DashboardPage
              customers={customers}
              serviceRecords={serviceRecords}
              reminders={reminders}
              messageAttempts={attemptsWithDelivery}
              setActiveTab={setActiveTab}
              onOpenAddCustomer={handleOpenAddCustomer}
              onOpenRecordService={() => handleOpenRecordService()}
              onOpenCustomerDetail={(cust) => setSelectedCustomerForDetail(cust)}
              onTriggerDailyBatch={handleTriggerDailyBatch}
              batchRunning={batchRunning}
            />
          )}

          {activeTab === 'customers' && (
            <CustomersPage
              customers={customers}
              serviceRecords={serviceRecords}
              reminders={reminders}
              onOpenAddCustomer={handleOpenAddCustomer}
              onEditCustomer={handleEditCustomer}
              onOpenCustomerDetail={(cust) => setSelectedCustomerForDetail(cust)}
              onRecordServiceForCustomer={(cust) => handleOpenRecordService(cust)}
              onArchiveToggle={handleArchiveToggle}
              initialSearch={searchQuery}
            />
          )}

          {activeTab === 'inventory' && (
            <InventoryPage
              inventory={inventory}
              onAddItem={async (data) => {
                const effectiveOwnerId = currentUser && isOwner ? currentUser.uid : BUSINESS_OWNER_ID;
                await addInventoryItem(data, effectiveOwnerId);
              }}
              onUpdateItem={async (id, updates) => {
                const effectiveOwnerId = currentUser && isOwner ? currentUser.uid : BUSINESS_OWNER_ID;
                await updateInventoryItem(id, updates, effectiveOwnerId);
              }}
              onAdjustQuantity={async (id, delta, reason) => {
                const effectiveOwnerId = currentUser && isOwner ? currentUser.uid : BUSINESS_OWNER_ID;
                await adjustInventoryQuantity(id, delta, effectiveOwnerId, reason);
              }}
              onDeleteItem={async (id) => {
                const effectiveOwnerId = currentUser && isOwner ? currentUser.uid : BUSINESS_OWNER_ID;
                await deleteInventoryItem(id, effectiveOwnerId);
              }}
              ownerId={currentUser && isOwner ? currentUser.uid : BUSINESS_OWNER_ID}
            />
          )}

          {activeTab === 'record_service' && (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
                <div className="w-12 h-12 bg-teal-50 border border-teal-200 rounded-full flex items-center justify-center mx-auto text-teal-700">
                  <Droplets className="w-6 h-6" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">Record Service Visit</h2>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Log a completed maintenance visit at a customer's location in Madurai, calculate the next reminder date, and record spare parts charges.
                </p>
                <button
                  onClick={() => handleOpenRecordService()}
                  className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs rounded-lg shadow-sm"
                >
                  Open Record Service Form
                </button>
              </div>
            </div>
          )}

          {activeTab === 'service_history' && (
            <ServiceHistoryPage
              serviceRecords={serviceRecords}
              customers={customers}
              onOpenCustomerDetail={(cust) => setSelectedCustomerForDetail(cust)}
            />
          )}

          {activeTab === 'reminders' && (
            <RemindersQueuePage
              reminders={reminders}
              customers={customers}
              serviceRecords={serviceRecords}
              messageAttempts={attemptsWithDelivery}
              onOpenCustomerDetail={(cust) => setSelectedCustomerForDetail(cust)}
              onOpenReminderAction={(rem) => setSelectedReminderForAction(rem)}
              onOpenWhatsAppPreview={(rem, cust) => {
                setReminderForWhatsApp(rem);
                setCustomerForWhatsApp(cust);
              }}
            />
          )}

          {activeTab === 'daily_reports' && (
            <DailyReportsPage
              reports={ownerReports}
              settings={settings}
              onRunBatch={handleTriggerDailyBatch}
              onOpenReport={(rpt) => setSelectedReportForView(rpt)}
              batchRunning={batchRunning}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsPage
              settings={settings}
              onSaveSettings={async (updated) => {
                const effectiveOwnerId = BUSINESS_OWNER_ID;
                await saveSettings(updated, effectiveOwnerId);
              }}
              customers={customers}
              serviceRecords={serviceRecords}
              onOpenSeedDataModal={() => setIsSeedModalOpen(true)}
              hasSampleData={hasSampleData}
            />
          )}

          {activeTab === 'automated_tests' && <AutomatedTestsPage />}
          </Suspense>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAddCustomer={handleOpenAddCustomer}
        onOpenRecordService={() => handleOpenRecordService()}
        pendingCount={dueTodayCount + overdueCount}
        lowStockCount={inventoryLowStockCount}
      />

      {/* MODALS */}
      <Suspense fallback={null}>
      {isCustomerModalOpen && (
        <CustomerModal
          isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        onSave={handleSaveCustomer}
        existingCustomers={customers}
          customerToEdit={customerToEdit}
        />
      )}

      {selectedCustomerForDetail && (
        <CustomerDetailDrawer
          customer={selectedCustomerForDetail}
        onClose={() => setSelectedCustomerForDetail(null)}
        serviceHistory={serviceRecords.filter((s) => s.customerId === selectedCustomerForDetail?.id)}
        reminders={reminders.filter((r) => r.customerId === selectedCustomerForDetail?.id)}
        onEdit={(cust) => {
          setSelectedCustomerForDetail(null);
          handleEditCustomer(cust);
        }}
        onRecordServiceForCustomer={(cust) => {
          setSelectedCustomerForDetail(null);
          handleOpenRecordService(cust);
        }}
        onArchiveToggle={handleArchiveToggle}
          onPauseToggle={handleCustomerPauseToggle}
        />
      )}

      {isRecordServiceModalOpen && (
        <RecordServiceModal
          isOpen={isRecordServiceModalOpen}
        onClose={() => setIsRecordServiceModalOpen(false)}
        customers={customers.filter((c) => c.status === 'active')}
        preselectedCustomer={preselectedCustomerForService}
          onSave={handleSaveServiceRecord}
          inventory={inventory}
        />
      )}

      {selectedReminderForAction && (
        <ReminderActionModal
          isOpen={!!selectedReminderForAction}
        onClose={() => setSelectedReminderForAction(null)}
        reminder={selectedReminderForAction}
        onReschedule={async (remId, custId, newDate, reason) => {
          const effectiveOwnerId = BUSINESS_OWNER_ID;
          await rescheduleReminder(remId, custId, newDate, reason, effectiveOwnerId);
        }}
        onPauseToggle={async (remId, custId, isPaused) => {
          const effectiveOwnerId = BUSINESS_OWNER_ID;
          await togglePauseReminder(remId, custId, isPaused, effectiveOwnerId);
        }}
        onMarkManualContact={async (remId, notes) => {
          const effectiveOwnerId = BUSINESS_OWNER_ID;
          await markReminderContactedManually(remId, notes, effectiveOwnerId);
        }}
        onOpenWhatsAppPreview={(rem) => {
          const c = customers.find((cust) => cust.id === rem.customerId);
          if (c) {
            setReminderForWhatsApp(rem);
            setCustomerForWhatsApp(c);
          }
        }}
        />
      )}

      {reminderForWhatsApp && customerForWhatsApp && (
        <DirectWhatsAppPreviewModal
        isOpen={!!reminderForWhatsApp && !!customerForWhatsApp}
        onClose={() => {
          setReminderForWhatsApp(null);
          setCustomerForWhatsApp(null);
        }}
        reminder={reminderForWhatsApp}
        customer={customerForWhatsApp}
          settings={settings}
        />
      )}

      {selectedReportForView && (
        <DailyReportModal
        isOpen={!!selectedReportForView}
        onClose={() => setSelectedReportForView(null)}
          report={selectedReportForView}
        />
      )}

      {isSeedModalOpen && (
        <SeedDataModal
        isOpen={isSeedModalOpen}
        onClose={() => setIsSeedModalOpen(false)}
        hasSampleData={hasSampleData}
        onSeedData={async () => {
          const effectiveOwnerId = BUSINESS_OWNER_ID;
          await seedSampleData(effectiveOwnerId);
        }}
        onPurgeData={async () => {
          const effectiveOwnerId = BUSINESS_OWNER_ID;
          return await purgeSampleData(customers, serviceRecords, reminders, effectiveOwnerId, inventory);
        }}
        />
      )}
      </Suspense>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AquaPlusApp />
    </AuthProvider>
  );
}
