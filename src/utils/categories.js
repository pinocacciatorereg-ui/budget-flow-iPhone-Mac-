// Category utilities including rules for automatic category suggestion

// Rules used when guessing a category from a transaction description.
export const importCategoryRules = [
  { name: 'Abbonamenti', keys: ['netflix', 'spotify', 'apple', 'icloud', 'disney', 'prime', 'dazn', 'youtube', 'music'] },
  { name: 'Spesa', keys: ['esselunga', 'conad', 'coop', 'lidl', 'aldi', 'eurospin', 'carrefour', 'iper', 'pam', 'supermercato'] },
  { name: 'Asporto / Delivery', keys: ['glovo', 'deliveroo', 'just eat', 'pizza', 'mc donald', 'burger', 'pizzeria', 'mcdonald'] },
  { name: 'Bar / Colazioni / Snack', keys: ['bar', 'caffe', 'caffè', 'cornetto', 'colazione', 'bakery', 'pasticceria', 'snack', 'cafe'] },
  { name: 'Trasporti', keys: ['benzina', 'eni', 'q8', 'tamoil', 'ip', 'treno', 'trenitalia', 'italo', 'metro', 'bus', 'uber', 'taxi'] },
  { name: 'Salute', keys: ['farmacia', 'medico', 'dentista', 'sanitaria', 'analisi', 'ospedale'] },
  { name: 'Shopping / Personale', keys: ['amazon', 'zara', 'h&m', 'decathlon', 'ikea', 'negozio'] },
  { name: 'Bollette', keys: ['enel', 'energia', 'gas', 'hera', 'a2a', 'luce', 'acqua', 'bolletta'] },
  { name: 'Rate / Finanziamenti', keys: ['mutuo', 'rata', 'finanziamento', 'prestito', 'leasing'] },
  { name: 'Accrediti / Entrata', keys: ['stipendio', 'salary', 'payroll', 'accredito', 'bonifico'] },
];

// Normalize string: lower-case, trim and strip accents
const norm = (v) =>
  String(v ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

// Given a description, attempt to infer the category name using predefined rules.
export function guessCategoryName(desc) {
  const n = norm(desc);
  for (const rule of importCategoryRules) {
    if (rule.keys.some((k) => n.includes(norm(k)))) {
      return rule.name;
    }
  }
  return 'Varie / Altro';
}