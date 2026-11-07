/**
 * Persistent helper for inline-edited vendor statement descriptions.
 * Allows store owners to customize transaction descriptions before printing or sharing,
 * persisting them across browser sessions and modals.
 */

import { api } from '../api/client';

const STORAGE_PREFIX = 'vendor_statement_desc_';

export function getCustomStatementDescriptions(
  contactId: string,
  serverOverrides?: Record<string, string> | null
): Record<string, string> {
  if (!contactId) return {};
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${contactId}`);
    const local = raw ? JSON.parse(raw) : {};
    if (serverOverrides && Object.keys(serverOverrides).length > 0) {
      const merged = { ...serverOverrides, ...local };
      localStorage.setItem(`${STORAGE_PREFIX}${contactId}`, JSON.stringify(merged));
      return merged;
    }
    return local;
  } catch (e) {
    console.error('Failed to parse statement descriptions from localStorage:', e);
    return serverOverrides || {};
  }
}

export function saveCustomStatementDescription(
  contactId: string,
  rowId: string,
  description: string
): Record<string, string> {
  if (!contactId || !rowId) return {};
  try {
    const current = getCustomStatementDescriptions(contactId);
    const trimmed = description.trim();
    if (!trimmed) {
      delete current[rowId];
    } else {
      current[rowId] = trimmed;
    }
    localStorage.setItem(`${STORAGE_PREFIX}${contactId}`, JSON.stringify(current));

    // Also persist permanently to backend database
    api.updateContactStatementOverride(contactId, rowId, trimmed).catch((err) => {
      console.warn('Failed to sync statement override to backend:', err);
    });

    return current;
  } catch (e) {
    console.error('Failed to save statement description to localStorage:', e);
    return {};
  }
}

export function clearCustomStatementDescription(
  contactId: string,
  rowId: string
): Record<string, string> {
  if (!contactId || !rowId) return {};
  try {
    const current = getCustomStatementDescriptions(contactId);
    delete current[rowId];
    localStorage.setItem(`${STORAGE_PREFIX}${contactId}`, JSON.stringify(current));

    // Remove from backend database as well
    api.updateContactStatementOverride(contactId, rowId, '').catch((err) => {
      console.warn('Failed to clear statement override on backend:', err);
    });

    return current;
  } catch (e) {
    console.error('Failed to clear statement description in localStorage:', e);
    return {};
  }
}
