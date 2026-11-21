import React, { useState } from 'react';
import {
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  ShieldAlert,
  LogOut,
  MapPin,
  Droplets,
  Sparkles,
  BellRing,
  Package,
  ArrowRight,
  Mail,
} from 'lucide-react';

interface LoginPageProps {
  currentUser: { email?: string | null; displayName?: string | null } | null;
  authLoading: boolean;
  authError: string | null;
  onClearAuthError: () => void;
  onSignInWithEmail: (email: string, password: string) => Promise<void>;
  onSignInWithGoogle: () => Promise<void>;
  onSendPasswordReset: (email: string) => Promise<boolean>;
  onLogOut: () => Promise<void>;
}

const OWNER_ACCOUNTS = [
  { label: 'Nisanth', email: 'nisanth.t9c@gmail.com', role: 'Operations' },
  { label: 'Aqua Plus', email: 'aquaplusrosales@gmail.com', role: 'Sales Desk' },
  { label: 'Vishaal', email: 'vishaalchinnan@gmail.com', role: 'Field Lead' },
];

export const LoginPage: React.FC<LoginPageProps> = ({
  currentUser,
  authLoading,
  authError,
  onClearAuthError,
  onSignInWithEmail,
  onSignInWithGoogle,
  onSendPasswordReset,
  onLogOut,
}) => {
  const [loginEmail, setLoginEmail] = useState(OWNER_ACCOUNTS[0].email);
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [submittingPassword, setSubmittingPassword] = useState(false);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword) return;
    try {
      setSubmittingPassword(true);
      await onSignInWithEmail(loginEmail.trim(), loginPassword);
    } catch {
      // AuthContext handles error display
    } finally {
      setSubmittingPassword(false);
    }
  };

  const handleSendReset = async () => {
    if (!loginEmail.trim()) return;
    onClearAuthError();
    const success = await onSendPasswordReset(loginEmail.trim());
    if (success) {
      setResetSent(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F3] text-[#1B2421] grid grid-cols-1 lg:grid-cols-12 antialiased selection:bg-[#163830] selection:text-[#FAF8F3]">
      {/* Left Brand Showcase Panel (Desktop) */}
      <aside className="hidden lg:flex lg:col-span-6 xl:col-span-7 bg-[#0C231F] text-[#FAF8F3] relative overflow-hidden flex-col justify-between p-12 xl:p-16">
        {/* Subtle concentric water ripple background */}
        <div className="absolute -right-24 -bottom-24 w-[520px] h-[520px] opacity-[0.07] pointer-events-none">
          <svg viewBox="0 0 400 400" className="w-full h-full stroke-[#7EE787] fill-none">
            <circle cx="200" cy="200" r="50" strokeWidth="1.2" />
            <circle cx="200" cy="200" r="100" strokeWidth="1.2" />
            <circle cx="200" cy="200" r="150" strokeWidth="1.2" />
            <circle cx="200" cy="200" r="195" strokeWidth="1.2" />
          </svg>
        </div>

        {/* Top Brand Identity */}
        <div className="relative z-10 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-white p-1 shadow-md border border-[#23584B] flex items-center justify-center overflow-hidden">
            <img
              src="/aqua-plus-logo.jpg"
              alt="Aqua Plus RO Tech"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <div className="font-editorial font-bold text-lg tracking-tight text-[#FAF8F3] leading-none">
              AquaPlus <span className="font-sans text-xs font-medium text-[#7EE787] ml-0.5">Service OS</span>
            </div>
            <div className="text-[11px] text-[#86AB9F] font-mono-data mt-1">
              Aqua Plus RO Tech • Madurai
            </div>
          </div>
        </div>

        {/* Center Editorial Copy & Feature Highlights */}
        <div className="relative z-10 max-w-lg space-y-8 my-auto py-10">
          <div className="space-y-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#174238] border border-[#23584B] text-[11px] font-mono-data text-[#9EE8C8]">
              <Droplets className="w-3.5 h-3.5 text-[#7EE787]" />
              Madurai RO Field Operations
            </span>
            <h1 className="font-editorial text-4xl xl:text-[42px] font-bold tracking-tight leading-[1.12] text-[#FAF8F3]">
              Every purifier, service cycle, and spare part in one ledger.
            </h1>
            <p className="text-sm text-[#B4CBC3] leading-relaxed">
              Manage residential &amp; commercial RO fleets, dispatch bilingual WhatsApp reminders, and restock spare parts with Gemini Vision AI.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
            <div className="p-3.5 rounded-xl bg-[#12332C]/80 border border-[#1E4A40] space-y-1.5">
              <BellRing className="w-4 h-4 text-[#F6D285]" />
              <div className="text-xs font-bold text-[#FAF8F3]">Smart Reminders</div>
              <p className="text-[11px] text-[#86AB9F] leading-snug">
                90-day cycles &amp; automated EN/TA WhatsApp dispatch.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-[#12332C]/80 border border-[#1E4A40] space-y-1.5">
              <Sparkles className="w-4 h-4 text-[#7EE787]" />
              <div className="text-xs font-bold text-[#FAF8F3]">AI Stock Scan</div>
              <p className="text-[11px] text-[#86AB9F] leading-snug">
                Photograph spare parts or supplier bills to auto-log stock.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-[#12332C]/80 border border-[#1E4A40] space-y-1.5">
              <Package className="w-4 h-4 text-[#FFD8B2]" />
              <div className="text-xs font-bold text-[#FAF8F3]">Live Inventory</div>
              <p className="text-[11px] text-[#86AB9F] leading-snug">
                Auto-deduct filters &amp; membranes on every service visit.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Location Footer */}
        <div className="relative z-10 flex items-center justify-between text-xs text-[#7A9C91] border-t border-[#1C3E37] pt-5">
          <span className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-[#7EE787]" />
            Thirunagar 3rd Stop, near BATA showroom, Madurai
          </span>
          <span className="font-mono-data text-[11px]">Owner Portal</span>
        </div>
      </aside>

      {/* Right Authentication Panel */}
      <main className="lg:col-span-6 xl:col-span-5 flex flex-col justify-center items-center px-5 py-10 sm:px-10 bg-[#FAF8F3]">
        <div className="w-full max-w-md space-y-7 animate-fade-in">
          {/* Mobile Brand Header */}
          <div className="lg:hidden flex flex-col items-center text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-white p-1.5 shadow-md border border-[#DDD6C5] flex items-center justify-center overflow-hidden">
              <img
                src="/aqua-plus-logo.jpg"
                alt="Aqua Plus RO Tech"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h1 className="font-editorial text-2xl font-bold text-[#0C231F] tracking-tight">
                AquaPlus Service
              </h1>
              <p className="text-xs text-[#5C6E67] mt-0.5">
                Aqua Plus RO Tech • Thirunagar, Madurai
              </p>
            </div>
          </div>

          {/* Card Surface */}
          <div className="bg-white border border-[#E5DEC9] rounded-2xl p-6 sm:p-8 shadow-[0_12px_36px_-18px_rgba(12,35,31,0.18)] space-y-6">
            <div className="space-y-1.5">
              <h2 className="font-editorial text-2xl font-bold text-[#0C231F] tracking-tight">
                {currentUser ? 'Account not authorized' : 'Welcome back'}
              </h2>
              <p className="text-xs text-[#5C6E67] leading-relaxed">
                {currentUser
                  ? 'This Google account is not on the Aqua Plus business allowlist. Sign out and switch to an authorized owner account.'
                  : 'Sign in with an authorized Aqua Plus business account to access customer records, reminders, and inventory.'}
              </p>
            </div>

            {authError && (
              <div
                role="alert"
                className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs leading-relaxed flex items-start gap-2.5"
              >
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}

            {resetSent && (
              <div
                role="status"
                className="p-3.5 bg-[#EBF7F2] border border-[#C6EAD8] rounded-xl text-[#163830] text-xs flex items-start gap-2.5"
              >
                <CheckCircle2 className="w-4 h-4 text-[#165B50] shrink-0 mt-0.5" />
                <span>
                  Password setup link sent to <strong className="font-mono-data">{loginEmail}</strong>. Check your inbox.
                </span>
              </div>
            )}

            {currentUser ? (
              <div className="space-y-4">
                <div className="p-3.5 bg-[#F4F0E6] border border-[#DDD6C5] rounded-xl text-xs">
                  <div className="text-[11px] text-[#5C6E67]">Signed in as</div>
                  <div className="font-mono-data font-semibold text-[#1B2421] mt-0.5 truncate">
                    {currentUser.email || 'Unknown user'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onLogOut}
                  disabled={authLoading}
                  className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm rounded-xl shadow-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out &amp; Switch Account</span>
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Quick Owner Account Pills */}
                <div className="space-y-2">
                  <label className="block text-[11px] font-semibold text-[#5C6E67] uppercase tracking-wider">
                    Quick-Select Owner Account
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {OWNER_ACCOUNTS.map((acct) => {
                      const active = loginEmail.toLowerCase() === acct.email.toLowerCase();
                      return (
                        <button
                          key={acct.email}
                          type="button"
                          onClick={() => {
                            setLoginEmail(acct.email);
                            setResetSent(false);
                            onClearAuthError();
                          }}
                          className={`px-2.5 py-2 rounded-xl border text-left transition-all ${
                            active
                              ? 'bg-[#0C231F] text-[#FAF8F3] border-[#0C231F] shadow-sm'
                              : 'bg-[#FAF8F3] text-[#1B2421] border-[#DDD6C5] hover:border-[#0C231F]/40 hover:bg-[#F4F0E6]'
                          }`}
                        >
                          <div className="text-xs font-bold truncate">{acct.label}</div>
                          <div
                            className={`text-[10px] truncate ${
                              active ? 'text-[#9EE8C8]' : 'text-[#5C6E67]'
                            }`}
                          >
                            {acct.role}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Email & Password Form */}
                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="login-email"
                      className="block text-xs font-semibold text-[#1B2421]"
                    >
                      Business Email
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-[#7A8C84] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="login-email"
                        type="email"
                        value={loginEmail}
                        onChange={(e) => {
                          setLoginEmail(e.target.value);
                          setResetSent(false);
                          onClearAuthError();
                        }}
                        placeholder="owner@aquaplus.com"
                        required
                        autoComplete="email"
                        className="w-full pl-10 pr-3.5 py-2.5 bg-[#FAF8F3] border border-[#DDD6C5] rounded-xl text-xs font-mono-data text-[#1B2421] focus:outline-none focus:bg-white focus:border-[#0C231F] focus:ring-2 focus:ring-[#0C231F]/15 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="login-password"
                        className="block text-xs font-semibold text-[#1B2421]"
                      >
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={handleSendReset}
                        className="text-[11px] font-semibold text-[#165B50] hover:text-[#0C231F] transition-colors"
                      >
                        Set / reset password?
                      </button>
                    </div>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-[#7A8C84] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        value={loginPassword}
                        onChange={(e) => {
                          setLoginPassword(e.target.value);
                          onClearAuthError();
                        }}
                        placeholder="Enter account password"
                        required
                        autoComplete="current-password"
                        className="w-full pl-10 pr-10 py-2.5 bg-[#FAF8F3] border border-[#DDD6C5] rounded-xl text-xs text-[#1B2421] focus:outline-none focus:bg-white focus:border-[#0C231F] focus:ring-2 focus:ring-[#0C231F]/15 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#7A8C84] hover:text-[#1B2421] transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submittingPassword || authLoading || !loginPassword}
                    className="w-full py-3 px-4 bg-[#0C231F] hover:bg-[#163830] text-[#FAF8F3] font-bold text-sm rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50"
                  >
                    <span>{submittingPassword ? 'Signing in...' : 'Sign In'}</span>
                    {!submittingPassword && <ArrowRight className="w-4 h-4 text-[#7EE787]" />}
                  </button>
                </form>

                {/* Divider */}
                <div className="relative flex items-center py-0.5">
                  <div className="flex-1 border-t border-[#E5DEC9]" />
                  <span className="px-3 text-[11px] font-medium text-[#7A8C84]">or continue with</span>
                  <div className="flex-1 border-t border-[#E5DEC9]" />
                </div>

                {/* Google Sign-In Button */}
                <button
                  type="button"
                  onClick={onSignInWithGoogle}
                  disabled={authLoading}
                  className="w-full py-2.5 px-4 bg-white hover:bg-[#FAF8F3] text-[#1B2421] font-semibold text-xs rounded-xl border border-[#DDD6C5] hover:border-[#0C231F]/40 shadow-2xs flex items-center justify-center gap-2.5 transition-all active:scale-[0.99] disabled:opacity-50"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.08 3.56-5.15 3.56-8.65z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.87-3c-1.07.72-2.44 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.29v3.1A12 12 0 0 0 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.29 14.29A7.2 7.2 0 0 1 4.91 12c0-.8.14-1.57.38-2.29V6.61H1.29A12 12 0 0 0 0 12c0 1.94.46 3.77 1.29 5.39l4-3.1z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.76c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.61l4 3.1c.94-2.84 3.59-4.95 6.71-4.95z"
                    />
                  </svg>
                  <span>{authLoading ? 'Verifying...' : 'Sign in with Google'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Subtle Footer */}
          <p className="text-center text-[11px] text-[#7A8C84] font-mono-data">
            Authorized Aqua Plus RO Tech business accounts only
          </p>
        </div>
      </main>
    </div>
  );
};
