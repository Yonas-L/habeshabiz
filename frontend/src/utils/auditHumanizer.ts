import type { AuditLogItem } from '../api/client';

export interface FormattedAuditDetail {
  label: string;
  value: string;
}

export interface FormattedAuditDiff {
  label: string;
  from: string;
  to: string;
}

export interface HumanizedAuditData {
  eventTitle: string;
  eventSubtitle: string;
  quickBadge?: { label: string; style: string };
  highlights: Array<{ label: string; value: string; isHighlight?: boolean }>;
  details: FormattedAuditDetail[];
  diffs: FormattedAuditDiff[];
  rawValues: Record<string, any> | null;
  rawOldValues: Record<string, any> | null;
}

// Technical database keys that should NOT be shown in the human-facing view
const TECHNICAL_KEYS = new Set([
  'id',
  'uuid',
  'tenant_id',
  'revert_group_id',
  'financial_account_id',
  'sales_order_id',
  'user_id',
  'contact_id',
  'variant_id',
  'product_id',
  'exchange_unit_id',
  'swapped_sales_order_id',
  'swapped_from_unit_id',
  'swapped_replacement_unit_id',
  'split_group_id',
  'parent_item_id',
  'supplier_contact_id',
  'customer_id',
  'salesperson_id',
  'created_at',
  'updated_at',
  'deleted_at',
  'unit_ids',
]);

// Money-related keys that should be formatted as currency
const MONEY_KEYS = new Set([
  'total_cost',
  'total_amount',
  'paid_amount',
  'amount',
  'bank_amount',
  'cash_amount',
  'discount_amount',
  'remaining_amount',
  'original_amount',
  'selling_price',
  'setted_price',
  'cost_basis',
  'offset_amount',
  'vendor_cost',
  'unit_cost',
  'unit_price',
  'write_off_amount',
  'exchange_allowance',
  'fee',
  'bonus_amount',
  'profit',
  'price',
]);

// Friendly human labels for common database field names
const FIELD_LABEL_MAP: Record<string, string> = {
  total_cost: 'Total Cost',
  total_amount: 'Total Amount',
  paid_amount: 'Paid Amount',
  amount: 'Amount',
  bank_amount: 'Paid via Bank',
  cash_amount: 'Paid via Cash',
  units_count: 'Units Received',
  quantity: 'Quantity',
  quantity_on_hand: 'Stock on Hand',
  items_count: 'Items in Order',
  offset_amount: 'Credit Offset',
  funding_source: 'Payment Source',
  payment_method: 'Payment Method',
  payment_status: 'Payment Status',
  order_number: 'Order Number',
  imei_or_serial: 'SN / IMEI',
  battery_health: 'Battery Health',
  cycle_count: 'Battery Cycles',
  condition: 'Physical Condition',
  storage_capacity: 'Storage',
  sim_type: 'SIM Type',
  color: 'Color',
  model: 'Model',
  product_name: 'Product Name',
  category: 'Category',
  description: 'Description',
  notes: 'Notes',
  location: 'Shop Location',
  handover_to: 'Custody Handed To',
  selling_price: 'Selling Price',
  cost_basis: 'Cost Basis',
  due_date: 'Due Date',
  order_date: 'Order Date',
  status: 'Status',
  customer_name: 'Customer',
  vendor_name: 'Vendor',
  partner_name: 'Partner',
  salesperson: 'Salesperson',
};

/**
 * Format a single value into human readable text
 */
function formatHumanValue(key: string, val: any): string {
  if (val === null || val === undefined || val === '') return '—';

  // Currency fields
  if (MONEY_KEYS.has(key)) {
    const num = Number(val);
    if (!isNaN(num)) {
      return `${num.toLocaleString()} ETB`;
    }
  }

  // Quantities
  if (key === 'units_count' || key === 'quantity' || key === 'quantity_on_hand' || key === 'items_count') {
    const num = Number(val);
    if (!isNaN(num)) {
      return `${num} ${num === 1 ? 'unit' : 'units'}`;
    }
  }

  // Battery health
  if (key === 'battery_health') {
    return `${val}%`;
  }

  // Cycle count
  if (key === 'cycle_count') {
    return `${val} cycles`;
  }

  // Boolean flags
  if (typeof val === 'boolean') {
    return val ? 'Yes' : 'No';
  }

  // Arrays (e.g. payment splits)
  if (Array.isArray(val)) {
    if (key === 'payment_splits') {
      const splitSummaries = val
        .map((s: any) => {
          const amt = s.amount ? `${Number(s.amount).toLocaleString()} ETB` : '';
          return amt;
        })
        .filter(Boolean);
      return splitSummaries.length > 0 ? splitSummaries.join(', ') : `${val.length} accounts`;
    }
    return `${val.length} items`;
  }

  // Objects
  if (typeof val === 'object') {
    return JSON.stringify(val);
  }

  const str = String(val);

  // Status or snake_case values
  if (str.includes('_') && str.length < 30) {
    return str
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }

  return str;
}

/**
 * Format field key into clean title
 */
function humanizeKey(key: string): string {
  if (FIELD_LABEL_MAP[key]) return FIELD_LABEL_MAP[key];
  return key
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Humanize an entire audit log item for drawer and table consumption
 */
export function humanizeAuditLog(log: AuditLogItem): HumanizedAuditData {
  const action = log.action;
  const newVals = log.new_values && typeof log.new_values === 'object' ? log.new_values : null;
  const oldVals = log.old_values && typeof log.old_values === 'object' ? log.old_values : null;

  // Friendly title based on action
  let eventTitle = humanizeKey(action);
  let eventSubtitle = `${log.entity_type}`;

  if (action.includes('intake')) {
    eventTitle = 'Stock Intake Recorded';
    eventSubtitle = 'New inventory received into shop';
  } else if (action === 'sale_created' || action === 'sales_order_create') {
    eventTitle = 'Sales Order Completed';
    eventSubtitle = newVals?.order_number ? `Order #${newVals.order_number}` : 'Customer device sale';
  } else if (action.includes('payment_collected') || action.includes('collect_payment')) {
    eventTitle = 'Customer Payment Collected';
    eventSubtitle = newVals?.order_number ? `Against Order #${newVals.order_number}` : 'Credit debt repayment';
  } else if (action.includes('expense')) {
    eventTitle = 'Expense Logged';
    eventSubtitle = newVals?.category ? humanizeKey(newVals.category) : 'Operational cash outflow';
  } else if (action.includes('transfer')) {
    eventTitle = 'Account Fund Transfer';
    eventSubtitle = 'Internal treasury balance movement';
  } else if (action.includes('handover') && action.includes('sold')) {
    eventTitle = 'Partner Handover Device Sold';
    eventSubtitle = 'Partner custody device converted to sale';
  } else if (action.includes('handover')) {
    eventTitle = 'Device Handed Out to Partner';
    eventSubtitle = 'Consignment or brokered device custody';
  } else if (action.includes('proforma')) {
    eventTitle = 'Proforma Invoice Generated';
    eventSubtitle = 'Official price quotation for customer';
  } else if (action.includes('undo') || action.includes('revert')) {
    eventTitle = 'Business Action Reversal (Undo)';
    eventSubtitle = 'Ledger and inventory rolled back safely';
  } else if (action.includes('update')) {
    eventTitle = `${log.entity_type} Updated`;
    eventSubtitle = 'Field attributes modified';
  } else if (action.includes('delete') || action.includes('void')) {
    eventTitle = `${log.entity_type} Removed / Voided`;
    eventSubtitle = 'Record removed from system';
  }

  // Key Highlights / Metrics
  const highlights: Array<{ label: string; value: string; isHighlight?: boolean }> = [];

  // Check for Total Cost or Total Amount
  const primaryAmount =
    newVals?.total_amount ??
    newVals?.total_cost ??
    newVals?.amount ??
    newVals?.paid_amount ??
    oldVals?.total_amount ??
    oldVals?.amount;

  if (primaryAmount !== undefined && primaryAmount !== null && primaryAmount !== '') {
    const num = Number(primaryAmount);
    if (!isNaN(num)) {
      highlights.push({
        label: newVals?.total_cost !== undefined ? 'Total Cost' : 'Amount',
        value: `${num.toLocaleString()} ETB`,
        isHighlight: true,
      });
    }
  }

  // Unit count / Quantity
  const count =
    newVals?.units_count ??
    newVals?.quantity ??
    newVals?.items_count ??
    (Array.isArray(newVals?.unit_ids) ? newVals.unit_ids.length : undefined);

  if (count !== undefined && count !== null && count !== '') {
    highlights.push({
      label: 'Quantity',
      value: `${count} ${count === 1 ? 'unit' : 'units'}`,
    });
  }

  // Paid amount or Payment Status
  if (newVals?.payment_status) {
    highlights.push({
      label: 'Payment Status',
      value: formatHumanValue('payment_status', newVals.payment_status),
    });
  } else if (newVals?.paid_amount !== undefined && newVals?.paid_amount !== primaryAmount) {
    highlights.push({
      label: 'Paid Amount',
      value: `${Number(newVals.paid_amount).toLocaleString()} ETB`,
    });
  }

  // Funding source or Payment Method
  if (newVals?.funding_source) {
    highlights.push({
      label: 'Payment Source',
      value: formatHumanValue('funding_source', newVals.funding_source),
    });
  } else if (newVals?.payment_method) {
    highlights.push({
      label: 'Method',
      value: formatHumanValue('payment_method', newVals.payment_method),
    });
  }

  // Secondary Details (filtered clean fields)
  const details: FormattedAuditDetail[] = [];
  const sourceObj = newVals || oldVals || {};

  for (const [key, rawVal] of Object.entries(sourceObj)) {
    // Skip technical internal noise or boolean false flags
    if (TECHNICAL_KEYS.has(key)) continue;
    if (typeof rawVal === 'boolean' && !rawVal) continue;
    if (rawVal === null || rawVal === undefined || rawVal === '') continue;

    // Skip if already in highlights to prevent redundancy
    if (
      key === 'total_cost' ||
      key === 'total_amount' ||
      key === 'units_count' ||
      key === 'quantity' ||
      key === 'funding_source' ||
      key === 'payment_status'
    ) {
      continue;
    }

    details.push({
      label: humanizeKey(key),
      value: formatHumanValue(key, rawVal),
    });
  }

  // Compare diffs if both old and new exist
  const diffs: FormattedAuditDiff[] = [];
  if (oldVals && newVals) {
    const allKeys = new Set([...Object.keys(oldVals), ...Object.keys(newVals)]);
    for (const key of allKeys) {
      if (TECHNICAL_KEYS.has(key)) continue;
      const vOld = oldVals[key];
      const vNew = newVals[key];

      if (vOld !== vNew && (vOld !== undefined || vNew !== undefined)) {
        diffs.push({
          label: humanizeKey(key),
          from: formatHumanValue(key, vOld),
          to: formatHumanValue(key, vNew),
        });
      }
    }
  }

  return {
    eventTitle,
    eventSubtitle,
    highlights,
    details,
    diffs,
    rawValues: newVals,
    rawOldValues: oldVals,
  };
}

/**
 * Get a 1-line glanceable summary for table row or mobile card
 */
export function getAuditQuickSummary(log: AuditLogItem): string {
  const newVals = log.new_values;
  const oldVals = log.old_values;
  const src = newVals || oldVals;

  if (!src) return 'System recorded event';

  const parts: string[] = [];

  // Intake summary
  if (log.action.includes('intake')) {
    if (src.total_cost) parts.push(`${Number(src.total_cost).toLocaleString()} ETB`);
    const count = src.units_count || (Array.isArray(src.unit_ids) ? src.unit_ids.length : null);
    if (count) parts.push(`${count} ${count === 1 ? 'unit' : 'units'}`);
    return parts.join(' · ') || 'Stock intake completed';
  }

  // Sale summary
  if (log.action.includes('sale')) {
    if (src.total_amount) parts.push(`${Number(src.total_amount).toLocaleString()} ETB`);
    if (src.order_number) parts.push(`Order #${src.order_number}`);
    return parts.join(' · ') || 'Sale transaction recorded';
  }

  // Payment summary
  if (log.action.includes('payment') || log.action.includes('collect')) {
    if (src.amount) parts.push(`Collected ${Number(src.amount).toLocaleString()} ETB`);
    if (src.order_number) parts.push(`Order #${src.order_number}`);
    return parts.join(' · ') || 'Payment collected';
  }

  // Expense summary
  if (log.action.includes('expense')) {
    if (src.amount) parts.push(`${Number(src.amount).toLocaleString()} ETB`);
    if (src.category) parts.push(humanizeKey(src.category));
    return parts.join(' · ') || 'Expense logged';
  }

  // Transfer summary
  if (log.action.includes('transfer')) {
    if (src.amount) parts.push(`Transferred ${Number(src.amount).toLocaleString()} ETB`);
    return parts.join(' · ') || 'Fund transfer executed';
  }

  // Handover summary
  if (log.action.includes('handover')) {
    if (src.partner_name || src.handover_to) parts.push(`With ${src.partner_name || src.handover_to}`);
    if (src.price || src.final_price) parts.push(`${Number(src.price || src.final_price).toLocaleString()} ETB`);
    return parts.join(' · ') || 'Handover custody updated';
  }

  // Default fallback to notes, description, or model
  if (src.notes) return `Note: ${src.notes}`;
  if (src.description) return src.description;
  if (src.model) return src.model;
  if (src.name) return src.name;

  return `${log.entity_type} event recorded`;
}
