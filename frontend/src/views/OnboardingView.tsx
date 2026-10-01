import React, { useState, useRef } from 'react';
import {
  Smartphone,
  Store,
  Shirt,
  Coffee,
  Check,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Building2,
  User,
  Mail,
  Lock,
  Phone,
  MapPin,
  UploadCloud,
  ImageIcon,
  Trash2,
} from 'lucide-react';
import { api, type OnboardingPayload, type User as ApiUser, type Tenant as ApiTenant } from '../api/client';
import { toast } from 'sonner';

interface OnboardingViewProps {
  onSuccess: (token: string, user: ApiUser, tenant: ApiTenant) => void;
  onCancelToLogin: () => void;
}

type BusinessType = 'electronics' | 'general_retail' | 'clothing' | 'food_beverage';

interface BusinessTypeOption {
  id: BusinessType;
  title: string;
  badge?: string;
  description: string;
  available: boolean;
  icon: React.FC<{ className?: string }>;
}

const BUSINESS_TYPES: BusinessTypeOption[] = [
  {
    id: 'electronics',
    title: 'Electronics and Mobile Phones',
    badge: 'Active',
    description: 'Specialized for smartphone shops, computers, accessories, and IMEI serial tracking.',
    available: true,
    icon: Smartphone,
  },
  {
    id: 'general_retail',
    title: 'General Retail',
    badge: 'Coming Soon',
    description: 'Supermarkets, packaged merchandise, FMCG goods, and quick cashier checkout.',
    available: false,
    icon: Store,
  },
  {
    id: 'clothing',
    title: 'Clothing and Fashion',
    badge: 'Coming Soon',
    description: 'Apparel boutiques, footwear shops, and size or color variant tracking.',
    available: false,
    icon: Shirt,
  },
  {
    id: 'food_beverage',
    title: 'Food and Beverage',
    badge: 'Coming Soon',
    description: 'Cafes, bakeries, juice bars, dining menus, and ingredient tracking.',
    available: false,
    icon: Coffee,
  },
];

const TEAM_SIZES = ['1', '2-5', '6-10', '10+'];

export const OnboardingView: React.FC<OnboardingViewProps> = ({ onSuccess, onCancelToLogin }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');

  // Step 1: Selected Business Type
  const [businessType, setBusinessType] = useState<BusinessType>('electronics');

  // Step 2: Form fields
  const [businessName, setBusinessName] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('+251 9');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [password, setPassword] = useState('');
  const [city, setCity] = useState('Addis Ababa');
  const [teamSize, setTeamSize] = useState('2-5');

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (PNG, JPG, SVG, WebP)');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo file size must be less than 2MB');
      return;
    }

    setLogoFile(file);
    const previewUrl = URL.createObjectURL(file);
    setLogoPreview(previewUrl);
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    if (logoPreview) {
      URL.revokeObjectURL(logoPreview);
      setLogoPreview(null);
    }
    if (logoInputRef.current) {
      logoInputRef.current.value = '';
    }
  };

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Waitlist Screen State
  const [isWaitlisted, setIsWaitlisted] = useState(false);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [waitlistPhone, setWaitlistPhone] = useState('');
  const [waitlistMessage, setWaitlistMessage] = useState('');
  const [waitlistConsent, setWaitlistConsent] = useState(false);
  const [waitlistStatus, setWaitlistStatus] = useState<'form' | 'joined' | 'opted_out'>('form');
  const [isWaitlistLoading, setIsWaitlistLoading] = useState(false);

  const goToStep = (nextStep: 1 | 2 | 3) => {
    setDirection(nextStep > step ? 'forward' : 'backward');
    setStep(nextStep);
    setErrorMessage(null);
  };

  const handleNextFromStep1 = () => {
    goToStep(2);
  };

  const handleNextFromStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!businessName.trim()) {
      setErrorMessage('Please enter your business name.');
      return;
    }
    if (!ownerName.trim()) {
      setErrorMessage('Please enter the owner full name.');
      return;
    }
    if (!ownerPhone.trim() || ownerPhone.trim().length < 8) {
      setErrorMessage('Please enter a valid phone number.');
      return;
    }
    if (!ownerEmail.trim() || !ownerEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!password || password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    goToStep(3);
  };

  const handleFinishOnboarding = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    const payload: OnboardingPayload = {
      business_type: businessType,
      business_name: businessName.trim(),
      owner_name: ownerName.trim(),
      owner_phone: ownerPhone.trim(),
      owner_email: ownerEmail.trim().toLowerCase(),
      password,
      city: city.trim() || 'Addis Ababa',
      team_size: teamSize,
      logo: logoFile || undefined,
    };

    try {
      const res = await api.onboard(payload);
      toast.success('Workspace created successfully');
      onSuccess(res.token, res.user, res.tenant);
    } catch (err: any) {
      if (err.error === 'not_whitelisted' || err.status === 403) {
        setAttemptId(err.attempt_id || null);
        setWaitlistPhone(ownerPhone);
        setIsWaitlisted(true);
        setIsSubmitting(false);
        return;
      }
      console.error('Onboarding failed:', err);
      const msg = err.message || 'Failed to create workspace. Please check your information.';
      setErrorMessage(msg);
      toast.error('Setup failed', { description: msg });
      setIsSubmitting(false);
      goToStep(2);
    }
  };

  const handleJoinWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waitlistConsent) return;
    try {
      setIsWaitlistLoading(true);
      await api.joinWaitlist({
        name: ownerName.trim(),
        email: ownerEmail.trim().toLowerCase(),
        phone: waitlistPhone.trim() || undefined,
        business_name: businessName.trim() || undefined,
        message: waitlistMessage.trim() || undefined,
        consented: true,
        attempt_id: attemptId || undefined,
      });
      setWaitlistStatus('joined');
    } catch (err: any) {
      toast.error('Failed to submit waitlist', { description: err.message });
    } finally {
      setIsWaitlistLoading(false);
    }
  };

  const handleDeclineWaitlist = async () => {
    try {
      setIsWaitlistLoading(true);
      await api.joinWaitlist({
        name: ownerName.trim() || 'Guest',
        email: ownerEmail.trim().toLowerCase(),
        consented: false,
        attempt_id: attemptId || undefined,
      });
      setWaitlistStatus('opted_out');
    } catch (err: any) {
      toast.error('Request failed', { description: err.message });
    } finally {
      setIsWaitlistLoading(false);
    }
  };

  if (isWaitlisted) {
    if (waitlistStatus === 'joined') {
      return (
        <div className="min-h-screen bg-[#f6f8fa] dark:bg-[#0b0f17] flex flex-col justify-center items-center p-4 sm:p-6 font-sans transition-colors duration-200">
          <div className="w-full max-w-lg bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xl overflow-hidden p-8 text-center space-y-6 animate-page-enter">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                You're on the list.
              </h1>
            </div>
            <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              <p>We'll reach out to you personally when your workspace is ready. Thank you.</p>
            </div>
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onCancelToLogin}
                className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>← Back to login</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (waitlistStatus === 'opted_out') {
      return (
        <div className="min-h-screen bg-[#f6f8fa] dark:bg-[#0b0f17] flex flex-col justify-center items-center p-4 sm:p-6 font-sans transition-colors duration-200">
          <div className="w-full max-w-lg bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xl overflow-hidden p-8 text-center space-y-6 animate-page-enter">
            <div className="space-y-1.5">
              <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                Understood. We haven't saved your details.
              </h1>
            </div>
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onCancelToLogin}
                className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>← Back to login</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-[#f6f8fa] dark:bg-[#0b0f17] flex flex-col justify-center items-center p-4 sm:p-6 font-sans transition-colors duration-200">
        <div className="w-full max-w-xl bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xl overflow-hidden animate-page-enter">
          {/* Header */}
          <div className="px-6 sm:px-8 pt-7 pb-5 border-b border-slate-100 dark:border-slate-800/80 text-center space-y-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3 font-bold text-xs">
              HB
            </div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-snug">
              We're currently in private beta with a selected group of shops.
            </h1>
            <div className="pt-1 text-xs text-slate-500 dark:text-slate-400">
              <p>Leave your details and we'll reach out personally when registration opens for your shop.</p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleJoinWaitlist} className="p-6 sm:p-8 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Owner Name
                </label>
                <input
                  type="text"
                  value={ownerName}
                  disabled
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-xs font-medium text-slate-600 dark:text-slate-400 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={ownerEmail}
                  disabled
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-xs font-medium text-slate-600 dark:text-slate-400 cursor-not-allowed"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Business Name
                </label>
                <input
                  type="text"
                  value={businessName}
                  disabled
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-xs font-medium text-slate-600 dark:text-slate-400 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Phone Number <span className="text-[10px] text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={waitlistPhone}
                  onChange={(e) => setWaitlistPhone(e.target.value)}
                  placeholder="+251 9..."
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tell us about your shop <span className="text-[10px] text-slate-400 font-normal font-sans">(optional)</span>
              </label>
              <textarea
                value={waitlistMessage}
                onChange={(e) => setWaitlistMessage(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Tell us about your shop..."
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400 resize-none"
              />
            </div>

            {/* Consent Checkbox */}
            <div className="pt-2">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={waitlistConsent}
                  onChange={(e) => setWaitlistConsent(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 dark:border-slate-700 cursor-pointer"
                />
                <div className="text-xs text-slate-700 dark:text-slate-300 leading-snug">
                  <p className="font-medium">I agree to be contacted when registration opens for new shops.</p>
                </div>
              </label>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handleDeclineWaitlist}
                disabled={isWaitlistLoading}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50 text-center"
              >
                No thanks
              </button>

              <button
                type="submit"
                disabled={!waitlistConsent || isWaitlistLoading}
                className="w-full sm:w-auto h-10 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isWaitlistLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <span>Join Waitlist</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f8fa] dark:bg-[#0b0f17] flex flex-col justify-center items-center p-4 sm:p-6 font-sans transition-colors duration-200">
      <div className="w-full max-w-xl bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xl overflow-hidden">
        {/* Stepper Progress Bar */}
        <div className="w-full bg-slate-100 dark:bg-slate-800/80 h-1">
          <div
            className="h-full bg-emerald-600 dark:bg-emerald-500 transition-all duration-500 ease-out"
            style={{ width: step === 1 ? '33.33%' : step === 2 ? '66.66%' : '100%' }}
          />
        </div>

        {/* Stepper Header */}
        <div className="px-6 sm:px-8 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs flex items-center justify-center tracking-tight shadow-xs">
              HB
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 dark:text-white">
                Set Up New Business
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Step {step} of 3 —{' '}
                {step === 1 && 'Choose Business Vertical'}
                {step === 2 && 'Business and Login Details'}
                {step === 3 && 'Confirm and Launch'}
              </p>
            </div>
          </div>

          {/* Stepper Pills */}
          <div className="flex items-center gap-1.5">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  s === step
                    ? 'w-6 bg-emerald-600 dark:bg-emerald-500'
                    : s < step
                    ? 'w-2.5 bg-emerald-600/50 dark:bg-emerald-500/50'
                    : 'w-2.5 bg-slate-200 dark:bg-slate-700'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step Contents */}
        <div className="p-6 sm:p-8">
          {errorMessage && (
            <div className="mb-5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 text-xs font-medium flex items-center justify-between">
              <span>{errorMessage}</span>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-rose-500 hover:text-rose-700 ml-2 font-bold cursor-pointer"
              >
                ×
              </button>
            </div>
          )}

          {/* STEP 1: Business Type Selection */}
          {step === 1 && (
            <div
              key="step-1"
              className={`space-y-5 ${
                direction === 'forward' ? 'animate-liquid-forward' : 'animate-liquid-backward'
              }`}
            >
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                  Choose Business Vertical
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Select your industry to configure catalog structure, inventory tracking, and accounts.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {BUSINESS_TYPES.map((type) => {
                  const Icon = type.icon;
                  const isSelected = businessType === type.id;
                  const isAvailable = type.available;

                  if (!isAvailable) {
                    return (
                      <div
                        key={type.id}
                        className="p-4 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-slate-50/40 dark:bg-slate-900/20 text-left opacity-45 cursor-not-allowed select-none flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500">
                              <Icon className="w-4 h-4" />
                            </div>
                            <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 px-2 py-0.5 rounded-full">
                              Coming Soon
                            </span>
                          </div>
                          <div className="font-semibold text-xs text-slate-500 dark:text-slate-400">
                            {type.title}
                          </div>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 leading-relaxed">
                            {type.description}
                          </p>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setBusinessType(type.id)}
                      className={`text-left p-4 rounded-xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                        isSelected
                          ? 'border-emerald-600 dark:border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20 ring-1 ring-emerald-600/30 dark:ring-emerald-500/30 shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                              isSelected
                                ? 'bg-emerald-600 dark:bg-emerald-500 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>

                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-900/50 px-2 py-0.5 rounded-full">
                            <Check className="w-3 h-3" /> Ready
                          </span>
                        </div>

                        <div className="font-semibold text-xs text-slate-900 dark:text-white">
                          {type.title}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                          {type.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onCancelToLogin}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  Back to Sign In
                </button>

                <button
                  type="button"
                  onClick={handleNextFromStep1}
                  className="h-10 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-2 transition-all shadow-xs cursor-pointer active:scale-95"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Business & Login Details */}
          {step === 2 && (
            <form
              key="step-2"
              onSubmit={handleNextFromStep2}
              className={`space-y-4 ${
                direction === 'forward' ? 'animate-liquid-forward' : 'animate-liquid-backward'
              }`}
            >
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                  Business and Login Details
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Enter your business information and your credentials as the owner.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Business Name */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Business Name
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Bole Medhanialem Electronics"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      className="w-full h-10 pl-9 pr-3 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* Business Logo (Optional) */}
                <div className="sm:col-span-2 p-3.5 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center shrink-0 overflow-hidden shadow-xs relative">
                        {logoPreview ? (
                          <img
                            src={logoPreview}
                            alt="Logo preview"
                            className="w-full h-full object-contain p-1"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                            <ImageIcon className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                            Business Logo
                          </label>
                          <span className="text-[10px] text-slate-400 font-normal">
                            (Optional)
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Featured on sales receipts, statements, and shop navigation.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                        className="hidden"
                        onChange={handleLogoChange}
                      />
                      <button
                        type="button"
                        onClick={() => logoInputRef.current?.click()}
                        className="h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <UploadCloud className="w-3.5 h-3.5 text-slate-500" />
                        <span>{logoPreview ? 'Change' : 'Upload Logo'}</span>
                      </button>
                      {logoPreview && (
                        <button
                          type="button"
                          onClick={handleRemoveLogo}
                          className="h-8 px-2.5 rounded-lg border border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-xs transition-colors cursor-pointer flex items-center"
                          title="Remove logo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Owner Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Owner Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Yonas Tadesse"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      className="w-full h-10 pl-9 pr-3 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* Owner Phone */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="tel"
                      required
                      placeholder="+251 91 123 4567"
                      value={ownerPhone}
                      onChange={(e) => setOwnerPhone(e.target.value)}
                      className="w-full h-10 pl-9 pr-3 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* Owner Email */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Owner Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="email"
                      required
                      placeholder="owner@yourshop.et"
                      value={ownerEmail}
                      onChange={(e) => setOwnerEmail(e.target.value)}
                      className="w-full h-10 pl-9 pr-3 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="password"
                      required
                      placeholder="Minimum 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full h-10 pl-9 pr-3 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* City */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    City
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      placeholder="Addis Ababa"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full h-10 pl-9 pr-3 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* Team Size */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Team Size
                  </label>
                  <div className="grid grid-cols-4 gap-1.5 h-10">
                    {TEAM_SIZES.map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setTeamSize(sz)}
                        className={`h-full text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                          teamSize === sz
                            ? 'bg-slate-900 dark:bg-emerald-600 text-white border-transparent shadow-xs'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                        }`}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => goToStep(1)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>

                <button
                  type="submit"
                  className="h-10 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-2 transition-all shadow-xs cursor-pointer active:scale-95"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: Review & Confirmation */}
          {step === 3 && (
            <div
              key="step-3"
              className={`space-y-5 ${
                direction === 'forward' ? 'animate-liquid-forward' : 'animate-liquid-backward'
              }`}
            >
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                  Confirm and Launch Workspace
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Review your information before initializing your workspace.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 text-xs overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50/50 dark:bg-slate-900/40">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Business</span>
                  <div className="flex items-center gap-2">
                    {logoPreview && (
                      <img
                        src={logoPreview}
                        alt="Logo"
                        className="w-5 h-5 rounded-md object-contain border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    )}
                    <span className="font-semibold text-slate-900 dark:text-white">{businessName}</span>
                  </div>
                </div>
                {logoPreview && (
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Brand Logo</span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      <Check className="w-3 h-3" /> Attached
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Business Vertical</span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                    Electronics and Mobile Phones
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50/50 dark:bg-slate-900/40">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Owner</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{ownerName}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Owner Email</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{ownerEmail}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50/50 dark:bg-slate-900/40">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Phone and Location</span>
                  <span className="text-slate-700 dark:text-slate-300">
                    {ownerPhone} · {city}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Team Capacity</span>
                  <span className="text-slate-700 dark:text-slate-300">{teamSize} members</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-emerald-200/70 dark:border-emerald-900/40 bg-emerald-50/30 dark:bg-emerald-950/20 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Includes the 2026 Electronics Starter Catalog with curated categories and smartphone models (Galaxy S25, iPhone 16 series, Tecno, MacBooks) for immediate stock intake.
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => goToStep(2)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleFinishOnboarding}
                  className="h-10 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-2 transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Setting up workspace...</span>
                    </>
                  ) : (
                    <>
                      <span>Launch Workspace</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
