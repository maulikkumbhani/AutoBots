/**
 * AutoBots Unified Persistent Storage Utility
 * Safely persists user configurations, selected tabs, timeframes,
 * trade filters, and allocation settings across page refreshes.
 */

export function getStoredItem<T>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") return defaultValue;
  try {
    const val = localStorage.getItem(key);
    if (val === null || val === undefined) return defaultValue;
    try {
      return JSON.parse(val) as T;
    } catch {
      return val as unknown as T;
    }
  } catch {
    return defaultValue;
  }
}

export function setStoredItem<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    if (typeof value === "string") {
      localStorage.setItem(key, value);
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
  } catch (e) {
    console.warn(`Failed to save ${key} to localStorage:`, e);
  }
}
