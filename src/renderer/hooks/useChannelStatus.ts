import { useState, useEffect, useCallback } from 'react';

interface ChannelStatus {
  connected: boolean;
  lastActivity?: string;
  error?: string;
}

interface ChannelsStatus {
  whatsapp?: ChannelStatus;
  telegram?: ChannelStatus;
  slack?: ChannelStatus;
}

export function useChannelStatus() {
  const [channels, setChannels] = useState<ChannelsStatus>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      // Preferred: one call covering all three channels from the gateway's
      // source of truth (overlord_channel_links).
      const all = await window.electron.channels.getStatusAll?.().catch(() => null);
      if (all?.success && all.data) {
        setChannels({
          whatsapp: { connected: Boolean(all.data.whatsapp?.linked) },
          telegram: { connected: Boolean(all.data.telegram?.linked) },
          slack: { connected: Boolean(all.data.slack?.linked) },
        });
        setError(null);
        return;
      }

      // Fallback: per-channel checks (older web app deploys without
      // /api/agi/channels; Slack approximated via the integrations list).
      const [whatsappResult, telegramResult, integrationsResult] = await Promise.allSettled([
        window.electron.channels.checkWhatsAppLinked(),
        window.electron.channels.checkTelegramLinked(),
        window.electron.integrations.list(),
      ]);

      const nextChannels: ChannelsStatus = {};

      if (whatsappResult.status === 'fulfilled') {
        const wa = whatsappResult.value;
        nextChannels.whatsapp = {
          connected: Boolean(wa?.linked),
          error: wa?.success === false ? wa.error : undefined,
        };
      }

      if (telegramResult.status === 'fulfilled') {
        const tg = telegramResult.value;
        nextChannels.telegram = {
          connected: Boolean(tg?.linked),
          error: tg?.success === false ? tg.error : undefined,
        };
      }

      if (integrationsResult.status === 'fulfilled') {
        const integrations = integrationsResult.value.data?.integrations || [];
        const slackIntegration = integrations.find((i) => i.provider === 'slack');
        nextChannels.slack = {
          connected: Boolean(slackIntegration?.connected),
        };
      }

      setChannels(nextChannels);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load initial data
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Refresh periodically (every 30 seconds)
  useEffect(() => {
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Derived state
  const hasAnyConnected = Object.values(channels).some((c) => c?.connected);
  const hasAllDisconnected = Object.values(channels).length === 0 ||
    Object.values(channels).every((c) => !c?.connected);

  const connectedChannels = Object.entries(channels)
    .filter(([, status]) => status?.connected)
    .map(([name]) => name);

  const disconnectedChannels = Object.entries(channels)
    .filter(([, status]) => !status?.connected)
    .map(([name]) => name);

  return {
    // State
    channels,
    isLoading,
    error,

    // Individual channels
    whatsapp: channels.whatsapp,
    telegram: channels.telegram,
    slack: channels.slack,

    // Derived
    hasAnyConnected,
    hasAllDisconnected,
    connectedChannels,
    disconnectedChannels,

    // Actions
    refresh,
  };
}
