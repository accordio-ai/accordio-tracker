import { StepShell } from './StepShell';
import { DotPanel } from '../mockups/DotPanel';
import { TimelineBrowser } from '../mockups/TimelineBrowser';

interface ReadyStepProps {
  /** Preview follows the theme picked two steps earlier. */
  dark: boolean;
  startAtLogin: boolean;
  autoUpdate: boolean;
  onToggle: (key: 'startAtLogin' | 'autoUpdate', value: boolean) => void;
  onBack: () => void;
  onNext: () => void;
}

/* The real macOS app icons, pulled from the system at build time into
   public/onboarding (Finder.icns and System Settings' AppIcon.icns). */
function SystemIcon({ src, badge }: { src: string; badge?: string }) {
  return (
    <span style={{ position: 'relative', width: 44, height: 44, display: 'inline-flex', flex: 'none' }}>
      <img src={src} alt="" width={44} height={44} draggable={false} style={{ width: 44, height: 44, objectFit: 'contain', display: 'block', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.18))' }} aria-hidden="true" />
      {badge && (
        <span style={{ position: 'absolute', top: -4, left: -4, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, background: '#ff3b30', color: '#fff', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 2px #fff' }}>{badge}</span>
      )}
    </span>
  );
}

export function ReadyStep({ dark, startAtLogin, autoUpdate, onToggle, onBack, onNext }: ReadyStepProps) {
  return (
    <StepShell
      title={
        <>
          Almost <span className="ob-title-muted">ready</span>
        </>
      }
      subtitle="Choose how Accordio runs on your Mac."
      onBack={onBack}
      onNext={onNext}
      right={
        <DotPanel>
          {/* The web app's Day view, scaled like the reference laptop: top-left
              corner of the window in view, the rest bleeding off right and bottom. */}
          <div style={{ position: 'absolute', left: 48, top: 64, transform: 'scale(0.78)', transformOrigin: 'top left' }}>
            <TimelineBrowser width={1180} dark={dark} />
          </div>
        </DotPanel>
      }
    >
      <div className="ob-cards">
        <div className="ob-toggle-row">
          <span className="ob-card-icon"><SystemIcon src="./onboarding/finder.png" /></span>
          <div className="ob-card-body">
            <p className="ob-card-title">Launch at login</p>
            <p className="ob-card-desc">Open Accordio automatically when your Mac starts.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={startAtLogin}
            className={`ob-switch${startAtLogin ? ' ob-switch--on' : ''}`}
            onClick={() => onToggle('startAtLogin', !startAtLogin)}
          />
        </div>
        <div className="ob-toggle-row">
          <span className="ob-card-icon"><SystemIcon src="./onboarding/system-settings.png" badge="1" /></span>
          <div className="ob-card-body">
            <p className="ob-card-title">Automatically download and install updates</p>
            <p className="ob-card-desc">Download updates in the background so they are ready to install.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={autoUpdate}
            className={`ob-switch${autoUpdate ? ' ob-switch--on' : ''}`}
            onClick={() => onToggle('autoUpdate', !autoUpdate)}
          />
        </div>
      </div>
    </StepShell>
  );
}
