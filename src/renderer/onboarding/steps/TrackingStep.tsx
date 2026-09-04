import { StepShell } from './StepShell';
import { DotPanel } from '../mockups/DotPanel';
import { KeyboardMockup } from '../mockups/Keyboard';
import { parseShortcut, shortcutGlyphs } from '../mockups/brand';

interface TrackingStepProps {
  enabled: boolean;
  shortcut: string;
  onChange: (enabled: boolean) => void;
  onBack: () => void;
  onNext: () => void;
}

export function TrackingStep({ enabled, shortcut, onChange, onBack, onNext }: TrackingStepProps) {
  const keys = parseShortcut(shortcut).map((k) => k.key);
  return (
    <StepShell
      title={
        <>
          Track time <span className="ob-title-muted">automatically?</span>
        </>
      }
      subtitle={
        <>
          Accordio notices which app is in front and logs the hours for you. Press {shortcutGlyphs(shortcut)} any time to open it. You can change this later in settings.
        </>
      }
      onBack={onBack}
      onNext={onNext}
      right={
        <DotPanel>
          <KeyboardMockup highlight={keys} />
        </DotPanel>
      }
    >
      <div className="ob-radios">
        <button type="button" className={`ob-radio${enabled ? ' ob-radio--on' : ''}`} onClick={() => onChange(true)}>
          <span className="ob-radio-dot" />
          <span>
            <strong>Yes</strong>, track my hours automatically
          </span>
        </button>
        <button type="button" className={`ob-radio${!enabled ? ' ob-radio--on' : ''}`} onClick={() => onChange(false)}>
          <span className="ob-radio-dot" />
          <span>
            <strong>No</strong>, I&rsquo;ll start timers myself
          </span>
        </button>
      </div>
    </StepShell>
  );
}
