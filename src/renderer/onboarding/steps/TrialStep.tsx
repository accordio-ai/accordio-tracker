import { useCallback, useEffect, useRef, useState } from 'react';
import { StepShell } from './StepShell';
import { DotPanel } from '../mockups/DotPanel';
import { Confetti } from '../mockups/Confetti';
import { AppIcon } from '../mockups/brand';
import { WhatsAppChat, ClaudeStar, SCENARIO_DURATIONS, type ChatPlatform } from '../mockups/WhatsAppChat';
import { SlackLogo } from '../mockups/AppLogos';

interface TrialStepProps {
  daysLeft: number | null;
  onBack: () => void;
  onNext: () => void;
}

const PLATFORMS: { id: ChatPlatform; name: string }[] = [
  { id: 'claude', name: 'Claude' },
  { id: 'whatsapp', name: 'WhatsApp' },
  { id: 'telegram', name: 'Telegram' },
  { id: 'slack', name: 'Slack' },
];

function PlatformIcon({ id, active }: { id: ChatPlatform; active: boolean }) {
  const muted = 'rgba(255,255,255,0.45)';
  if (id === 'claude') return <ClaudeStar size={15} color={active ? '#D97757' : muted} />;
  if (id === 'slack') return <span style={{ opacity: active ? 1 : 0.45, display: 'inline-flex' }}><SlackLogo size={15} /></span>;
  if (id === 'whatsapp') {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill={active ? '#25D366' : muted} aria-hidden="true">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    );
  }
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill={active ? '#2AABEE' : muted} aria-hidden="true">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

/**
 * Every download starts a trial, so this step always shows. The panel
 * carries the landing page's phone: the same scripted conversations in the
 * Claude, WhatsApp, Telegram and Slack skins, scenarios advancing on their
 * own timing and the skin rotating once a scenario has played out.
 */
export function TrialStep({ daysLeft, onBack, onNext }: TrialStepProps) {
  const [platform, setPlatform] = useState<ChatPlatform>('whatsapp');
  const [scenario, setScenario] = useState(0);
  const [held, setHeld] = useState(false);
  const btnRefs = useRef<Partial<Record<ChatPlatform, HTMLButtonElement | null>>>({});
  const morphWrapRef = useRef<HTMLDivElement>(null);
  const morphLiveRef = useRef<HTMLDivElement>(null);
  const morphCleanupRef = useRef<(() => void) | null>(null);

  // Gliding highlight behind the active tab, measured from the buttons.
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);
  useEffect(() => {
    const el = btnRefs.current[platform];
    if (el) setPill({ left: el.offsetLeft, width: el.offsetWidth });
  }, [platform]);

  // Clip-path morph between skins, lifted from the landing hero: snapshot the
  // outgoing skin, then the new one grows out of the tab that triggered it.
  const switchPlatform = useCallback((p: ChatPlatform, origin?: HTMLElement | null) => {
    if (p === platform) return;
    const wrap = morphWrapRef.current;
    const live = morphLiveRef.current;
    if (wrap && live && typeof live.animate === 'function') {
      live.getAnimations().forEach((a) => a.cancel());
      const clone = live.cloneNode(true) as HTMLElement;
      clone.setAttribute('aria-hidden', 'true');
      clone.style.position = 'absolute';
      clone.style.inset = '0';
      clone.style.zIndex = '0';
      clone.style.pointerEvents = 'none';
      wrap.insertBefore(clone, live);
      const rect = wrap.getBoundingClientRect();
      const btnRect = origin?.getBoundingClientRect();
      const cx = btnRect ? btnRect.left + btnRect.width / 2 : rect.left + rect.width / 2;
      const ox = rect.width > 0 ? Math.min(100, Math.max(0, ((cx - rect.left) / rect.width) * 100)) : 50;
      // The switcher sits under the phone here, so the wipe starts from the bottom edge.
      const anim = live.animate(
        [{ clipPath: `circle(0% at ${ox}% 100%)` }, { clipPath: `circle(150% at ${ox}% 100%)` }],
        { duration: 700, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' }
      );
      const cleanup = () => {
        clone.remove();
        morphCleanupRef.current = null;
      };
      morphCleanupRef.current = cleanup;
      anim.onfinish = cleanup;
      anim.oncancel = cleanup;
    }
    setPlatform(p);
  }, [platform]);
  useEffect(() => () => morphCleanupRef.current?.(), []);

  useEffect(() => {
    if (held) return;
    const t = setTimeout(() => {
      setScenario((i) => {
        const next = (i + 1) % SCENARIO_DURATIONS.length;
        if (next === 0) {
          const upcoming = PLATFORMS[(PLATFORMS.findIndex((x) => x.id === platform) + 1) % PLATFORMS.length].id;
          switchPlatform(upcoming, btnRefs.current[upcoming] ?? null);
        }
        return next;
      });
    }, SCENARIO_DURATIONS[scenario] + 1800);
    return () => clearTimeout(t);
  }, [scenario, held, platform, switchPlatform]);

  return (
    <StepShell
      title={
        <>
          Your free trial
          <br />
          <span className="ob-title-muted">is active</span> 🎉
        </>
      }
      subtitle="You have the whole Accordio super-app for 14 days: contracts, proposals, invoices, meeting notes, AI time tracking, and your assistant in WhatsApp, Telegram, Slack or Claude."
      onBack={onBack}
      onNext={onNext}
      overlay={<Confetti count={110} />}
      right={
        <DotPanel>
          <Confetti count={80} />
          <div className="ob-phone-stage">
            <div className="ob-phone-wrap">
              <div ref={morphWrapRef} style={{ position: 'relative' }}>
                <div ref={morphLiveRef} style={{ position: 'relative', zIndex: 1 }}>
                  <WhatsAppChat activeScenario={scenario} compact onAudioHold={setHeld} platform={platform} />
                </div>
              </div>
            </div>
            {/* Platform switcher: the hero's — a neutral highlight glides
                between tabs, icons take their brand colour when active. */}
            <div className="ob-phone-tabs" role="tablist" aria-label="Chat platform">
              {pill && (
                <span
                  aria-hidden="true"
                  className="ob-phone-pill"
                  style={{ left: pill.left, width: pill.width }}
                />
              )}
              {PLATFORMS.map((p) => {
                const active = platform === p.id;
                return (
                  <button
                    key={p.id}
                    ref={(el) => { btnRefs.current[p.id] = el; }}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={`ob-phone-tab${active ? ' ob-phone-tab--on' : ''}`}
                    onClick={(e) => { switchPlatform(p.id, e.currentTarget); setScenario(0); }}
                  >
                    <PlatformIcon id={p.id} active={active} />
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>
        </DotPanel>
      }
    >
      <div className="ob-legend-card">
        <div className="ob-legend-copy">
          <div className="ob-legend-kicker">Accordio Legend</div>
          <h2 className="ob-legend-title">
            Your whole business,
            <br />
            in one app.
          </h2>
        </div>
        <div className="ob-legend-tags">
          <span className="ob-tag">Every feature</span>
          <span className="ob-tag">No card required</span>
          {daysLeft !== null && <span className="ob-tag">{daysLeft} days left</span>}
        </div>
        <div className="ob-legend-art">
          <AppIcon size={236} />
        </div>
      </div>
    </StepShell>
  );
}
