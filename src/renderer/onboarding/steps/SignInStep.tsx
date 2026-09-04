import { useEffect, useRef, useState } from 'react';
import { AppIcon } from '../mockups/brand';

interface SignInStepProps {
  onSignedIn: () => void;
}

const TERMS_URL = 'https://accordio.ai/terms';

/**
 * The splash. One button: sign in through the browser (device flow). While
 * the browser has the ball the button turns into a quiet "Continue on
 * browser" and the window polls until the web app authorises this device.
 * An email code remains available underneath for anyone who prefers it.
 */
export function SignInStep({ onSignedIn }: SignInStepProps) {
  const [phase, setPhase] = useState<'idle' | 'waiting'>('idle');
  const [deviceCode, setDeviceCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Email-code fallback
  const [mode, setMode] = useState<'browser' | 'email' | 'code'>('browser');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState<string[]>(['', '', '', '', '', '']);
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);

  const startBrowserSignIn = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await window.electron.auth.deviceRequest();
      if (result.success && result.deviceCode) {
        setDeviceCode(result.deviceCode);
        setPhase('waiting');
        await window.electron.auth.deviceOpenBrowser(result.deviceCode);
      } else {
        setError(result.error || 'Browser sign-in is unavailable right now. Try the email code instead.');
      }
    } catch {
      setError('Browser sign-in is unavailable right now. Try the email code instead.');
    } finally {
      setBusy(false);
    }
  };

  // Poll while the browser is doing the work.
  useEffect(() => {
    if (phase !== 'waiting' || !deviceCode) return;
    let failures = 0;
    const poll = setInterval(async () => {
      try {
        const result = await window.electron.auth.devicePoll(deviceCode);
        if (result.success && result.status === 'authorized') {
          clearInterval(poll);
          onSignedIn();
        } else if (!result.success) {
          failures += 1;
          if (failures >= 5) setError('Still trying to reach Accordio. Check your connection.');
        } else {
          failures = 0;
          setError(null);
        }
      } catch {
        failures += 1;
        if (failures >= 5) setError('Still trying to reach Accordio. Check your connection.');
      }
    }, 3000);
    const timeout = setTimeout(() => {
      clearInterval(poll);
      setPhase('idle');
      setDeviceCode(null);
      setError('That sign-in link expired. Start again when you are ready.');
    }, 10 * 60 * 1000);
    return () => {
      clearInterval(poll);
      clearTimeout(timeout);
    };
  }, [phase, deviceCode, onSignedIn]);

  const sendCode = async () => {
    const value = email.trim();
    if (!value.includes('@')) {
      setError('Enter the email you use for Accordio.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await window.electron.auth.sendCode(value);
      if (result.success) {
        setMode('code');
        setTimeout(() => codeRefs.current[0]?.focus(), 80);
      } else {
        const msg = result.error || '';
        setError(msg.includes('not found') || msg.includes('404')
          ? 'No account for that email. Sign up at app.accordio.ai first.'
          : 'Could not send a code. Try again in a moment.');
      }
    } catch {
      setError('Could not send a code. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  };

  const verify = async (digits: string[]) => {
    const otp = digits.join('');
    if (otp.length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      const result = await window.electron.auth.verifyCode(email.trim(), otp);
      if (result.success) {
        onSignedIn();
      } else {
        setError(result.error || 'That code did not match. Try again.');
      }
    } catch {
      setError('Could not verify the code. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const onDigit = (i: number, v: string) => {
    if (!/^\d?$/.test(v)) return;
    const next = [...code];
    next[i] = v;
    setCode(next);
    if (v && i < 5) codeRefs.current[i + 1]?.focus();
    if (v && i === 5 && next.every(Boolean)) void verify(next);
  };

  return (
    <div className="ob-left ob-left--full">
      <AppIcon size={124} className="ob-splash-icon" />
      <h1 className="ob-splash-title">Make every hour count</h1>
      <p className="ob-splash-sub">
        The AI-powered time tracker that lives in your menu bar, sorts hours into projects, and turns them into invoices.
      </p>

      <div className="ob-splash-actions">
        {mode === 'browser' && (
          <>
            {phase === 'waiting' ? (
              <button type="button" className="ob-btn ob-btn-dark ob-btn-waiting" onClick={() => deviceCode && window.electron.auth.deviceOpenBrowser(deviceCode)}>
                Continue on browser
                <ArrowUpRight />
              </button>
            ) : (
              <button type="button" className="ob-btn ob-btn-dark" onClick={startBrowserSignIn} disabled={busy}>
                Sign in via browser
                <ArrowUpRight />
              </button>
            )}
            <p className="ob-terms">
              By signing up, you agree to our{' '}
              <a href={TERMS_URL} target="_blank" rel="noreferrer">Terms of Service</a>
            </p>
            {error && <p className="ob-error">{error}</p>}
            <button type="button" className="ob-btn ob-btn-text" onClick={() => { setError(null); setMode('email'); }}>
              Sign in with an email code instead
            </button>
          </>
        )}

        {mode === 'email' && (
          <>
            <div className="ob-email-form">
              <input
                className="ob-input"
                type="email"
                placeholder="you@studio.com"
                value={email}
                autoFocus
                disabled={busy}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void sendCode(); }}
              />
              <button type="button" className="ob-btn ob-btn-dark" onClick={sendCode} disabled={busy || !email.trim()}>
                Continue with email
              </button>
            </div>
            {error && <p className="ob-error">{error}</p>}
            <button type="button" className="ob-btn ob-btn-text" onClick={() => { setError(null); setMode('browser'); }}>
              Back to browser sign-in
            </button>
          </>
        )}

        {mode === 'code' && (
          <>
            <p className="ob-terms">We sent a 6-digit code to <strong>{email.trim()}</strong></p>
            <div className="ob-code-row">
              {code.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => { codeRefs.current[i] = el; }}
                  className="ob-input"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  disabled={busy}
                  onChange={(e) => onDigit(i, e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Backspace' && !code[i] && i > 0) codeRefs.current[i - 1]?.focus(); }}
                  onPaste={(e) => {
                    const text = e.clipboardData.getData('text').trim();
                    if (/^\d{6}$/.test(text)) {
                      e.preventDefault();
                      const next = text.split('');
                      setCode(next);
                      void verify(next);
                    }
                  }}
                />
              ))}
            </div>
            {error && <p className="ob-error">{error}</p>}
            <button type="button" className="ob-btn ob-btn-text" onClick={() => { setCode(['', '', '', '', '', '']); setError(null); setMode('email'); }}>
              Use a different email
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ArrowUpRight() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </svg>
  );
}
