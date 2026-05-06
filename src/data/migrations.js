// Data migrations for BudgetFlow. Ensures compatibility across versions and
// initializes missing fields with sensible defaults.

import { defaultData, COLORS } from './defaultData.js';

// Generate a pseudo-unique identifier (without relying on crypto)
const uid = () => Math.random().toString(36).slice(2, 10);

// Ensure a category object has all required fields
function normalizeCategory(cat, index = 0) {
  return {
    id: cat.id ?? uid(),
    name: cat.name ?? `Categoria ${index + 1}`,
    budget: typeof cat.budget === 'number' ? cat.budget : Number(cat.budget || 0),
    kind: cat.kind || 'variable',
    type: cat.type || 'expense',
    color: cat.color || COLORS[index % COLORS.length],
  };
}

// Ensure a transaction object has all required fields
function normalizeTransaction(tx) {
  const out = { ...tx };
  out.id = tx.id ?? uid();
  out.date = tx.date ?? new Date().toISOString().slice(0, 10);
  out.description = tx.description ?? 'Transazione';
  out.categoryId = tx.categoryId ?? 'uncategorized';
  out.type = tx.type === 'income' ? 'income' : 'expense';
  out.amount = Number(tx.amount ?? 0);
  out.notes = tx.notes ?? '';
  return out;
}

// Ensure a recurrence object has all required fields
function normalizeRecurrence(rec) {
  const out = { ...rec };
  out.id = rec.id ?? uid();
  out.description = rec.description ?? 'Ricorrenza';
  out.categoryId = rec.categoryId ?? 'uncategorized';
  out.type = rec.type === 'income' ? 'income' : 'expense';
  out.amount = Number(rec.amount ?? 0);
  out.day = rec.day ?? 1;
  out.active = rec.active !== false; // default true
  out.frequency = rec.frequency || 'monthly';
  out.remindDays = rec.remindDays ?? 0;
  out.autoApply = rec.autoApply || false;
  return out;
}

/**
 * Migrate data from an older schema to the current schema. Populates missing
 * fields with defaults, ensures data integrity, and assigns the correct
 * schema and app version numbers.
 * @param {object} data - The stored state to migrate
 * @returns {object} The migrated data conforming to the latest schema
 */
export function migrateData(data = {}) {
  const result = { ...defaultData, ...data };
  // Update version identifiers for v32
  result.schemaVersion = 32;
  result.appVersion = '32';
  result.version = 32;
  // Categories
  result.categories = (data.categories || defaultData.categories).map((c, i) => normalizeCategory(c, i));
  // Transactions
  result.transactions = (data.transactions || defaultData.transactions).map((t) => normalizeTransaction(t));
  // Recurrences
  result.recurrences = (data.recurrences || defaultData.recurrences).map((r) => normalizeRecurrence(r));
  // Budgets
  result.budgets = data.budgets || {};
  // Mappings
  result.mappings = data.mappings || {};
  // Histories
  result.backupHistory = data.backupHistory || [];
  result.importHistory = data.importHistory || [];
  result.csvMappings = data.csvMappings || [];
  // Last import batch
  result.lastImportBatchId = data.lastImportBatchId ?? null;
  // Settings
  result.settings = { ...defaultData.settings, ...(data.settings || {}) };
  // Ensure quickFavorites is an array. Do not auto-populate favourites; leave empty for user choice.
  if (!Array.isArray(result.settings.quickFavorites)) {
    result.settings.quickFavorites = [];
  }
  if (!('dirtyCount' in result.settings)) result.settings.dirtyCount = 0;
  if (!('pin' in result.settings)) result.settings.pin = '';
  if (!('lastCategoryId' in result.settings)) result.settings.lastCategoryId = result.categories[0]?.id;
  return result;
}