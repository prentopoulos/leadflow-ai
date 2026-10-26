import { useEffect } from 'react';

// Polls while the tab is visible, one read at a time. A new `refresh` (for
// example after a filter change) restarts polling with an immediate read;
// `isCurrent` turns false once that happens, so a read still in flight for
// the previous `refresh` can skip applying its stale result.
export function useVisiblePolling(
  refresh: (isCurrent: () => boolean) => Promise<void>,
  intervalMs = 3_000,
) {
  useEffect(() => {
    let active = true;
    let polling = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const isCurrent = () => active;

    const schedule = () => {
      if (!active) return;
      timer = setTimeout(() => void poll(), intervalMs);
    };
    const poll = async () => {
      if (!active || polling) return;
      polling = true;
      try {
        if (document.visibilityState === 'visible') {
          await refresh(isCurrent);
        }
      } finally {
        polling = false;
      }
      schedule();
    };
    const visibilityChanged = () => {
      if (document.visibilityState === 'visible' && !polling) {
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
