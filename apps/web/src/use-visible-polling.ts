import { useEffect } from 'react';

// Polls while the tab is visible. A new `refresh` (for example after a filter
// change) restarts polling with an immediate read.
export function useVisiblePolling(
  refresh: () => Promise<void>,
  intervalMs = 3_000,
) {
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
      if (!active) return;
      timer = setTimeout(() => void poll(), intervalMs);
    };
    const poll = async () => {
      if (!active) return;
      if (document.visibilityState === 'visible') {
        await refresh();
      }
      schedule();
    };
    const visibilityChanged = () => {
      if (document.visibilityState === 'visible') {
        if (timer !== undefined) clearTimeout(timer);
        void poll();
      }
    };

    void poll();
    document.addEventListener('visibilitychange', visibilityChanged);
    return () => {
      active = false;
      if (timer !== undefined) clearTimeout(timer);
      document.removeEventListener('visibilitychange', visibilityChanged);
    };
  }, [intervalMs, refresh]);
}
