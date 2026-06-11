import { useState, useEffect } from 'react';

const STORAGE_KEY = 'collectapp_offline_queue';

export function usePendingSync() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const update = () => {
      try {
        const queue = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
        setCount(Array.isArray(queue) ? queue.length : 0);
      } catch { setCount(0); }
    };
    update();
    window.addEventListener('storage', update);
    const t = setInterval(update, 5000);
    return () => { window.removeEventListener('storage', update); clearInterval(t); };
  }, []);

  return count;
}

export function addToOfflineQueue(op: Record<string, unknown>) {
  try {
    const queue = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    queue.push({ ...op, horodatage_local: new Date().toISOString(), id_local: Date.now() });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    window.dispatchEvent(new Event('storage'));
  } catch { /* silencieux */ }
}

export function getOfflineQueue(): Record<string, unknown>[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); } catch { return []; }
}

export function clearOfflineQueue() {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event('storage'));
}
