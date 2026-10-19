import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../services/backendApi';

/**
 * Wave 38 central lock: asks the server whether this domain was already
 * initialized (installed.lock). Exactly one office per domain — later
 * visitors get the login page, never a second setup screen.
 */
export function useInstallStatus(enabled: boolean): {
  loading: boolean;
  /** true = sealed, false = fresh, null = server unreachable */
  initialized: boolean | null;
  refresh: () => void;
} {
  const [loading, setLoading] = useState(enabled);
  const [initialized, setInitialized] = useState<boolean | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) { setLoading(false); return; }
    let alive = true;
    setLoading(true);
    fetch(`${API_BASE_URL}/install.php?action=status`, { method: 'GET' })
      .then(r => r.json().catch(() => ({})))
      .then((j: { success?: boolean; data?: { initialized?: boolean } }) => {
        if (!alive) return;
        setInitialized(j && j.success && j.data ? !!j.data.initialized : null);
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setInitialized(null);
        setLoading(false);
      });
    return () => { alive = false; };
  }, [enabled, tick]);

  return { loading, initialized, refresh: () => setTick(t => t + 1) };
}
