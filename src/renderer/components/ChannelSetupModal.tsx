import { useState, useEffect, useCallback, useRef } from 'react';

type ChannelType = 'whatsapp' | 'telegram' | 'slack' | null;

interface ChannelSetupModalProps {
  channel: ChannelType;
  onClose: () => void;
  onSuccess: () => void;
}

export function ChannelSetupModal({ channel, onClose, onSuccess }: ChannelSetupModalProps) {
  const [step, setStep] = useState<'loading' | 'ready' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [telegramCode, setTelegramCode] = useState<string | null>(null);
  const [telegramDeepLink, setTelegramDeepLink] = useState<string | null>(null);
  const [whatsappCode, setWhatsAppCode] = useState<string | null>(null);
  const [whatsappBotPhone, setWhatsAppBotPhone] = useState<string | null>(null);
  const [whatsappInstructions, setWhatsAppInstructions] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const initializedRef = useRef(false); // Track if we've already started the flow

  // Store callbacks in refs to avoid useEffect re-runs
  const onSuccessRef = useRef(onSuccess);
  const onCloseRef = useRef(onClose);
  onSuccessRef.current = onSuccess;
  onCloseRef.current = onClose;

  // WhatsApp pairing code flow
  const startWhatsAppLogin = useCallback(async () => {
    setStep('loading');
    setError(null);
    setWhatsAppCode(null);
    setWhatsAppBotPhone(null);
    setWhatsAppInstructions(null);

    try {
      if (pollingRef.current) clearInterval(pollingRef.current);
      const result = await window.electron.channels.getWhatsAppLinkCode();
      if (result.success && result.code) {
        setWhatsAppCode(result.code);
        setWhatsAppBotPhone(result.botPhone || null);
        setWhatsAppInstructions(result.instructions || null);
        setStep('ready');

        // Start polling for link completion
        pollingRef.current = setInterval(async () => {
          const status = await window.electron.channels.checkWhatsAppLinked();
          if (status.linked) {
            if (pollingRef.current) clearInterval(pollingRef.current);
            setStep('success');
            setTimeout(() => {
              onSuccessRef.current();
              onCloseRef.current();
            }, 1500);
          }
        }, 3000);
      } else {
        setError(result.error || 'Failed to generate link code');
        setStep('error');
      }
    } catch (err) {
      setError((err as Error).message);
      setStep('error');
    }
  }, []); // No dependencies - uses refs for callbacks

  // Telegram pairing code flow
  const startTelegramLink = useCallback(async () => {
    console.log('[Telegram] Starting link flow...');
    setStep('loading');
    setError(null);
    setTelegramCode(null);
    setTelegramDeepLink(null);

    try {
      if (pollingRef.current) clearInterval(pollingRef.current);
      console.log('[Telegram] Calling getTelegramLinkCode...');
      const result = await window.electron.channels.getTelegramLinkCode();
      console.log('[Telegram] Result:', result);

      if (result.success && result.code) {
        setTelegramCode(result.code);
        setTelegramDeepLink(result.deepLink || null);
        setStep('ready');

        // Start polling for link completion
        pollingRef.current = setInterval(async () => {
          const status = await window.electron.channels.checkTelegramLinked();
          if (status.linked) {
            if (pollingRef.current) clearInterval(pollingRef.current);
            setStep('success');
            setTimeout(() => {
              onSuccessRef.current();
              onCloseRef.current();
            }, 1500);
          }
        }, 3000);
      } else {
        console.error('[Telegram] Error:', result.error);
        setError(result.error || 'Failed to generate link code');
        setStep('error');
      }
    } catch (err) {
      console.error('[Telegram] Exception:', err);
      setError((err as Error).message);
      setStep('error');
    }
  }, []); // No dependencies - uses refs for callbacks

  // Auto-start when modal opens - only once per channel
  useEffect(() => {
    if (initializedRef.current) return; // Already initialized
    initializedRef.current = true;

    if (channel === 'whatsapp') {
      startWhatsAppLogin();
    } else if (channel === 'telegram') {
      startTelegramLink();
    } else if (channel === 'slack') {
      setStep('ready'); // Slack shows input form immediately
    }
  }, [channel, startWhatsAppLogin, startTelegramLink]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  const copyCode = () => {
    const code = channel === 'telegram' ? telegramCode : whatsappCode;
    if (code) {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Slack connection (handled in web app)
  const openSlackSettings = async () => {
    try {
      await window.electron.integrations.openSettings('slack');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleRetry = () => {
    if (channel === 'telegram') {
      startTelegramLink();
    } else if (channel === 'whatsapp') {
      startWhatsAppLogin();
    } else {
      setStep('ready');
      setError(null);
    }
  };

  if (!channel) return null;

  const channelName = channel === 'whatsapp' ? 'WhatsApp' : channel === 'telegram' ? 'Telegram' : 'Slack';
  const channelColor = channel === 'whatsapp' ? '#25D366' : channel === 'telegram' ? '#0088cc' : '#4A154B';
  const whatsappDeepLink = whatsappBotPhone && whatsappCode
    ? `https://wa.me/${whatsappBotPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(whatsappCode)}`
    : null;

  return (
    <div className="channel-modal-overlay" onClick={onClose}>
      <div className="channel-modal" onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button className="channel-modal-close" onClick={onClose}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        {/* Icon */}
        <div className="channel-modal-icon" style={{ background: channelColor }}>
          {channel === 'whatsapp' && (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          )}
          {channel === 'telegram' && (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
            </svg>
          )}
          {channel === 'slack' && (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
              <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
            </svg>
          )}
        </div>

        {/* Title */}
        <h2 className="channel-modal-title">Connect {channelName}</h2>

        {/* Content based on step */}
        <div className="channel-modal-content">
          {/* Loading State */}
          {step === 'loading' && (
            <div className="channel-modal-loading">
              <div className="channel-spinner" />
              <p>
                {channel === 'telegram' && 'Generating pairing code...'}
                {channel === 'whatsapp' && 'Generating pairing code...'}
                {channel === 'slack' && 'Connecting...'}
              </p>
            </div>
          )}

          {/* Success State */}
          {step === 'success' && (
            <div className="channel-modal-success">
              <div className="channel-success-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>
              <p>Connected successfully!</p>
            </div>
          )}

          {/* Error State */}
          {step === 'error' && (
            <div className="channel-modal-error">
              <div className="channel-error-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <p className="channel-error-message">{error || 'Connection failed'}</p>
              {error?.includes('not connected') && (
                <p className="channel-error-hint">
                  The {channelName} bot service may not be running. Try again later or contact support.
                </p>
              )}
              {error?.includes('Not authenticated') && (
                <p className="channel-error-hint">
                  Please sign in again to connect {channelName}.
                </p>
              )}
              <button className="channel-modal-btn primary" onClick={handleRetry}>
                Try Again
              </button>
            </div>
          )}

          {/* Ready State - Telegram */}
          {step === 'ready' && channel === 'telegram' && telegramCode && (
            <div className="channel-telegram-ready">
              <p className="channel-modal-description">
                Send this code to <strong>@AccordioBot</strong> on Telegram
              </p>

              <div className="telegram-code-box">
                <span className="telegram-code-text">{telegramCode}</span>
                <button className="telegram-copy-btn" onClick={copyCode} title="Copy code">
                  {copied ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                  )}
                </button>
              </div>

              {telegramDeepLink && (
                <a
                  href={telegramDeepLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="channel-modal-btn primary"
                >
                  Open Telegram
                </a>
              )}

              <div className="channel-waiting-indicator">
                <span className="channel-waiting-dot" />
                <span>Waiting for connection...</span>
              </div>
            </div>
          )}

          {/* Ready State - WhatsApp */}
          {step === 'ready' && channel === 'whatsapp' && (
            <div className="channel-whatsapp-ready">
              <p className="channel-modal-description">
                {whatsappInstructions
                  ? whatsappInstructions
                  : <>Send this code to <strong>{whatsappBotPhone || 'the WhatsApp bot'}</strong></>
                }
              </p>

              <div className="telegram-code-box">
                <span className="telegram-code-text">{whatsappCode}</span>
                <button className="telegram-copy-btn" onClick={copyCode} title="Copy code">
                  {copied ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                  )}
                </button>
              </div>

              {whatsappDeepLink && (
                <a
                  href={whatsappDeepLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="channel-modal-btn primary"
                >
                  Open WhatsApp
                </a>
              )}

              <div className="channel-waiting-indicator">
                <span className="channel-waiting-dot" />
                <span>Waiting for connection...</span>
              </div>
            </div>
          )}

          {/* Ready State - Slack */}
          {step === 'ready' && channel === 'slack' && (
            <div className="channel-slack-ready">
              <p className="channel-modal-description">
                Connect Slack in the web app (OAuth). We’ll detect it here once connected.
              </p>

              {error && <p className="channel-input-error">{error}</p>}

              <button
                className="channel-modal-btn primary"
                onClick={openSlackSettings}
              >
                Open Slack Settings
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ChannelSetupModal;
