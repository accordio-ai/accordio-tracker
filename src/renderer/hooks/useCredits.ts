import { useState, useEffect, useCallback, useRef } from 'react';

interface ServerCredits {
  credit_balance: number;
  /* Present once the web app ships them; default to 0 until then. */
  daily_credits_balance?: number;
  daily_credits_limit?: number;
  monthly_allocation: number;
  legend_credit_tier: number;
  is_legend: boolean;
  /* Trial/billing state for the banners; absent on older servers. */
  trial?: {
    is_active: boolean;
    is_expired: boolean;
    days_remaining: number | null;
    end_at: string | null;
  };
  billing_issue?: boolean;
}

// Legacy shape expected by the IPC layer
interface UserCredits {
  daily_messages: number;
  daily_messages_used: number;
  bonus_messages: number;
  legend_message_tier: number;
  total_available: number;
}

function normalizeCredits(raw: ServerCredits | UserCredits): {
  balance: number;
  allocation: number;
  dailyBalance: number;
  dailyLimit: number;
  isLegend: boolean;
  legendTier: number;
} {
  // Handle new API shape
  if ('credit_balance' in raw) {
    return {
      balance: raw.credit_balance ?? 0,
      allocation: raw.monthly_allocation ?? 0,
      dailyBalance: raw.daily_credits_balance ?? 0,
      dailyLimit: raw.daily_credits_limit ?? 0,
      isLegend: raw.is_legend ?? false,
      legendTier: raw.legend_credit_tier ?? 0,
    };
  }
  // Handle legacy shape
  return {
    balance: raw.total_available ?? 0,
    allocation: raw.daily_messages ?? 0,
    dailyBalance: 0,
    dailyLimit: 0,
    isLegend: (raw.legend_message_tier ?? 0) > 0,
    legendTier: raw.legend_message_tier ?? 0,
  };
}

export function useCredits() {
  const [balance, setBalance] = useState(0);
  const [allocation, setAllocation] = useState(0);
  const [dailyBalance, setDailyBalance] = useState(0);
  const [dailyLimit, setDailyLimit] = useState(0);
  const [isLegend, setIsLegend] = useState(false);
  const [legendTier, setLegendTier] = useState(0);
  const [isExhausted, setIsExhausted] = useState(false);
  const [isTrialActive, setIsTrialActive] = useState(false);
  const [isTrialExpired, setIsTrialExpired] = useState(false);
  const [trialDaysRemaining, setTrialDaysRemaining] = useState<number | null>(null);
  const [billingIssue, setBillingIssue] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastFetchDate = useRef<string>('');

  const fetchCredits = useCallback(async () => {
    try {
      const result = await window.electron.credits.get();
      if (result.success && result.data) {
        const norm = normalizeCredits(result.data);
        setBalance(norm.balance);
        setAllocation(norm.allocation);
        setDailyBalance(norm.dailyBalance);
        setDailyLimit(norm.dailyLimit);
        setIsLegend(norm.isLegend);
        setLegendTier(norm.legendTier);
        setIsExhausted(!norm.isLegend && norm.balance + norm.dailyBalance <= 0);
        // The IPC layer types the legacy shape only; trial/billing ride the
        // new server payload when present.
        const server = result.data as unknown as Partial<ServerCredits>;
        if (server.trial) {
          setIsTrialActive(server.trial.is_active);
          setIsTrialExpired(server.trial.is_expired);
          setTrialDaysRemaining(server.trial.days_remaining);
        }
        setBillingIssue(Boolean(server.billing_issue));
        setError(null);
        lastFetchDate.current = new Date().toISOString().slice(0, 10);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  // Credit updates arrive from two places now:
  //  - IPC, for anything the main process does (periodic polling, bot actions)
  //  - window events, from the chat transport. Chat moved into the renderer,
  //    so its credit headers never cross the IPC boundary any more.
  useEffect(() => {
    const applyUpdate = (creditsRemaining: number) => {
      if (creditsRemaining <= 0) {
        setIsExhausted(true);
      }
      // The pushed number is a merged total — refetch instead of writing it
      // into `balance`, which would corrupt the plan/daily split.
      fetchCredits();
    };

    const applyExhausted = () => {
      setIsExhausted(true);
      fetchCredits();
    };

    const cleanupUpdated = window.electron.credits.onUpdated((data) =>
      applyUpdate(data.creditsRemaining)
    );
    const cleanupExhausted = window.electron.credits.onExhausted(applyExhausted);

    const onLocalUpdate = (e: Event) => {
      const detail = (e as CustomEvent<{ creditsRemaining: number }>).detail;
      if (detail) applyUpdate(detail.creditsRemaining);
    };
    // The chat transport saw a trial_expired 402 — flip immediately rather
    // than waiting for the next credits poll.
    const applyTrialExpired = () => {
      setIsTrialActive(false);
      setIsTrialExpired(true);
      fetchCredits();
    };

    window.addEventListener('accordio:credits', onLocalUpdate);
    window.addEventListener('accordio:credits-exhausted', applyExhausted);
    window.addEventListener('accordio:trial-expired', applyTrialExpired);

    return () => {
      cleanupUpdated();
      cleanupExhausted();
      window.removeEventListener('accordio:credits', onLocalUpdate);
      window.removeEventListener('accordio:credits-exhausted', applyExhausted);
      window.removeEventListener('accordio:trial-expired', applyTrialExpired);
    };
  }, [fetchCredits]);

  // Check for monthly rollover every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const today = new Date().toISOString().slice(0, 10);
      if (lastFetchDate.current && lastFetchDate.current !== today) {
        fetchCredits();
        setIsExhausted(false);
      }
    }, 60_000);

    return () => clearInterval(interval);
  }, [fetchCredits]);

  const totalBalance = balance + dailyBalance;
  const isLow = !isLegend && totalBalance > 0 && totalBalance <= 50;
  const used = Math.max(0, allocation - balance);
  const usagePercentage = allocation > 0 ? Math.round((used / allocation) * 100) : 0;

  const planName = isLegend ? 'Legend' : isTrialActive ? 'Trial' : 'Free';

  return {
    credits: { balance, allocation, legendTier },
    isExhausted: isExhausted && !isLegend,
    isLegend,
    isTrialActive,
    isTrialExpired,
    trialDaysRemaining,
    billingIssue,
    isLow,
    isLoading,
    error,
    remainingToday: totalBalance,
    totalBalance,
    planBalance: balance,
    planAllocation: allocation,
    dailyBalance,
    dailyLimit,
    usedToday: used,
    usagePercentage,
    planName,
    refresh: fetchCredits,
  };
}
