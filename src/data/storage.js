// Storage abstraction for BudgetFlow. Persists the entire app state in IndexedDB
// with a fallback to localStorage if IndexedDB is unavailable.

import { defaultData } from './defaultData.js';

// IndexedDB constants
const DB_NAME = 'budgetflow-db';
const STORE_NAME = 'state';
const DB_VERSION = 1;

// Check if IndexedDB is available in the current environment
export const isIndexedDBAvailable = () => {
  try {
    return typeof indexedDB !== 'undefined';
  } catch {
    return false;
  }
};

// Open (or create) the database and object store
async function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Read the stored app state from IndexedDB
async function readState() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get('state');
    getReq.onsuccess = () => resolve(getReq.result || null);
    getReq.onerror = () => reject(getReq.error);
  });
}

// Write the app state to IndexedDB
async function writeState(data) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const putReq = store.put(data, 'state');
    putReq.onsuccess = () => resolve();
    putReq.onerror = () => reject(putReq.error);
  });
}

// Attempt to migrate legacy data from localStorage into IndexedDB. This is called
// automatically on first load. If migration has already been done, it returns null.
async function migrateFromLocalStorage() {
  try {
    // Avoid migrating multiple times
    const migrated = localStorage.getItem('budgetflow_migrated');
    if (migrated) return null;
    const saved = localStorage.getItem('budgetflow');
    if (!saved) {
      // nothing to migrate
      return null;
    }
    const parsed = JSON.parse(saved);
    if (!parsed || typeof parsed !== 'object') return null;
    // Save a backup of the legacy data
    localStorage.setItem('budgetflow_legacy_backup', saved);
    // Mark migration
    localStorage.setItem('budgetflow_migrated', '1');
    // Persist in IndexedDB
    await writeState(parsed);
    return parsed;
  } catch (err) {
    console.error('Migration from localStorage failed', err);
    return null;
  }
}

// Load the app data, performing migration and using default data if necessary.
export async function loadData() {
  // Attempt migration from localStorage
  let migrated = null;
  if (isIndexedDBAvailable()) {
    migrated = await migrateFromLocalStorage();
  }
  // Try reading from IndexedDB
  if (isIndexedDBAvailable()) {
    try {
      const state = await readState();
      if (state) return state;
    } catch (err) {
      console.warn('Failed to read from IndexedDB, falling back to localStorage', err);
    }
  }
  // Fallback to localStorage
  try {
    const saved = localStorage.getItem('budgetflow');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (err) {
    console.warn('Failed to read from localStorage', err);
  }
  // Nothing saved; return default
  return defaultData;
}

// Save the app data into IndexedDB and localStorage. Fallback gracefully if
// IndexedDB is unavailable or write fails.
export async function saveData(data) {
  // Always persist a copy to localStorage for simple fallback and backups
  try {
    localStorage.setItem('budgetflow', JSON.stringify(data));
  } catch (err) {
    console.error('Unable to persist to localStorage', err);
  }
  // Persist to IndexedDB if available
  if (isIndexedDBAvailable()) {
    try {
      await writeState(data);
    } catch (err) {
      console.warn('Failed to write to IndexedDB, falling back to localStorage only', err);
    }
  }
}