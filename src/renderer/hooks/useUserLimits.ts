import { useState, useEffect, useCallback } from 'react';

interface UserLimits {
  id: string;
  user_id: string;
  ai_actions_used: number;
  ai_actions_limit: number;
  signatures_used: number;
  signatures_limit: number;
  period_start: string;
  period_end: string;
}

// Signatures >= 999999 are considered unlimited (Legend plan)
const UNLIMITED_THRESHOLD = 999999;

export function useUserLimits() {
  const [limits, setLimits] = useState<UserLimits | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLimits = useCallback(async () => {
    try {
      const result = await window.electron.limits.get();
      if (result.success && result.data) {
        setLimits(result.data);
        setError(null);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLimits();
  }, [fetchLimits]);

  const signaturesUsed = limits?.signatures_used ?? 0;
  const signaturesLimit = limits?.signatures_limit ?? 5;
  const hasUnlimitedSignatures = signaturesLimit >= UNLIMITED_THRESHOLD;
  const signaturesRemaining = hasUnlimitedSignatures ? Infinity : Math.max(0, signaturesLimit - signaturesUsed);
  const signaturesPercentUsed = hasUnlimitedSignatures ? 0 : (signaturesLimit > 0 ? signaturesUsed / signaturesLimit : 0);

  return {
    limits,
    isLoading,
    error,
    signaturesUsed,
    signaturesLimit,
    signaturesRemaining,
    signaturesPercentUsed,
    hasUnlimitedSignatures,
    refresh: fetchLimits,
  };
}
