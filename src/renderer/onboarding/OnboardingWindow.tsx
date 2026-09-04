import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SignInStep } from './steps/SignInStep';
import { WelcomeStep } from './steps/WelcomeStep';
import { ThemeStep, resolveDark, type ThemePreference } from './steps/ThemeStep';
import { PermissionsStep, type PermissionKind } from './steps/PermissionsStep';
import { TrackingStep } from './steps/TrackingStep';
import { ReadyStep } from './steps/ReadyStep';
import { TrialStep } from './steps/TrialStep';
import { FirstMomentStep } from './steps/FirstMomentStep';
import { startOnboardingMusic, readMutedPreference, type MusicController } from './music';
import { Blobs, StepNavContext, type StepNav } from './steps/StepShell';
import { DotPanelFrame } from './mockups/DotPanel';

type StepId = 'signin' | 'welcome' | 'theme' | 'permissions' | 'tracking' | 'ready' | 'trial' | 'moment';

const ORDER: StepId[] = ['welcome', 'theme', 'permissions', 'tracking', 'ready', 'trial', 'moment'];

/**
 * Dev-only QA hook: `?window=onboarding&qaStep=<step>` opens straight on that
 * step, signed in or not, so every screen can be checked without a real
 * device-auth round trip. Ignored in packaged builds.
 */
const QA_STEP: StepId | null = (() => {
  if (!(import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV) return null;
  const v = new URLSearchParams(window.location.search).get('qaStep');
  return v && (['signin', ...ORDER] as string[]).includes(v) ? (v as StepId) : null;
})();

interface SetupState {
  authenticated: boolean;
  startAtLogin: boolean;
  autoUpdate: boolean;
  theme: ThemePreference;
  shortcut: string;
  trackingEnabled: boolean;
}

interface PermissionStatus {
  accessibility: boolean;
  screenRecording: boolean;
}

/**
 * The setup window. Owns the step order, the music, and every side effect a
 * step asks for (theme, permissions, settings), so the steps themselves stay
 * presentational.
 */
export function OnboardingWindow() {
  const [state, setState] = useState<SetupState | null>(null);
  const [step, setStep] = useState<StepId>('signin');
  const [theme, setTheme] = useState<ThemePreference>('system');
  const [tracking, setTracking] = useState(true);
  const [startAtLogin, setStartAtLogin] = useState(false);
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [perm, setPerm] = useState<PermissionStatus>({ accessibility: false, screenRecording: false });
  const [permFocus, setPermFocus] = useState<PermissionKind>('accessibility');
  const [permSkipped, setPermSkipped] = useState(false);
  const [trial, setTrial] = useState<{ active: boolean; days: number | null }>({ active: false, days: null });
  const [muted, setMuted] = useState(readMutedPreference);
  const [finishing, setFinishing] = useState(false);
  // Back/Next row is owned here so it persists across steps; each step
  // registers its handlers through StepNavContext.
  const [nav, setNav] = useState<StepNav | null>(null);
  const registerNav = useCallback((n: StepNav | null) => setNav(n), []);

  const music = useRef<MusicController | null>(null);
  const needsRelaunch = useRef(false);
  const screenGrantedThisRun = useRef(false);
  const initialScreenRef = useRef<boolean | null>(null);

  // First frame: everything the steps need to render truthfully.
  useEffect(() => {
    let alive = true;
    window.electron.onboarding.getState().then((s) => {
      if (!alive) return;
      setState(s);
      setTheme(s.theme);
      setTracking(s.trackingEnabled);
      setStartAtLogin(s.startAtLogin);
      setAutoUpdate(s.autoUpdate);
      setStep(QA_STEP ?? (s.authenticated ? 'welcome' : 'signin'));
    });
    return () => {
      alive = false;
    };
  }, []);

  // Music from the first frame; the mute button is the only control.
  useEffect(() => {
    const controller = startOnboardingMusic(readMutedPreference());
    music.current = controller;
    return () => controller.stop();
  }, []);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    music.current?.setMuted(next);
  };

  // Trial state decides whether the celebration step shows.
  useEffect(() => {
    if (step !== 'welcome') return;
    window.electron.credits.get().then((r) => {
      const data = r.data as unknown as { trial?: { is_active?: boolean; days_remaining?: number | null } } | undefined;
      const t = data?.trial;
      if (t) setTrial({ active: !!t.is_active, days: t.days_remaining ?? null });
    }).catch(() => { /* no trial info — skip the step */ });
  }, [step]);

  // Permission status: poll while on the step, and listen for the instant
  // change events main fires from its own polling.
  useEffect(() => {
    if (step !== 'permissions') return;
    let alive = true;
    const check = async () => {
      const s = await window.electron.permissions.getStatus(true);
      if (!alive) return;
      if (initialScreenRef.current === null) initialScreenRef.current = s.screenRecording;
      setPerm(s);
    };
    void check();
    const timer = setInterval(check, 1500);
    const off = window.electron.permissions.onChanged((d) => {
      if (!alive) return;
      setPerm({ accessibility: d.accessibility, screenRecording: d.screenRecording });
    });
    return () => {
      alive = false;
      clearInterval(timer);
      off();
    };
  }, [step]);

  useEffect(() => {
    if (perm.screenRecording && initialScreenRef.current === false) {
      screenGrantedThisRun.current = true;
    }
  }, [perm.screenRecording]);

  useEffect(() => {
    const off = window.electron.permissions.onValidated((d) => {
      if (d.needsRestart) needsRelaunch.current = true;
    });
    return off;
  }, []);

  // Every download starts a trial, so the celebration step always shows;
  // the credits call only decides whether it can name the days left.
  const visibleOrder = useMemo(() => ORDER, []);

  const goNext = useCallback(() => {
    const i = visibleOrder.indexOf(step);
    if (i >= 0 && i < visibleOrder.length - 1) setStep(visibleOrder[i + 1]);
  }, [step, visibleOrder]);

  const goBack = useCallback(() => {
    const i = visibleOrder.indexOf(step);
    if (i > 0) setStep(visibleOrder[i - 1]);
  }, [step, visibleOrder]);

  const onSignedIn = useCallback(() => {
    setState((s) => (s ? { ...s, authenticated: true } : s));
    setStep('welcome');
  }, []);

  const changeTheme = (t: ThemePreference) => {
    setTheme(t);
    void window.electron.onboarding.setTheme(t);
  };

  const allowPermission = (kind: PermissionKind) => {
    setPermFocus(kind);
    // Open the right pane, then float the companion that hands over the app
    // bundle as a drag. Main's aggressive polling flips the card on grant.
    void window.electron.permissions.openSettings(kind);
    void window.electron.onboarding.showDragHelper(kind);
  };

  const skipPermissions = () => {
    setPermSkipped(true);
    void window.electron.onboarding.hideDragHelper();
    goNext();
  };

  const toggleSetting = (key: 'startAtLogin' | 'autoUpdate', value: boolean) => {
    if (key === 'startAtLogin') setStartAtLogin(value);
    else setAutoUpdate(value);
    void window.electron.settings.set(key, value);
  };

  const finish = useCallback(async () => {
    if (finishing) return;
    setFinishing(true);
    try {
      const both = perm.accessibility && perm.screenRecording;
      if (permSkipped && !both) {
        // skip() turns tracking off; the user's own answer wins afterwards.
        await window.electron.permissions.skip();
        await window.electron.time.updateSettings({ enabled: tracking });
      } else {
        await window.electron.time.updateSettings({ enabled: tracking });
        await window.electron.permissions.complete();
      }
      await window.electron.settings.set('startAtLogin', startAtLogin);
      await window.electron.settings.set('autoUpdate', autoUpdate);
      music.current?.stop();
      await window.electron.onboarding.complete({
        relaunch: needsRelaunch.current || screenGrantedThisRun.current,
      });
    } catch {
      setFinishing(false);
    }
  }, [finishing, perm.accessibility, perm.screenRecording, permSkipped, tracking, startAtLogin, autoUpdate]);

  // Leaving the permissions step retires the companion panel.
  useEffect(() => {
    if (step !== 'permissions') void window.electron.onboarding.hideDragHelper();
  }, [step]);

  const shortcut = state?.shortcut || 'CommandOrControl+Shift+A';

  const renderStep = () => {
    switch (step) {
      case 'signin':
        return <SignInStep onSignedIn={onSignedIn} />;
      case 'welcome':
        return <WelcomeStep onNext={goNext} />;
      case 'theme':
        return <ThemeStep theme={theme} onChange={changeTheme} onBack={goBack} onNext={goNext} />;
      case 'permissions':
        return (
          <PermissionsStep
            status={perm}
            focus={permFocus}
            onAllow={allowPermission}
            onSkip={skipPermissions}
            onBack={goBack}
            onNext={goNext}
          />
        );
      case 'tracking':
        return <TrackingStep enabled={tracking} shortcut={shortcut} onChange={setTracking} onBack={goBack} onNext={goNext} />;
      case 'ready':
        return <ReadyStep dark={resolveDark(theme)} startAtLogin={startAtLogin} autoUpdate={autoUpdate} onToggle={toggleSetting} onBack={goBack} onNext={goNext} />;
      case 'trial':
        return <TrialStep daysLeft={trial.days} onBack={goBack} onNext={goNext} />;
      case 'moment':
        return <FirstMomentStep shortcut={shortcut} dark={resolveDark(theme)} onBack={goBack} onReady={finish} />;
      default:
        return null;
    }
  };

  const splash = step === 'signin';

  return (
    <div className={`ob-root${splash ? ' ob-root--splash' : ''}`}>
      <div className="ob-drag" />

      {/* Persistent frame: the story panel's wash and rings on the left, the
          dot shader on the right. Steps only swap the content on top. Mounted
          once the first step is known, so the left panel never plays its
          splash-to-column width change on a signed-in launch. */}
      {state && (
        <>
          <div className="ob-frame-left" aria-hidden="true">
            <Blobs />
          </div>
          <div className="ob-frame-right" aria-hidden="true">
            <DotPanelFrame />
          </div>
        </>
      )}

      {state && (
        <button
          type="button"
          className={`ob-btn ob-mute${muted ? ' ob-mute--off' : ''}`}
          onClick={toggleMute}
          aria-label={muted ? 'Unmute music' : 'Mute music'}
          style={{ right: splash ? 16 : 616 }}
        >
          {muted ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M11 5 6 9H2v6h4l5 4z" fill="currentColor" stroke="none" />
              <path d="m23 9-6 6M17 9l6 6" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M11 5 6 9H2v6h4l5 4z" fill="currentColor" stroke="none" />
              <path d="M15.5 8.5a5 5 0 0 1 0 7" />
            </svg>
          )}
        </button>
      )}

      {state && (
        <StepNavContext.Provider value={registerNav}>
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
              style={{ position: 'absolute', inset: 0, display: 'flex' }}
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>
        </StepNavContext.Provider>
      )}

      {/* Persistent Back / Next row */}
      {state && !splash && nav && (
        <div className="ob-nav ob-nav--frame">
          <div className="ob-nav-left">
            {nav.onBack ? (
              <button type="button" className="ob-btn ob-btn-back" onClick={nav.onBack}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M19 12H5" />
                  <path d="m12 19-7-7 7-7" />
                </svg>
                Back
              </button>
            ) : (
              <span />
            )}
            {nav.secondary?.()}
          </div>
          {nav.onNext && (
            <button type="button" className="ob-btn ob-btn-next" onClick={nav.onNext} disabled={!!nav.nextDisabled}>
              {nav.nextLabel ?? 'Next'}
              <span className="ob-kbd" aria-hidden="true">⏎</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
