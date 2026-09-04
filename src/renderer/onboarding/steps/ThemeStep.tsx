import { StepShell } from './StepShell';
import { DotPanel } from '../mockups/DotPanel';
import { PopoverMockup } from '../mockups/MacBook';

export type ThemePreference = 'system' | 'light' | 'dark';

interface ThemeStepProps {
  theme: ThemePreference;
  onChange: (theme: ThemePreference) => void;
  onBack: () => void;
  onNext: () => void;
}

export function resolveDark(theme: ThemePreference): boolean {
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Miniature app window used on the theme cards. */
function Thumb({ mode }: { mode: 'light' | 'dark' | 'split' }) {
  const paint = (dark: boolean, clip?: string) => {
    const bg = dark ? '#151a17' : '#ffffff';
    const side = dark ? '#1f2622' : '#f3f6f4';
    const bar = dark ? 'rgba(255,255,255,0.14)' : 'rgba(26,31,28,0.12)';
    return (
      <div style={{ position: 'absolute', inset: 0, background: dark ? '#0f1411' : '#e9efe9', clipPath: clip }}>
        <div style={{ position: 'absolute', inset: '14px 12px 0 12px', borderRadius: '8px 8px 0 0', background: bg, overflow: 'hidden', display: 'flex' }}>
          <div style={{ width: 54, background: side, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: 3 }}>
              {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
                <span key={c} style={{ width: 5, height: 5, borderRadius: '50%', background: c }} />
              ))}
            </div>
            {[28, 22, 30, 18].map((w, i) => (
              <span key={i} style={{ width: w, height: 5, borderRadius: 3, background: bar }} />
            ))}
          </div>
          <div style={{ flex: 1, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ width: 60, height: 7, borderRadius: 3, background: bar }} />
            <div style={{ display: 'flex', gap: 6 }}>
              <span style={{ flex: 1, height: 26, borderRadius: 5, background: side }} />
              <span style={{ flex: 1, height: 26, borderRadius: 5, background: side }} />
            </div>
            <span style={{ width: '100%', height: 5, borderRadius: 3, background: bar }} />
            <span style={{ width: '80%', height: 5, borderRadius: 3, background: bar }} />
            <span style={{ width: '90%', height: 5, borderRadius: 3, background: '#78D277', opacity: 0.8 }} />
          </div>
        </div>
      </div>
    );
  };
  if (mode === 'split') {
    return (
      <div className="ob-theme-thumb">
        {paint(false)}
        {paint(true, 'inset(0 0 0 50%)')}
      </div>
    );
  }
  return <div className="ob-theme-thumb">{paint(mode === 'dark')}</div>;
}

export function ThemeStep({ theme, onChange, onBack, onNext }: ThemeStepProps) {
  const dark = resolveDark(theme);
  const options: { id: ThemePreference; label: string; mode: 'split' | 'light' | 'dark' }[] = [
    { id: 'system', label: 'System', mode: 'split' },
    { id: 'light', label: 'Light', mode: 'light' },
    { id: 'dark', label: 'Dark', mode: 'dark' },
  ];
  return (
    <StepShell
      title={
        <>
          Choose your <span className="ob-title-muted">theme</span>
        </>
      }
      subtitle="Pick light or dark mode to match your style."
      onBack={onBack}
      onNext={onNext}
      right={
        <DotPanel>
          <PopoverMockup dark={dark} width={440} height={680} interactive variant="tracker" style={{ left: 80, top: 40 }} />
        </DotPanel>
      }
    >
      <div className="ob-theme-grid">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            className={`ob-theme-card${theme === o.id ? ' ob-theme-card--selected' : ''}`}
            onClick={() => onChange(o.id)}
          >
            <Thumb mode={o.mode} />
            <span className="ob-theme-label">{o.label}</span>
          </button>
        ))}
      </div>
    </StepShell>
  );
}
