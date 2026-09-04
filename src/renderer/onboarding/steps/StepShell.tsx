import { createContext, useContext, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';

/** The colour wash behind the story panel (see .ob-blob in onboarding.css). */
export function Blobs() {
  return (
    <>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`ob-blob ob-blob--${i}`} aria-hidden="true" />
      ))}
    </>
  );
}

export interface StepNav {
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  /** Read at render time so a fresh element each render can't re-register. */
  secondary?: () => ReactNode;
}

/**
 * The persistent frame (OnboardingWindow) owns the Back/Next row so it never
 * re-animates between steps; each step hands it the handlers through here.
 */
export const StepNavContext = createContext<(nav: StepNav | null) => void>(() => {});

interface StepShellProps {
  title: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
  right: ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  /** Muted action rendered beside Back (e.g. "Skip for now"). */
  secondary?: ReactNode;
  /** Centre the story column (the last step). */
  centered?: boolean;
  /** Extra layer over the story panel (confetti). */
  overlay?: ReactNode;
}

/**
 * A step's content: the story column on the left, the mockup on the right.
 * Backgrounds, the dot shader and the navigation live in the frame around
 * it, so only this content crossfades when the step changes. Return
 * advances, the way it does in every macOS assistant.
 */
export function StepShell({
  title,
  subtitle,
  children,
  right,
  onBack,
  onNext,
  nextLabel = 'Next',
  nextDisabled = false,
  secondary,
  centered = false,
  overlay,
}: StepShellProps) {
  const setNav = useContext(StepNavContext);

  // Handlers and the secondary node change identity every render; registering
  // them directly re-rendered the frame, which re-rendered the step, which
  // registered again — an update loop. Keep the live values in a ref and hand
  // the frame stable thunks, re-registering only when something visible
  // (label, disabled state, presence of Back/secondary) actually changes.
  const latest = useRef({ onBack, onNext, secondary });
  latest.current = { onBack, onNext, secondary };
  const hasBack = !!onBack;
  const hasNext = !!onNext;
  const hasSecondary = !!secondary;

  useLayoutEffect(() => {
    setNav({
      onBack: hasBack ? () => latest.current.onBack?.() : undefined,
      onNext: hasNext ? () => latest.current.onNext?.() : undefined,
      nextLabel,
      nextDisabled,
      secondary: hasSecondary ? () => latest.current.secondary : undefined,
    });
  }, [setNav, hasBack, hasNext, hasSecondary, nextLabel, nextDisabled]);

  useEffect(() => {
    if (!onNext) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (nextDisabled) return;
      e.preventDefault();
      onNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onNext, nextDisabled]);

  return (
    <>
      <div className={`ob-left${centered ? ' ob-left--centered' : ''}`}>
        <h1 className="ob-title">{title}</h1>
        {subtitle && <p className="ob-subtitle">{subtitle}</p>}
        <div className="ob-body">{children}</div>
        {overlay}
      </div>
      {right}
    </>
  );
}
