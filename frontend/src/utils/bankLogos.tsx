import React from 'react';

export interface BankPreset {
  id: string;
  name: string;
  shortCode: string;
  primaryColor: string;
  keywords: string[];
  dataUri: string;
  svgElement: React.ReactElement;
}

// 1. CBE (Commercial Bank of Ethiopia)
const CBE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80">
  <defs>
    <linearGradient id="cbeBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4a107a"/>
      <stop offset="100%" stop-color="#2c064e"/>
    </linearGradient>
    <linearGradient id="cbeGold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fde047"/>
      <stop offset="50%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#d97706"/>
    </linearGradient>
  </defs>
  <rect width="80" height="80" rx="18" fill="url(#cbeBg)"/>
  <circle cx="40" cy="34" r="21" fill="none" stroke="url(#cbeGold)" stroke-width="2.5" opacity="0.8"/>
  <circle cx="40" cy="34" r="16" fill="#3b0764" stroke="url(#cbeGold)" stroke-width="1.5"/>
  <path d="M40 22 L42.5 30 L50.5 30 L44 35 L46.5 43 L40 38 L33.5 43 L36 35 L29.5 30 L37.5 30 Z" fill="url(#cbeGold)"/>
  <text x="40" y="65" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="12" fill="#ffffff" letter-spacing="1.5">CBE</text>
</svg>`;

// 2. Telebirr (Ethio Telecom)
const TELEBIRR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80">
  <defs>
    <linearGradient id="tbBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0083cb"/>
      <stop offset="100%" stop-color="#005a92"/>
    </linearGradient>
    <linearGradient id="tbYellow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fef08a"/>
      <stop offset="100%" stop-color="#eab308"/>
    </linearGradient>
  </defs>
  <rect width="80" height="80" rx="18" fill="url(#tbBg)"/>
  <circle cx="40" cy="33" r="18" fill="none" stroke="url(#tbYellow)" stroke-width="3" stroke-dasharray="85 30" stroke-linecap="round"/>
  <path d="M40 22 C32 22 26 27 26 34 C26 40 30 43 36 44 L39 44.5 C43 45 44 46.5 44 48 C44 50 42 51.5 38 51.5 C34 51.5 30 50 28 47.5" fill="none" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round"/>
  <path d="M48 24 C51 27 52 30 52 34" fill="none" stroke="url(#tbYellow)" stroke-width="3" stroke-linecap="round"/>
  <text x="40" y="66" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="10.5" fill="#ffffff" letter-spacing="0.5">telebirr</text>
</svg>`;

// 3. Awash Bank
const AWASH_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80">
  <defs>
    <linearGradient id="awashBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#14213d"/>
      <stop offset="100%" stop-color="#0a1128"/>
    </linearGradient>
    <linearGradient id="awashOrange" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fb923c"/>
      <stop offset="100%" stop-color="#ea580c"/>
    </linearGradient>
  </defs>
  <rect width="80" height="80" rx="18" fill="url(#awashBg)"/>
  <path d="M40 18 L60 44 L49 44 L40 31 L31 44 L20 44 Z" fill="url(#awashOrange)"/>
  <path d="M40 34 L52 50 L43 50 L40 45 L37 50 L28 50 Z" fill="#ffffff" opacity="0.9"/>
  <text x="40" y="66" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="10.5" fill="#f97316" letter-spacing="1">AWASH</text>
</svg>`;

// 4. Bank of Abyssinia (BOA)
const BOA_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80">
  <defs>
    <linearGradient id="boaBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#020617"/>
    </linearGradient>
    <linearGradient id="boaGold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fef08a"/>
      <stop offset="50%" stop-color="#eab308"/>
      <stop offset="100%" stop-color="#ca8a04"/>
    </linearGradient>
  </defs>
  <rect width="80" height="80" rx="18" fill="url(#boaBg)"/>
  <g transform="translate(40,32)">
    <circle cx="0" cy="0" r="18" fill="none" stroke="url(#boaGold)" stroke-width="1.5" stroke-dasharray="3 3"/>
    <path d="M0 -15 L3 -5 L13 -9 L7 0 L15 5 L5 6 L6 16 L0 9 L-6 16 L-5 6 L-15 5 L-7 0 L-13 -9 L-3 -5 Z" fill="url(#boaGold)"/>
    <circle cx="0" cy="0" r="4.5" fill="#0f172a" stroke="url(#boaGold)" stroke-width="1.5"/>
  </g>
  <text x="40" y="65" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="11.5" fill="url(#boaGold)" letter-spacing="1.5">BOA</text>
</svg>`;

// 5. Zemen Bank
const ZEMEN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80">
  <defs>
    <linearGradient id="zemenBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#b91c1c"/>
      <stop offset="100%" stop-color="#7f1d1d"/>
    </linearGradient>
  </defs>
  <rect width="80" height="80" rx="18" fill="url(#zemenBg)"/>
  <rect x="22" y="20" width="36" height="7" rx="3.5" fill="#ffffff"/>
  <polygon points="56,23 30,46 22,46 48,23" fill="#fbbf24"/>
  <polygon points="48,27 24,50 32,50 56,27" fill="#ffffff"/>
  <rect x="22" y="45" width="36" height="7" rx="3.5" fill="#ffffff"/>
  <text x="40" y="66" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="10.5" fill="#ffffff" letter-spacing="1.2">ZEMEN</text>
</svg>`;

// 6. Dashen Bank
const DASHEN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80">
  <defs>
    <linearGradient id="dashenBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e3a8a"/>
      <stop offset="100%" stop-color="#172554"/>
    </linearGradient>
    <linearGradient id="dashenGold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fde047"/>
      <stop offset="100%" stop-color="#f59e0b"/>
    </linearGradient>
  </defs>
  <rect width="80" height="80" rx="18" fill="url(#dashenBg)"/>
  <path d="M40 18 L58 43 L48 43 L40 31 L32 43 L22 43 Z" fill="url(#dashenGold)"/>
  <path d="M40 29 L50 43 L43 43 L40 38 L37 43 L30 43 Z" fill="#ffffff"/>
  <circle cx="40" cy="49" r="3.5" fill="url(#dashenGold)"/>
  <text x="40" y="66" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="9.5" fill="#ffffff" letter-spacing="1">DASHEN</text>
</svg>`;

// 7. Cash Drawer (Cash on Hand)
const CASH_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80">
  <defs>
    <linearGradient id="cashBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#059669"/>
      <stop offset="100%" stop-color="#064e3b"/>
    </linearGradient>
    <linearGradient id="cashMint" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#a7f3d0"/>
      <stop offset="100%" stop-color="#34d399"/>
    </linearGradient>
  </defs>
  <rect width="80" height="80" rx="18" fill="url(#cashBg)"/>
  <rect x="20" y="24" width="40" height="25" rx="4" fill="none" stroke="url(#cashMint)" stroke-width="2.5"/>
  <circle cx="40" cy="36.5" r="6" fill="none" stroke="url(#cashMint)" stroke-width="2"/>
  <circle cx="26" cy="30" r="1.5" fill="url(#cashMint)"/>
  <circle cx="54" cy="30" r="1.5" fill="url(#cashMint)"/>
  <circle cx="26" cy="43" r="1.5" fill="url(#cashMint)"/>
  <circle cx="54" cy="43" r="1.5" fill="url(#cashMint)"/>
  <text x="40" y="65" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="10" fill="#ffffff" letter-spacing="1.2">CASH</text>
</svg>`;

// 8. Physical Gold Reserve
const GOLD_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80">
  <defs>
    <linearGradient id="goldBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#78350f"/>
      <stop offset="100%" stop-color="#451a03"/>
    </linearGradient>
    <linearGradient id="ingotGold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fef08a"/>
      <stop offset="40%" stop-color="#facc15"/>
      <stop offset="80%" stop-color="#ca8a04"/>
      <stop offset="100%" stop-color="#854d0e"/>
    </linearGradient>
  </defs>
  <rect width="80" height="80" rx="18" fill="url(#goldBg)"/>
  <polygon points="26,38 54,38 50,47 22,47" fill="url(#ingotGold)" stroke="#fef08a" stroke-width="0.8"/>
  <polygon points="22,47 50,47 48,51 20,51" fill="#a16207"/>
  <polygon points="32,24 60,24 56,33 28,33" fill="url(#ingotGold)" stroke="#fef08a" stroke-width="0.8"/>
  <polygon points="28,33 56,33 54,37 26,37" fill="#a16207"/>
  <text x="44" y="30" font-family="system-ui, sans-serif" font-weight="900" font-size="5" fill="#78350f" letter-spacing="0.5">999.9</text>
  <text x="36" y="44" font-family="system-ui, sans-serif" font-weight="900" font-size="5" fill="#78350f" letter-spacing="0.5">GOLD</text>
  <text x="40" y="67" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="10.5" fill="#fde047" letter-spacing="1.2">RESERVE</text>
</svg>`;

// 9. Forex & USDT Reserve
const FOREX_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80">
  <defs>
    <linearGradient id="fxBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#042f2e"/>
      <stop offset="100%" stop-color="#115e59"/>
    </linearGradient>
    <linearGradient id="fxTeal" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#5eead4"/>
      <stop offset="100%" stop-color="#14b8a6"/>
    </linearGradient>
  </defs>
  <rect width="80" height="80" rx="18" fill="url(#fxBg)"/>
  <circle cx="34" cy="32" r="14" fill="#0f766e" stroke="url(#fxTeal)" stroke-width="1.8"/>
  <text x="34" y="37" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="15" fill="#ffffff">$</text>
  <circle cx="49" cy="38" r="11" fill="#042f2e" stroke="#2dd4bf" stroke-width="1.8"/>
  <text x="49" y="42" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="900" font-size="12" fill="#2dd4bf">₮</text>
  <text x="40" y="66" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="9" fill="#ffffff" letter-spacing="1">FX · USDT</text>
</svg>`;

function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const PRESET_BANK_LOGOS: BankPreset[] = [
  {
    id: 'cbe',
    name: 'Commercial Bank of Ethiopia (CBE)',
    shortCode: 'CBE',
    primaryColor: '#7b1fa2',
    keywords: ['cbe', 'commercial bank', 'ንግድ ባንክ'],
    dataUri: svgToDataUri(CBE_SVG),
    svgElement: <div dangerouslySetInnerHTML={{ __html: CBE_SVG }} className="w-full h-full" />,
  },
  {
    id: 'telebirr',
    name: 'TeleBirr Counter Wallet',
    shortCode: 'TeleBirr',
    primaryColor: '#0284c7',
    keywords: ['telebirr', 'tele birr', 'ቴሌብር'],
    dataUri: svgToDataUri(TELEBIRR_SVG),
    svgElement: <div dangerouslySetInnerHTML={{ __html: TELEBIRR_SVG }} className="w-full h-full" />,
  },
  {
    id: 'awash',
    name: 'Awash Bank',
    shortCode: 'Awash',
    primaryColor: '#ea580c',
    keywords: ['awash', 'አዋሽ'],
    dataUri: svgToDataUri(AWASH_SVG),
    svgElement: <div dangerouslySetInnerHTML={{ __html: AWASH_SVG }} className="w-full h-full" />,
  },
  {
    id: 'boa',
    name: 'Bank of Abyssinia (BOA)',
    shortCode: 'BOA',
    primaryColor: '#ca8a04',
    keywords: ['boa', 'abyssinia', 'አቢሲኒያ'],
    dataUri: svgToDataUri(BOA_SVG),
    svgElement: <div dangerouslySetInnerHTML={{ __html: BOA_SVG }} className="w-full h-full" />,
  },
  {
    id: 'zemen',
    name: 'Zemen Bank',
    shortCode: 'Zemen',
    primaryColor: '#dc2626',
    keywords: ['zemen', 'ዘመን'],
    dataUri: svgToDataUri(ZEMEN_SVG),
    svgElement: <div dangerouslySetInnerHTML={{ __html: ZEMEN_SVG }} className="w-full h-full" />,
  },
  {
    id: 'dashen',
    name: 'Dashen Bank',
    shortCode: 'Dashen',
    primaryColor: '#1d4ed8',
    keywords: ['dashen', 'ዳሸን'],
    dataUri: svgToDataUri(DASHEN_SVG),
    svgElement: <div dangerouslySetInnerHTML={{ __html: DASHEN_SVG }} className="w-full h-full" />,
  },
  {
    id: 'cash',
    name: 'Cash on Hand (Drawer)',
    shortCode: 'Cash',
    primaryColor: '#059669',
    keywords: ['cash', 'drawer', 'ጥሬ ገንዘብ', 'petty'],
    dataUri: svgToDataUri(CASH_SVG),
    svgElement: <div dangerouslySetInnerHTML={{ __html: CASH_SVG }} className="w-full h-full" />,
  },
  {
    id: 'gold',
    name: 'Physical Gold Reserve',
    shortCode: 'Gold',
    primaryColor: '#d97706',
    keywords: ['gold', 'reserve', 'ወርቅ', 'karat'],
    dataUri: svgToDataUri(GOLD_SVG),
    svgElement: <div dangerouslySetInnerHTML={{ __html: GOLD_SVG }} className="w-full h-full" />,
  },
  {
    id: 'forex',
    name: 'Forex & USDT Reserve',
    shortCode: 'Forex',
    primaryColor: '#0d9488',
    keywords: ['forex', 'usdt', 'usd', 'fx', 'crypto', 'ዶላር'],
    dataUri: svgToDataUri(FOREX_SVG),
    svgElement: <div dangerouslySetInnerHTML={{ __html: FOREX_SVG }} className="w-full h-full" />,
  },
];

/**
 * Detect matching bank preset by name or account type
 */
export function matchBankPreset(name?: string, type?: string): BankPreset | undefined {
  const query = (name || '').toLowerCase();
  const typeQuery = (type || '').toLowerCase();

  // 1. Direct type matching first for special types
  if (typeQuery === 'asset_gold') {
    return PRESET_BANK_LOGOS.find((p) => p.id === 'gold');
  }
  if (typeQuery === 'asset_fx') {
    return PRESET_BANK_LOGOS.find((p) => p.id === 'forex');
  }
  if (typeQuery === 'cash') {
    return PRESET_BANK_LOGOS.find((p) => p.id === 'cash');
  }
  if (typeQuery === 'mobile_money' && (query.includes('tele') || !query)) {
    return PRESET_BANK_LOGOS.find((p) => p.id === 'telebirr');
  }

  // 2. Keyword matching on name
  for (const preset of PRESET_BANK_LOGOS) {
    if (preset.keywords.some((kw) => query.includes(kw))) {
      return preset;
    }
  }

  // 3. Fallback based on type
  if (typeQuery === 'bank') {
    return PRESET_BANK_LOGOS.find((p) => p.id === 'cbe');
  }

  return undefined;
}

export interface AccountLogoInfo {
  src: string;
  isCustom: boolean;
  preset?: BankPreset;
  shortCode: string;
}

/**
 * Returns the effective logo src (uploaded custom logo OR authentic bank preset logo)
 */
export function getAccountLogoInfo(account: {
  name?: string;
  type?: string;
  logo?: string | null;
  asset_details?: Record<string, any> | null;
}): AccountLogoInfo {
  // Check if account already has an uploaded or configured logo
  const explicitLogo = account.logo || (account.asset_details?.logo as string | undefined);
  if (explicitLogo && explicitLogo.trim().length > 0) {
    return {
      src: explicitLogo,
      isCustom: !explicitLogo.startsWith('data:image/svg+xml'),
      shortCode: (account.name || 'ACC').slice(0, 3).toUpperCase(),
    };
  }

  // Auto-detect based on name and type
  const matched = matchBankPreset(account.name, account.type);
  if (matched) {
    return {
      src: matched.dataUri,
      isCustom: false,
      preset: matched,
      shortCode: matched.shortCode,
    };
  }

  // Default to CBE for bank, Cash for cash, or generic
  const fallback = PRESET_BANK_LOGOS[0];
  return {
    src: fallback.dataUri,
    isCustom: false,
    preset: fallback,
    shortCode: fallback.shortCode,
  };
}

export interface AccountLogoProps {
  account: {
    name?: string;
    type?: string;
    logo?: string | null;
    asset_details?: Record<string, any> | null;
  };
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_MAP = {
  xs: 'w-6 h-6 rounded-md',
  sm: 'w-7 h-7 rounded-lg',
  md: 'w-8 h-8 rounded-lg',
  lg: 'w-10 h-10 rounded-xl',
  xl: 'w-12 h-12 rounded-xl',
};

export const AccountLogo: React.FC<AccountLogoProps> = ({
  account,
  size = 'md',
  className = '',
}) => {
  const info = getAccountLogoInfo(account);
  const sizeClasses = SIZE_MAP[size] || SIZE_MAP.md;

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 overflow-hidden bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-xs ${sizeClasses} ${className}`}
      title={account.name}
    >
      <img
        src={info.src}
        alt={account.name || 'Account Logo'}
        className="w-full h-full object-cover"
        loading="lazy"
      />
    </div>
  );
};
