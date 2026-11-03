import React, { useState, useEffect } from 'react';
import type { FinancialAccount, AccountActivity } from '../api/client';
import { api } from '../api/client';
import { toast } from 'sonner';
import {
  ArrowRightLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Coins,
  Loader2,
  X,
  Plus,
  Trash2,
  Landmark,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Home,
  Car,
  Gem,
  Globe,
  FileText,
  Inbox,
} from 'lucide-react';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { useBalancePrivacy } from '../context/BalancePrivacyContext';
import { ManageAccountModal } from '../components/treasury/ManageAccountModal';
import { AddBalanceModal } from '../components/treasury/AddBalanceModal';
import { AccountLedgerDrawer } from '../components/drawers/AccountLedgerDrawer';
import { AccountLogo, matchBankPreset, getAccountLogoInfo } from '../utils/bankLogos';
import { CustomPageLoader } from '../components/loading/CustomPageLoader';
// Pagination import removed — desktop uses carousel slider, not pagination

// Helpers for Bank Clean Name and Cash Account Detection (No Amharic script)
const getBankCleanName = (acc: FinancialAccount): string => {
  if (isCashAccount(acc)) return 'Cash on Hand';

  const explicitLogo = acc.logo || (acc.asset_details?.logo as string | undefined);
  const matched = matchBankPreset(acc.name, acc.type, explicitLogo);
  if (matched) return matched.name;

  if (acc.account_number) return acc.account_number;
  if (acc.type === 'bank') return 'Bank Account';
  if (acc.type === 'mobile_money') return 'Mobile Wallet';
  return acc.type ? acc.type.replace(/_/g, ' ') : 'Account';
};

const isCashAccount = (acc: FinancialAccount): boolean => {
  return (
    acc.type === 'cash' ||
    acc.name.toLowerCase().includes('safe') ||
    acc.name.toLowerCase().includes('cash') ||
    acc.name.toLowerCase().includes('drawer')
  );
};

// Variant 0: Glowing Bar Chart Wave (matches Card 1 in reference)
const BarChartWave: React.FC<{ gradId: string }> = ({ gradId }) => (
  <div className="absolute bottom-0 right-0 w-44 h-32 pointer-events-none select-none overflow-hidden z-0">
    <svg viewBox="0 0 180 130" fill="none" className="w-full h-full">
      <defs>
        <linearGradient id={`wave0-${gradId}`} x1="40" y1="130" x2="180" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ecfdf5" stopOpacity="0.9" />
          <stop offset="0.6" stopColor="#d1fae5" stopOpacity="0.5" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id={`barGrad-${gradId}`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#34d399" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
      </defs>
      {/* Soft translucent curved wave */}
      <path d="M40,130 Q90,75 150,30 L180,30 L180,130 Z" fill={`url(#wave0-${gradId})`} />
      {/* 3 vertical rounded bars with increasing height */}
      <rect x="135" y="75" width="5.5" height="32" rx="2.75" fill="#34d399" fillOpacity="0.9" />
      <rect x="145" y="60" width="5.5" height="47" rx="2.75" fill="#059669" fillOpacity="0.95" />
      <rect x="155" y="70" width="5.5" height="37" rx="2.75" fill="#10b981" fillOpacity="0.9" />
    </svg>
  </div>
);

// Variant 1: Laser Streak Fold (matches Card 2 in reference with subtle corner fold and short glowing laser line)
const LaserStreakFold: React.FC<{ gradId: string }> = ({ gradId }) => (
  <div className="absolute bottom-0 right-0 w-44 h-32 pointer-events-none select-none overflow-hidden z-0">
    <svg viewBox="0 0 180 130" fill="none" className="w-full h-full">
      <defs>
        <linearGradient id={`wave1-${gradId}`} x1="50" y1="130" x2="180" y2="25" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f0f9ff" stopOpacity="0.9" />
          <stop offset="0.6" stopColor="#e0f2fe" stopOpacity="0.5" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id={`streakGrad-${gradId}`} x1="118" y1="96" x2="162" y2="68" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0284c7" />
          <stop offset="0.3" stopColor="#0ea5e9" />
          <stop offset="0.75" stopColor="#2dd4bf" />
          <stop offset="1" stopColor="#67e8f9" />
        </linearGradient>
      </defs>
      {/* Soft translucent corner fold */}
      <path d="M50,130 Q105,80 155,25 L180,25 L180,130 Z" fill={`url(#wave1-${gradId})`} />
      {/* Subtle curved crease highlight */}
      <path d="M78,126 Q120,84 165,30" stroke="#bae6fd" strokeWidth="1" strokeOpacity="0.6" />
      {/* Sleek, short luminous cyan curved streak matching Card 2 reference fold */}
      <path
        d="M 124,80 Q 146,68 166,52"
        stroke="#0ea5e9"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
    </svg>
  </div>
);

// Variant 2: Sparkline Trend Wave (matches Card 3 in reference)
const SparklineTrendWave: React.FC<{ gradId: string }> = ({ gradId }) => (
  <div className="absolute bottom-0 right-0 w-44 h-32 pointer-events-none select-none overflow-hidden z-0">
    <svg viewBox="0 0 180 130" fill="none" className="w-full h-full">
      <defs>
        <linearGradient id={`wave2-${gradId}`} x1="45" y1="130" x2="180" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff7ed" stopOpacity="0.8" />
          <stop offset="0.6" stopColor="#ecfdf5" stopOpacity="0.5" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      {/* Soft translucent curved wave */}
      <path d="M45,130 Q98,78 155,25 L180,25 L180,130 Z" fill={`url(#wave2-${gradId})`} />
      {/* Rising trendline zigzag graph floating cleanly above button area */}
      <path
        d="M 122,80 L 136,68 L 148,76 L 168,46"
        stroke="#10b981"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </div>
);

// Variant 3: Concentric Pulse Rings
const ConcentricPulseRings: React.FC<{ gradId: string }> = ({ gradId }) => (
  <div className="absolute bottom-0 right-0 w-44 h-32 pointer-events-none select-none overflow-hidden z-0">
    <svg viewBox="0 0 180 130" fill="none" className="w-full h-full">
      <defs>
        <linearGradient id={`wave3-${gradId}`} x1="45" y1="130" x2="180" y2="25" gradientUnits="userSpaceOnUse">
          <stop stopColor="#faf5ff" stopOpacity="0.85" />
          <stop offset="0.6" stopColor="#f3e8ff" stopOpacity="0.4" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <path d="M45,130 Q98,78 158,25 L180,25 L180,130 Z" fill={`url(#wave3-${gradId})`} />
      <circle cx="162" cy="78" r="16" stroke="#c084fc" strokeWidth="2" strokeOpacity="0.5" fill="none" />
      <circle cx="162" cy="78" r="28" stroke="#a855f7" strokeWidth="2" strokeOpacity="0.35" fill="none" />
      <circle cx="162" cy="78" r="40" stroke="#9333ea" strokeWidth="1.8" strokeOpacity="0.2" fill="none" />
    </svg>
  </div>
);

// Variant 4: Double Wave Ribbon
const DoubleWaveRibbon: React.FC<{ gradId: string }> = ({ gradId }) => (
  <div className="absolute bottom-0 right-0 w-44 h-32 pointer-events-none select-none overflow-hidden z-0">
    <svg viewBox="0 0 180 130" fill="none" className="w-full h-full">
      <defs>
        <linearGradient id={`wave4-${gradId}`} x1="40" y1="130" x2="180" y2="35" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f0f9ff" stopOpacity="0.8" />
          <stop offset="0.7" stopColor="#e0f2fe" stopOpacity="0.4" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <path d="M40,130 Q96,82 152,32 L180,32 L180,130 Z" fill={`url(#wave4-${gradId})`} />
      <path d="M 116,78 Q 142,60 168,44" stroke="#0ea5e9" strokeWidth="2.8" strokeLinecap="round" />
      <path d="M 126,84 Q 148,70 170,56" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.8" />
    </svg>
  </div>
);

// Variant 5: Flow Stream Wave
const FlowStreamWave: React.FC<{ gradId: string }> = ({ gradId }) => (
  <div className="absolute bottom-0 right-0 w-44 h-32 pointer-events-none select-none overflow-hidden z-0">
    <svg viewBox="0 0 180 130" fill="none" className="w-full h-full">
      <defs>
        <linearGradient id={`wave5-${gradId}`} x1="45" y1="130" x2="180" y2="25" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fefce8" stopOpacity="0.8" />
          <stop offset="0.6" stopColor="#fef3c7" stopOpacity="0.4" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <path d="M45,130 Q98,75 158,25 L180,25 L180,130 Z" fill={`url(#wave5-${gradId})`} />
      <path d="M 118,78 Q 144,60 168,44" stroke="#eab308" strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  </div>
);

// Dynamic Card Ambient Art selector ensuring cards across slide 1 and slide 2 are all unique
const DynamicCardAmbientArt: React.FC<{ acc: FinancialAccount; index: number }> = ({ acc, index }) => {
  const safeId = `${acc.id.replace(/[^a-zA-Z0-9]/g, '')}-${index}`;
  const variant = Math.abs(index) % 6;
  switch (variant) {
    case 0:
      return <BarChartWave gradId={safeId} />;
    case 1:
      return <LaserStreakFold gradId={safeId} />;
    case 2:
      return <SparklineTrendWave gradId={safeId} />;
    case 3:
      return <ConcentricPulseRings gradId={safeId} />;
    case 4:
      return <DoubleWaveRibbon gradId={safeId} />;
    case 5:
    default:
      return <FlowStreamWave gradId={safeId} />;
  }
};

// Subtle Golden EMV Smart Chip for ATM/Debit Card Styling (Solid golden bevel & etched circuitry)
const EmvChip: React.FC<{ className?: string }> = ({ className = 'w-9 h-7' }) => (
  <div
    className={`${className} shrink-0 rounded-md p-[1.5px] shadow-[0_2px_5px_rgba(180,83,9,0.35),inset_0_1px_1px_rgba(255,255,255,0.6)] relative overflow-hidden select-none`}
    style={{
      background: 'linear-gradient(135deg, #fef08a 0%, #facc15 30%, #eab308 65%, #ca8a04 100%)',
      backgroundColor: '#facc15',
    }}
  >
    <div
      className="w-full h-full rounded-[4px] relative overflow-hidden flex items-center justify-center border border-[#ca8a04]/40"
      style={{
        background: 'linear-gradient(135deg, #fef9c3 0%, #fde047 30%, #eab308 70%, #d97706 100%)',
        backgroundColor: '#eab308',
      }}
    >
      {/* Specular metallic highlight band */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          background: 'linear-gradient(115deg, transparent 20%, rgba(255,255,255,0.8) 45%, transparent 60%)',
        }}
      />
      <svg viewBox="0 0 36 28" className="w-full h-full relative z-10" fill="none">
        <path d="M0 10.5 H12 C13.5 10.5 14.5 11.5 14.5 13 V15 C14.5 16.5 13.5 17.5 12 17.5 H0" stroke="#78350f" strokeWidth="0.9" strokeOpacity="0.8" />
        <path d="M36 10.5 H24 C22.5 10.5 21.5 11.5 21.5 13 V15 C21.5 16.5 22.5 17.5 24 17.5 H36" stroke="#78350f" strokeWidth="0.9" strokeOpacity="0.8" />
        <path d="M12 0 V28" stroke="#78350f" strokeWidth="0.9" strokeOpacity="0.8" />
        <path d="M24 0 V28" stroke="#78350f" strokeWidth="0.9" strokeOpacity="0.8" />
        <circle cx="18" cy="14" r="3.2" fill="#fef9c3" stroke="#78350f" strokeWidth="0.85" strokeOpacity="0.85" />
      </svg>
    </div>
  </div>
);

// Contactless EMV Payment Wave Icon (Classic radiating arcs for tap-to-pay)
const ContactlessWave: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <path d="M8.5 15.5 A5 5 0 0 1 8.5 8.5" strokeOpacity="0.5" />
    <path d="M12 18 A8.5 8.5 0 0 1 12 6" strokeOpacity="0.75" />
    <path d="M15.5 20.5 A12 12 0 0 1 15.5 3.5" strokeOpacity="0.95" />
  </svg>
);

// Format account number like an authentic physical debit card (e.g. 1000  ••••  ••••  9821)
const formatCardNumber = (accountNumber?: string | null, accountId?: string): string => {
  if (accountNumber && accountNumber.trim()) {
    const raw = accountNumber.trim().replace(/\s+/g, '');
    if (raw.length >= 12) {
      const first4 = raw.slice(0, 4);
      const last4 = raw.slice(-4);
      return `${first4}  ••••  ••••  ${last4}`;
    }
    if (raw.length >= 8) {
      const first4 = raw.slice(0, 4);
      const last4 = raw.slice(-4);
      return `${first4}  ••••  ••••  ${last4}`;
    }
    return raw;
  }
  const fallbackLast4 = (accountId || '0000').slice(-4).toUpperCase();
  return `••••  ••••  ••••  ${fallbackLast4}`;
};

// Format unhidden account number for mobile ATM card (no gaps, continuous number)
const formatUnhiddenAccountNumber = (accountNumber?: string | null, accountId?: string): string => {
  if (accountNumber && accountNumber.trim()) {
    return accountNumber.trim().replace(/\s+/g, '');
  }
  const fallbackDigits = (accountId || '1000283948292733').replace(/[^0-9]/g, '').padEnd(16, '0').slice(0, 16);
  return fallbackDigits;
};

// Frameless Bank Logo component for Mobile ATM Cards (large, prominent bank icon, no box border)
const FramelessCardLogo: React.FC<{ account: FinancialAccount; className?: string }> = ({
  account,
  className = 'w-13 h-13',
}) => {
  const isCash = isCashAccount(account);
  if (isCash) {
    return (
      <div className={`${className} shrink-0 flex items-center justify-center text-emerald-600 dark:text-emerald-400 drop-shadow-sm`}>
        <Landmark className="w-10 h-10 stroke-[2.2]" />
      </div>
    );
  }

  const info = getAccountLogoInfo(account);

  return (
    <div className={`${className} shrink-0 flex items-center justify-center drop-shadow-sm`}>
      <img
        src={info.src}
        alt={account.name}
        className="w-full h-full object-contain drop-shadow-sm"
      />
    </div>
  );
};

// Human-friendly date formatting for transactions (e.g. "Today, 09:30", "Yesterday, 18:42")
const formatActivityDate = (dateStr?: string): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Today, ${timeStr}`;
  if (isYesterday) return `Yesterday, ${timeStr}`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// 3D Realistic Stack of Gold Bullion Ingots with Metallic Bevels and Sparkle Sheen
const GoldIngotStack: React.FC<{ className?: string }> = ({ className = 'w-14 h-12' }) => (
  <svg
    viewBox="0 0 64 52"
    className={`${className} drop-shadow-[0_4px_14px_rgba(245,158,11,0.45)]`}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="goldTopGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#fffbeb" />
        <stop offset="30%" stopColor="#fef08a" />
        <stop offset="70%" stopColor="#facc15" />
        <stop offset="100%" stopColor="#eab308" />
      </linearGradient>
      <linearGradient id="goldFrontGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#facc15" />
        <stop offset="50%" stopColor="#eab308" />
        <stop offset="100%" stopColor="#ca8a04" />
      </linearGradient>
      <linearGradient id="goldSideGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#ca8a04" />
        <stop offset="100%" stopColor="#854d0e" />
      </linearGradient>
    </defs>
    {/* Bottom Left Ingot */}
    <g transform="translate(2, 22)">
      <polygon points="4,9 26,9 23,20 1,20" fill="url(#goldFrontGrad)" stroke="#a16207" strokeWidth="0.6" />
      <polygon points="7,2 29,2 26,9 4,9" fill="url(#goldTopGrad)" stroke="#ca8a04" strokeWidth="0.6" />
      <polygon points="29,2 26,9 23,20 26,13" fill="url(#goldSideGrad)" stroke="#854d0e" strokeWidth="0.6" />
    </g>
    {/* Bottom Right Ingot */}
    <g transform="translate(30, 22)">
      <polygon points="4,9 26,9 23,20 1,20" fill="url(#goldFrontGrad)" stroke="#a16207" strokeWidth="0.6" />
      <polygon points="7,2 29,2 26,9 4,9" fill="url(#goldTopGrad)" stroke="#ca8a04" strokeWidth="0.6" />
      <polygon points="29,2 26,9 23,20 26,13" fill="url(#goldSideGrad)" stroke="#854d0e" strokeWidth="0.6" />
    </g>
    {/* Top Center Ingot (Elevated & Prominent) */}
    <g transform="translate(16, 5)">
      <ellipse cx="16" cy="20" rx="14" ry="2.5" fill="#78350f" fillOpacity="0.4" />
      <polygon points="4,10 28,10 25,22 1,22" fill="url(#goldFrontGrad)" stroke="#a16207" strokeWidth="0.8" />
      <polygon points="8,2 32,2 28,10 4,10" fill="url(#goldTopGrad)" stroke="#ca8a04" strokeWidth="0.8" />
      <polygon points="32,2 28,10 25,22 29,14" fill="url(#goldSideGrad)" stroke="#854d0e" strokeWidth="0.8" />
      <text x="17" y="7" textAnchor="middle" fill="#854d0e" fontSize="3.6" fontWeight="900" fontFamily="sans-serif" letterSpacing="0.4">
        999.9 FINE GOLD
      </text>
    </g>
    {/* Sparkle glints */}
    <path d="M18 4 L19 7 L22 8 L19 9 L18 12 L17 9 L14 8 L17 7 Z" fill="#ffffff" />
    <path d="M48 24 L48.8 26 L51 26.8 L48.8 27.6 L48 30 L47.2 27.6 L45 26.8 L47.2 26 Z" fill="#ffffff" opacity="0.8" />
  </svg>
);

type AssetCategory = 'gold' | 'fx_usd' | 'fx_eur' | 'fx_gbp' | 'fx_crypto' | 'fx_general' | 'property' | 'vehicle' | 'gem' | 'custom';

const detectAssetCategory = (acc: FinancialAccount): AssetCategory => {
  const nameLower = (acc.name || '').toLowerCase();
  const currLower = (acc.currency || '').toLowerCase();
  const typeLower = (acc.type || '').toLowerCase();
  const categoryLower = ((acc.asset_details as any)?.category || '').toLowerCase();

  // 1. Gold Bullion / Reserve
  if (
    typeLower === 'asset_gold' ||
    currLower === 'gold' ||
    currLower === 'xau' ||
    nameLower.includes('gold') ||
    nameLower.includes('bullion') ||
    nameLower.includes('ingot') ||
    nameLower.includes('ወርቅ')
  ) {
    return 'gold';
  }

  // 2. Real Estate / Property / House
  if (
    nameLower.includes('house') ||
    nameLower.includes('home') ||
    nameLower.includes('property') ||
    nameLower.includes('villa') ||
    nameLower.includes('building') ||
    nameLower.includes('land') ||
    nameLower.includes('apartment') ||
    nameLower.includes('condo') ||
    nameLower.includes('estate') ||
    categoryLower.includes('property') ||
    categoryLower.includes('real_estate')
  ) {
    return 'property';
  }

  // 3. Vehicles
  if (
    nameLower.includes('car') ||
    nameLower.includes('vehicle') ||
    nameLower.includes('auto') ||
    nameLower.includes('truck') ||
    nameLower.includes('toyota') ||
    nameLower.includes('mercedes') ||
    categoryLower.includes('vehicle')
  ) {
    return 'vehicle';
  }

  // 4. Jewelry / Gems / Watches
  if (
    nameLower.includes('gem') ||
    nameLower.includes('diamond') ||
    nameLower.includes('jewelry') ||
    nameLower.includes('jewel') ||
    nameLower.includes('watch') ||
    nameLower.includes('rolex')
  ) {
    return 'gem';
  }

  // 5. Foreign Currency & Crypto
  if (typeLower === 'asset_fx' || ['usd', 'eur', 'gbp', 'usdt', 'aed', 'sar', 'cad'].includes(currLower)) {
    if (currLower === 'usd' || nameLower.includes('usd') || nameLower.includes('dollar')) return 'fx_usd';
    if (currLower === 'eur' || nameLower.includes('eur') || nameLower.includes('euro')) return 'fx_eur';
    if (currLower === 'gbp' || nameLower.includes('gbp') || nameLower.includes('pound')) return 'fx_gbp';
    if (currLower === 'usdt' || currLower === 'crypto' || nameLower.includes('usdt') || nameLower.includes('tether') || nameLower.includes('crypto')) return 'fx_crypto';
    return 'fx_general';
  }

  return 'custom';
};

const ReserveAssetIcon: React.FC<{ acc: FinancialAccount; size?: 'sm' | 'md' | 'lg' }> = ({ acc, size = 'md' }) => {
  const category = detectAssetCategory(acc);
  const isSm = size === 'sm';
  const isLg = size === 'lg';
  const sizeClasses = isLg ? 'w-20 h-20 rounded-3xl' : isSm ? 'w-10 h-10 rounded-xl' : 'w-18 h-18 rounded-2xl';

  if (category === 'gold') {
    return (
      <div className={`${sizeClasses} bg-gradient-to-br from-amber-400/35 via-yellow-400/30 to-amber-600/20 shadow-[0_12px_28px_-6px_rgba(245,158,11,0.45)] flex items-center justify-center relative overflow-hidden group-hover:scale-105 transition-transform duration-300`}>
        <GoldIngotStack className={isLg ? 'w-14 h-12' : isSm ? 'w-7 h-6' : 'w-13 h-11'} />
      </div>
    );
  }

  if (category === 'fx_usd') {
    return (
      <div className={`${sizeClasses} bg-gradient-to-br from-emerald-400/35 via-teal-400/30 to-emerald-600/20 shadow-[0_12px_28px_-6px_rgba(16,185,129,0.45)] flex flex-col items-center justify-center relative overflow-hidden group-hover:scale-105 transition-transform duration-300`}>
        <div className="flex items-center text-emerald-600 dark:text-emerald-400 font-black">
          <DollarSign className={isLg ? 'w-10 h-10 stroke-[2.75]' : isSm ? 'w-5 h-5 stroke-[2.75]' : 'w-8 h-8 stroke-[2.75]'} />
        </div>
        {!isSm && (
          <span className="text-[10px] font-mono font-black tracking-wider text-emerald-700 dark:text-emerald-300 -mt-1 uppercase">
            USD
          </span>
        )}
      </div>
    );
  }

  if (category === 'fx_eur') {
    return (
      <div className={`${sizeClasses} bg-gradient-to-br from-blue-400/35 via-indigo-400/30 to-blue-600/20 shadow-[0_12px_28px_-6px_rgba(59,130,246,0.45)] flex flex-col items-center justify-center relative overflow-hidden group-hover:scale-105 transition-transform duration-300`}>
        <span className={`${isSm ? 'text-lg' : isLg ? 'text-4xl' : 'text-3xl'} font-black text-blue-600 dark:text-blue-400 leading-none`}>€</span>
        {!isSm && (
          <span className="text-[10px] font-mono font-black tracking-wider text-blue-700 dark:text-blue-300 mt-0.5 uppercase">
            EUR
          </span>
        )}
      </div>
    );
  }

  if (category === 'fx_gbp') {
    return (
      <div className={`${sizeClasses} bg-gradient-to-br from-violet-400/35 via-purple-400/30 to-violet-600/20 shadow-[0_12px_28px_-6px_rgba(139,92,246,0.45)] flex flex-col items-center justify-center relative overflow-hidden group-hover:scale-105 transition-transform duration-300`}>
        <span className={`${isSm ? 'text-lg' : isLg ? 'text-4xl' : 'text-3xl'} font-black text-violet-600 dark:text-violet-400 leading-none`}>£</span>
        {!isSm && (
          <span className="text-[10px] font-mono font-black tracking-wider text-violet-700 dark:text-violet-300 mt-0.5 uppercase">
            GBP
          </span>
        )}
      </div>
    );
  }

  if (category === 'fx_crypto') {
    return (
      <div className={`${sizeClasses} bg-gradient-to-br from-teal-400/35 via-cyan-400/30 to-teal-600/20 shadow-[0_12px_28px_-6px_rgba(20,184,166,0.45)] flex flex-col items-center justify-center relative overflow-hidden group-hover:scale-105 transition-transform duration-300`}>
        <span className={`${isSm ? 'text-lg' : isLg ? 'text-4xl' : 'text-3xl'} font-black text-teal-600 dark:text-teal-400 leading-none`}>₮</span>
        {!isSm && (
          <span className="text-[10px] font-mono font-black tracking-wider text-teal-700 dark:text-teal-300 mt-0.5 uppercase">
            USDT
          </span>
        )}
      </div>
    );
  }

  if (category === 'property') {
    return (
      <div className={`${sizeClasses} bg-gradient-to-br from-blue-500/35 via-indigo-600/30 to-slate-800/15 shadow-[0_12px_28px_-6px_rgba(59,130,246,0.45)] flex flex-col items-center justify-center relative overflow-hidden group-hover:scale-105 transition-transform duration-300`}>
        <Home className={`${isLg ? 'w-10 h-10' : isSm ? 'w-5 h-5' : 'w-8 h-8'} text-blue-600 dark:text-blue-400 stroke-[2.2]`} />
        {!isSm && (
          <span className="text-[9.5px] font-bold tracking-wider text-blue-700 dark:text-blue-300 mt-0.5 uppercase">
            ESTATE
          </span>
        )}
      </div>
    );
  }

  if (category === 'vehicle') {
    return (
      <div className={`${sizeClasses} bg-gradient-to-br from-purple-500/35 via-violet-600/30 to-slate-800/15 shadow-[0_12px_28px_-6px_rgba(168,85,247,0.45)] flex flex-col items-center justify-center relative overflow-hidden group-hover:scale-105 transition-transform duration-300`}>
        <Car className={`${isLg ? 'w-10 h-10' : isSm ? 'w-5 h-5' : 'w-8 h-8'} text-purple-600 dark:text-purple-400 stroke-[2.2]`} />
        {!isSm && (
          <span className="text-[9.5px] font-bold tracking-wider text-purple-700 dark:text-purple-300 mt-0.5 uppercase">
            VEHICLE
          </span>
        )}
      </div>
    );
  }

  if (category === 'gem') {
    return (
      <div className={`${sizeClasses} bg-gradient-to-br from-rose-500/35 via-pink-600/30 to-amber-600/15 shadow-[0_12px_28px_-6px_rgba(244,63,94,0.45)] flex flex-col items-center justify-center relative overflow-hidden group-hover:scale-105 transition-transform duration-300`}>
        <Gem className={`${isLg ? 'w-10 h-10' : isSm ? 'w-5 h-5' : 'w-8 h-8'} text-rose-600 dark:text-rose-400 stroke-[2.2]`} />
        {!isSm && (
          <span className="text-[9.5px] font-bold tracking-wider text-rose-700 dark:text-rose-300 mt-0.5 uppercase">
            LUXURY
          </span>
        )}
      </div>
    );
  }

  if (category === 'fx_general') {
    return (
      <div className={`${sizeClasses} bg-gradient-to-br from-emerald-400/35 via-teal-500/30 to-emerald-600/15 shadow-[0_12px_28px_-6px_rgba(16,185,129,0.45)] flex flex-col items-center justify-center relative overflow-hidden group-hover:scale-105 transition-transform duration-300`}>
        <Globe className={`${isLg ? 'w-10 h-10' : isSm ? 'w-5 h-5' : 'w-8 h-8'} text-emerald-600 dark:text-emerald-400 stroke-[2.2]`} />
        {!isSm && (
          <span className="text-[10px] font-mono font-black tracking-wider text-emerald-700 dark:text-emerald-300 mt-0.5 uppercase">
            {acc.currency || 'FX'}
          </span>
        )}
      </div>
    );
  }

  // Default Custom Asset
  return (
    <div className={`${sizeClasses} bg-gradient-to-br from-slate-500/35 via-zinc-600/30 to-slate-800/15 shadow-[0_12px_28px_-6px_rgba(100,116,139,0.45)] flex flex-col items-center justify-center relative overflow-hidden group-hover:scale-105 transition-transform duration-300`}>
      <Landmark className={`${isLg ? 'w-10 h-10' : isSm ? 'w-5 h-5' : 'w-8 h-8'} text-slate-700 dark:text-slate-300 stroke-[2.2]`} />
      {!isSm && (
        <span className="text-[9.5px] font-bold tracking-wider text-slate-700 dark:text-slate-300 mt-0.5 uppercase">
          ASSET
        </span>
      )}
    </div>
  );
};

// getAssetCategoryMeta removed — unused after cardless reserve redesign

const getAssetCardTheme = (acc: FinancialAccount) => {
  const category = detectAssetCategory(acc);
  switch (category) {
    case 'gold':
      return {
        bg: 'bg-gradient-to-b from-white via-amber-50/30 to-amber-100/10 dark:from-[#1b170e] dark:via-[#141109] dark:to-[#0d0b06] border-amber-200/70 dark:border-amber-500/25 shadow-[0_18px_35px_-10px_rgba(245,158,11,0.1),0_4px_12px_rgba(0,0,0,0.02)] hover:border-amber-400/80 hover:shadow-[0_24px_45px_-10px_rgba(245,158,11,0.22)]',
        glow: 'from-amber-400/20 via-transparent to-transparent',
        dot: 'bg-amber-500',
      };
    case 'fx_usd':
    case 'fx_crypto':
    case 'fx_general':
      return {
        bg: 'bg-gradient-to-b from-white via-emerald-50/30 to-emerald-100/10 dark:from-[#0d1a15] dark:via-[#09130f] dark:to-[#050c09] border-emerald-200/70 dark:border-emerald-500/25 shadow-[0_18px_35px_-10px_rgba(16,185,129,0.1),0_4px_12px_rgba(0,0,0,0.02)] hover:border-emerald-400/80 hover:shadow-[0_24px_45px_-10px_rgba(16,185,129,0.22)]',
        glow: 'from-emerald-400/20 via-transparent to-transparent',
        dot: 'bg-emerald-500',
      };
    case 'fx_eur':
    case 'property':
      return {
        bg: 'bg-gradient-to-b from-white via-blue-50/30 to-indigo-100/10 dark:from-[#0f172a] dark:via-[#0a0f1d] dark:to-[#060912] border-blue-200/70 dark:border-blue-500/25 shadow-[0_18px_35px_-10px_rgba(59,130,246,0.1),0_4px_12px_rgba(0,0,0,0.02)] hover:border-blue-400/80 hover:shadow-[0_24px_45px_-10px_rgba(59,130,246,0.22)]',
        glow: 'from-blue-400/20 via-transparent to-transparent',
        dot: 'bg-blue-500',
      };
    case 'vehicle':
    case 'fx_gbp':
      return {
        bg: 'bg-gradient-to-b from-white via-purple-50/30 to-violet-100/10 dark:from-[#181024] dark:via-[#110a1a] dark:to-[#0a0610] border-purple-200/70 dark:border-purple-500/25 shadow-[0_18px_35px_-10px_rgba(168,85,247,0.1),0_4px_12px_rgba(0,0,0,0.02)] hover:border-purple-400/80 hover:shadow-[0_24px_45px_-10px_rgba(168,85,247,0.22)]',
        glow: 'from-purple-400/20 via-transparent to-transparent',
        dot: 'bg-purple-500',
      };
    case 'gem':
      return {
        bg: 'bg-gradient-to-b from-white via-rose-50/30 to-pink-100/10 dark:from-[#1f1017] dark:via-[#150a0f] dark:to-[#0c0508] border-rose-200/70 dark:border-rose-500/25 shadow-[0_18px_35px_-10px_rgba(244,63,94,0.1),0_4px_12px_rgba(0,0,0,0.02)] hover:border-rose-400/80 hover:shadow-[0_24px_45px_-10px_rgba(244,63,94,0.22)]',
        glow: 'from-rose-400/20 via-transparent to-transparent',
        dot: 'bg-rose-500',
      };
    case 'custom':
    default:
      return {
        bg: 'bg-gradient-to-b from-white via-slate-50/50 to-slate-100/20 dark:from-[#172033] dark:via-[#111726] dark:to-[#0c101a] border-slate-200/80 dark:border-slate-700/60 shadow-[0_18px_35px_-10px_rgba(0,0,0,0.07),0_4px_12px_rgba(0,0,0,0.02)] hover:border-slate-400/80 hover:shadow-[0_24px_45px_-10px_rgba(0,0,0,0.12)]',
        glow: 'from-slate-400/15 via-transparent to-transparent',
        dot: 'bg-slate-500',
      };
  }
};

interface TreasuryViewProps {
  accounts?: FinancialAccount[];
  initialSelectedAccount?: FinancialAccount | null;
  onClearInitialContext?: () => void;
}

export const TreasuryView: React.FC<TreasuryViewProps> = ({
  accounts,
  initialSelectedAccount,
  onClearInitialContext,
}) => {
  const initialTreasury = React.useMemo(
    () => (accounts || []).filter((a) => a.type === 'bank' || a.type === 'cash' || a.type === 'mobile_money'),
    [accounts]
  );
  const initialAssets = React.useMemo(
    () => (accounts || []).filter((a) => a.type === 'asset_gold' || a.type === 'custom' || a.type.startsWith('asset_')),
    [accounts]
  );

  const [treasuryAccounts, setTreasuryAccounts] = useState<FinancialAccount[]>(initialTreasury);
  const [assetAccounts, setAssetAccounts] = useState<FinancialAccount[]>(initialAssets);
  const [totalTreasury, setTotalTreasury] = useState(() =>
    initialTreasury.reduce((sum, a) => sum + Number(a.current_balance), 0)
  );
  const [totalAssets, setTotalAssets] = useState(() =>
    initialAssets.reduce((sum, a) => sum + Number(a.current_balance), 0)
  );
  const [loading, setLoading] = useState(!accounts || accounts.length === 0);

  // Sync state when accounts prop updates
  useEffect(() => {
    if (accounts && accounts.length > 0) {
      const treas = accounts.filter((a) => a.type === 'bank' || a.type === 'cash' || a.type === 'mobile_money');
      const asts = accounts.filter((a) => a.type === 'asset_gold' || a.type === 'custom' || a.type.startsWith('asset_'));
      setTreasuryAccounts(treas);
      setAssetAccounts(asts);
      setTotalTreasury(treas.reduce((sum, a) => sum + Number(a.current_balance), 0));
      setTotalAssets(asts.reduce((sum, a) => sum + Number(a.current_balance), 0));
      setLoading(false);
    }
  }, [accounts]);

  // Pagination removed — desktop uses carousel slider approach

  // Desktop Carousel Slides (max 2 rows x 3 columns = 6 for banks, 1 row x 3 columns = 3 for assets)
  const BANK_SLIDE_SIZE = 6;
  const bankSlides = React.useMemo(() => {
    const slides: FinancialAccount[][] = [];
    for (let i = 0; i < treasuryAccounts.length; i += BANK_SLIDE_SIZE) {
      slides.push(treasuryAccounts.slice(i, i + BANK_SLIDE_SIZE));
    }
    return slides.length > 0 ? slides : [[]];
  }, [treasuryAccounts]);

  const bankScrollRef = React.useRef<HTMLDivElement>(null);
  const [canScrollBankLeft, setCanScrollBankLeft] = useState(false);
  const [canScrollBankRight, setCanScrollBankRight] = useState(false);

  const updateBankScrollState = () => {
    const el = bankScrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollBankLeft(scrollLeft > 4);
    setCanScrollBankRight(scrollLeft < scrollWidth - clientWidth - 4);
  };

  useEffect(() => {
    updateBankScrollState();
    const timer = setTimeout(updateBankScrollState, 80);
    const el = bankScrollRef.current;
    if (!el) return () => clearTimeout(timer);
    el.addEventListener('scroll', updateBankScrollState, { passive: true });
    window.addEventListener('resize', updateBankScrollState);
    return () => {
      clearTimeout(timer);
      el.removeEventListener('scroll', updateBankScrollState);
      window.removeEventListener('resize', updateBankScrollState);
    };
  }, [treasuryAccounts.length, bankSlides.length]);

  const scrollBank = (dir: 'left' | 'right') => {
    const el = bankScrollRef.current;
    if (!el) return;
    const scrollAmt = el.clientWidth;
    el.scrollBy({
      left: dir === 'left' ? -scrollAmt : scrollAmt,
      behavior: 'smooth',
    });
  };

  const RESERVE_SLIDE_SIZE = 3;
  const reserveSlides = React.useMemo(() => {
    const slides: FinancialAccount[][] = [];
    for (let i = 0; i < assetAccounts.length; i += RESERVE_SLIDE_SIZE) {
      slides.push(assetAccounts.slice(i, i + RESERVE_SLIDE_SIZE));
    }
    return slides.length > 0 ? slides : [[]];
  }, [assetAccounts]);

  const reserveScrollRef = React.useRef<HTMLDivElement>(null);
  const [canScrollReserveLeft, setCanScrollReserveLeft] = useState(false);
  const [canScrollReserveRight, setCanScrollReserveRight] = useState(false);

  const updateReserveScrollState = () => {
    const el = reserveScrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollReserveLeft(scrollLeft > 4);
    setCanScrollReserveRight(scrollLeft < scrollWidth - clientWidth - 4);
  };

  useEffect(() => {
    updateReserveScrollState();
    const timer = setTimeout(updateReserveScrollState, 80);
    const el = reserveScrollRef.current;
    if (!el) return () => clearTimeout(timer);
    el.addEventListener('scroll', updateReserveScrollState, { passive: true });
    window.addEventListener('resize', updateReserveScrollState);
    return () => {
      clearTimeout(timer);
      el.removeEventListener('scroll', updateReserveScrollState);
      window.removeEventListener('resize', updateReserveScrollState);
    };
  }, [assetAccounts.length, reserveSlides.length]);

  const scrollReserve = (dir: 'left' | 'right') => {
    const el = reserveScrollRef.current;
    if (!el) return;
    const scrollAmt = el.clientWidth;
    el.scrollBy({
      left: dir === 'left' ? -scrollAmt : scrollAmt,
      behavior: 'smooth',
    });
  };

  // Mobile ATM Cards and Transactions State (matches reference screenshot)
  const [mobileCategory, setMobileCategory] = useState<'banks' | 'reserves'>('banks');
  const [mobileActiveIndex, setMobileActiveIndex] = useState(0);
  const { isBalancesHidden } = useBalancePrivacy();
  const [mobileActivities, setMobileActivities] = useState<Record<string, AccountActivity[]>>({});
  const [loadingMobileActivities, setLoadingMobileActivities] = useState(false);
  const mobileCardScrollRef = React.useRef<HTMLDivElement>(null);

  const mobileAccounts = mobileCategory === 'banks' ? treasuryAccounts : assetAccounts;
  const activeMobileAccount = mobileAccounts[mobileActiveIndex] || mobileAccounts[0];

  useEffect(() => {
    if (!activeMobileAccount) return;
    const accId = activeMobileAccount.id;
    if (mobileActivities[accId]) return;

    let isMounted = true;
    setLoadingMobileActivities(true);
    api.getAccountActivities(accId)
      .then((res) => {
        if (isMounted) {
          setMobileActivities((prev) => ({
            ...prev,
            [accId]: res.activities || [],
          }));
        }
      })
      .catch((err) => {
        console.warn('Failed to load mobile activities for', accId, err);
      })
      .finally(() => {
        if (isMounted) setLoadingMobileActivities(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeMobileAccount?.id]);

  const handleSwitchMobileCategory = (cat: 'banks' | 'reserves') => {
    setMobileCategory(cat);
    setMobileActiveIndex(0);
    if (mobileCardScrollRef.current) {
      mobileCardScrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
    }
  };

  const handleSelectMobileCard = (idx: number) => {
    setMobileActiveIndex(idx);
    const el = mobileCardScrollRef.current;
    if (!el) return;
    const cardEl = el.children[idx] as HTMLElement;
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  };

  // High-Performance Touch & Mouse Gesture Handlers for Slidable Mobile Carousel
  const swipeGestureRef = React.useRef<{
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    startTime: number;
    isTracking: boolean;
  }>({ startX: 0, startY: 0, lastX: 0, lastY: 0, startTime: 0, isTracking: false });

  const handleGestureStart = (clientX: number, clientY: number) => {
    swipeGestureRef.current = {
      startX: clientX,
      startY: clientY,
      lastX: clientX,
      lastY: clientY,
      startTime: Date.now(),
      isTracking: true,
    };
  };

  const handleGestureMove = (clientX: number, clientY: number) => {
    if (!swipeGestureRef.current.isTracking) return;
    swipeGestureRef.current.lastX = clientX;
    swipeGestureRef.current.lastY = clientY;
  };

  const handleGestureEnd = () => {
    const gesture = swipeGestureRef.current;
    if (!gesture.isTracking) return;
    gesture.isTracking = false;

    const diffX = gesture.startX - gesture.lastX;
    const diffY = gesture.startY - gesture.lastY;
    const elapsed = Date.now() - gesture.startTime;

    // Trigger swipe if horizontal drag is significantly greater than vertical movement
    if (Math.abs(diffX) > Math.abs(diffY) * 1.15 && (Math.abs(diffX) > 28 || (Math.abs(diffX) > 16 && elapsed < 250))) {
      if (diffX > 0) {
        // Swipe left -> Next card / reserve
        setMobileActiveIndex((prev) => (prev < mobileAccounts.length - 1 ? prev + 1 : 0));
      } else {
        // Swipe right -> Previous card / reserve
        setMobileActiveIndex((prev) => (prev > 0 ? prev - 1 : mobileAccounts.length - 1));
      }
    }
  };

  // Dedicated Ledger Drawer
  const [selectedAccountForLedger, setSelectedAccountForLedger] = useState<FinancialAccount | null>(null);

  useEffect(() => {
    if (initialSelectedAccount) {
      setSelectedAccountForLedger(initialSelectedAccount);
      onClearInitialContext?.();
    }
  }, [initialSelectedAccount, onClearInitialContext]);

  // Transfer Modal
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [sourceAccountId, setSourceAccountId] = useState('');
  const [destAccountId, setDestAccountId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferFee, setTransferFee] = useState('0');
  const [transferDesc, setTransferDesc] = useState('');
  const [transferring, setTransferring] = useState(false);

  // Account Management Modal
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<FinancialAccount | null>(null);
  const [accountDefaultType, setAccountDefaultType] = useState('bank');

  // Delete Confirmation
  const [deletingAccount, setDeletingAccount] = useState<FinancialAccount | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showTransferModal) setShowTransferModal(false);
        if (deletingAccount) setDeletingAccount(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showTransferModal, deletingAccount]);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const res = await api.getAccounts();
      setTreasuryAccounts(res.treasury_accounts);
      setAssetAccounts(res.asset_accounts);
      setTotalTreasury(res.total_treasury);
      setTotalAssets(res.total_assets);
      setSelectedAccountForLedger((prev) => {
        if (!prev) return null;
        const all = [...res.treasury_accounts, ...res.asset_accounts];
        return all.find((a) => a.id === prev.id) || prev;
      });
    } catch (err: any) {
      toast.error('Failed to load financial accounts', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const calculateDefaultFee = (srcId: string, amtStr: string): string => {
    const all = [...treasuryAccounts, ...assetAccounts];
    const src = all.find((a) => a.id === srcId);
    if (!src || !src.default_fee_type || src.default_fee_type === 'none') {
      return '0';
    }
    const amt = parseFloat(amtStr) || 0;
    const rate = Number(src.default_fee_amount) || 0;
    if (rate <= 0) return '0';
    if (src.default_fee_type === 'fixed') {
      return String(rate);
    }
    if (src.default_fee_type === 'percentage') {
      const calc = (amt * rate) / 100;
      return String(Math.round(calc * 100) / 100);
    }
    return '0';
  };

  const handleOpenTransfer = (preselectedSourceId?: string) => {
    let chosenSourceId = '';
    if (preselectedSourceId) {
      chosenSourceId = preselectedSourceId;
      setSourceAccountId(preselectedSourceId);
      const other = treasuryAccounts.find((a) => a.id !== preselectedSourceId);
      if (other) setDestAccountId(other.id);
    } else if (treasuryAccounts.length >= 2) {
      chosenSourceId = treasuryAccounts[0].id;
      setSourceAccountId(treasuryAccounts[0].id);
      setDestAccountId(treasuryAccounts[1].id);
    }
    setTransferFee(calculateDefaultFee(chosenSourceId, transferAmount));
    setShowTransferModal(true);
  };

  const handleSourceAccountChange = (newSrcId: string) => {
    setSourceAccountId(newSrcId);
    setTransferFee(calculateDefaultFee(newSrcId, transferAmount));
  };

  const handleTransferAmountChange = (newAmt: string) => {
    setTransferAmount(newAmt);
    setTransferFee(calculateDefaultFee(sourceAccountId, newAmt));
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceAccountId || !destAccountId || !transferAmount) return;

    if (sourceAccountId === destAccountId) {
      toast.error('Invalid Transfer', { description: 'Source and destination accounts must be different.' });
      return;
    }

    try {
      setTransferring(true);
      await api.transferFunds({
        source_account_id: sourceAccountId,
        destination_account_id: destAccountId,
        amount: parseFloat(transferAmount),
        fee: parseFloat(transferFee || '0'),
        description: transferDesc || undefined,
      });

      const srcAcc = treasuryAccounts.find((a) => a.id === sourceAccountId)?.name || 'Source';
      const dstAcc = treasuryAccounts.find((a) => a.id === destAccountId)?.name || 'Destination';

      toast.success('Funds Transferred Successfully', {
        description: `${parseFloat(transferAmount).toLocaleString()} ETB moved from ${srcAcc} to ${dstAcc}.`,
      });

      setShowTransferModal(false);
      setTransferAmount('');
      setTransferFee('0');
      setTransferDesc('');
      loadAccounts();
    } catch (err: any) {
      toast.error('Transfer failed', { description: err.message });
    } finally {
      setTransferring(false);
    }
  };

  const [selectedAccountForBalance, setSelectedAccountForBalance] = useState<FinancialAccount | null>(null);

  const handleOpenAddBalance = (acc: FinancialAccount) => {
    setSelectedAccountForBalance(acc);
  };

  const handleOpenCreate = (type = 'bank') => {
    setEditingAccount(null);
    setAccountDefaultType(type);
    setShowAccountModal(true);
  };

  const handleDelete = async () => {
    if (!deletingAccount) return;
    try {
      setDeleting(true);
      await api.deleteAccount(deletingAccount.id);
      toast.success('Account removed successfully', {
        description: `${deletingAccount.name} has been removed. All dependable historical records remain preserved.`,
      });
      setDeletingAccount(null);
      loadAccounts();
    } catch (err: any) {
      toast.error('Failed to remove account', { description: err.message });
    } finally {
      setDeleting(false);
    }
  };

  if (loading && treasuryAccounts.length === 0) {
    return <CustomPageLoader mode="app" fullScreen={false} />;
  }

  const allAccounts = [...treasuryAccounts, ...assetAccounts];
  const selectedSource = allAccounts.find((a) => a.id === sourceAccountId);
  const selectedDest = allAccounts.find((a) => a.id === destAccountId);

  return (
    <div className="space-y-1 sm:space-y-5 animate-page-enter">
      {/* 1. Treasury Capital Strip — Desktop Only (hidden sm:grid) */}
      <div className="hidden sm:grid grid-cols-3 gap-px bg-slate-200/60 dark:bg-slate-800/50 rounded-xl overflow-hidden border border-slate-200/60 dark:border-slate-800/60 shadow-xs mb-4">
        {/* Metric 1: Liquid Cash & Banks */}
        <div className="bg-white dark:bg-[#131926] px-4 sm:px-6 py-3 text-left">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-0.5 truncate">
            Bank Accounts
          </div>
          <div className="text-sm sm:text-base font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100 truncate">
            <AnimatedNumber value={totalTreasury} decimals={2} />
            <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 ml-1 font-sans">ETB</span>
          </div>
        </div>

        {/* Metric 2: Other Assets & Reserves */}
        <div className="bg-white dark:bg-[#131926] px-4 sm:px-6 py-3 text-left">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-0.5 truncate">
            Other Assets
          </div>
          <div className="text-sm sm:text-base font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100 truncate">
            <AnimatedNumber value={totalAssets} decimals={2} />
            <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 ml-1 font-sans">ETB</span>
          </div>
        </div>

        {/* Metric 3: Total Combined Treasury */}
        <div className="bg-white dark:bg-[#131926] px-4 sm:px-6 py-3 text-left">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-0.5 truncate">
            Total Combined
          </div>
          <div className="text-sm sm:text-base font-bold font-mono tracking-tight text-emerald-600 dark:text-emerald-400 truncate">
            <AnimatedNumber value={totalTreasury + totalAssets} decimals={2} />
            <span className="text-[10px] font-medium text-emerald-500/80 ml-1 font-sans">ETB</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DESKTOP VIEW (≥ sm): Full desktop view preserved and completely unaffected */}
      {/* ========================================================================= */}
      <div className="hidden sm:block space-y-8">
        {/* Bank Accounts & Mobile Wallets Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Bank Accounts & Wallets
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                {treasuryAccounts.length} {treasuryAccounts.length === 1 ? 'account' : 'accounts'}
              </span>
              <button
                onClick={() => handleOpenCreate('bank')}
                className="h-7 px-2.5 rounded-lg border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center gap-1 active:scale-95 cursor-pointer ml-1"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-600" />
                <span>Add Account</span>
              </button>
              <button
                onClick={() => handleOpenTransfer()}
                className="h-7 px-2.5 rounded-lg border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-500" />
                <span>Transfer</span>
              </button>
            </div>
          </div>

          {/* Desktop Bank Cards (≥ sm): Max 2 rows x 3 columns visible, horizontally scrollable with big floating nav arrows */}
          <div className="relative group/bank-slider">
            {/* Big Left Floating Slider Arrow */}
            {bankSlides.length > 1 && (
              <button
                onClick={() => scrollBank('left')}
                disabled={!canScrollBankLeft}
                className={`hidden sm:flex absolute -left-4 sm:-left-5 top-1/2 -translate-y-1/2 z-30 w-11 h-11 sm:w-12 sm:h-12 rounded-full items-center justify-center transition-all duration-300 border cursor-pointer ${
                  canScrollBankLeft
                    ? 'bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border-slate-200/90 dark:border-slate-700 text-slate-700 dark:text-slate-100 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-600 dark:hover:text-emerald-400 hover:scale-110 active:scale-95 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.15),0_4px_10px_-2px_rgba(0,0,0,0.06)] dark:shadow-[0_10px_25px_-5px_rgba(0,0,0,0.6)]'
                    : 'opacity-0 pointer-events-none scale-90'
                }`}
                aria-label="Previous bank accounts"
              >
                <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
              </button>
            )}

            <div
              ref={bankScrollRef}
              className="hidden sm:flex items-start overflow-x-auto scrollbar-none snap-x snap-mandatory gap-5 pb-2 pt-1"
            >
              {bankSlides.map((slide, sIdx) => (
                <div
                  key={sIdx}
                  className="w-full shrink-0 snap-start grid grid-cols-3 gap-5 items-start content-start auto-rows-max"
                >
                  {slide.map((acc, aIdx) => {
                    const globalIndex = sIdx * BANK_SLIDE_SIZE + aIdx;
                    const isInactive = acc.is_active === false;
                    const isCash = isCashAccount(acc);
                    return (
                      <div
                        key={acc.id}
                        onClick={() => setSelectedAccountForLedger(acc)}
                        className={`relative overflow-hidden rounded-3xl border p-5 sm:p-6 transition-all duration-300 flex flex-col justify-between cursor-pointer group min-h-[220px] h-[220px] self-start w-full ${
                          isInactive
                            ? 'bg-slate-50/80 dark:bg-[#131926]/60 border-slate-200/50 dark:border-slate-800/50 opacity-60'
                            : 'bg-gradient-to-br from-white via-[#fcfdfe] to-[#f8fafc] dark:from-[#182133] dark:via-[#131926] dark:to-[#0f1420] border-slate-200/70 dark:border-slate-800 shadow-[0_20px_35px_-10px_rgba(0,0,0,0.07),0_10px_20px_-5px_rgba(0,0,0,0.03),inset_0_1px_0_rgba(255,255,255,1)] dark:shadow-[0_20px_35px_-10px_rgba(0,0,0,0.5),0_10px_20px_-5px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.06)] hover:shadow-[0_28px_45px_-12px_rgba(0,0,0,0.12),0_12px_24px_-6px_rgba(0,0,0,0.05)] hover:-translate-y-1'
                        }`}
                      >
                        <DynamicCardAmbientArt acc={acc} index={globalIndex} />

                        <div className="relative z-10">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <AccountLogo account={acc} size="md" className="w-10 h-10 rounded-xl shrink-0 shadow-xs" />
                              <div className="min-w-0">
                                <div className="font-bold text-slate-800 dark:text-slate-100 text-sm sm:text-[14px] leading-tight truncate">
                                  {acc.name}
                                </div>
                                <div className="text-[11px] text-slate-400 dark:text-slate-500 font-medium truncate mt-0.5">
                                  {getBankCleanName(acc)}
                                </div>
                              </div>
                            </div>

                            <div className="shrink-0">
                              {isCash ? (
                                <div className="w-9 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800/40 flex items-center justify-center shrink-0 shadow-xs">
                                  <Landmark className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
                                </div>
                              ) : (
                                <EmvChip className="w-9 h-7" />
                              )}
                            </div>
                          </div>

                          <div className="mt-5">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 block mb-1">
                              {isCash ? 'CASH IN SAFE' : 'AVAILABLE BALANCE'}
                            </span>
                            <div className="font-mono font-black tabular-nums text-slate-900 dark:text-white text-2xl sm:text-[26px] tracking-tight leading-none">
                              <AnimatedNumber value={Number(acc.current_balance)} decimals={2} />
                              <span className="text-xs font-semibold text-slate-400 font-sans ml-1.5">ETB</span>
                            </div>
                            <div className="font-mono text-xs font-medium text-slate-400 dark:text-slate-500 tracking-wider mt-2 truncate">
                              {isCash ? 'Physical Cash Safe' : formatCardNumber(acc.account_number, acc.id)}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 pt-2.5 border-t border-slate-100/90 dark:border-slate-800/80 flex items-center justify-between gap-2 relative z-10" onClick={(e) => e.stopPropagation()}>
                          <div className="min-w-0">
                            {acc.default_fee_type && acc.default_fee_type !== 'none' && Number(acc.default_fee_amount) > 0 && (
                              <span className="inline-flex items-center text-[9px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200/60 dark:border-amber-900/40">
                                Fee: {Number(acc.default_fee_amount)}{acc.default_fee_type === 'percentage' ? '%' : ' ETB'}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {!isCash && (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenAddBalance(acc);
                                  }}
                                  title="Deposit / Add balance"
                                  className="w-7.5 h-7.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-[0_1px_3px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,0.9)] dark:shadow-none hover:border-emerald-500/40 text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30 transition-all flex items-center justify-center active:scale-95 cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeletingAccount(acc);
                                  }}
                                  title="Remove account"
                                  className="w-7.5 h-7.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-[0_1px_3px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,0.9)] dark:shadow-none hover:border-rose-500/40 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50/50 dark:hover:bg-rose-950/30 transition-all flex items-center justify-center active:scale-95 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenTransfer(acc.id);
                              }}
                              className="h-7.5 px-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-[0_1px_3px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,0.9)] dark:shadow-none hover:border-emerald-500/40 hover:text-emerald-600 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-500" />
                              <span>Transfer</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Big Right Floating Slider Arrow */}
            {bankSlides.length > 1 && (
              <button
                onClick={() => scrollBank('right')}
                disabled={!canScrollBankRight}
                className={`hidden sm:flex absolute -right-4 sm:-right-5 top-1/2 -translate-y-1/2 z-30 w-11 h-11 sm:w-12 sm:h-12 rounded-full items-center justify-center transition-all duration-300 border cursor-pointer ${
                  canScrollBankRight
                    ? 'bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border-slate-200/90 dark:border-slate-700 text-slate-700 dark:text-slate-100 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-600 dark:hover:text-emerald-400 hover:scale-110 active:scale-95 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.15),0_4px_10px_-2px_rgba(0,0,0,0.06)] dark:shadow-[0_10px_25px_-5px_rgba(0,0,0,0.6)]'
                    : 'opacity-0 pointer-events-none scale-90'
                }`}
                aria-label="Next bank accounts"
              >
                <ChevronRight className="w-6 h-6 stroke-[2.5]" />
              </button>
            )}
          </div>
        </div>

        {/* Hedge Reserves Section - Cardless, Icon-first, Minimal, Vibrant */}
        <div className="space-y-4">
          <div className="flex items-center justify-between pt-2">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                Hedge Reserves
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">Gold & foreign currency</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleOpenCreate('asset_fx')}
                className="h-8 px-3.5 rounded-xl bg-[#064e3b] hover:bg-[#065f46] text-white text-xs font-semibold transition-all flex items-center gap-1.5 active:scale-95 shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Reserve
              </button>
            </div>
          </div>

          {assetAccounts.length === 0 ? (
            <div className="bg-white dark:bg-[#131926] rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center">
              <Coins className="w-7 h-7 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-400">No asset reserves yet</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Add gold, USD, USDT, or other hedge assets</p>
            </div>
          ) : (
            <div className="relative group/reserve-slider">
              {/* Big Left Floating Slider Arrow */}
              {reserveSlides.length > 1 && (
                <button
                  onClick={() => scrollReserve('left')}
                  disabled={!canScrollReserveLeft}
                  className={`hidden sm:flex absolute -left-4 sm:-left-5 top-1/2 -translate-y-1/2 z-30 w-11 h-11 sm:w-12 sm:h-12 rounded-full items-center justify-center transition-all duration-300 border cursor-pointer ${
                    canScrollReserveLeft
                      ? 'bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border-slate-200/90 dark:border-slate-700 text-slate-700 dark:text-slate-100 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-600 dark:hover:text-emerald-400 hover:scale-110 active:scale-95 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.15),0_4px_10px_-2px_rgba(0,0,0,0.06)] dark:shadow-[0_10px_25px_-5px_rgba(0,0,0,0.6)]'
                      : 'opacity-0 pointer-events-none scale-90'
                  }`}
                  aria-label="Previous reserves"
                >
                  <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
                </button>
              )}

              <div
                ref={reserveScrollRef}
                className="hidden sm:flex items-start overflow-x-auto scrollbar-none snap-x snap-mandatory gap-5 pb-2 pt-1"
              >
                {reserveSlides.map((slide, sIdx) => (
                  <div
                    key={sIdx}
                    className="w-full shrink-0 snap-start grid grid-cols-3 gap-6 items-start content-start auto-rows-max"
                  >
                    {slide.map((acc) => {
                      const isInactive = acc.is_active === false;
                      const theme = getAssetCardTheme(acc);
                      return (
                        <div
                          key={acc.id}
                          onClick={() => setSelectedAccountForLedger(acc)}
                          className={`relative p-6 rounded-3xl transition-all duration-300 flex flex-col items-center justify-between cursor-pointer group min-h-[220px] self-start w-full hover:-translate-y-1 hover:bg-slate-50/70 dark:hover:bg-slate-800/30 ${
                            isInactive ? 'opacity-60' : ''
                          }`}
                        >
                          {/* Quick Action Buttons on hover */}
                          <div
                            className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1 z-20"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenAddBalance(acc);
                              }}
                              title="Deposit / Add balance"
                              className="w-7 h-7 rounded-lg bg-white/90 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-emerald-600 shadow-xs flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingAccount(acc);
                              }}
                              title="Remove reserve"
                              className="w-7 h-7 rounded-lg bg-white/90 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-400 hover:text-rose-600 shadow-xs flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Big Vibrant Centered Emblem with Radiant Ambient Halo */}
                          <div className="relative mb-2 mt-1">
                            <div className={`absolute inset-0 rounded-3xl blur-2xl opacity-70 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-tr ${theme.glow}`} />
                            <div className="relative z-10 group-hover:scale-110 transition-transform duration-300">
                              <ReserveAssetIcon acc={acc} size="lg" />
                            </div>
                          </div>

                          {/* Asset Name: Minimal & Bold */}
                          <h4 className="font-bold text-slate-900 dark:text-white text-base tracking-tight truncate max-w-full text-center leading-tight mt-1">
                            {acc.name}
                          </h4>

                          {/* Clean Numbers (Holdings & Valuation on one line) */}
                          <div className="flex items-center justify-center gap-2 mt-1 text-center">
                            {acc.asset_details?.total_foreign_amount != null && (
                              <span className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">
                                {Number(acc.asset_details.total_foreign_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                                <span className="text-[11px] font-bold text-slate-400 uppercase font-sans">
                                  {acc.currency === 'GOLD' ? 'g' : (acc.currency || 'USD')}
                                </span>
                              </span>
                            )}
                            {acc.asset_details?.total_foreign_amount != null && (
                              <span className="text-slate-300 dark:text-slate-600 text-xs">•</span>
                            )}
                            <div className="font-mono font-black tabular-nums text-slate-900 dark:text-white text-base tracking-tight">
                              <AnimatedNumber value={Number(acc.current_balance)} decimals={2} />
                              <span className="text-[10px] font-semibold text-slate-400 font-sans ml-1">ETB</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Big Right Floating Slider Arrow */}
              {reserveSlides.length > 1 && (
                <button
                  onClick={() => scrollReserve('right')}
                  disabled={!canScrollReserveRight}
                  className={`hidden sm:flex absolute -right-4 sm:-right-5 top-1/2 -translate-y-1/2 z-30 w-11 h-11 sm:w-12 sm:h-12 rounded-full items-center justify-center transition-all duration-300 border cursor-pointer ${
                    canScrollReserveRight
                      ? 'bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border-slate-200/90 dark:border-slate-700 text-slate-700 dark:text-slate-100 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-600 dark:hover:text-emerald-400 hover:scale-110 active:scale-95 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.15),0_4px_10px_-2px_rgba(0,0,0,0.06)] dark:shadow-[0_10px_25px_-5px_rgba(0,0,0,0.6)]'
                      : 'opacity-0 pointer-events-none scale-90'
                  }`}
                  aria-label="Next reserves"
                >
                  <ChevronRight className="w-6 h-6 stroke-[2.5]" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MOBILE VIEW (< sm): ATM-sized cards, touch-slidable, cardless reserves   */}
      {/* ========================================================================= */}
      <div className="sm:hidden space-y-0">
        {/* Centered Tab Switcher: Banks vs Reserves */}
        <div className="flex items-center justify-center py-0">
          <div className="flex items-center p-1 bg-[#e9eef5] dark:bg-slate-800 rounded-full">
            <button
              onClick={() => handleSwitchMobileCategory('banks')}
              className={`py-1.5 px-5.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                mobileCategory === 'banks'
                  ? 'bg-gradient-to-b from-[#094838] to-[#042d23] text-white shadow-sm border border-emerald-500/25'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              Banks ({treasuryAccounts.length})
            </button>
            <button
              onClick={() => handleSwitchMobileCategory('reserves')}
              className={`py-1.5 px-5.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                mobileCategory === 'reserves'
                  ? 'bg-gradient-to-b from-[#094838] to-[#042d23] text-white shadow-sm border border-emerald-500/25'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              Reserves ({assetAccounts.length})
            </button>
          </div>
        </div>

        {/* 3D Carousel Display — Full Bleed (-mx-4), Frosted Blurry Soft Cards, No Edge Cutoff */}
        {mobileAccounts.length === 0 ? (
          <div className="bg-white dark:bg-[#131926] rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center my-4">
            <p className="text-xs text-slate-400">No accounts in this category yet</p>
          </div>
        ) : (
          <>
            <div
              className="relative -mx-4 px-4 pt-0 pb-0 -mt-2 overflow-hidden select-none cursor-grab active:cursor-grabbing"
              onTouchStart={(e) => handleGestureStart(e.targetTouches[0].clientX, e.targetTouches[0].clientY)}
              onTouchMove={(e) => handleGestureMove(e.targetTouches[0].clientX, e.targetTouches[0].clientY)}
              onTouchEnd={handleGestureEnd}
              onTouchCancel={handleGestureEnd}
              onMouseDown={(e) => handleGestureStart(e.clientX, e.clientY)}
              onMouseMove={(e) => handleGestureMove(e.clientX, e.clientY)}
              onMouseUp={handleGestureEnd}
              onMouseLeave={handleGestureEnd}
              style={{
                touchAction: 'pan-y',
              }}
            >
              {/* 3D Stack Container — Balanced Height & Natural Proportions */}
              <div
                className="flex items-center justify-center relative"
                style={{
                  perspective: '1200px',
                  minHeight: mobileCategory === 'reserves' ? '165px' : '226px',
                }}
              >
                {mobileCategory === 'banks' && (
                  <div
                    aria-hidden="true"
                    className="absolute inset-x-[12%] top-[14%] bottom-[14%] rounded-[40px] blur-2xl pointer-events-none"
                    style={{
                      background: 'radial-gradient(ellipse at center, rgba(15,23,42,0.18) 0%, rgba(16,80,68,0.11) 42%, rgba(15,23,42,0) 76%)',
                    }}
                  />
                )}
                {mobileAccounts.map((acc, idx) => {
                  const isCash = isCashAccount(acc);
                  const isReserve = mobileCategory === 'reserves';
                  const total = mobileAccounts.length;

                  // Circular offset calculation
                  let offset = idx - mobileActiveIndex;
                  if (total > 2) {
                    if (offset > Math.floor(total / 2)) offset -= total;
                    if (offset < -Math.floor(total / 2)) offset += total;
                  }
                  const isCenter = offset === 0;
                  const isVisible = Math.abs(offset) <= 1;
                  if (!isVisible) return null;

                  // 3D positioning: natural clearance so back cards are never clipped by square borders
                  const translateX = isCenter ? 0 : offset * (isReserve ? 95 : 30);
                  const translateZ = isCenter ? 20 : -35;
                  const rotateY = isCenter ? 0 : offset * (isReserve ? 0 : -2.5);
                  const scale = isCenter ? 1 : isReserve ? 0.78 : 0.89;
                  const zIndex = isCenter ? 20 : 10;
                  const opacity = isCenter ? 1 : isReserve ? 0.45 : 0.38;
                  const isInactive = acc.is_active === false;
                  const theme = isReserve ? getAssetCardTheme(acc) : null;

                  return (
                    <div
                      key={acc.id}
                      onClick={() => {
                        if (isCenter) {
                          setSelectedAccountForLedger(acc);
                        } else {
                          handleSelectMobileCard(idx);
                        }
                      }}
                      className="absolute transition-all duration-500 ease-out flex items-center justify-center"
                      style={{
                        transform: `translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
                        zIndex,
                        opacity,
                        filter: isReserve ? 'none' : isCenter ? 'none' : 'blur(10px)',
                        WebkitFilter: isReserve ? 'none' : isCenter ? 'none' : 'blur(10px)',
                        width: isReserve ? '130px' : 'min(calc(100vw - 32px), 356px)',
                        maxWidth: isReserve ? '130px' : '356px',
                        cursor: 'pointer',
                      }}
                    >
                      {isReserve ? (
                        /* CARDLESS ASSET DISPLAY (Uncongested, ample breathing room, direct tap or swipe) */
                        <div
                          className={`flex flex-col items-center justify-center text-center p-2 transition-all duration-300 w-full select-none ${
                            isInactive ? 'opacity-60' : ''
                          }`}
                        >
                          <div className="relative mb-2">
                            {isCenter && (
                              <div
                                className={`absolute inset-0 rounded-full blur-2xl opacity-75 bg-gradient-to-tr ${theme?.glow || 'from-amber-400/20 to-transparent'}`}
                              />
                            )}
                            <div className="relative z-10 transition-transform duration-300 hover:scale-105 active:scale-95">
                              <ReserveAssetIcon acc={acc} size={isCenter ? 'lg' : 'md'} />
                            </div>
                          </div>
                          {isCenter ? (
                            <>
                              <h4 className="font-black text-slate-900 dark:text-white text-base tracking-tight truncate max-w-[150px] leading-tight">
                                {acc.name}
                              </h4>
                              <div className="flex items-center justify-center gap-1 mt-1">
                                <span className="font-mono font-black text-lg text-slate-900 dark:text-white tabular-nums">
                                  {!isBalancesHidden ? (
                                    <AnimatedNumber value={Number(acc.current_balance || 0)} decimals={2} />
                                  ) : (
                                    <span className="tracking-wider">******.**</span>
                                  )}
                                </span>
                                <span className="text-xs font-bold text-slate-500 font-sans">ETB</span>
                              </div>
                              {acc.asset_details?.total_foreign_amount != null && (
                                <div className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                                  {Number(acc.asset_details.total_foreign_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                                  <span className="text-[10px] font-sans font-bold text-slate-400 uppercase">
                                    {acc.currency === 'GOLD' ? 'g' : (acc.currency || 'USD')} Holdings
                                  </span>
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="text-[11px] font-bold text-slate-400 truncate max-w-[110px] mt-1 block">
                              {acc.name}
                            </span>
                          )}
                        </div>
                      ) : (
                        /* AUTHENTIC REALISTIC ATM / DEBIT CARD — FROSTED GLASS (APPLE STYLE) */
                        <>
                        {isCenter && (
                          <div
                            aria-hidden="true"
                            className="absolute bottom-[-10px] left-[10%] right-[10%] h-6 rounded-[50%] bg-slate-900/10 blur-xl pointer-events-none"
                          />
                        )}
                        <div
                          className={`relative z-10 overflow-hidden rounded-[20px] transition-all duration-300 flex flex-col justify-between w-full select-none ${
                            isInactive ? 'opacity-60' : ''
                          }`}
                          style={{
                            aspectRatio: '1.586 / 1',
                            backgroundColor: 'rgba(255, 255, 255, 0.55)',
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                            border: '1px solid rgba(255, 255, 255, 0.85)',
                            boxShadow: isCenter
                              ? '0 22px 45px -12px rgba(15, 23, 42, 0.22), 0 8px 18px -4px rgba(15, 23, 42, 0.10), 0 1px 3px 0 rgba(15, 23, 42, 0.04), inset 0 1.5px 0.5px 0 rgba(255, 255, 255, 0.98), inset 0 -1.5px 1.5px 0 rgba(15, 23, 42, 0.05), inset 0 0 0 1px rgba(255, 255, 255, 0.45)'
                              : '0 4px 16px -2px rgba(0, 0, 0, 0.03)',
                          }}
                        >
                          {/* ── APPLE LIQUID GLASS PERIMETER TREATMENT: Edge refraction, optical highlights, translucent rim ── */}
                          {/* 1. Translucent Rim & Dual-Edge Refraction Bevel (Inner stroke & rim refraction) */}
                          <div
                            aria-hidden="true"
                            className="absolute inset-0 rounded-[20px] pointer-events-none z-[12]"
                            style={{
                              boxShadow: `
                                inset 0 1.5px 1px 0 rgba(255, 255, 255, 0.95),
                                inset 0 -1.5px 2px 0 rgba(15, 23, 42, 0.07),
                                inset 1.5px 0 1px 0 rgba(255, 255, 255, 0.65),
                                inset -1.5px 0 1px 0 rgba(255, 255, 255, 0.35),
                                inset 0 0 0 1px rgba(255, 255, 255, 0.40)
                              `,
                            }}
                          />

                          {/* 2. Top Edge Optical Highlight: Sharp specular reflection glint along upper rim */}
                          <div
                            aria-hidden="true"
                            className="absolute inset-x-3 top-0 h-[1.5px] rounded-full pointer-events-none z-[13]"
                            style={{
                              background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.98) 22%, rgba(255, 255, 255, 0.75) 70%, transparent 100%)',
                              filter: 'drop-shadow(0 1px 1px rgba(255, 255, 255, 0.8))',
                            }}
                          />

                          {/* 3. Left Edge Optical Highlight: Vertical liquid refraction sheen */}
                          <div
                            aria-hidden="true"
                            className="absolute inset-y-3 left-0 w-[1.5px] rounded-full pointer-events-none z-[13]"
                            style={{
                              background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.90) 0%, rgba(255, 255, 255, 0.35) 45%, transparent 100%)',
                            }}
                          />

                          {/* 4. Top-Left Corner Glass Highlight: Concentrated corner specular glint */}
                          <div
                            aria-hidden="true"
                            className="absolute top-0 left-0 w-12 h-12 rounded-tl-[20px] pointer-events-none z-[13]"
                            style={{
                              background: 'radial-gradient(circle at 4px 4px, rgba(255, 255, 255, 0.85) 0%, rgba(255, 255, 255, 0.25) 35%, transparent 65%)',
                            }}
                          />

                          {/* 5. Bottom Rim Caustic Refraction: Soft light bounce on bottom perimeter */}
                          <div
                            aria-hidden="true"
                            className="absolute inset-x-8 bottom-0 h-[1px] rounded-full pointer-events-none z-[13]"
                            style={{
                              background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.55) 45%, transparent 100%)',
                            }}
                          />

                          {/* ── HORIZONTAL BLURRY MOSAIC: Minimal, soft ambient color haze spanning horizontally ── */}
                          <div
                            aria-hidden="true"
                            className="absolute inset-x-0 top-[25%] bottom-[20%] pointer-events-none z-[1] select-none overflow-hidden"
                            style={{ filter: 'blur(22px)', opacity: 0.5 }}
                          >
                            <svg
                              viewBox="0 0 356 100"
                              fill="none"
                              className="w-full h-full"
                              preserveAspectRatio="none"
                            >
                              {/* Staggered soft mosaic color cells spanning horizontally here and there — NO outlines, minimal soft tones */}
                              {/* Left: soft whisper of emerald */}
                              <rect x="25" y="18" width="55" height="42" rx="16" fill="#10b981" fillOpacity="0.22" />
                              <rect x="55" y="44" width="45" height="36" rx="14" fill="#059669" fillOpacity="0.16" />

                              {/* Center-left: warm champagne/gold touch */}
                              <rect x="110" y="24" width="50" height="40" rx="15" fill="#f59e0b" fillOpacity="0.18" />

                              {/* Center: delicate mint/teal */}
                              <rect x="165" y="38" width="52" height="42" rx="16" fill="#10b981" fillOpacity="0.20" />
                              <rect x="195" y="14" width="48" height="38" rx="14" fill="#14b8a6" fillOpacity="0.16" />

                              {/* Right: soft sage and champagne */}
                              <rect x="245" y="32" width="54" height="44" rx="16" fill="#059669" fillOpacity="0.18" />
                              <rect x="295" y="20" width="45" height="40" rx="14" fill="#f59e0b" fillOpacity="0.14" />
                            </svg>
                          </div>

                          {/* ── TOP SECTION: Logo + bank name flush to top ── */}
                          <div className="relative z-10 px-5 pt-4.5 flex items-center justify-between gap-3">
                            {/* Left: logo + name stacked tight */}
                            <div className="flex items-center gap-3 min-w-0">
                              <FramelessCardLogo account={acc} className="w-10.5 h-10.5 shrink-0" />
                              <div className="min-w-0">
                                <div className="font-black text-slate-900 text-[15px] leading-tight tracking-tight truncate max-w-[160px]">
                                  {acc.name}
                                </div>
                                {(() => {
                                  const cleanBank = getBankCleanName(acc);
                                  const subtitle = cleanBank && cleanBank.toLowerCase() !== acc.name.toLowerCase() ? cleanBank : null;
                                  return subtitle ? (
                                    <div className="text-[11px] text-slate-600 font-semibold truncate max-w-[160px] mt-[1px] leading-none">
                                      {subtitle}
                                    </div>
                                  ) : null;
                                })()}
                              </div>
                            </div>

                            {/* Right: contactless wave + EMV chip */}
                            <div className="shrink-0 flex items-center gap-2">
                              <ContactlessWave className="w-5 h-5 text-slate-500 stroke-[2.2]" />
                              {isCash ? (
                                <div className="w-9 h-7 rounded-lg bg-emerald-50 border border-emerald-200/70 flex items-center justify-center shrink-0">
                                  <Landmark className="w-4 h-4 text-emerald-600" />
                                </div>
                              ) : (
                                <EmvChip className="w-9.5 h-7.5" />
                              )}
                            </div>
                          </div>

                          {/* ── MIDDLE: Balance + account number directly below logo with comfortable gap ── */}
                          <div className="relative z-10 px-5 py-1">
                            <span className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-600 block mb-[3px]">
                              {isCash ? 'CASH IN SAFE' : 'TOTAL BALANCE'}
                            </span>
                            <div className="flex items-baseline gap-2 whitespace-nowrap">
                              <div className="font-mono font-black text-[clamp(1.35rem,6.8vw,1.8rem)] leading-none tabular-nums text-slate-900 tracking-tight">
                                {!isBalancesHidden ? (
                                  <AnimatedNumber value={Number(acc.current_balance || 0)} decimals={2} />
                                ) : (
                                  <span className="tracking-wider">******.**</span>
                                )}
                              </div>
                              <span className="text-sm font-black text-slate-600 font-sans">ETB</span>
                            </div>
                            <div className="font-mono text-[11px] font-bold text-slate-600 mt-[5px] tracking-[0.14em]">
                              {isCash ? 'Physical Cash Safe' : formatUnhiddenAccountNumber(acc.account_number, acc.id)}
                            </div>
                          </div>

                          {/* ── BOTTOM FILL: Quiet etched line work gives the card a premium finish ── */}
                          <div className="absolute bottom-0 left-0 right-0 h-[56px] pointer-events-none z-[2] overflow-hidden rounded-b-[20px]">
                            <div
                              className="absolute inset-0"
                              style={{
                                background: 'linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.12) 30%, rgba(16,185,129,0.035) 62%, rgba(16,185,129,0.10) 100%)',
                              }}
                            />
                            <div
                              className="absolute top-0 left-5 right-5 h-[0.5px]"
                              style={{ background: 'rgba(100,116,139,0.18)' }}
                            />
                            <svg aria-hidden="true" viewBox="0 0 180 80" className="absolute right-0 bottom-0 h-[56px] w-[140px] text-emerald-900/30">
                              <path d="M75 80C95 54 120 34 180 19M103 80C119 57 142 42 180 32M132 80C146 64 160 56 180 49" fill="none" stroke="currentColor" strokeWidth="0.8" />
                              <path d="M121 80C140 57 159 41 180 29" fill="none" stroke="white" strokeOpacity="0.85" strokeWidth="0.8" />
                              <circle cx="153" cy="43" r="2" fill="currentColor" />
                              <circle cx="169" cy="31" r="1.2" fill="currentColor" />
                              <path d="M18 58h24M18 64h16M18 70h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.55" />
                              <circle cx="47" cy="58" r="1.5" fill="currentColor" fillOpacity="0.55" />
                            </svg>
                            {/* Inactive badge pinned inside the fill zone */}
                            {acc.is_active === false && (
                              <div className="absolute bottom-3 right-4 flex items-center">
                                <span className="text-[9px] font-bold text-rose-600 uppercase tracking-widest bg-rose-50/90 px-2 py-0.5 rounded-full border border-rose-200/70">
                                  Inactive
                                </span>
                              </div>
                            )}
                          </div>
                          <div
                            aria-hidden="true"
                            className="absolute bottom-0 left-0 right-0 h-5 pointer-events-none z-[3] blur-md"
                            style={{ background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.45))' }}
                          />
                        </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Dot Indicators — Vertically Centered Between Card and Action Buttons */}
              {mobileAccounts.length > 1 && (
                <div className="flex items-center justify-center gap-1.5 py-3">
                  {mobileAccounts.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectMobileCard(idx)}
                      className={`rounded-full transition-all duration-300 cursor-pointer ${
                        idx === mobileActiveIndex
                          ? 'w-6 h-1.5 bg-gradient-to-r from-[#094838] to-[#042d23] dark:from-emerald-400 dark:to-emerald-500'
                          : 'w-1.5 h-1.5 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* 4 Action Buttons: Emerald icons with dark theme background */}
            <div className={`grid grid-cols-4 gap-2.5 mb-2 px-1 ${mobileAccounts.length > 1 ? 'mt-0' : 'mt-2'}`}>
              <button
                type="button"
                onClick={() => activeMobileAccount && handleOpenAddBalance(activeMobileAccount)}
                className="flex flex-col items-center justify-center gap-1.5 py-1 group active:scale-95 transition-transform cursor-pointer"
                title="Top Up / Deposit"
              >
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-b from-[#094838] to-[#042d23] text-emerald-400 dark:text-emerald-300 flex items-center justify-center shadow-md shadow-emerald-950/25 border border-emerald-500/30 group-hover:scale-105 transition-transform">
                  <Plus className="w-6 h-6 stroke-[2.6]" />
                </div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Top Up</span>
              </button>

              <button
                type="button"
                onClick={() => activeMobileAccount && handleOpenTransfer(activeMobileAccount.id)}
                className="flex flex-col items-center justify-center gap-1.5 py-1 group active:scale-95 transition-transform cursor-pointer"
                title="Transfer"
              >
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-b from-[#094838] to-[#042d23] text-emerald-400 dark:text-emerald-300 flex items-center justify-center shadow-md shadow-emerald-950/25 border border-emerald-500/30 group-hover:scale-105 transition-transform">
                  <ArrowRightLeft className="w-5 h-5 stroke-[2.4]" />
                </div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Transfer</span>
              </button>

              <button
                type="button"
                onClick={() => activeMobileAccount && setDeletingAccount(activeMobileAccount)}
                className="flex flex-col items-center justify-center gap-1.5 py-1 group active:scale-95 transition-transform cursor-pointer"
                title="Delete Account"
              >
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-b from-[#380e14] to-[#20050a] text-rose-400 flex items-center justify-center shadow-md shadow-rose-950/25 border border-rose-500/30 group-hover:scale-105 transition-transform">
                  <Trash2 className="w-5 h-5 stroke-[2.4]" />
                </div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Delete</span>
              </button>

              <button
                type="button"
                onClick={() => activeMobileAccount && setSelectedAccountForLedger(activeMobileAccount)}
                className="flex flex-col items-center justify-center gap-1.5 py-1 group active:scale-95 transition-transform cursor-pointer"
                title="All Time Ledger"
              >
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-b from-[#094838] to-[#042d23] text-emerald-400 dark:text-emerald-300 flex items-center justify-center shadow-md shadow-emerald-950/25 border border-emerald-500/30 group-hover:scale-105 transition-transform">
                  <FileText className="w-5 h-5 stroke-[2.4]" />
                </div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">All Time</span>
              </button>
            </div>

            {/* Transactions Section — Displayed Frameless Without an Enclosing Card */}
            <div className="w-full mt-2">
              <div className="flex items-center justify-between mb-2.5 px-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-lg text-[#0f2347] dark:text-white tracking-tight">
                    Transactions
                  </h3>
                  {activeMobileAccount && (
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-200/70 dark:bg-slate-800 px-2.5 py-0.5 rounded-full">
                      ({mobileActivities[activeMobileAccount.id]?.length || 0})
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => activeMobileAccount && setSelectedAccountForLedger(activeMobileAccount)}
                  className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400 flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <span>See all</span>
                  <span className="text-base leading-none">→</span>
                </button>
              </div>

              {/* Scrollable Container without a Card */}
              <div className="overflow-y-auto overscroll-contain pr-1 scrollbar-thin max-h-[320px]">
                {loadingMobileActivities && !mobileActivities[activeMobileAccount?.id || ''] ? (
                  <div className="space-y-3 py-1">
                    {[1, 2, 3, 4].map((n) => (
                      <div key={n} className="flex items-center justify-between gap-3 animate-pulse py-1">
                        <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-800 shrink-0" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3.5 bg-slate-100 dark:bg-slate-800 rounded w-1/2" />
                          <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded w-1/3" />
                        </div>
                        <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-20" />
                      </div>
                    ))}
                  </div>
                ) : (!activeMobileAccount || !(mobileActivities[activeMobileAccount.id] && mobileActivities[activeMobileAccount.id].length > 0)) ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-6">
                    <Inbox className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-500 dark:text-slate-400">No transactions recorded yet</p>
                    <p className="text-xs text-slate-400 mt-0.5">Transactions will appear as payments occur</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {(mobileActivities[activeMobileAccount.id] || []).map((act) => {
                      const isInflow = act.direction === 'inflow';
                      const title = act.counterparty || act.type_label || act.description || 'Transaction';
                      const dateFormatted = formatActivityDate(act.date);
                      return (
                        <div
                          key={act.id}
                          onClick={() => activeMobileAccount && setSelectedAccountForLedger(activeMobileAccount)}
                          className="flex items-center justify-between gap-3 py-2.5 px-1.5 cursor-pointer group hover:bg-slate-100/60 dark:hover:bg-slate-800/40 active:bg-slate-100/80 dark:active:bg-slate-800/60 rounded-xl transition-colors border-b border-slate-200/60 dark:border-slate-800/60 last:border-0"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${
                                isInflow
                                  ? 'bg-emerald-100/70 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                                  : 'bg-rose-100/70 dark:bg-rose-950/60 text-rose-500 dark:text-rose-400'
                              }`}
                            >
                              {isInflow ? (
                                <ArrowDownLeft className="w-5 h-5 stroke-[2.8]" />
                              ) : (
                                <ArrowUpRight className="w-5 h-5 stroke-[2.8]" />
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <h4 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white leading-tight tracking-tight truncate">
                                {title}
                              </h4>
                              <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mt-1 leading-none truncate">
                                {dateFormatted}
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span
                              className={`font-mono font-black text-sm sm:text-base tabular-nums tracking-tight ${
                                isInflow ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {isInflow ? '+ ' : '- '}ETB {Math.abs(Number(act.amount || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Account Management Modal */}
      <ManageAccountModal
        isOpen={showAccountModal}
        onClose={() => {
          setShowAccountModal(false);
          setEditingAccount(null);
        }}
        onSaved={loadAccounts}
        editAccount={editingAccount}
        defaultType={accountDefaultType}
      />

      {/* Dedicated Account Activity Ledger Drawer */}
      <AccountLedgerDrawer
        account={selectedAccountForLedger}
        isOpen={selectedAccountForLedger !== null}
        onClose={() => setSelectedAccountForLedger(null)}
        onOpenTransfer={(accountId) => {
          handleOpenTransfer(accountId);
        }}
        onOpenAddBalance={(acc) => {
          handleOpenAddBalance(acc);
        }}
        onAccountUpdated={() => {
          loadAccounts();
        }}
      />

      {/* Dedicated Add Balance Modal */}
      <AddBalanceModal
        isOpen={selectedAccountForBalance !== null}
        onClose={() => setSelectedAccountForBalance(null)}
        onSaved={loadAccounts}
        account={selectedAccountForBalance}
      />

      {/* Delete Confirmation Modal */}
      {deletingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeletingAccount(null)} />
          <div className="relative w-full max-w-sm mx-4 bg-white dark:bg-[#0f1522] rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden animate-page-enter p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Remove Account?</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {deletingAccount.name} — {Number(deletingAccount.current_balance).toLocaleString()} ETB
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              This account will be removed from your active accounts list. All dependable historical transactions, sales, and expense records linked to it are preserved in your audit trail.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeletingAccount(null)}
                className="h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="h-9 px-5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{deleting ? 'Removing...' : 'Remove'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tactile Elevated Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs animate-backdrop-enter"
            onClick={() => setShowTransferModal(false)}
          />

          <div className="relative z-10 bg-white dark:bg-[#131926] rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 space-y-4 animate-modal-enter">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">Inter-Account Transfer</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  Shift balances between accounts without affecting income or expense ledgers
                </p>
              </div>
              <button
                onClick={() => setShowTransferModal(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleTransferSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Source Account
                  </label>
                  <select
                    value={sourceAccountId}
                    onChange={(e) => handleSourceAccountChange(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-700"
                    required
                  >
                    <option value="">-- Choose Source --</option>
                    {allAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} — {Number(a.current_balance).toLocaleString()} ETB
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Destination Account
                  </label>
                  <select
                    value={destAccountId}
                    onChange={(e) => setDestAccountId(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-700"
                    required
                  >
                    <option value="">-- Choose Destination --</option>
                    {allAccounts
                      .filter((a) => a.id !== sourceAccountId)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} — {Number(a.current_balance).toLocaleString()} ETB
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {selectedSource && selectedDest && (
                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <AccountLogo account={selectedSource} size="sm" />
                    <div className="min-w-0">
                      <span className="font-bold text-slate-900 dark:text-white block truncate">{selectedSource.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{Number(selectedSource.current_balance).toLocaleString()} ETB</span>
                    </div>
                  </div>
                  <ArrowRightLeft className="w-4 h-4 text-emerald-500 shrink-0 mx-2" />
                  <div className="flex items-center gap-2 text-right min-w-0 justify-end">
                    <div className="min-w-0">
                      <span className="font-bold text-slate-900 dark:text-white block truncate">{selectedDest.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{Number(selectedDest.current_balance).toLocaleString()} ETB</span>
                    </div>
                    <AccountLogo account={selectedDest} size="sm" />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Transfer Amount ETB
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={transferAmount}
                    onChange={(e) => handleTransferAmountChange(e.target.value)}
                    placeholder="e.g. 50000"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-700"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Bank Fee ETB
                    </label>
                    {selectedSource?.default_fee_type && selectedSource.default_fee_type !== 'none' && Number(selectedSource.default_fee_amount) > 0 && (
                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded">
                        Auto ({Number(selectedSource.default_fee_amount)}{selectedSource.default_fee_type === 'percentage' ? '%' : ' ETB'})
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    value={transferFee}
                    onChange={(e) => setTransferFee(e.target.value)}
                    placeholder="e.g. 15"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs font-mono font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Transfer Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. Replenish cash drawer from CBE account"
                  value={transferDesc}
                  onChange={(e) => setTransferDesc(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-700"
                />
              </div>

              {/* Transfer Preview Card */}
              {selectedSource && selectedDest && transferAmount && (
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white">{selectedSource.name}</span>
                      <ArrowRightLeft className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-bold text-slate-900 dark:text-white">{selectedDest.name}</span>
                    </div>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {parseFloat(transferAmount || '0').toLocaleString()} ETB
                    </span>
                  </div>
                  {parseFloat(transferFee || '0') > 0 && (
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/50 dark:border-slate-700/50 font-mono">
                      <span>Total Outflow ({selectedSource.name}):</span>
                      <span className="font-bold text-rose-600 dark:text-rose-400">
                        {(parseFloat(transferAmount || '0') + parseFloat(transferFee || '0')).toLocaleString()} ETB (Amount + {parseFloat(transferFee).toLocaleString()} Fee)
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transferring || !sourceAccountId || !destAccountId || !transferAmount}
                  className="h-10 px-5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-50 transition-colors shadow-sm active:scale-[0.98]"
                >
                  {transferring ? 'Executing...' : 'Execute Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
