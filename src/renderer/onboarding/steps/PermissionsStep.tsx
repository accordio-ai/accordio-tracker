import { StepShell } from './StepShell';
import { DotPanel } from '../mockups/DotPanel';
import { SettingsRowsMockup } from '../mockups/SettingsRows';

export type PermissionKind = 'accessibility' | 'screenRecording';

interface PermissionsStepProps {
  status: { accessibility: boolean; screenRecording: boolean };
  /** Which permission the System Settings companion is currently helping with. */
  focus: PermissionKind;
  onAllow: (kind: PermissionKind) => void;
  onSkip: () => void;
  onBack: () => void;
  onNext: () => void;
}

function AccessibilityIcon() {
  return (
    <span style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(180deg, #2f7cf6 0%, #1a5fd0 100%)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 14px -8px rgba(26,95,208,0.8)' }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9.2" stroke="#ffffff" strokeWidth="1.6" />
        <circle cx="12" cy="7.6" r="1.5" fill="#ffffff" />
        <path d="M7.4 10.6 12 11.7l4.6-1.1M12 11.7V14M12 14l-2.1 3.5M12 14l2.1 3.5" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function ScreenRecordingIcon() {
  return (
    <span style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(180deg, #8e8e93 0%, #636366 100%)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 14px -8px rgba(0,0,0,0.6)' }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="8.6" stroke="#ffffff" strokeWidth="1.6" />
        <circle cx="12" cy="12" r="4.2" fill="#ffffff" />
      </svg>
    </span>
  );
}

function Granted() {
  return (
    <span className="ob-granted">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m20 6-11 11-5-5" />
      </svg>
      Permissions granted
    </span>
  );
}

export function PermissionsStep({ status, focus, onAllow, onSkip, onBack, onNext }: PermissionsStepProps) {
  const both = status.accessibility && status.screenRecording;
  const cards: { kind: PermissionKind; icon: JSX.Element; title: string; desc: string; on: boolean }[] = [
    {
      kind: 'accessibility',
      icon: <AccessibilityIcon />,
      title: 'Allow accessibility access',
      desc: 'Needed to see which app is in front so hours land on the right work.',
      on: status.accessibility,
    },
    {
      kind: 'screenRecording',
      icon: <ScreenRecordingIcon />,
      title: 'Allow screen recording',
      desc: 'Needed to read window titles. No screenshots, no keystrokes, ever.',
      on: status.screenRecording,
    },
  ];

  return (
    <StepShell
      title={
        <>
          Set up <span className="ob-title-muted">permissions</span>
        </>
      }
      subtitle="Accordio needs two system permissions to notice which app is in front and how long you spend there."
      onBack={onBack}
      onNext={onNext}
      nextDisabled={!both}
      secondary={
        !both ? (
          <button type="button" className="ob-btn ob-btn-text" onClick={onSkip}>
            Skip for now
          </button>
        ) : null
      }
      right={
        <DotPanel>
          <SettingsRowsMockup accordioOn={status[focus]} />
        </DotPanel>
      }
    >
      <div className="ob-cards">
        {cards.map((c) => (
          <div key={c.kind} className="ob-card">
            <span className="ob-card-icon">{c.icon}</span>
            <div className="ob-card-body">
              <p className="ob-card-title">{c.title}</p>
              <p className="ob-card-desc">{c.desc}</p>
              <div className="ob-card-actions">
                {c.on ? (
                  <Granted />
                ) : (
                  <button type="button" className="ob-btn ob-btn-accent" onClick={() => onAllow(c.kind)}>
                    Allow permissions
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </StepShell>
  );
}
