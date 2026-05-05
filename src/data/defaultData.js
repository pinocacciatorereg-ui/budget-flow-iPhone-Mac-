// Default data and constants used when initializing the BudgetFlow app.

// Colour palette used for categories. Reused across default categories.
export const COLORS = [
  '#3b82f6',
  '#22c55e',
  '#ec4899',
  '#facc15',
  '#ef4444',
  '#d946ef',
  '#8b5cf6',
  '#60a5fa',
  '#14b8a6',
  '#fb923c',
  '#a3e635',
  '#0f766e',
  '#fb7185',
  '#7dd3fc',
  '#94a3b8',
];

// Generate a random unique identifier. Fall back to Math.random when crypto API is unavailable.
const uid = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10));

// Today's date in ISO format for seeding default transactions
const today = () => new Date().toISOString().slice(0, 10);

// Default expense categories with budgets and types. 'kind' can be 'fixed' or 'variable'.
export const defaultCats = [
  ['Spesa', 400, 'variable'],
  ['Bar / Colazioni / Snack', 250, 'variable'],
  ['Asporto / Delivery', 200, 'variable'],
  ['Casa', 160, 'fixed'],
  ['Affitto', 650, 'fixed'],
  ['Bollette', 90, 'fixed'],
  ['Trasporti', 70, 'variable'],
  ['Salute', 50, 'variable'],
  ['Shopping / Personale', 50, 'variable'],
  ['Tempo Libero', 30, 'variable'],
  ['Abbonamenti', 25, 'fixed'],
  ['Rate / Finanziamenti', 10, 'fixed'],
  ['Regali', 10, 'variable'],
  ['Viaggi', 10, 'variable'],
  ['Varie / Altro', 10, 'variable'],
].map((x, i) => ({
  id: uid(),
  name: x[0],
  budget: x[1],
  kind: x[2],
  type: 'expense',
  color: COLORS[i % COLORS.length],
}));

// Demo transactions for new users. A single income and sample expenses matching each default category.
const demoTx = [];
// Income entry
demoTx.push({
  id: uid(),
  date: today(),
  description: 'Stipendio',
  categoryId: 'income',
  type: 'income',
  amount: 1950,
  notes: 'Entrata ricorrente',
});
// Sample expenses: amount decreases progressively. Only include when amount > 0.
[387, 240, 200, 150, 114, 80, 60, 48, 40, 25, 20, 6, 2, 0, 0].forEach((a, i) => {
  if (a) {
    demoTx.push({
      id: uid(),
      date: today(),
      description: defaultCats[i].name,
      categoryId: defaultCats[i].id,
      type: 'expense',
      amount: a,
      notes: '',
    });
  }
});

// Default recurrences for demonstration purposes
const defaultRecurrences = [
  {
    id: uid(),
    description: 'Stipendio',
    categoryId: 'income',
    type: 'income',
    amount: 1950,
    day: 1,
    active: true,
    frequency: 'monthly',
    remindDays: 2,
    autoApply: false,
  },
  {
    id: uid(),
    description: 'Affitto',
    categoryId: defaultCats[4].id,
    type: 'expense',
    amount: 650,
    day: 1,
    active: true,
    frequency: 'monthly',
    remindDays: 3,
    autoApply: false,
  },
  {
    id: uid(),
    description: 'Netflix',
    categoryId: defaultCats[10].id,
    type: 'expense',
    amount: 12.99,
    day: 7,
    active: true,
    frequency: 'monthly',
    remindDays: 2,
    autoApply: false,
  },
  {
    id: uid(),
    description: 'Bollette luce/gas',
    categoryId: defaultCats[5].id,
    type: 'expense',
    amount: 85,
    day: 15,
    active: true,
    frequency: 'monthly',
    remindDays: 5,
    autoApply: false,
  },
  {
    id: uid(),
    description: 'Rata finanziamento',
    categoryId: defaultCats[11].id,
    type: 'expense',
    amount: 120,
    day: 20,
    active: true,
    frequency: 'monthly',
    remindDays: 3,
    autoApply: false,
  },
];

// Default application data. This structure will be persisted in IndexedDB.
export const defaultData = {
  // Schema and application versions for migrations
  schemaVersion: 25,
  appVersion: '25',
  version: 25,
  // Top-level collections
  categories: defaultCats,
  transactions: demoTx,
  recurrences: defaultRecurrences,
  // User settings and preferences
  settings: {
    pin: '',
    lastCategoryId: defaultCats[0].id,
    dirtyCount: 0,
    quickFavorites: defaultCats.slice(0, 6).map((c) => c.id),
  },
  // Budgets per month (YYYY-MM => { categoryId: amount })
  budgets: {},
  // Saved CSV column mappings keyed by user-defined names
  mappings: {},
  // Track the ID of the most recent CSV import batch
  lastImportBatchId: null,
  // Additional collections for future features
  backupHistory: [],
  importHistory: [],
  csvMappings: [],
};