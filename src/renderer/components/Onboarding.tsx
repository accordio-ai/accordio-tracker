import { useState, useRef, useEffect } from 'react';
import { Lock, EyeOff, Info } from 'lucide-react';

interface OnboardingProps {
  onComplete: () => void;
}

type Step = 'welcome' | 'email' | 'code' | 'success' | 'device-auth' | 'permissions' | 'permissions-done';

/**
 * Dev-only QA hook: set `localStorage['qa-onboarding-step'] = '<step>'` and
 * reload to open onboarding at that step even while signed in. One-shot —
 * cleared on read so the next reload is back to normal.
 */
export const QA_ONBOARDING_STEP: Step | null = (() => {
  try {
    if (!(import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV) return null;
    const v = window.localStorage.getItem('qa-onboarding-step');
    if (v) window.localStorage.removeItem('qa-onboarding-step');
    return v as Step | null;
  } catch {
    return null;
  }
})();

interface PermissionStatus {
  accessibility: boolean;
  screenRecording: boolean;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState<Step>(QA_ONBOARDING_STEP ?? 'welcome');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>({ accessibility: false, screenRecording: false });
  // First Enable click fires the native macOS prompt; once asked, the button
  // becomes a settings deep-link (macOS won't re-show a dismissed prompt).
  const [accessibilityAsked, setAccessibilityAsked] = useState(false);
  const [screenRecordingAsked, setScreenRecordingAsked] = useState(false);
  const [deviceCode, setDeviceCode] = useState<string | null>(null);
  const [deviceAuthPolling, setDeviceAuthPolling] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [appVersion, setAppVersion] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);
  const settingsMenuRef = useRef<HTMLDivElement>(null);

  // Get app version and theme on mount
  useEffect(() => {
    window.electron.app.getVersion().then(setAppVersion);
    window.electron.settings.get('darkMode').then((darkMode) => {
      // Default to true (dark mode) if not set
      const isDark = darkMode === undefined ? true : darkMode as boolean;
      setIsDarkMode(isDark);
      // Apply theme class to app container
      document.querySelector('.app')?.classList.toggle('light', !isDark);
    });
  }, []);

  const toggleTheme = async () => {
    const newValue = !isDarkMode;
    setIsDarkMode(newValue);
    await window.electron.settings.set('darkMode', newValue);
    // Apply theme class to app container
    document.querySelector('.app')?.classList.toggle('light', !newValue);
  };

  const openWebApp = () => {
    window.electron.app.openExternal('https://app.accordio.ai');
    setShowSettingsMenu(false);
  };

  // Close settings menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(e.target as Node)) {
        setShowSettingsMenu(false);
      }
    };
    if (showSettingsMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSettingsMenu]);

  // Auto-focus first code input when entering code step
  useEffect(() => {
    if (step === 'code') {
      setTimeout(() => codeRefs.current[0]?.focus(), 100);
    }
  }, [step]);

  // Check permission status when on the permissions step
  useEffect(() => {
    if (step === 'permissions') {
      const checkStatus = async () => {
        const status = await window.electron.permissions.getStatus();
        setPermissionStatus(status);
      };
      checkStatus();
      // Poll every 2 seconds to detect when user grants permission
      const interval = setInterval(checkStatus, 2000);
      return () => clearInterval(interval);
    }
  }, [step]);

  const handleSendCode = async () => {
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await window.electron.auth.sendCode(email.trim());
      if (result.success) {
        setStep('code');
      } else {
        const errorMsg = result.error || '';
        if (errorMsg.includes('<!doctype') || errorMsg.includes('not valid JSON')) {
          setError('Server error. Please try again later.');
        } else if (errorMsg.includes('not found') || errorMsg.includes('404')) {
          setError('Account not found. Please sign up at app.accordio.ai first.');
        } else {
          setError(errorMsg || 'Failed to send code. Please try again.');
        }
      }
    } catch (err) {
      const errMsg = (err as Error).message || '';
      if (errMsg.includes('<!doctype') || errMsg.includes('not valid JSON')) {
        setError('Server error. Please try again later.');
      } else {
        setError('Connection error. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (codeToVerify?: string[]) => {
    const codeArray = codeToVerify || code;
    const otp = codeArray.join('');
    if (otp.length !== 6) {
      setError('Please enter the full 6-digit code');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await window.electron.auth.verifyCode(email.trim(), otp);
      if (result.success) {
        setStep('success');
        // Move to permissions setup after brief success message
        setTimeout(() => startPermissionsSetup(), 1200);
      } else {
        setError(result.error || 'Invalid code. Please try again.');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    if (value.length <= 1 && /^\d*$/.test(value)) {
      const newCode = [...code];
      newCode[index] = value;
      setCode(newCode);

      if (value && index < 5) {
        codeRefs.current[index + 1]?.focus();
      }

      if (value && index === 5 && newCode.every(digit => digit !== '')) {
        setTimeout(() => handleVerifyCode(newCode), 100);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      codeRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();

    if (/^\d{6}$/.test(pastedData)) {
      const newCode = pastedData.split('');
      setCode(newCode);
      codeRefs.current[5]?.focus();
      setTimeout(() => handleVerifyCode(newCode), 100);
    }
  };

  const handleEmailKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      handleSendCode();
    }
  };

  // Device Authorization Flow (Sign in via Web App)
  const handleDeviceAuth = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await window.electron.auth.deviceRequest();
      if (result.success && result.deviceCode) {
        setDeviceCode(result.deviceCode);
        setStep('device-auth');
        // Open browser to authorize page
        await window.electron.auth.deviceOpenBrowser(result.deviceCode);
        // Start polling
        setDeviceAuthPolling(true);
      } else {
        // If device auth not available, guide to email flow
        setError('Web sign-in is temporarily unavailable. Please use email sign-in instead.');
      }
    } catch (err) {
      setError('Web sign-in is temporarily unavailable. Please use email sign-in instead.');
    } finally {
      setIsLoading(false);
    }
  };

  // Poll for device authorization
  useEffect(() => {
    if (step !== 'device-auth' || !deviceCode || !deviceAuthPolling) return;

    let failCount = 0;
    const pollInterval = setInterval(async () => {
      try {
        const result = await window.electron.auth.devicePoll(deviceCode);
        if (result.success && result.status === 'authorized') {
          failCount = 0;
          setDeviceAuthPolling(false);
          setStep('success');
          setTimeout(() => startPermissionsSetup(), 1200);
        } else if (!result.success) {
          failCount++;
          // Show error after 5 consecutive failures so user knows something is wrong
          if (failCount >= 5) {
            setError(`Connection issue: ${result.error || 'Unable to reach server'}. Still retrying...`);
          }
        } else {
          // Successful poll but still pending — reset fail count
          failCount = 0;
          setError(null);
        }
      } catch {
        failCount++;
        if (failCount >= 5) {
          setError('Connection issue. Still retrying...');
        }
      }
    }, 3000);

    // Stop polling after 10 minutes (code expiry)
    const timeout = setTimeout(() => {
      setDeviceAuthPolling(false);
      setError('Authorization timed out. Please try again.');
    }, 10 * 60 * 1000);

    return () => {
      clearInterval(pollInterval);
      clearTimeout(timeout);
    };
  }, [step, deviceCode, deviceAuthPolling]);

  const startPermissionsSetup = async () => {
    const status = await window.electron.permissions.getStatus();
    setPermissionStatus(status);
    if (status.accessibility && status.screenRecording) {
      window.electron.permissions.complete();
      onComplete();
    } else {
      setStep('permissions');
    }
  };

  const allPermissionsGranted = permissionStatus.accessibility && permissionStatus.screenRecording;

  // Reaching this step means Screen Recording was granted during this run, and
  // macOS only surfaces window titles to a process started AFTER the grant —
  // so the done screen offers a restart instead of auto-completing.
  const handlePermissionsContinue = () => {
    if (allPermissionsGranted) {
      setStep('permissions-done');
    }
  };

  const handleRestart = async () => {
    await window.electron.permissions.complete();
    await window.electron.app.relaunch();
  };

  const handleFinishWithoutRestart = async () => {
    await window.electron.permissions.complete();
    onComplete();
  };

  // Auto-advance when all permissions are granted on the permissions step
  useEffect(() => {
    if (step === 'permissions' && allPermissionsGranted) {
      // Brief delay so user sees both as "Done" before advancing
      const timer = setTimeout(() => {
        handlePermissionsContinue();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [step, allPermissionsGranted]);

  return (
    <div className="onboarding">
      <div className="onboarding-container">
        {/* Back — same ghost arrow button as the settings panel header */}
        {(step === 'email' || step === 'code' || step === 'device-auth') && (
          <button
            className="icon-btn icon-btn-ghost onboarding-back-btn"
            aria-label="Back"
            onClick={() => {
              setError(null);
              if (step === 'email') {
                setStep('welcome');
              } else if (step === 'code') {
                setCode(['', '', '', '', '', '']);
                setStep('email');
              } else {
                setDeviceAuthPolling(false);
                setDeviceCode(null);
                setStep('email');
              }
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5"/>
              <polyline points="12 19 5 12 12 5"/>
            </svg>
          </button>
        )}

        {/* Settings Menu - top right, always visible */}
        <div className="onboarding-settings-wrapper" ref={settingsMenuRef}>
          <button
            className="onboarding-settings-btn"
            onClick={() => setShowSettingsMenu(!showSettingsMenu)}
            aria-label="Settings"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="5" r="1.5" />
              <circle cx="12" cy="19" r="1.5" />
            </svg>
          </button>

          {showSettingsMenu && (
            <div className="onboarding-settings-menu">
              <div className="settings-menu-header">
                <span className="settings-menu-version">Accordio AI v{appVersion}</span>
              </div>
              <div className="settings-menu-divider" />
              {(step === 'permissions' || step === 'permissions-done') && (
                <button
                  className="settings-menu-item"
                  onClick={() => {
                    setShowSettingsMenu(false);
                    setShowInfoModal(true);
                  }}
                >
                  <Info size={16} />
                  <span>Privacy Info</span>
                </button>
              )}
              <button
                className="settings-menu-item"
                onClick={toggleTheme}
              >
                {isDarkMode ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="5" />
                    <line x1="12" y1="1" x2="12" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" />
                    <line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                )}
                <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
              </button>
              <button
                className="settings-menu-item"
                onClick={openWebApp}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                <span>Open Web App</span>
              </button>
              <div className="settings-menu-divider" />
              <button
                className="settings-menu-item danger"
                onClick={() => {
                  window.electron.app.quit();
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span>Quit Accordio</span>
              </button>
            </div>
          )}
        </div>

        {/* Welcome Step */}
        {step === 'welcome' && (
          <div className="onboarding-step">
            <div className="onboarding-logo">
              <svg width="48" height="48" viewBox="0 0 18 18" fill="none">
                <path d="M14.3509 4.82496C15.172 3.99533 15.9931 2.77388 17.1805 0.420348C17.2791 0.224884 17.1291 -0.00512837 16.9102 8.7099e-05C4.51767 0.295389 2.66382 11.9639 1.78948 17.2987C1.76662 17.4381 1.87502 17.5601 2.01635 17.5601H3.29916C3.40749 17.5601 3.50087 17.4835 3.52487 17.3779C4.15774 14.5918 5.65209 12.9875 7.94948 12.7296C11.3032 12.306 13.7384 9.43117 14.6869 6.86346C14.7439 6.70915 14.6573 6.54102 14.5005 6.49145L13.4854 6.17067C13.322 6.11901 13.2711 5.91268 13.3919 5.79102L14.3509 4.82496Z" fill="currentColor"/>
                <path d="M2.5208 0.320351C2.63278 0.115601 2.92685 0.115601 3.03883 0.320351L3.21191 0.636821C3.64538 1.42939 4.29703 2.08103 5.08959 2.5145L5.40606 2.68759C5.61081 2.79957 5.61081 3.09363 5.40606 3.20562L5.08959 3.3787C4.29703 3.81217 3.64538 4.46381 3.21191 5.25638L3.03883 5.57285C2.92685 5.7776 2.63278 5.7776 2.5208 5.57285L2.34771 5.25638C1.91425 4.46381 1.2626 3.81217 0.470033 3.3787L0.153563 3.20562C-0.0511877 3.09363 -0.0511874 2.79957 0.153563 2.68759L0.470033 2.5145C1.2626 2.08103 1.91425 1.42939 2.34771 0.636821L2.5208 0.320351Z" fill="currentColor"/>
              </svg>
            </div>
            <h1 className="onboarding-title">
              Busy work?<br />
              <span className="onboarding-title-accent">AI work.</span>
            </h1>
            <p className="onboarding-subtitle">
              Your AI runs the business. You do the work.
            </p>
            <button
              className="onboarding-btn primary"
              onClick={() => setStep('email')}
            >
              Get Started
            </button>

            {/* Chat Channels */}
            <div className="onboarding-channels">
              <span className="onboarding-channels-label">Chat anywhere via</span>
              <div className="onboarding-channels-icons">
                <div className="onboarding-channel-icon whatsapp">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                </div>
                <div className="onboarding-channel-icon telegram">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                  </svg>
                </div>
                <div className="onboarding-channel-icon slack">
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path fill="#E01E5A" d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z"/>
                    <path fill="#36C5F0" d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z"/>
                    <path fill="#2EB67D" d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z"/>
                    <path fill="#ECB22E" d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Email Step */}
        {step === 'email' && (
          <div className="onboarding-step">
            <div className="onboarding-logo">
              <svg width="48" height="48" viewBox="0 0 18 18" fill="none">
                <path d="M14.3509 4.82496C15.172 3.99533 15.9931 2.77388 17.1805 0.420348C17.2791 0.224884 17.1291 -0.00512837 16.9102 8.7099e-05C4.51767 0.295389 2.66382 11.9639 1.78948 17.2987C1.76662 17.4381 1.87502 17.5601 2.01635 17.5601H3.29916C3.40749 17.5601 3.50087 17.4835 3.52487 17.3779C4.15774 14.5918 5.65209 12.9875 7.94948 12.7296C11.3032 12.306 13.7384 9.43117 14.6869 6.86346C14.7439 6.70915 14.6573 6.54102 14.5005 6.49145L13.4854 6.17067C13.322 6.11901 13.2711 5.91268 13.3919 5.79102L14.3509 4.82496Z" fill="currentColor"/>
                <path d="M2.5208 0.320351C2.63278 0.115601 2.92685 0.115601 3.03883 0.320351L3.21191 0.636821C3.64538 1.42939 4.29703 2.08103 5.08959 2.5145L5.40606 2.68759C5.61081 2.79957 5.61081 3.09363 5.40606 3.20562L5.08959 3.3787C4.29703 3.81217 3.64538 4.46381 3.21191 5.25638L3.03883 5.57285C2.92685 5.7776 2.63278 5.7776 2.5208 5.57285L2.34771 5.25638C1.91425 4.46381 1.2626 3.81217 0.470033 3.3787L0.153563 3.20562C-0.0511877 3.09363 -0.0511874 2.79957 0.153563 2.68759L0.470033 2.5145C1.2626 2.08103 1.91425 1.42939 2.34771 0.636821L2.5208 0.320351Z" fill="currentColor"/>
              </svg>
            </div>
            <h1 className="onboarding-title">
              Sign in to<br />
              <span className="onboarding-title-accent">Accordio.</span>
            </h1>
            <p className="onboarding-subtitle">
              Enter your email to receive a code
            </p>

            <div className="onboarding-card">
              <div className="onboarding-input-group">
                <input
                  type="email"
                  className="onboarding-input"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={handleEmailKeyDown}
                  disabled={isLoading}
                  autoFocus
                />
                {error && <span className="onboarding-error">{error}</span>}
              </div>
              <button
                className="onboarding-btn primary"
                onClick={handleSendCode}
                disabled={isLoading || !email.trim()}
              >
                {isLoading ? (
                  <span className="onboarding-spinner" />
                ) : (
                  'Continue with email'
                )}
              </button>
            </div>

            <div className="onboarding-divider">
              <span>or</span>
            </div>

            <button
              className="onboarding-btn secondary"
              onClick={handleDeviceAuth}
              disabled={isLoading}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              Sign in with Web App
            </button>

          </div>
        )}

        {/* Code Verification Step */}
        {step === 'code' && (
          <div className="onboarding-step">
            <div className="onboarding-logo">
              <svg width="48" height="48" viewBox="0 0 18 18" fill="none">
                <path d="M14.3509 4.82496C15.172 3.99533 15.9931 2.77388 17.1805 0.420348C17.2791 0.224884 17.1291 -0.00512837 16.9102 8.7099e-05C4.51767 0.295389 2.66382 11.9639 1.78948 17.2987C1.76662 17.4381 1.87502 17.5601 2.01635 17.5601H3.29916C3.40749 17.5601 3.50087 17.4835 3.52487 17.3779C4.15774 14.5918 5.65209 12.9875 7.94948 12.7296C11.3032 12.306 13.7384 9.43117 14.6869 6.86346C14.7439 6.70915 14.6573 6.54102 14.5005 6.49145L13.4854 6.17067C13.322 6.11901 13.2711 5.91268 13.3919 5.79102L14.3509 4.82496Z" fill="currentColor"/>
                <path d="M2.5208 0.320351C2.63278 0.115601 2.92685 0.115601 3.03883 0.320351L3.21191 0.636821C3.64538 1.42939 4.29703 2.08103 5.08959 2.5145L5.40606 2.68759C5.61081 2.79957 5.61081 3.09363 5.40606 3.20562L5.08959 3.3787C4.29703 3.81217 3.64538 4.46381 3.21191 5.25638L3.03883 5.57285C2.92685 5.7776 2.63278 5.7776 2.5208 5.57285L2.34771 5.25638C1.91425 4.46381 1.2626 3.81217 0.470033 3.3787L0.153563 3.20562C-0.0511877 3.09363 -0.0511874 2.79957 0.153563 2.68759L0.470033 2.5145C1.2626 2.08103 1.91425 1.42939 2.34771 0.636821L2.5208 0.320351Z" fill="currentColor"/>
              </svg>
            </div>
            <h1 className="onboarding-title">
              Check your<br />
              <span className="onboarding-title-accent">inbox.</span>
            </h1>
            <p className="onboarding-subtitle">
              We sent a code to <strong>{email}</strong>
            </p>

            <div className="onboarding-card">
              <div className="onboarding-code-inputs">
                {code.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => { codeRefs.current[index] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleCodeChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={handlePaste}
                    disabled={isLoading}
                    className="onboarding-code-input"
                  />
                ))}
              </div>
              {error && <span className="onboarding-error">{error}</span>}

              <div className="onboarding-code-actions">
                <button
                  className="onboarding-link"
                  onClick={() => {
                    setCode(['', '', '', '', '', '']);
                    setError(null);
                    setStep('email');
                  }}
                  disabled={isLoading}
                >
                  Change email
                </button>
                <button
                  className="onboarding-link accent"
                  onClick={() => {
                    setCode(['', '', '', '', '', '']);
                    setError(null);
                    handleSendCode();
                  }}
                  disabled={isLoading}
                >
                  Resend code
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Success Step (brief) */}
        {step === 'success' && (
          <div className="onboarding-step">
            <div className="onboarding-success-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h1 className="onboarding-title">
              Welcome<br />
              <span className="onboarding-title-accent">back!</span>
            </h1>
            <p className="onboarding-subtitle">
              Setting up your workspace...
            </p>
          </div>
        )}

        {/* Device Auth Waiting Step */}
        {step === 'device-auth' && (
          <div className="onboarding-step">
            <div className="onboarding-logo">
              <svg width="48" height="48" viewBox="0 0 18 18" fill="none">
                <path d="M14.3509 4.82496C15.172 3.99533 15.9931 2.77388 17.1805 0.420348C17.2791 0.224884 17.1291 -0.00512837 16.9102 8.7099e-05C4.51767 0.295389 2.66382 11.9639 1.78948 17.2987C1.76662 17.4381 1.87502 17.5601 2.01635 17.5601H3.29916C3.40749 17.5601 3.50087 17.4835 3.52487 17.3779C4.15774 14.5918 5.65209 12.9875 7.94948 12.7296C11.3032 12.306 13.7384 9.43117 14.6869 6.86346C14.7439 6.70915 14.6573 6.54102 14.5005 6.49145L13.4854 6.17067C13.322 6.11901 13.2711 5.91268 13.3919 5.79102L14.3509 4.82496Z" fill="currentColor"/>
                <path d="M2.5208 0.320351C2.63278 0.115601 2.92685 0.115601 3.03883 0.320351L3.21191 0.636821C3.64538 1.42939 4.29703 2.08103 5.08959 2.5145L5.40606 2.68759C5.61081 2.79957 5.61081 3.09363 5.40606 3.20562L5.08959 3.3787C4.29703 3.81217 3.64538 4.46381 3.21191 5.25638L3.03883 5.57285C2.92685 5.7776 2.63278 5.7776 2.5208 5.57285L2.34771 5.25638C1.91425 4.46381 1.2626 3.81217 0.470033 3.3787L0.153563 3.20562C-0.0511877 3.09363 -0.0511874 2.79957 0.153563 2.68759L0.470033 2.5145C1.2626 2.08103 1.91425 1.42939 2.34771 0.636821L2.5208 0.320351Z" fill="currentColor"/>
              </svg>
            </div>
            <h1 className="onboarding-title">
              Waiting for<br />
              <span className="onboarding-title-accent">authorization.</span>
            </h1>
            <p className="onboarding-subtitle">
              Complete sign-in in your browser
            </p>

            <div className="onboarding-card">
              <div className="device-auth-waiting">
                <span className="device-auth-spinner" />
                <p className="device-auth-status">
                  Click <strong>Allow</strong> in your browser to authorize this device
                </p>
              </div>

              {deviceCode && (
                <div className="device-auth-code">
                  <span className="device-auth-code-label">Device Code</span>
                  <span className="device-auth-code-value">{deviceCode}</span>
                </div>
              )}

              {error && <span className="onboarding-error">{error}</span>}
            </div>

            <button
              className="onboarding-btn text"
              onClick={() => {
                window.electron.auth.deviceOpenBrowser(deviceCode!);
              }}
              style={{ marginBottom: 4 }}
            >
              Reopen browser
            </button>

          </div>
        )}

        {/* Permissions Step - Loom-style unified view */}
        {step === 'permissions' && (
          <div className="onboarding-step onboarding-step--permissions">
            <h1 className="onboarding-title">
              Enable <span className="onboarding-title-accent">time tracking</span>
              <button
                className="onboarding-info-btn"
                aria-label="How Accordio AI works"
                onClick={() => setShowInfoModal(true)}
              >
                <Info size={14} />
                <span className="onboarding-tooltip">How Accordio AI works</span>
              </button>
            </h1>

            {/* Privacy Info Card */}
            <div className="onboarding-privacy-card">
              <div className="privacy-item">
                <div className="privacy-icon lock">
                  <Lock size={17} />
                </div>
                <div className="privacy-text">
                  <strong>Your data stays private</strong>
                  <span>We never share or sell your information</span>
                </div>
              </div>
              <div className="privacy-item">
                <div className="privacy-icon eye">
                  <EyeOff size={17} />
                </div>
                <div className="privacy-text">
                  <strong>No screenshots</strong>
                  <span>Only app names and window titles are tracked</span>
                </div>
              </div>
            </div>

            {/* Permission checklist — a row is idle (empty circle), waiting
                (spinner while macOS polling detects the grant), or done
                (checkmark). Screen Recording stays disabled until
                Accessibility is granted so the flow reads as two steps. */}
            <div className="permissions-list">
              {(() => {
                const accessibilityDone = permissionStatus.accessibility;
                const screenDone = permissionStatus.screenRecording;
                const screenDisabled = !accessibilityDone && !screenDone;
                return (<>
                  <button
                    className={`permissions-list-row ${accessibilityDone ? 'done' : accessibilityAsked ? 'waiting' : ''}`}
                    disabled={accessibilityDone}
                    onClick={() => {
                      if (accessibilityDone) return;
                      if (!accessibilityAsked) {
                        // Native "wants to control this computer" dialog — it
                        // carries its own System Settings shortcut.
                        setAccessibilityAsked(true);
                        window.electron.permissions.requestAccessibility();
                      } else {
                        window.electron.permissions.openSettings('accessibility');
                      }
                    }}
                  >
                    {/* Replica of the macOS System Settings Accessibility tile:
                        blue universal-access figure in a circle on a dark tile. */}
                    <span className="permissions-list-icon-tile">
                      <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="9.2" stroke="#0A84FF" strokeWidth="1.7"/>
                        <circle cx="12" cy="7.6" r="1.55" fill="#0A84FF"/>
                        <path
                          d="M7.2 10.6 L12 11.7 L16.8 10.6 M12 11.7 V14 M12 14 L9.8 17.6 M12 14 L14.2 17.6"
                          stroke="#0A84FF"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <span className="permissions-list-info">
                      <strong>Accessibility</strong>
                      <span>
                        {accessibilityDone
                          ? 'Active apps detected'
                          : accessibilityAsked
                            ? 'Waiting — click to open System Settings'
                            : 'To detect active apps'}
                      </span>
                    </span>
                    <span className="permissions-list-state">
                      {accessibilityDone ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      ) : accessibilityAsked ? (
                        <span className="permissions-list-spinner" />
                      ) : (
                        <span className="permissions-list-circle" />
                      )}
                    </span>
                  </button>

                  <button
                    className={`permissions-list-row ${screenDone ? 'done' : screenDisabled ? 'disabled' : screenRecordingAsked ? 'waiting' : ''}`}
                    disabled={screenDone || screenDisabled}
                    onClick={() => {
                      if (screenDone || screenDisabled) return;
                      if (!screenRecordingAsked) {
                        // One-shot capture attempt: registers the app in the
                        // Screen Recording pane (macOS only lists apps that
                        // have tried) and fires the native prompt.
                        setScreenRecordingAsked(true);
                        window.electron.permissions.requestScreenRecording();
                      } else {
                        window.electron.permissions.openSettings('screenRecording');
                      }
                    }}
                  >
                    {/* Replica of the macOS Screen & System Audio Recording
                        tile: red record symbol (ring + filled dot). */}
                    <span className="permissions-list-icon-tile">
                      <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="9.2" stroke="#FF5F57" strokeWidth="1.7"/>
                        <circle cx="12" cy="12" r="4.6" fill="#FF5F57"/>
                      </svg>
                    </span>
                    <span className="permissions-list-info">
                      <strong>Screen Recording</strong>
                      <span>
                        {screenDone
                          ? 'Window titles readable'
                          : screenRecordingAsked
                            ? 'Waiting — click to open System Settings'
                            : 'To read window titles'}
                      </span>
                    </span>
                    <span className="permissions-list-state">
                      {screenDone ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      ) : screenRecordingAsked && !screenDisabled ? (
                        <span className="permissions-list-spinner" />
                      ) : (
                        <span className="permissions-list-circle" />
                      )}
                    </span>
                  </button>
                </>);
              })()}
            </div>

            {/* Continue button */}
            <button
              className={`onboarding-btn primary ${!allPermissionsGranted ? 'disabled-muted' : ''}`}
              onClick={handlePermissionsContinue}
              disabled={!allPermissionsGranted}
            >
              Continue
            </button>

            {/* Skip */}
            <button
              className="onboarding-btn secondary"
              onClick={() => {
                window.electron.permissions.skip();
                onComplete();
              }}
            >
              Skip for now
            </button>

          </div>
        )}

        {/* Permissions Complete Step */}
        {step === 'permissions-done' && (
          <div className="onboarding-step">
            <div className="onboarding-success-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h1 className="onboarding-title">
              You're all<br />
              <span className="onboarding-title-accent">set!</span>
            </h1>
            <p className="onboarding-subtitle">
              One restart and tracking is fully live — macOS only shares window titles with a freshly launched app
            </p>
            <button className="onboarding-btn primary" onClick={handleRestart}>
              Restart Accordio
            </button>
            <button className="onboarding-btn text" onClick={handleFinishWithoutRestart}>
              Later — start without window titles
            </button>
          </div>
        )}
      </div>

      {/* Info Modal */}
      {showInfoModal && (
        <div className="onboarding-modal-overlay" onClick={() => setShowInfoModal(false)}>
          <div className="onboarding-modal" onClick={(e) => e.stopPropagation()}>
            <button className="icon-btn icon-btn-ghost modal-close" onClick={() => setShowInfoModal(false)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <h2 className="modal-title">How Accordio AI Works</h2>

            <div className="modal-section">
              <h3>Powered by Claude AI</h3>
              <p>We use Claude, Anthropic's advanced AI, to power your assistant. All AI processing happens securely in the cloud - nothing runs on your device.</p>
            </div>

            <div className="modal-section">
              <h3>What We Track</h3>
              <ul>
                <li><strong>App names</strong> - Which applications you use</li>
                <li><strong>Window titles</strong> - To identify projects/documents</li>
                <li><strong>Time spent</strong> - Duration per app/task</li>
              </ul>
            </div>

            <div className="modal-section">
              <h3>What We Don't Do</h3>
              <ul>
                <li>No screenshots of your screen</li>
                <li>No keystroke logging</li>
                <li>No microphone or camera access</li>
                <li>No tracking when app is closed</li>
              </ul>
            </div>

            <div className="modal-section">
              <h3>Your Control</h3>
              <p>You can disable time tracking anytime in Settings. You can also exclude specific apps from tracking.</p>
            </div>

            <div className="modal-footer">
              <a href="https://accordio.ai/privacy" target="_blank" rel="noopener noreferrer" className="modal-link">
                Read full privacy policy
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Onboarding;
