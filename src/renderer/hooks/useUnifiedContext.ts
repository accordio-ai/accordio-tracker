import { useState, useEffect, useCallback, useRef } from 'react';

export interface UnifiedContext {
  user: { id: string; name: string | null; business_name: string | null };
  current_state: {
    focus_task: unknown;
    running_timer: unknown;
    tracked_today_minutes: number;
    tracked_today_hours: number;
    billable_today_minutes: number;
    billable_today_hours: number;
  };
  tasks: {
    focus: unknown;
    next_up: unknown[];
    high_priority: unknown[];
    total_active: number;
    by_source: Record<string, number>;
  };
  deadlines: {
    overdue: unknown[];
    upcoming: unknown[];
    total_this_week: number;
  };
  time_tracking: {
    recent_entries: unknown[];
    summary: { last_7_days_minutes: number; last_7_days_hours: number };
  } | null;
  calendar: {
    upcoming_events: unknown[];
    today_count: number;
  } | null;
  finances: {
    unpaid_invoices: unknown[];
    total_outstanding: string;
    total_overdue: string;
    overdue_count: number;
  };
  projects: {
    active: unknown[];
    total_active: number;
  };
  contracts: {
    awaiting_signature: unknown[];
    active: unknown[];
    total_value: string;
  };
  clients: {
    list: unknown[];
    total: number;
  };
  integrations: {
    connected: Array<{ provider: string; workspace_name?: string; last_synced_at?: string }>;
  };
  memories: {
    by_category: Record<string, string[]>;
    total: number;
  };
  generated_at: string;
}

export function useUnifiedContext() {
  const [context, setContext] = useState<UnifiedContext | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastFetchRef = useRef<number>(0);

  const fetchContext = useCallback(async (force = false) => {
    // Throttle: don't re-fetch within 30 seconds unless forced
    const now = Date.now();
    if (!force && now - lastFetchRef.current < 30_000) return;

    try {
      setIsLoading(true);
      const result = await window.electron.context.getUnified();
      if (result.success && result.data) {
        setContext(result.data as UnifiedContext);
        setError(null);
        lastFetchRef.current = now;
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchContext(true);
  }, [fetchContext]);

  // Re-fetch when window becomes visible
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchContext();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchContext]);

  return {
    context,
    isLoading,
    error,
    refresh: () => fetchContext(true),
  };
}
