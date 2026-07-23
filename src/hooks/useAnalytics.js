import { useCallback } from 'react';

/**
 * Fake analytics hook — just console logging for now since there's no
 * real backend to send this to. Swap the log line for a real
 * fetch()/sendBeacon() call whenever the client gives us an actual
 * analytics endpoint.
 */
export function useAnalytics() {
  const track = useCallback((eventName, meta = {}) => {
    console.log(`[Analytics] ${eventName}`, meta);
  }, []);

  return { track };
}
