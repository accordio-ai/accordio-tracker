/**
 * useIntegrations Hook
 *
 * Manages integration status fetching and connect actions for the menubar app.
 */

import { useState, useEffect, useCallback } from 'react';

export interface Integration {
  provider: string;
  connected: boolean;
  name: string;
  icon?: string;
}

export interface IntegrationsData {
  integrations: Integration[];
  summary: {
    total: number;
    connected: number;
  };
}

export function useIntegrations() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<number>(0);

  const fetchIntegrations = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const result = await window.electron.integrations.list();

      if (result.success && result.data) {
        setIntegrations(result.data.integrations);
        setLastFetched(Date.now());
      } else {
        setError(result.error || 'Failed to fetch integrations');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchIntegrations();

    // Set up polling every 60 seconds
    const interval = setInterval(fetchIntegrations, 60000);

    // Listen for status changes from main process
    window.electron.integrations.onStatusChanged((data) => {
      if (data.integrations) {
        setIntegrations(data.integrations as Integration[]);
        setLastFetched(Date.now());
      }
    });

    return () => {
      clearInterval(interval);
    };
  }, [fetchIntegrations]);

  // Open web app settings to connect an integration
  const connectIntegration = useCallback((provider?: string) => {
    window.electron.integrations.openSettings(provider);
  }, []);

  // Refresh integrations status
  const refresh = useCallback(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  // Get specific integration status
  const getIntegration = useCallback((provider: string) => {
    return integrations.find(i => i.provider === provider);
  }, [integrations]);

  // Check if a specific integration is connected
  const isConnected = useCallback((provider: string) => {
    const integration = integrations.find(i => i.provider === provider);
    return integration?.connected ?? false;
  }, [integrations]);

  // Get count of connected integrations
  const connectedCount = integrations.filter(i => i.connected).length;

  // Priority integrations for display
  const priorityIntegrations = integrations.filter(i =>
    ['gmail', 'google_calendar', 'notion', 'slack'].includes(i.provider)
  );

  return {
    integrations,
    priorityIntegrations,
    isLoading,
    error,
    lastFetched,
    connectedCount,
    totalCount: integrations.length,
    connectIntegration,
    refresh,
    getIntegration,
    isConnected,
  };
}
