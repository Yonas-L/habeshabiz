// Electronics retail niche archetypes and field configurations
export type CategoryArchetype =
  | 'phone'
  | 'tablet'
  | 'laptop_computer'
  | 'smartwatch'
  | 'case_cover'
  | 'screen_protector'
  | 'charger_cable'
  | 'powerbank'
  | 'audio'
  | 'gaming'
  | 'general';

/**
 * Determine the exact electronics archetype from category metadata and optional product name.
 */
export function getCategoryArchetype(
  catSlug?: string | null,
  catName?: string | null,
  productName?: string | null
): CategoryArchetype {
  const s = `${catSlug || ''} ${catName || ''} ${productName || ''}`.toLowerCase();

  // 1. Screen Protectors
  if (s.includes('protector') || s.includes('tempered') || s.includes('glass') || s.includes('film')) {
    return 'screen_protector';
  }

  // 2. Cases & Covers (Phone cases, iPad cases, folios)
  if (s.includes('case') || s.includes('cover') || s.includes('pouch') || s.includes('skin') || s.includes('folio') || s.includes('sleeve')) {
    return 'case_cover';
  }

  // 3. Chargers, Cables & Adapters
  if (s.includes('charger') || s.includes('cable') || s.includes('adapter') || s.includes('magsafe') || s.includes('plug') || s.includes('charging')) {
    return 'charger_cable';
  }

  // 4. Power Banks & Batteries
  if (s.includes('powerbank') || s.includes('power bank') || s.includes('battery pack') || s.includes('batteries')) {
    return 'powerbank';
  }

  // 5. Smart Watches & Wearables
  if (s.includes('watch') || s.includes('wearable') || s.includes('band')) {
    return 'smartwatch';
  }

  // 6. Tablets (iPads, Galaxy Tabs)
  if (s.includes('tablet') || s.includes('ipad') || s.includes('galaxy tab') || s.includes('tab ')) {
    return 'tablet';
  }

  // 7. Laptops & Computers
  if (
    s.includes('laptop') ||
    s.includes('macbook') ||
    s.includes('computer') ||
    s.includes('desktop') ||
    s.includes('imac') ||
    s.includes('mac mini') ||
    s.includes('mac studio')
  ) {
    return 'laptop_computer';
  }

  // 8. Audio
  if (
    s.includes('audio') ||
    s.includes('headphone') ||
    s.includes('earphone') ||
    s.includes('airpod') ||
    s.includes('speaker') ||
    s.includes('earbud') ||
    s.includes('soundbar')
  ) {
    return 'audio';
  }

  // 9. Gaming
  if (s.includes('game') || s.includes('gaming') || s.includes('console') || s.includes('playstation') || s.includes('xbox') || s.includes('joystick') || s.includes('controller')) {
    return 'gaming';
  }

  // 10. Smartphones
  if (
    s.includes('phone') ||
    s.includes('smartphone') ||
    s.includes('iphone') ||
    s.includes('galaxy') ||
    s.includes('pixel') ||
    s.includes('android') ||
    s.includes('motorola') ||
    s.includes('redmi') ||
    s.includes('xiaomi')
  ) {
    return 'phone';
  }

  return 'general';
}

/**
 * Intelligent default for whether units of this category/archetype are serialized or bulk.
 */
export function getDefaultHasSerials(archetype: CategoryArchetype): boolean {
  switch (archetype) {
    case 'phone':
    case 'tablet':
    case 'laptop_computer':
    case 'smartwatch':
      return true;
    case 'case_cover':
    case 'screen_protector':
    case 'charger_cable':
    case 'powerbank':
    case 'audio':
    case 'gaming':
    case 'general':
    default:
      return false;
  }
}

/**
 * Relevant fields configuration per archetype to keep the UI clean, focused, and free of irrelevant inputs.
 */
export function getArchetypeFields(archetype: CategoryArchetype) {
  return {
    showStorage: archetype === 'phone' || archetype === 'tablet' || archetype === 'laptop_computer',
    showRam: archetype === 'phone' || archetype === 'laptop_computer', // NOT shown for tablets, cases, or accessories
    showColor: archetype !== 'screen_protector',
    showProcessor: archetype === 'laptop_computer',
    showCompatibility: archetype === 'case_cover' || archetype === 'screen_protector',
    showMaterial: archetype === 'case_cover',
    showGlassType: archetype === 'screen_protector',
    showWattage: archetype === 'charger_cable' || archetype === 'powerbank',
    showCaseSize: archetype === 'smartwatch',
    showConnectivity: archetype === 'tablet' || archetype === 'smartwatch',
    showBattery: archetype === 'phone' || archetype === 'tablet' || archetype === 'laptop_computer' || archetype === 'smartwatch',
    showSim: archetype === 'phone' || archetype === 'tablet',
    isTablet: archetype === 'tablet',
  };
}

/**
 * Check if a tablet configuration requires both Serial Number and IMEI.
 * Wi-Fi only tablets only require Serial Number.
 * Tablets with SIM (Physical, eSIM, or Dual) or connectivity Cellular require both.
 */
export function isCellularTablet(
  simType?: string | null,
  connectivity?: string | null,
  variantDisplayName?: string | null
): boolean {
  if (simType === 'physical' || simType === 'esim' || simType === 'dual') {
    return true;
  }
  const conn = (connectivity || '').toLowerCase();
  if (conn.includes('cellular') || conn.includes('sim') || conn.includes('4g') || conn.includes('5g') || conn.includes('lte')) {
    return true;
  }
  const vName = (variantDisplayName || '').toLowerCase();
  if (vName.includes('cellular') || vName.includes('sim') || vName.includes('4g') || vName.includes('5g') || vName.includes('lte')) {
    return true;
  }
  return false;
}

/**
 * Formats unit identifier badges cleanly based on whether it has Serial, IMEI, or both.
 */
export function formatUnitDisplayIdentifier(unit: {
  imei_or_serial?: string | null;
  serial_number?: string | null;
  sim_type?: string | null;
}): {
  serial?: string | null;
  imei?: string | null;
  primaryLabel: string;
  hasBoth: boolean;
} {
  const serial = unit.serial_number?.trim() || null;
  const imei = unit.imei_or_serial?.trim() || null;

  if (serial && imei && serial !== imei) {
    return {
      serial,
      imei,
      primaryLabel: `SN: ${serial}`,
      hasBoth: true,
    };
  }

  if (serial) {
    return {
      serial,
      imei: null,
      primaryLabel: `SN: ${serial}`,
      hasBoth: false,
    };
  }

  if (imei) {
    const isLikelyImei = /^\d{14,16}$/.test(imei);
    return {
      serial: null,
      imei,
      primaryLabel: isLikelyImei ? `IMEI: ${imei}` : `SN: ${imei}`,
      hasBoth: false,
    };
  }

  return {
    serial: null,
    imei: null,
    primaryLabel: 'No Serial',
    hasBoth: false,
  };
}

export const POPULAR_BRANDS_BY_ARCHETYPE: Record<CategoryArchetype, string[]> = {
  phone: [
    'Apple',
    'Samsung',
    'Xiaomi',
    'Tecno',
    'Infinix',
    'Google',
    'Huawei',
    'Honor',
    'OnePlus',
    'Realme',
    'Vivo',
    'OPPO',
    'Nokia',
    'Nothing',
    'Motorola',
    'Sony',
  ],
  tablet: [
    'Apple',
    'Samsung',
    'Xiaomi',
    'Lenovo',
    'Huawei',
    'Amazon',
    'Microsoft',
  ],
  laptop_computer: [
    'Apple',
    'Dell',
    'HP',
    'Lenovo',
    'Asus',
    'Acer',
    'Microsoft',
    'MSI',
    'Samsung',
    'Toshiba',
  ],
  smartwatch: [
    'Apple',
    'Samsung',
    'Garmin',
    'Xiaomi',
    'Huawei',
    'Oraimo',
    'Amazfit',
    'Fitbit',
  ],
  case_cover: [
    'Apple',
    'Samsung',
    'Spigen',
    'Pitaka',
    'Torras',
    'Nillkin',
    'Baseus',
    'Joyroom',
    'WiWU',
    'Green Lion',
    'Generic',
  ],
  screen_protector: [
    'Spigen',
    'Baseus',
    'WiWU',
    'Green Lion',
    'Hoco',
    'Remax',
    'Diamond Glass',
    'Generic',
  ],
  charger_cable: [
    'Apple',
    'Samsung',
    'Anker',
    'Baseus',
    'Oraimo',
    'Joyroom',
    'WiWU',
    'UGREEN',
    'Green Lion',
    'Xiaomi',
    'Hoco',
    'Generic',
  ],
  powerbank: [
    'Anker',
    'Baseus',
    'Oraimo',
    'Xiaomi',
    'Remax',
    'Joyroom',
    'WiWU',
    'Green Lion',
    'Romoss',
    'Generic',
  ],
  audio: [
    'Apple',
    'Sony',
    'JBL',
    'Bose',
    'Anker',
    'Oraimo',
    'Beats',
    'Sennheiser',
    'Marshall',
    'Samsung',
  ],
  gaming: [
    'Sony',
    'Microsoft',
    'Nintendo',
    'Razer',
    'Logitech',
    'Asus ROG',
  ],
  general: [
    'Apple',
    'Samsung',
    'Xiaomi',
    'Anker',
    'Baseus',
    'Generic',
  ],
};

export function detectBrandFromModelName(modelName: string): string | null {
  if (!modelName || !modelName.trim()) return null;
  const s = modelName.trim().toLowerCase();

  // Apple
  if (
    /\b(iphone|ipad|macbook|imac|mac mini|mac studio|airpods|airpod|apple watch|apple pencil|magsafe)\b/i.test(s) ||
    s.startsWith('iphone') ||
    s.startsWith('ipad') ||
    s.startsWith('macbook') ||
    s.startsWith('apple')
  ) {
    return 'Apple';
  }

  // Samsung
  if (
    /\b(galaxy|samsung|z fold|z flip)\b/i.test(s) ||
    /\b(s20|s21|s22|s23|s24|s25|a05|a14|a15|a24|a25|a34|a35|a54|a55)\b/i.test(s) ||
    s.startsWith('galaxy') ||
    s.startsWith('samsung')
  ) {
    return 'Samsung';
  }

  // Xiaomi / Redmi / POCO
  if (/\b(xiaomi|redmi|poco|mi \d)\b/i.test(s) || s.startsWith('redmi') || s.startsWith('xiaomi') || s.startsWith('poco')) {
    return 'Xiaomi';
  }

  // Tecno
  if (/\b(tecno|spark|camon|pova|phantom)\b/i.test(s) || s.startsWith('spark') || s.startsWith('camon') || s.startsWith('pova')) {
    return 'Tecno';
  }

  // Infinix
  if (/\b(infinix|hot \d|note \d|smart \d|zero \d)\b/i.test(s) || s.startsWith('infinix')) {
    return 'Infinix';
  }

  // Google
  if (/\b(pixel|google pixel)\b/i.test(s) || s.startsWith('pixel')) {
    return 'Google';
  }

  // Lenovo / ThinkPad
  if (/\b(lenovo|thinkpad|ideapad|legion|yoga)\b/i.test(s) || s.startsWith('thinkpad')) {
    return 'Lenovo';
  }

  // Dell
  if (/\b(dell|latitude|inspiron|xps|vostro|alienware)\b/i.test(s) || s.startsWith('dell')) {
    return 'Dell';
  }

  // HP
  if (/\b(hp|pavilion|elitebook|probook|envy|spectre|omen|victus)\b/i.test(s) || s.startsWith('hp ')) {
    return 'HP';
  }

  // Asus
  if (/\b(asus|zenbook|vivobook|rog|tuf)\b/i.test(s) || s.startsWith('asus')) {
    return 'Asus';
  }

  // Sony
  if (/\b(sony|playstation|ps5|ps4|xperia)\b/i.test(s) || s.startsWith('playstation') || s.startsWith('ps5')) {
    return 'Sony';
  }

  // Anker
  if (/\b(anker|soundcore|eufy)\b/i.test(s) || s.startsWith('anker') || s.startsWith('soundcore')) {
    return 'Anker';
  }

  // Baseus
  if (/\bbaseus\b/i.test(s) || s.startsWith('baseus')) {
    return 'Baseus';
  }

  // Oraimo
  if (/\boraimo\b/i.test(s) || s.startsWith('oraimo')) {
    return 'Oraimo';
  }

  // JBL
  if (/\bjbl\b/i.test(s) || s.startsWith('jbl')) {
    return 'JBL';
  }

  // Spigen
  if (/\bspigen\b/i.test(s) || s.startsWith('spigen')) {
    return 'Spigen';
  }

  // WiWU
  if (/\bwiwu\b/i.test(s) || s.startsWith('wiwu')) {
    return 'WiWU';
  }

  // Green Lion
  if (/\bgreen lion\b/i.test(s) || s.startsWith('green lion')) {
    return 'Green Lion';
  }

  // Joyroom
  if (/\bjoyroom\b/i.test(s) || s.startsWith('joyroom')) {
    return 'Joyroom';
  }

  // Generic
  if (/\bgeneric\b/i.test(s)) {
    return 'Generic';
  }

  return null;
}
