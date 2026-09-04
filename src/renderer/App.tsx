import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Lock, Sparkles, TriangleAlert } from 'lucide-react';
import { useGateway } from './hooks/useGateway';
import { useAgiChat } from './hooks/useAgiChat';
import { useTimeTracker } from './hooks/useTimeTracker';
import { useActiveTask } from './hooks/useActiveTask';
import { useChannelStatus } from './hooks/useChannelStatus';
import { useIntegrations } from './hooks/useIntegrations';
import { useCredits } from './hooks/useCredits';
import { useUserLimits } from './hooks/useUserLimits';
import { useProfile } from './hooks/useProfile';
import { useUnifiedContext } from './hooks/useUnifiedContext';
import ActivityHub from './components/ActivityHub';
import { IntegrationGrid } from './components/IntegrationGrid';
import { MessageList } from './components/chat/MessageList';
import { SignInPrompt } from './components/SignInPrompt';
import ChannelSetupModal from './components/ChannelSetupModal';
import { Composer } from './components/chat/Composer';
import { MemorySheet } from './components/MemorySheet';
import { AppIcon } from './components/AppIcon';
import NumberFlow from '@number-flow/react';

/** "12:34"-style duration with per-digit NumberFlow roll on tick. */
function AnimatedDuration({ duration }: { duration: string }) {
  const parts = duration.split(':');
  return (
    <>
      {parts.map((part, i) => (
        <span key={`${parts.length}-${i}`} style={{ display: 'inline-flex', alignItems: 'baseline' }}>
          {i > 0 && ':'}
          <NumberFlow
            value={parseInt(part, 10) || 0}
            {...(i > 0 ? { format: { minimumIntegerDigits: 2 } } : {})}
          />
        </span>
      ))}
    </>
  );
}

// Messaging channels rendered as tiles in settings (same UX as Connected Tools)
const MESSAGING_CHANNELS: Array<{
  key: 'whatsapp' | 'telegram' | 'slack';
  name: string;
  color: string;
  icon: React.ReactNode;
}> = [
  {
    key: 'whatsapp',
    name: 'WhatsApp',
    color: '#25D366',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
      </svg>
    ),
  },
  {
    key: 'telegram',
    name: 'Telegram',
    color: '#26A6FE',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
      </svg>
    ),
  },
  {
    key: 'slack',
    name: 'Slack',
    color: '#E01E5A',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
      </svg>
    ),
  },
];

// Default placeholders when no context available
const DEFAULT_PLACEHOLDERS = [
  "Ask anything...",
  "Review this week...",
  "Draft an invoice for...",
  "Summarize today's work...",
];

export default function App() {
  const { isConnected } = useGateway();
  const {
    messages,
    isLoading,
    isThinking,
    error: chatError,
    sendMessage,
    stop: stopStreaming,
    retry,
    clear: clearMessages,
  } = useAgiChat();
  const {
    formattedToday,
    settings: timeSettings,
    updateSettings: updateTimeSettings,
    currentActivity,
    isIdle,
    isManualTimerRunning,
    formattedManualTimer,
    permissionStatus,
    permissionError,
    isCheckingPermissions,
    refreshPermissions,
  } = useTimeTracker();
  const { task: focusTask, formattedElapsed, settings: taskSettings, updateSettings: updateTaskSettings } = useActiveTask();
  const { whatsapp, telegram, slack, refresh: refreshChannels } = useChannelStatus();
  const { priorityIntegrations, connectIntegration } = useIntegrations();
  const {
    isExhausted: creditsExhausted,
    isLegend,
    isTrialActive,
    isTrialExpired,
    trialDaysRemaining,
    billingIssue,
    isLow: creditsLow,
    remainingToday: creditsRemaining,
    totalBalance: creditsTotal,
    planBalance: creditsPlanBalance,
    planAllocation: creditsPlanAllocation,
    dailyBalance: creditsDailyBalance,
    dailyLimit: creditsDailyLimit,
    isLoading: creditsLoading,
    planName,
    usedToday: _creditsUsedToday,
    usagePercentage: _creditsUsagePercentage,
  } = useCredits();
  const {
    signaturesUsed: _signaturesUsed,
    signaturesLimit: _signaturesLimit,
    hasUnlimitedSignatures: _hasUnlimitedSignatures,
    signaturesPercentUsed: _signaturesPercentUsed,
  } = useUserLimits();
  const { profile, displayName, initials } = useProfile();
  const { context: unifiedContext } = useUnifiedContext();

  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null); // null = checking
  const [_authToken, setAuthToken] = useState<string | null>(null);

  const [showSettings, setShowSettings] = useState(false);

  // Re-check channel link status whenever settings opens so the tiles are never stale
  useEffect(() => {
    if (showSettings) refreshChannels();
  }, [showSettings, refreshChannels]);

  // Update-ready prompt below the chat input (autoDownload is on, so
  // "downloaded" is the first moment the user can act). The mount check
  // covers updates that finished downloading before the window first opened.
  const [updateReadyVersion, setUpdateReadyVersion] = useState<string | null>(null);
  useEffect(() => {
    window.electron.update.onDownloaded((info) => setUpdateReadyVersion(info.version));
    window.electron.update.getPending?.().then((version) => {
      if (version) setUpdateReadyVersion(version);
    });
  }, []);
  const [mainTab, setMainTab] = useState<'agent' | 'tracker'>('agent');
  const [showMemorySheet, setShowMemorySheet] = useState(false);
  const [memoryCount, setMemoryCount] = useState<number | null>(null);
  const [logoAnimated, setLogoAnimated] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [currentShortcut, setCurrentShortcut] = useState('CommandOrControl+Shift+A');
  const [isRecordingShortcut, setIsRecordingShortcut] = useState(false);
  const [recordedKeys, setRecordedKeys] = useState('');
  const [updateAvailable, setUpdateAvailable] = useState(false);
  /** Clicked "Update now" while the download is still in flight. */
  const [updateClicked, setUpdateClicked] = useState(false);
  const [channelToSetup, setChannelToSetup] = useState<'whatsapp' | 'telegram' | 'slack' | null>(null);
  const [showUsageDropdown, setShowUsageDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Memory count for the settings profile card. Refreshed when settings open
  // and when the memory sheet closes (it may have added/removed entries).
  useEffect(() => {
    if (!showSettings || showMemorySheet) return;
    let cancelled = false;
    window.electron.memory.list()
      .then((m) => { if (!cancelled) setMemoryCount(m.length); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [showSettings, showMemorySheet]);

  // The floating composer's height is dynamic (timer chip, credits notice,
  // growing textarea). Publish it as a CSS var so the chat area can reserve
  // exactly enough bottom space instead of a hardcoded guess.
  const brainBarObserverRef = useRef<ResizeObserver | null>(null);
  const brainBarRef = useCallback((el: HTMLDivElement | null) => {
    brainBarObserverRef.current?.disconnect();
    brainBarObserverRef.current = null;
    if (!el) return;
    const publish = () => {
      document.documentElement.style.setProperty('--brain-bar-height', `${el.offsetHeight}px`);
    };
    publish();
    brainBarObserverRef.current = new ResizeObserver(publish);
    brainBarObserverRef.current.observe(el);
  }, []);

  // Top-level tab indicator refs
  const mainTabsContainerRef = useRef<HTMLDivElement>(null);
  const agentTabRef = useRef<HTMLButtonElement>(null);
  const trackerTabRef = useRef<HTMLButtonElement>(null);
  const [mainTabIndicatorStyle, setMainTabIndicatorStyle] = useState({ left: 3, width: 0 });

  // Track previous activity for "stale" state (shows yellow dot for 60s after switching apps)
  const [previousActivity, setPreviousActivity] = useState<{ appName: string; timestamp: number } | null>(null);
  const previousActivityRef = useRef<string | null>(null);

  // Update previous activity when current activity changes
  useEffect(() => {
    const currentAppName = currentActivity?.appName;
    if (previousActivityRef.current && currentAppName !== previousActivityRef.current) {
      // App changed - store the previous one with timestamp
      setPreviousActivity({ appName: previousActivityRef.current, timestamp: Date.now() });
    }
    previousActivityRef.current = currentAppName || null;
  }, [currentActivity?.appName]);

  // Listen for app update availability
  useEffect(() => {
    window.electron.update?.onAvailable?.(() => setUpdateAvailable(true));
    window.electron.update?.onNotAvailable?.(() => setUpdateAvailable(false));
  }, []);

  // Clear stale activity after 60 seconds
  useEffect(() => {
    if (previousActivity) {
      const timeout = setTimeout(() => {
        setPreviousActivity(null);
      }, 60000); // 60 seconds
      return () => clearTimeout(timeout);
    }
  }, [previousActivity]);

  // Determine what to show in the timer badge
  const isStaleActivity = !currentActivity && previousActivity && (Date.now() - previousActivity.timestamp < 60000);
  const displayActivity = currentActivity || (isStaleActivity ? { appName: previousActivity.appName } : null);

  // Timer state from focus task, manual timer, or auto time tracker
  const isTimeTracking = isManualTimerRunning || !!currentActivity || !!focusTask || isStaleActivity;
  const timerDuration = isManualTimerRunning ? formattedManualTimer : (focusTask ? formattedElapsed : formattedToday);

  // Generate dynamic placeholders based on context
  const placeholders = useMemo(() => {
    const suggestions: string[] = [];

    // Task-based suggestions
    if (focusTask) {
      suggestions.push(`Update on "${focusTask.title.substring(0, 20)}${focusTask.title.length > 20 ? '...' : ''}"...`);
      if (focusTask.project) {
        suggestions.push(`Log time for ${focusTask.project.name}...`);
      }
    }

    // Integration-based suggestions
    const gmail = priorityIntegrations.find(i => i.provider === 'gmail');
    const calendar = priorityIntegrations.find(i => i.provider === 'google_calendar');
    const notion = priorityIntegrations.find(i => i.provider === 'notion');
    const slackInt = priorityIntegrations.find(i => i.provider === 'slack');

    if (gmail?.connected) {
      suggestions.push("Draft an email to...");
      suggestions.push("Check my inbox...");
    }
    if (calendar?.connected) {
      suggestions.push("What's on my calendar today?");
      suggestions.push("Schedule a meeting with...");
    }
    if (notion?.connected) {
      suggestions.push("Add a note to Notion...");
    }
    if (slackInt?.connected) {
      suggestions.push("Send a Slack message to...");
    }

    // Channel-based suggestions
    if (whatsapp?.connected) {
      suggestions.push("Message client on WhatsApp...");
    }
    if (telegram?.connected) {
      suggestions.push("Send update via Telegram...");
    }

    // Time-based suggestions
    const hour = new Date().getHours();
    if (hour >= 17) {
      suggestions.push("Summarize today's work...");
      suggestions.push("What did I accomplish today?");
    } else if (hour < 10) {
      suggestions.push("What's my focus for today?");
      suggestions.push("Show my priorities...");
    }

    // Activity-based
    if (currentActivity && !isIdle) {
      suggestions.push(`Log time in ${currentActivity.appName}...`);
    }

    // Always include some defaults
    suggestions.push("Create an invoice for...");
    suggestions.push("Send a reminder to...");

    // Return unique suggestions, limit to 6
    const unique = [...new Set(suggestions)].slice(0, 6);
    return unique.length > 0 ? unique : DEFAULT_PLACEHOLDERS;
  }, [focusTask, priorityIntegrations, whatsapp, telegram, currentActivity, isIdle]);

  // Logo animation on window show + autofocus input
  useEffect(() => {
    setLogoAnimated(false);
    const timer = setTimeout(() => {
      setLogoAnimated(true);
      inputRef.current?.focus();
    }, 50);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        setLogoAnimated(false);
        setTimeout(() => {
          setLogoAnimated(true);
          inputRef.current?.focus();
        }, 50);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Also focus on window focus event (for Cmd+Shift+A)
    const handleFocus = () => {
      setTimeout(() => inputRef.current?.focus(), 100);
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Update top-level tab indicator position
  useEffect(() => {
    const updateIndicator = () => {
      const activeRef = mainTab === 'agent' ? agentTabRef : trackerTabRef;
      if (activeRef.current && mainTabsContainerRef.current) {
        const containerRect = mainTabsContainerRef.current.getBoundingClientRect();
        const tabRect = activeRef.current.getBoundingClientRect();
        const left = tabRect.left - containerRect.left;
        setMainTabIndicatorStyle({ left, width: tabRect.width });
      }
    };
    // Run immediately and after a short delay (for initial mount)
    updateIndicator();
    const timer = setTimeout(updateIndicator, 50);
    return () => clearTimeout(timer);
  }, [mainTab, isAuthenticated]);

  // Check authentication on startup
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = await window.electron.auth.getToken();
        setAuthToken(token);
        setIsAuthenticated(!!token);
      } catch (error) {
        console.error('[App] Failed to check auth:', error);
        setIsAuthenticated(false);
      }
    };
    checkAuth();

    // Listen for session expiry (401 from server)
    const cleanup = window.electron.auth.onSessionExpired(() => {
      console.log('[App] Session expired — returning to login');
      setIsAuthenticated(false);
      setAuthToken(null);
    });
    return cleanup;
  }, []);

  // Load saved settings
  useEffect(() => {
    const loadSettings = async () => {
      const savedTheme = await window.electron.settings.get('darkMode');
      if (savedTheme !== undefined) setIsDarkMode(savedTheme as boolean);
      const savedShortcut = await window.electron.settings.get('globalShortcut');
      if (savedShortcut && typeof savedShortcut === 'string') setCurrentShortcut(savedShortcut);
    };
    if (isAuthenticated) {
      loadSettings();
    }
  }, [isAuthenticated]);

  // Scrolling is owned by MessageList, which sticks to the bottom only when
  // the user is already there — the old unconditional scrollIntoView yanked
  // you back down mid-read during a long answer.

  const handleNewChat = () => {
    clearMessages();
  };

  const toggleTheme = async () => {
    const newValue = !isDarkMode;
    setIsDarkMode(newValue);
    await window.electron.settings.set('darkMode', newValue);
  };

  const hasMessages = messages.length > 0;
  const missingAccessibility = !!permissionStatus && !permissionStatus.accessibility;
  const missingScreenRecording = !!permissionStatus && !permissionStatus.screenRecording;
  const showPermissionWarning = (missingAccessibility || missingScreenRecording) && (timeSettings?.enabled || !!permissionError);
  const showEmptyState = !hasMessages && mainTab === 'agent' && !showSettings;

  // Show loading state while checking auth
  if (isAuthenticated === null) {
    return (
      <div className={`app ${isDarkMode ? 'dark' : 'light'}`}>
        <div className="onboarding">
          <div className="onboarding-container">
            <div className="onboarding-logo">
              <svg width="56" height="56" viewBox="0 0 18 18" fill="none">
                <path d="M14.3509 4.82496C15.172 3.99533 15.9931 2.77388 17.1805 0.420348C17.2791 0.224884 17.1291 -0.00512837 16.9102 8.7099e-05C4.51767 0.295389 2.66382 11.9639 1.78948 17.2987C1.76662 17.4381 1.87502 17.5601 2.01635 17.5601H3.29916C3.40749 17.5601 3.50087 17.4835 3.52487 17.3779C4.15774 14.5918 5.65209 12.9875 7.94948 12.7296C11.3032 12.306 13.7384 9.43117 14.6869 6.86346C14.7439 6.70915 14.6573 6.54102 14.5005 6.49145L13.4854 6.17067C13.322 6.11901 13.2711 5.91268 13.3919 5.79102L14.3509 4.82496Z" fill="currentColor"/>
                <path d="M2.5208 0.320351C2.63278 0.115601 2.92685 0.115601 3.03883 0.320351L3.21191 0.636821C3.64538 1.42939 4.29703 2.08103 5.08959 2.5145L5.40606 2.68759C5.61081 2.79957 5.61081 3.09363 5.40606 3.20562L5.08959 3.3787C4.29703 3.81217 3.64538 4.46381 3.21191 5.25638L3.03883 5.57285C2.92685 5.7776 2.63278 5.7776 2.5208 5.57285L2.34771 5.25638C1.91425 4.46381 1.2626 3.81217 0.470033 3.3787L0.153563 3.20562C-0.0511877 3.09363 -0.0511874 2.79957 0.153563 2.68759L0.470033 2.5145C1.2626 2.08103 1.91425 1.42939 2.34771 0.636821L2.5208 0.320351Z" fill="currentColor"/>
              </svg>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Signed out: the popover only points at the setup window, which owns
  // sign-in and first-run configuration (see onboarding/OnboardingWindow).
  if (!isAuthenticated) {
    return (
      <div className={`app ${isDarkMode ? 'dark' : 'light'}`}>
        <SignInPrompt />
      </div>
    );
  }

  // Account ribbon — the desktop mirror of the web app's TrialBanner ribbon
  // and FailedPaymentBar. A full-width strip above the tab bar; the whole app
  // is pushed down to reveal it. Enforcement is server-side (402 on every
  // chat turn); the ribbon makes the state visible and the composer is
  // disabled up front on expiry. One state at a time: expired > billing >
  // countdown (they're mutually exclusive server-side anyway).
  const trialCountdownLabel =
    trialDaysRemaining === 0
      ? 'Your trial ends today'
      : trialDaysRemaining === 1
        ? '1 day left in your trial'
        : `${trialDaysRemaining} days left in your trial`;

  const openPricing = () => window.electron.app.openExternal('https://app.accordio.ai/pricing');

  const accountBanner = isTrialExpired ? (
    <div className="account-banner">
      <Lock size={13} />
      <span className="account-banner-label">Your trial has ended.</span>
      <button className="account-banner-action" onClick={openPricing}>
        Upgrade now
      </button>
    </div>
  ) : billingIssue ? (
    <div className="account-banner account-banner--billing">
      <TriangleAlert size={13} />
      <span className="account-banner-label">Your Legend renewal failed.</span>
      <button
        className="account-banner-action"
        onClick={() => window.electron.app.openExternal('https://app.accordio.ai/settings?tab=subscription')}
      >
        Fix now
      </button>
    </div>
  ) : isTrialActive && trialDaysRemaining !== null && trialDaysRemaining <= 3 ? (
    <div className="account-banner">
      <Sparkles size={13} />
      <span className="account-banner-label">{trialCountdownLabel}.</span>
      <button className="account-banner-action" onClick={openPricing}>
        See pricing
      </button>
    </div>
  ) : null;

  // Credits chip + usage dropdown — rendered right-aligned in the last
  // message's actions row (via MessageList's footer prop), so it scrolls
  // with the conversation instead of floating over it.
  const creditsFooter = (
    <div style={{ position: 'relative', marginLeft: 'auto', display: 'flex' }}>
      {/* Usage counter - plain text, clickable to reveal dropdown (hidden when exhausted/expired) */}
      {!creditsLoading && !creditsExhausted && !isTrialExpired && (
        <button
          className="usage-counter-pill"
          onClick={() => setShowUsageDropdown(prev => !prev)}
        >
          {Math.max(0, creditsTotal)} credits left
        </button>
      )}

      {/* Usage dropdown */}
      {showUsageDropdown && (
        <>
          <div
            className="usage-dropdown-backdrop"
            onClick={() => setShowUsageDropdown(false)}
          />
          <div className="usage-dropdown">
            <div className="usage-dropdown-header">
              <span className="usage-dropdown-plan">{planName}</span>
              <span className="usage-dropdown-label">Usage</span>
            </div>

            {/* Plan + daily credits — separate rows with their own bars,
                mirroring the web topbar's CreditsPill breakdown */}
            <div className="usage-dropdown-item">
              <div className="usage-dropdown-item-header">
                <span className="usage-dropdown-item-label">Plan credits</span>
                <span className="usage-dropdown-item-value">
                  {Math.max(0, creditsPlanBalance)} / {creditsPlanAllocation}
                </span>
              </div>
              <div className="usage-dropdown-bar-bg">
                <div
                  className="usage-dropdown-bar-fill"
                  style={{
                    width: `${creditsPlanAllocation > 0 ? Math.min(100, Math.max(0, Math.round((creditsPlanBalance / creditsPlanAllocation) * 100))) : 0}%`,
                    background: creditsPlanBalance <= 50 ? '#e74c3c' : creditsPlanBalance <= 100 ? '#d4a017' : '#78D277',
                  }}
                />
              </div>
            </div>

            {creditsDailyLimit > 0 && (
              <div className="usage-dropdown-item">
                <div className="usage-dropdown-item-header">
                  <span className="usage-dropdown-item-label">Daily credits</span>
                  <span className="usage-dropdown-item-value">
                    {Math.max(0, creditsDailyBalance)} / {creditsDailyLimit}
                  </span>
                </div>
                <div className="usage-dropdown-bar-bg">
                  <div
                    className="usage-dropdown-bar-fill"
                    style={{
                      width: `${Math.min(100, Math.max(0, Math.round((creditsDailyBalance / creditsDailyLimit) * 100)))}%`,
                      background: creditsDailyBalance <= 25 ? '#e74c3c' : creditsDailyBalance <= 75 ? '#d4a017' : '#78D277',
                    }}
                  />
                </div>
              </div>
            )}

            {/* Context snapshot — deadlines & finances */}
            {unifiedContext && (
              <>
                {(unifiedContext.deadlines.overdue.length > 0 || unifiedContext.finances.overdue_count > 0) && (
                  <div className="usage-dropdown-divider" />
                )}
                {unifiedContext.deadlines.overdue.length > 0 && (
                  <div className="usage-dropdown-alert">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="#e74c3c">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                    </svg>
                    <span>{unifiedContext.deadlines.overdue.length} overdue deadline{unifiedContext.deadlines.overdue.length !== 1 ? 's' : ''}</span>
                  </div>
                )}
                {unifiedContext.finances.overdue_count > 0 && (
                  <div className="usage-dropdown-alert">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="#d4a017">
                      <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                    </svg>
                    <span>{unifiedContext.finances.total_overdue} overdue</span>
                  </div>
                )}
              </>
            )}

            {/* Upgrade CTA for free users */}
            {!isLegend && (
              <button
                className="usage-dropdown-upgrade"
                onClick={() => {
                  window.electron.app.openExternal('https://app.accordio.ai/pricing');
                  setShowUsageDropdown(false);
                }}
              >
                <svg width="12" height="12" viewBox="0 0 18 18" fill="none">
                  <path d="M14.3509 4.82496C15.172 3.99533 15.9931 2.77388 17.1805 0.420348C17.2791 0.224884 17.1291 -0.00512837 16.9102 8.7099e-05C4.51767 0.295389 2.66382 11.9639 1.78948 17.2987C1.76662 17.4381 1.87502 17.5601 2.01635 17.5601H3.29916C3.40749 17.5601 3.50087 17.4835 3.52487 17.3779C4.15774 14.5918 5.65209 12.9875 7.94948 12.7296C11.3032 12.306 13.7384 9.43117 14.6869 6.86346C14.7439 6.70915 14.6573 6.54102 14.5005 6.49145L13.4854 6.17067C13.322 6.11901 13.2711 5.91268 13.3919 5.79102L14.3509 4.82496Z" fill="#78D277"/>
                  <path d="M2.5208 0.320351C2.63278 0.115601 2.92685 0.115601 3.03883 0.320351L3.21191 0.636821C3.64538 1.42939 4.29703 2.08103 5.08959 2.5145L5.40606 2.68759C5.61081 2.79957 5.61081 3.09363 5.40606 3.20562L5.08959 3.3787C4.29703 3.81217 3.64538 4.46381 3.21191 5.25638L3.03883 5.57285C2.92685 5.7776 2.63278 5.7776 2.5208 5.57285L2.34771 5.25638C1.91425 4.46381 1.2626 3.81217 0.470033 3.3787L0.153563 3.20562C-0.0511877 3.09363 -0.0511874 2.79957 0.153563 2.68759L0.470033 2.5145C1.2626 2.08103 1.91425 1.42939 2.34771 0.636821L2.5208 0.320351Z" fill="#78D277"/>
                </svg>
                Upgrade to Legend
              </button>
            )}

            <div className="usage-dropdown-footer">
              Daily credits refresh at 02:00 UTC
            </div>
          </div>
        </>
      )}

    </div>
  );

  return (
    <div className={`app ${isDarkMode ? 'dark' : 'light'}`}>
      {isAuthenticated && accountBanner}

      {/* Everything below the ribbon. Positioned so the absolute overlays
          (empty state, settings panel) anchor here instead of the viewport —
          that's what makes the banner push the whole app down. */}
      <div className="app-body">
      {/* Top-level Tab Bar */}
      {!showSettings && isAuthenticated && (
        <div className="main-tab-bar">
          <div className="main-morph-tabs" ref={mainTabsContainerRef}>
            <div
              className="hub-morph-indicator"
              style={{ left: mainTabIndicatorStyle.left, width: mainTabIndicatorStyle.width }}
            />
            <button
              ref={agentTabRef}
              className={`hub-morph-tab ${mainTab === 'agent' ? 'active' : ''}`}
              onClick={() => setMainTab('agent')}
            >
              <svg width="14" height="14" viewBox="0 0 18 18" fill="currentColor">
                <path d="M14.3509 4.82496C15.172 3.99533 15.9931 2.77388 17.1805 0.420348C17.2791 0.224884 17.1291 -0.00512837 16.9102 8.7099e-05C4.51767 0.295389 2.66382 11.9639 1.78948 17.2987C1.76662 17.4381 1.87502 17.5601 2.01635 17.5601H3.29916C3.40749 17.5601 3.50087 17.4835 3.52487 17.3779C4.15774 14.5918 5.65209 12.9875 7.94948 12.7296C11.3032 12.306 13.7384 9.43117 14.6869 6.86346C14.7439 6.70915 14.6573 6.54102 14.5005 6.49145L13.4854 6.17067C13.322 6.11901 13.2711 5.91268 13.3919 5.79102L14.3509 4.82496Z"/>
                <path d="M2.5208 0.320351C2.63278 0.115601 2.92685 0.115601 3.03883 0.320351L3.21191 0.636821C3.64538 1.42939 4.29703 2.08103 5.08959 2.5145L5.40606 2.68759C5.61081 2.79957 5.61081 3.09363 5.40606 3.20562L5.08959 3.3787C4.29703 3.81217 3.64538 4.46381 3.21191 5.25638L3.03883 5.57285C2.92685 5.7776 2.63278 5.7776 2.5208 5.57285L2.34771 5.25638C1.91425 4.46381 1.2626 3.81217 0.470033 3.3787L0.153563 3.20562C-0.0511877 3.09363 -0.0511874 2.79957 0.153563 2.68759L0.470033 2.5145C1.2626 2.08103 1.91425 1.42939 2.34771 0.636821L2.5208 0.320351Z"/>
              </svg>
              Agent
            </button>
            <button
              ref={trackerTabRef}
              className={`hub-morph-tab ${mainTab === 'tracker' ? 'active' : ''}`}
              onClick={() => setMainTab('tracker')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              Tracker
            </button>
          </div>
          <div className="main-tab-actions">
            <button className="icon-btn" onClick={() => setShowSettings(true)} title="Settings">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3.33946 17.0002C2.90721 16.2515 2.58277 15.4702 2.36133 14.6741C3.3338 14.1779 3.99972 13.1668 3.99972 12.0002C3.99972 10.8345 3.3348 9.824 2.36353 9.32741C2.81025 7.71651 3.65857 6.21627 4.86474 4.99001C5.7807 5.58416 6.98935 5.65534 7.99972 5.072C9.01009 4.48866 9.55277 3.40635 9.4962 2.31604C11.1613 1.8846 12.8847 1.90004 14.5031 2.31862C14.4475 3.40806 14.9901 4.48912 15.9997 5.072C17.0101 5.65532 18.2187 5.58416 19.1346 4.99007C19.7133 5.57986 20.2277 6.25151 20.66 7.00021C21.0922 7.7489 21.4167 8.53025 21.6381 9.32628C20.6656 9.82247 19.9997 10.8336 19.9997 12.0002C19.9997 13.166 20.6646 14.1764 21.6359 14.673C21.1892 16.2839 20.3409 17.7841 19.1347 19.0104C18.2187 18.4163 17.0101 18.3451 15.9997 18.9284C14.9893 19.5117 14.4467 20.5941 14.5032 21.6844C12.8382 22.1158 11.1148 22.1004 9.49633 21.6818C9.55191 20.5923 9.00929 19.5113 7.99972 18.9284C6.98938 18.3451 5.78079 18.4162 4.86484 19.0103C4.28617 18.4205 3.77172 17.7489 3.33946 17.0002ZM8.99972 17.1964C10.0911 17.8265 10.8749 18.8227 11.2503 19.9659C11.7486 20.0133 12.2502 20.014 12.7486 19.9675C13.1238 18.8237 13.9078 17.8268 14.9997 17.1964C16.0916 16.5659 17.347 16.3855 18.5252 16.6324C18.8146 16.224 19.0648 15.7892 19.2729 15.334C18.4706 14.4373 17.9997 13.2604 17.9997 12.0002C17.9997 10.74 18.4706 9.5632 19.2729 8.6665C19.1688 8.4405 19.0538 8.21822 18.9279 8.00021C18.802 7.78219 18.667 7.57148 18.5233 7.36842C17.3457 7.61476 16.0911 7.43414 14.9997 6.80405C13.9083 6.17395 13.1246 5.17768 12.7491 4.03455C12.2509 3.98714 11.7492 3.98646 11.2509 4.03292C10.8756 5.17671 10.0916 6.17364 8.99972 6.80405C7.9078 7.43447 6.65245 7.61494 5.47428 7.36803C5.18485 7.77641 4.93463 8.21117 4.72656 8.66637C5.52881 9.56311 5.99972 10.74 5.99972 12.0002C5.99972 13.2604 5.52883 14.4372 4.72656 15.3339C4.83067 15.5599 4.94564 15.7822 5.07152 16.0002C5.19739 16.2182 5.3324 16.4289 5.47612 16.632C6.65377 16.3857 7.90838 16.5663 8.99972 17.1964ZM11.9997 15.0002C10.3429 15.0002 8.99972 13.6571 8.99972 12.0002C8.99972 10.3434 10.3429 9.00021 11.9997 9.00021C13.6566 9.00021 14.9997 10.3434 14.9997 12.0002C14.9997 13.6571 13.6566 15.0002 11.9997 15.0002ZM11.9997 13.0002C12.552 13.0002 12.9997 12.5525 12.9997 12.0002C12.9997 11.4479 12.552 11.0002 11.9997 11.0002C11.4474 11.0002 10.9997 11.4479 10.9997 12.0002C10.9997 12.5525 11.4474 13.0002 11.9997 13.0002Z"/>
              </svg>
            </button>
            {hasMessages && mainTab === 'agent' && (
              <button className="icon-btn icon-btn-ghost" onClick={handleNewChat} title="New Chat">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Empty State - Logo above input */}
      {showEmptyState && (
        <div className="empty-state">

          <div className="empty-state-content">
            {/* Centered Logo - Accordio Quill */}
            <div className={`empty-state-logo ${logoAnimated ? 'logo-lit' : ''}`}>
              {/* Base fill + shimmer band both clip to the brandmark shape, so
                  the light sweep reads as filling the mark itself. */}
              {/* The viewBox carries a 2-unit margin around the 18×18 mark so
                  no painted (pre-clip) geometry ever touches the raster edge —
                  edge-touching pixels get smeared into 1px hairlines by GPU
                  clamp-to-edge sampling while the spring scale resamples the
                  layer (visible on dark). */}
              <svg width="56" height="56" viewBox="-2 -2 22 22" fill="none">
                <defs>
                  <clipPath id="empty-brandmark-clip">
                    <path d="M14.3509 4.82496C15.172 3.99533 15.9931 2.77388 17.1805 0.420348C17.2791 0.224884 17.1291 -0.00512837 16.9102 8.7099e-05C4.51767 0.295389 2.66382 11.9639 1.78948 17.2987C1.76662 17.4381 1.87502 17.5601 2.01635 17.5601H3.29916C3.40749 17.5601 3.50087 17.4835 3.52487 17.3779C4.15774 14.5918 5.65209 12.9875 7.94948 12.7296C11.3032 12.306 13.7384 9.43117 14.6869 6.86346C14.7439 6.70915 14.6573 6.54102 14.5005 6.49145L13.4854 6.17067C13.322 6.11901 13.2711 5.91268 13.3919 5.79102L14.3509 4.82496Z"/>
                    <path d="M2.5208 0.320351C2.63278 0.115601 2.92685 0.115601 3.03883 0.320351L3.21191 0.636821C3.64538 1.42939 4.29703 2.08103 5.08959 2.5145L5.40606 2.68759C5.61081 2.79957 5.61081 3.09363 5.40606 3.20562L5.08959 3.3787C4.29703 3.81217 3.64538 4.46381 3.21191 5.25638L3.03883 5.57285C2.92685 5.7776 2.63278 5.7776 2.5208 5.57285L2.34771 5.25638C1.91425 4.46381 1.2626 3.81217 0.470033 3.3787L0.153563 3.20562C-0.0511877 3.09363 -0.0511874 2.79957 0.153563 2.68759L0.470033 2.5145C1.2626 2.08103 1.91425 1.42939 2.34771 0.636821L2.5208 0.320351Z"/>
                  </clipPath>
                  <linearGradient id="empty-brandmark-shimmer" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#ffffff" stopOpacity="0.8"/>
                    <stop offset="1" stopColor="#ffffff" stopOpacity="0"/>
                  </linearGradient>
                </defs>
                <g clipPath="url(#empty-brandmark-clip)">
                  <rect className="brandmark-base" x="-1" y="-1" width="20" height="20"/>
                  {/* Green fill parked above the mark; the group slides down on
                      load (19 units, see brandmarkFillDown) so the color pours
                      in top-to-bottom with a soft light edge leading it. */}
                  <g className="brandmark-fill-group">
                    <rect className="brandmark-fill" x="-1" y="-20" width="20" height="20"/>
                    <rect className="brandmark-shimmer" x="-1" y="0" width="20" height="5" fill="url(#empty-brandmark-shimmer)"/>
                  </g>
                </g>
              </svg>
            </div>

            {/* Main Input Card */}
            <div className="input-card-wrapper">
              {/* Update notice — same grown-from-the-card strip as the chat
                  detail's live-tracking card, tucked behind the input's top. */}
              {(updateAvailable || updateReadyVersion) && (
                <button
                  className="tracking-card"
                  title="Install update"
                  onClick={() => {
                    // Downloaded → relaunch into it. Otherwise nudge the
                    // updater (autoDownload is on, so an available update is
                    // already in flight) and fall back to the download page
                    // if the check itself fails.
                    if (updateReadyVersion) {
                      window.electron.update.install();
                      return;
                    }
                    setUpdateClicked(true);
                    window.electron.update?.check().catch(() =>
                      window.electron.app.openExternal('https://accordio.ai/download')
                    );
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="update-card-icon">
                    <path d="M13 13V18.585L14.8284 16.7574L16.2426 18.1716L12 22.4142L7.75736 18.1716L9.17157 16.7574L11 18.585V13H13ZM12 2C15.5934 2 18.5544 4.70761 18.9541 8.19395C21.2858 8.83154 23 10.9656 23 13.5C23 16.3688 20.8036 18.7246 18.0006 18.9776L18.0009 16.9644C19.6966 16.7214 21 15.2629 21 13.5C21 11.567 19.433 10 17.5 10C17.2912 10 17.0867 10.0183 16.8887 10.054C16.9616 9.7142 17 9.36158 17 9C17 6.23858 14.7614 4 12 4C9.23858 4 7 6.23858 7 9C7 9.36158 7.03838 9.7142 7.11205 10.0533C6.91331 10.0183 6.70879 10 6.5 10C4.567 10 3 11.567 3 13.5C3 15.2003 4.21241 16.6174 5.81986 16.934L6.00005 16.9646L6.00039 18.9776C3.19696 18.7252 1 16.3692 1 13.5C1 10.9656 2.71424 8.83154 5.04648 8.19411C5.44561 4.70761 8.40661 2 12 2Z"/>
                  </svg>
                  <span className="tracking-card-app">New version available</span>
                  <span className="update-card-action">
                    {updateReadyVersion ? 'Restart to update' : updateClicked ? 'Downloading...' : 'Update now'}
                  </span>
                </button>
              )}

              {/* One composer for both states — the empty state used to have
                  its own raw <input> with separate attachment state, so
                  drag-and-drop, tiles and stop only ever existed in neither. */}
              <Composer
                onSubmit={async (message, files) => {
                  setMainTab('agent');
                  await sendMessage(message, files);
                }}
                onStop={stopStreaming}
                isLoading={isLoading}
                disabled={!isConnected || isTrialExpired}
                placeholders={placeholders}
                dropZoneActive={mainTab === 'agent'}
                autoFocus
              />

            </div>

            {/* Active Timer - Bottom of first page */}
            {timeSettings?.showInMenuBar && isTimeTracking && !isIdle && timerDuration && timerDuration !== '0:00' && (
              <button
                className="empty-state-bottom-timer"
                onClick={() => setMainTab('tracker')}
              >
                {displayActivity?.appName ? (
                  <AppIcon
                    appName={displayActivity.appName}
                    {...('url' in displayActivity && displayActivity.url ? { url: displayActivity.url } : {})}
                    size={16}
                    className={isStaleActivity ? 'tracking-icon-stale' : ''}
                  />
                ) : (
                  <span className={`timer-dot ${isStaleActivity ? 'stale' : 'recording'}`} />
                )}
                {displayActivity?.appName && (
                  <span className="timer-app">{displayActivity.appName}</span>
                )}
                <span className="timer-duration"><AnimatedDuration duration={timerDuration} /></span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tracker Tab */}
      {mainTab === 'tracker' && !showSettings && (
        <ActivityHub
          onShowSettings={() => setShowSettings(true)}
        />
      )}

      {/* Chat Messages */}
      {hasMessages && mainTab === 'agent' && (
        <div className="chat-area">
          <MessageList
            messages={messages}
            isLoading={isLoading}
            isThinking={isThinking}
            error={chatError}
            onRetry={retry}
            footer={creditsFooter}
          />
        </div>
      )}

      {/* Brain Bar - Hidden in empty state and tracker tab */}
      {!showEmptyState && mainTab === 'agent' && (
      <div className="brain-bar-container" ref={brainBarRef}>
        <div className={`brain-bar-wrapper ${logoAnimated ? 'animate-in' : ''}`}>
          {/* Live-tracking card — tucks behind the input card's top edge and
              grows out of it. Shows what the tracker is recording right now. */}
          {/* Stays mounted through idle so it can slide down behind the input
              card instead of vanishing; unmounts only when tracking stops. */}
          {isTimeTracking && timerDuration && timerDuration !== '0:00' && displayActivity?.appName && (
            <button
              className={`tracking-card ${isIdle ? 'tracking-card-hidden' : ''}`}
              onClick={() => setMainTab('tracker')}
              title="Open tracker"
              tabIndex={isIdle ? -1 : 0}
            >
              <AppIcon
                appName={displayActivity.appName}
                {...('url' in displayActivity && displayActivity.url ? { url: displayActivity.url } : {})}
                size={14}
                className={isStaleActivity ? 'tracking-icon-stale' : ''}
              />
              <span className="tracking-card-app">{displayActivity.appName}</span>
              <span className="tracking-card-duration"><AnimatedDuration duration={timerDuration} /></span>
            </button>
          )}

          <Composer
            onStop={stopStreaming}
            onSubmit={async (message, files) => {
              setMainTab('agent');
              await sendMessage(message, files);
            }}
            isLoading={isLoading}
            disabled={!isConnected}
            placeholders={placeholders}
            dropZoneActive={mainTab === 'agent'}
          />
        </div>

        {/* Credits exhausted — compact inline notice (trial expiry supersedes it) */}
        {creditsExhausted && !isTrialExpired && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '4px 0',
            marginTop: '2px',
            fontSize: '11px',
            color: 'var(--color-text-secondary)',
          }}>
            <span>Credits used up — resets monthly</span>
            <button
              className="btn btn-primary"
              style={{ fontSize: '10px', padding: '2px 8px', lineHeight: '16px' }}
              onClick={() => window.electron.app.openExternal('https://app.accordio.ai/pricing')}
            >
              Upgrade
            </button>
          </div>
        )}

        {/* Update downloaded — restart to apply */}
        {updateReadyVersion && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '4px 0',
            marginTop: '2px',
            fontSize: '11px',
            color: 'var(--color-text-secondary)',
          }}>
            <span>Update ready — v{updateReadyVersion}</span>
            <button
              className="btn btn-primary"
              style={{ fontSize: '10px', padding: '2px 8px', lineHeight: '16px' }}
              onClick={() => window.electron.update.install()}
            >
              Restart to update
            </button>
          </div>
        )}

        {/* Credits low warning */}
        {creditsLow && !creditsExhausted && !isTrialExpired && (
          <div style={{
            padding: '2px 10px',
            marginTop: '2px',
            fontSize: '11px',
            color: '#d4a017',
            textAlign: 'center',
          }}>
            {creditsRemaining} credits remaining
          </div>
        )}
      </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Settings</span>
            <button className="icon-btn icon-btn-ghost" onClick={() => setShowSettings(false)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5"/>
                <polyline points="12 19 5 12 12 5"/>
              </svg>
            </button>
          </div>
          <div className="panel-content">
            {/* Profile card — avatar + identity on the left, memories on the right */}
            {profile && (
              <div className="panel-section">
                <div className="profile-card">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="profile-card-avatar" />
                  ) : (
                    <div className="profile-card-avatar profile-card-avatar--initials">{initials}</div>
                  )}
                  <div className="profile-card-info">
                    <div className="profile-card-name">{displayName}</div>
                    {profile.business_name && profile.full_name && (
                      <div className="profile-card-business">{profile.business_name}</div>
                    )}
                    <div className="profile-card-email">{profile.email}</div>
                  </div>
                  <button className="profile-memories-btn" onClick={() => setShowMemorySheet(true)}>
                    <span className="profile-memories-count">{memoryCount ?? '–'}</span>
                    <span>memories</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* Appearance */}
            <div className="panel-section">
              <div className="panel-section-title">Appearance</div>
              <div className="theme-toggle-row">
                <span className="settings-label">Dark Mode</span>
                <button
                  className={`theme-toggle-switch ${isDarkMode ? 'active' : ''}`}
                  onClick={toggleTheme}
                />
              </div>
            </div>

            {/* Keyboard Shortcut */}
            <div className="panel-section">
              <div className="panel-section-title">Global Shortcut</div>
              <div className="settings-shortcut-row">
                <span className="settings-label">Toggle Window</span>
                <button
                  className={`settings-shortcut-btn ${isRecordingShortcut ? 'recording' : ''}`}
                  onClick={() => {
                    if (isRecordingShortcut) {
                      setIsRecordingShortcut(false);
                      setRecordedKeys('');
                    } else {
                      setIsRecordingShortcut(true);
                      setRecordedKeys('');
                    }
                  }}
                  onKeyDown={(e) => {
                    if (!isRecordingShortcut) return;
                    e.preventDefault();
                    e.stopPropagation();

                    // Build Electron-style accelerator from key event
                    const parts: string[] = [];
                    if (e.metaKey || e.ctrlKey) parts.push('CommandOrControl');
                    if (e.altKey) parts.push('Alt');
                    if (e.shiftKey) parts.push('Shift');

                    // Get the actual key (ignore modifier-only presses)
                    const key = e.key;
                    const isModifierOnly = ['Meta', 'Control', 'Alt', 'Shift'].includes(key);

                    if (isModifierOnly) {
                      // Show what's pressed so far
                      setRecordedKeys(parts.join('+'));
                      return;
                    }

                    // Map special keys
                    const keyMap: Record<string, string> = {
                      ' ': 'Space', 'ArrowUp': 'Up', 'ArrowDown': 'Down',
                      'ArrowLeft': 'Left', 'ArrowRight': 'Right',
                      'Escape': 'Escape', 'Enter': 'Return', 'Backspace': 'Backspace',
                      'Delete': 'Delete', 'Tab': 'Tab',
                    };
                    const mappedKey = keyMap[key] || (key.length === 1 ? key.toUpperCase() : key);

                    if (parts.length === 0) {
                      // Need at least one modifier
                      setRecordedKeys('Need a modifier key');
                      return;
                    }

                    parts.push(mappedKey);
                    const shortcut = parts.join('+');

                    // Try to register the shortcut
                    window.electron.settings.set('globalShortcut', shortcut).then((result) => {
                      if (result !== false) {
                        setCurrentShortcut(shortcut);
                        setIsRecordingShortcut(false);
                        setRecordedKeys('');
                      } else {
                        setRecordedKeys('Failed — try another');
                      }
                    });
                  }}
                >
                  {isRecordingShortcut
                    ? (recordedKeys || 'Press keys...')
                    : currentShortcut
                        .replace('CommandOrControl', '\u2318')
                        .replace('Shift', '\u21E7')
                        .replace('Alt', '\u2325')
                        .replace(/\+/g, ' ')}
                </button>
              </div>
            </div>

            <div className="settings-divider" />

            {/* Time Tracking */}
            <div className="panel-section">
              <div className="panel-section-title">Time Tracking</div>
              {showPermissionWarning && (
                <div className="permission-warning">
                  <div>
                    <div className="permission-warning-title">Permissions required</div>
                    <div className="permission-warning-text">
                      {missingAccessibility && missingScreenRecording
                        ? 'Enable Accessibility and Screen Recording to start auto-tracking.'
                        : missingAccessibility
                          ? 'Enable Accessibility to start auto-tracking.'
                          : 'Enable Screen Recording to capture window titles for auto-tracking.'}
                    </div>
                    <div className="permission-warning-text" style={{ opacity: 0.7, marginTop: '4px', fontSize: '11px' }}>
                      Note: macOS may show permissions as missing even after granting. Click "Retry" after granting.
                    </div>
                  </div>
                  <div className="permission-warning-actions">
                    {missingAccessibility && (
                      <button
                        className="permission-warning-btn"
                        onClick={() => window.electron.permissions.openSettings('accessibility')}
                      >
                        Open Accessibility
                      </button>
                    )}
                    {missingScreenRecording && !missingAccessibility && (
                      <button
                        className="permission-warning-btn"
                        onClick={() => window.electron.permissions.openSettings('screenRecording')}
                      >
                        Open Screen Recording
                      </button>
                    )}
                    <button
                      className="permission-warning-btn"
                      onClick={async () => {
                        await window.electron.permissions.retryTracking();
                        refreshPermissions();
                      }}
                      disabled={isCheckingPermissions}
                    >
                      {isCheckingPermissions ? 'Checking...' : 'Retry'}
                    </button>
                  </div>
                </div>
              )}
              <div className="settings-toggle-row">
                <div className="settings-toggle-info">
                  <span className="settings-toggle-label">Automatic Tracking</span>
                  <span className="settings-toggle-description">Track active apps and windows</span>
                </div>
                <button
                  className={`theme-toggle-switch ${timeSettings?.enabled ? 'active' : ''}`}
                  onClick={() => updateTimeSettings({ enabled: !timeSettings?.enabled })}
                />
              </div>
              <div className="settings-select-row">
                <span className="settings-label">Idle Timeout</span>
                <select
                  className="settings-select"
                  value={timeSettings?.idleTimeoutMinutes || 5}
                  onChange={(e) => updateTimeSettings({ idleTimeoutMinutes: parseInt(e.target.value) })}
                >
                  <option value="1">1 min</option>
                  <option value="2">2 min</option>
                  <option value="5">5 min</option>
                  <option value="10">10 min</option>
                  <option value="15">15 min</option>
                </select>
              </div>
              <div className="settings-select-row">
                <span className="settings-label">Sync Interval</span>
                <select
                  className="settings-select"
                  value={timeSettings?.syncIntervalMinutes || 5}
                  onChange={(e) => updateTimeSettings({ syncIntervalMinutes: parseInt(e.target.value) })}
                >
                  <option value="1">1 min</option>
                  <option value="5">5 min</option>
                  <option value="10">10 min</option>
                  <option value="15">15 min</option>
                </select>
              </div>
              <div className="settings-toggle-row">
                <span className="settings-label">Track Browser Tabs</span>
                <button
                  className={`theme-toggle-switch ${timeSettings?.trackBrowserTabs ? 'active' : ''}`}
                  onClick={() => updateTimeSettings({ trackBrowserTabs: !timeSettings?.trackBrowserTabs })}
                />
              </div>
              <div className="settings-toggle-row">
                <span className="settings-label">Show in Menu Bar</span>
                <button
                  className={`theme-toggle-switch ${timeSettings?.showInMenuBar ? 'active' : ''}`}
                  onClick={() => updateTimeSettings({ showInMenuBar: !timeSettings?.showInMenuBar })}
                />
              </div>
            </div>

            <div className="settings-divider" />

            {/* Integrations - Visual Grid */}
            <div className="panel-section">
              <IntegrationGrid
                integrations={priorityIntegrations}
                onConnect={connectIntegration}
                onOpenSettings={() => window.electron.app.openExternal('https://app.accordio.ai/settings/integrations')}
              />
            </div>

            {/* Active Task */}
            <div className="panel-section">
              <div className="panel-section-title">Active Task</div>
              <div className="settings-toggle-row">
                <span className="settings-label">Show in Brain Bar</span>
                <button
                  className={`theme-toggle-switch ${taskSettings?.showInBrainBar ? 'active' : ''}`}
                  onClick={() => updateTaskSettings({ showInBrainBar: !taskSettings?.showInBrainBar })}
                />
              </div>
              <div className="settings-toggle-row">
                <span className="settings-label">Show Project Name</span>
                <button
                  className={`theme-toggle-switch ${taskSettings?.showProject ? 'active' : ''}`}
                  onClick={() => updateTaskSettings({ showProject: !taskSettings?.showProject })}
                />
              </div>
            </div>

            <div className="settings-divider" />

            {/* Messaging Channels — same tile UX as Connected Tools */}
            <div className="panel-section">
              <div className="integration-grid">
                <div className="integration-grid-header">
                  <h3 className="integration-grid-title">Messaging Channels</h3>
                  <span className="integration-grid-count">
                    {[whatsapp, telegram, slack].filter(c => c?.connected).length}/3 connected
                  </span>
                </div>
                <div className="integration-grid-items integration-grid-items--channels">
                  {MESSAGING_CHANNELS.map(channel => {
                    const status = { whatsapp, telegram, slack }[channel.key];
                    const isConnected = !!status?.connected;
                    return (
                      <button
                        key={channel.key}
                        className={`integration-tile ${isConnected ? 'connected' : ''}`}
                        onClick={() => isConnected
                          ? window.electron.app.openExternal('https://app.accordio.ai/settings/integrations')
                          : setChannelToSetup(channel.key)}
                        title={isConnected ? `${channel.name} connected` : `Connect ${channel.name}`}
                      >
                        <div
                          className="integration-tile-icon"
                          style={{ color: isConnected ? channel.color : undefined, opacity: isConnected ? 1 : 0.5 }}
                        >
                          {channel.icon}
                        </div>
                        <span className="integration-tile-name">{channel.name}</span>
                        {isConnected ? (
                          <span className="integration-tile-status connected">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M9.9997 15.1709L19.1921 5.97852L20.6063 7.39273L9.9997 17.9993L3.63574 11.6354L5.04996 10.2212L9.9997 15.1709Z"/>
                            </svg>
                          </span>
                        ) : (
                          <span className="integration-tile-status disconnected">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <line x1="12" y1="5" x2="12" y2="19"/>
                              <line x1="5" y1="12" x2="19" y2="12"/>
                            </svg>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Plan & Credits */}
            <div className="panel-section">
              <div className="panel-section-title">Plan & Credits</div>
              <div className="settings-row">
                <span className="settings-label">Plan</span>
                <span className={`status-badge ${isLegend ? 'connected' : ''}`}>
                  {planName}
                </span>
              </div>
              <div className="settings-row" style={{ borderBottom: 'none' }}>
                <span className="settings-label">AI Credits</span>
                <span className={`status-badge ${creditsExhausted ? 'error' : ''}`}>
                  {creditsRemaining} remaining
                </span>
              </div>
              <div className="settings-actions">
                {!isLegend && (
                  <button
                    className="btn btn-primary"
                    onClick={() => window.electron.app.openExternal('https://app.accordio.ai/pricing')}
                  >
                    Upgrade to Legend
                  </button>
                )}
                <button
                  className="btn btn-secondary"
                  onClick={async () => {
                    await window.electron.auth.clearToken();
                    setIsAuthenticated(false);
                    setAuthToken(null);
                    setShowSettings(false);
                  }}
                >
                  Sign Out
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => window.electron.app.quit()}
                >
                  Quit Accordio AI
                </button>
              </div>
              <div className="settings-version">
                <AppVersion />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Memory Sheet */}
      <MemorySheet
        isOpen={showMemorySheet}
        onClose={() => setShowMemorySheet(false)}
      />

      {/* Channel Setup Modal */}
      {channelToSetup && (
        <ChannelSetupModal
          channel={channelToSetup}
          onClose={() => setChannelToSetup(null)}
          onSuccess={() => {
            setChannelToSetup(null);
            refreshChannels();
          }}
        />
      )}
      </div>
    </div>
  );
}

function AppVersion() {
  const [version, setVersion] = useState('');
  useEffect(() => {
    window.electron.app.getVersion().then(setVersion);
  }, []);
  return <span className="settings-value">Version {version || '...'}</span>;
}

