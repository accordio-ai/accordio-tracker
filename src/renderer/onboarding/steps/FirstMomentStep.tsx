import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { StepShell } from './StepShell';
import { DotPanel } from '../mockups/DotPanel';
import { KeyCap, parseShortcut, shortcutGlyphs } from '../mockups/brand';
import { TrackerShowcase } from '../mockups/TrackerShowcase';
import { BrandMark } from '../mockups/brand';
import { HOSTS, HostLogo, McpMark, McpSetupPanel } from '../McpSetupPanel';

interface FirstMomentStepProps {
  shortcut: string;
  /** Menu bar preview follows the theme picked earlier. */
  dark: boolean;
  onBack: () => void;
  onReady: () => void;
}


/**
 * Stage-two art: the top-right of a real macOS menu bar, zoomed in. Status
 * glyphs drawn after the system's (volume, Focus, input source, battery,
 * Wi-Fi, Spotlight, Control Center, clock) with Accordio's feather and live
 * timer among them and the cursor resting on it. Light or dark like the
 * theme the user picked.
 */
function MenuBarZoom({ dark }: { dark: boolean }) {
  const fg = dark ? '#ffffff' : '#111111';
  const S = 34;
  // speaker.wave.3
  const Volume = (
    <svg width={S} height={S} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.5 9.6v4.8h3.2l4.6 3.9V5.7L6.7 9.6z" fill={fg} />
      <path d="M14 9.9a3 3 0 0 1 0 4.2M16.4 7.6a6 6 0 0 1 0 8.8M18.8 5.4a9 9 0 0 1 0 13.2" fill="none" stroke={fg} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
  // moon.fill, tilted the way Focus draws it
  const Moon = (
    <svg width={S} height={S} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M13.2 3.1a8.9 8.9 0 1 0 7.9 12.9 7.6 7.6 0 0 1-7.9-12.9z" fill={fg} />
    </svg>
  );
  // input source: rounded box with a bold A
  const InputSource = (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 42, height: 27, borderRadius: 6, border: `1.8px solid ${fg}`, fontSize: 18, fontWeight: 600, color: fg, lineHeight: 1, fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>A</span>
  );
  // battery.100percent.bolt with a low red level
  const Battery = (
    <svg width={48} height={S} viewBox="0 0 38 24" aria-hidden="true">
      <rect x="1.5" y="6" width="30" height="12" rx="3" fill="none" stroke={fg} strokeWidth="1.5" opacity="0.55" />
      <rect x="33" y="9.6" width="2.2" height="4.8" rx="1" fill={fg} opacity="0.4" />
      <rect x="3.6" y="8.1" width="3.2" height="7.8" rx="1.2" fill="#ff453a" />
      <path d="M18.6 6.6 13.2 12.6h3.6l-.9 4.8 5.4-6h-3.6z" fill={fg} />
      <path d="M18.6 6.6 13.2 12.6h3.6l-.9 4.8 5.4-6h-3.6z" fill="none" stroke={dark ? '#1c1e1d' : '#eceff0'} strokeWidth="1.2" strokeLinejoin="round" style={{ mixBlendMode: 'normal' }} opacity="0.9" />
      <path d="M18.6 6.6 13.2 12.6h3.6l-.9 4.8 5.4-6h-3.6z" fill={fg} />
    </svg>
  );
  // wifi: filled wedges, not thin arcs
  const Wifi = (
    <svg width={S} height={S} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M1.5 8.2a15.6 15.6 0 0 1 21 0l-1.9 2a12.9 12.9 0 0 0-17.2 0z" fill={fg} />
      <path d="M5.2 12a10.3 10.3 0 0 1 13.6 0l-1.9 2a7.6 7.6 0 0 0-9.8 0z" fill={fg} />
      <path d="M8.9 15.7a5.1 5.1 0 0 1 6.2 0L12 19z" fill={fg} />
    </svg>
  );
  const Spotlight = (
    <svg width={S} height={S} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="10.3" cy="10.3" r="6.3" fill="none" stroke={fg} strokeWidth="1.9" />
      <path d="M15.2 15.2 20.6 20.6" stroke={fg} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
  // Control Center: two stacked switches, knobs on opposite sides
  const ControlCenter = (
    <svg width={S} height={S} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5.2" width="18" height="6.4" rx="3.2" fill="none" stroke={fg} strokeWidth="1.7" />
      <circle cx="16.6" cy="8.4" r="1.9" fill={fg} />
      <rect x="3" y="12.4" width="18" height="6.4" rx="3.2" fill="none" stroke={fg} strokeWidth="1.7" />
      <circle cx="7.4" cy="15.6" r="1.9" fill={fg} />
    </svg>
  );
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {/* a sliver of desktop wallpaper under the bar so it reads as a screen */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 120, height: 260, background: dark ? 'radial-gradient(120% 90% at 20% 0%, #2f5a3b 0%, #16281c 45%, #0b1410 100%)' : 'radial-gradient(120% 90% at 20% 0%, #d8f3d6 0%, #9fdc9c 45%, #3e8a47 100%)' }} />
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 120,
          width: 1000,
          height: 58,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: 22,
          padding: '0 34px',
          background: dark ? 'rgba(28,30,29,0.92)' : 'rgba(236,240,238,0.9)',
          backdropFilter: 'blur(30px)',
          borderBottom: dark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.08)',
          color: fg,
          fontSize: 25,
          fontWeight: 500,
          letterSpacing: '-0.01em',
          boxShadow: '0 30px 60px -20px rgba(0,0,0,0.8)',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12, padding: '8px 14px', borderRadius: 8, background: dark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.1)', fontVariantNumeric: 'tabular-nums' }}>
          <BrandMark size={26} color={fg} />
          0:42:16
        </span>
        {Volume}
        {Moon}
        {InputSource}
        {Battery}
        {Wifi}
        {Spotlight}
        {ControlCenter}
        <span style={{ whiteSpace: 'nowrap' }}>Fri 4 Sep&nbsp;&nbsp;14:52</span>
      </div>

      {/* the pointer, resting on Accordio's item */}
      <svg width="54" height="62" viewBox="0 0 24 28" fill="none" aria-hidden="true" style={{ position: 'absolute', left: 104, top: 156, filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.6))' }}>
        <path d="M5 3l14 11.5-6 .6 3.6 7.2-2.7 1.3-3.6-7.3L5 20.5z" fill="#ffffff" stroke="#1a1a1a" strokeWidth="1.2" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

const STACK = ['codex', 'claude', 'claude-code'] as const;
const STAGE_MS = 4600;

/**
 * The last step. Story side: one button with the stacked host marks that
 * opens the MCP setup rail in the panel. Panel: the four-stage autoplay
 * walkthrough (bring your own AI, the shortcut, the menu bar, the popover)
 * until that button is pressed, then the setup rail slides in over it.
 */
export function FirstMomentStep({ shortcut, dark, onBack, onReady }: FirstMomentStepProps) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState(0);
  const [cycle, setCycle] = useState(0);
  const stack = STACK.map((id) => HOSTS.find((h) => h.id === id)!);
  const keys = parseShortcut(shortcut);
  const glyphs = shortcutGlyphs(shortcut);

  const stages = [
    {
      title: 'Bring your own AI',
      desc: <>Your hours, projects and invoices, answered wherever you already ask. Press the button to connect.</>,
      art: (
        <div className="ob-mcp-idle ob-mcp-idle--stage">
          <span className="ob-mcp-idle-mark"><McpMark size={64} /></span>
          <div className="ob-mcp-idle-orbit">
            {HOSTS.map((h, i) => (
              <span key={h.id} className="ob-mcp-idle-host" style={{ transform: `rotate(${i * 60}deg) translateY(-118px) rotate(${-i * 60}deg)` }}>
                <HostLogo host={h} size={20} />
              </span>
            ))}
          </div>
        </div>
      ),
    },
    {
      title: 'Learn the shortcut',
      desc: <>You&rsquo;ll open Accordio with {glyphs}. Don&rsquo;t press it yet, we&rsquo;ll try together.</>,
      art: (
        <div style={{ position: 'absolute', left: 70, top: 220, display: 'flex', gap: 14 }}>
          {keys.map((k) => (
            <KeyCap key={k.key} symbol={k.symbol} label={k.label || undefined} size={96} />
          ))}
        </div>
      ),
    },
    {
      title: 'Find it in your menu bar',
      desc: <>The feather shows a live timer while you work. Click it any time to see today.</>,
      art: <MenuBarZoom dark={dark} />,
    },
    {
      title: 'Nothing more',
      desc: <>Accordio already tracks the app in front and files the hours to your active projects. Just keep working.</>,
      art: (
        <div style={{ position: 'absolute', left: 100, top: 36, transform: 'scale(0.88)', transformOrigin: 'top center', width: 400 }}>
          <TrackerShowcase />
        </div>
      ),
    },
  ];

  // Autoplay pauses while the setup rail is open, and restarts its clock on
  // every manual bar click (cycle bumps) so a chosen stage gets its full run.
  useEffect(() => {
    if (open) return;
    const t = setInterval(() => {
      setStage((s) => (s + 1) % stages.length);
      setCycle((c) => c + 1);
    }, STAGE_MS);
    return () => clearInterval(t);
  }, [open, cycle, stages.length]);

  return (
    <StepShell
      centered
      title={
        <>
          Your first <span className="ob-title-muted">Accordio</span>
          <br />
          moment
        </>
      }
      subtitle={
        <>
          Connect Claude, Codex or any MCP host to your tracked hours. Then do nothing: Accordio tracks and files them while you work.
        </>
      }
      onBack={onBack}
      onNext={onReady}
      nextLabel="Do nothing"
      right={
        <DotPanel inset>
          <AnimatePresence mode="wait">
            {open ? (
              <motion.div
                key="setup"
                className="ob-mcp-scroll"
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 24 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              >
                <McpSetupPanel initialHost="claude" />
              </motion.div>
            ) : (
              <motion.div
                key="walk"
                className="ob-walk"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.03 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                <span className="ob-walk-info">i</span>
                <div className="ob-walk-stage">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={stage}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                      style={{ position: 'absolute', inset: 0 }}
                    >
                      {stages[stage].art}
                    </motion.div>
                  </AnimatePresence>
                </div>
                <div className="ob-walk-foot">
                  <div className="ob-walk-bars">
                    {stages.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        className="ob-walk-bar"
                        aria-label={`Show step ${i + 1}`}
                        onClick={() => {
                          setStage(i);
                          setCycle((c) => c + 1);
                        }}
                      >
                        <motion.span
                          key={`${cycle}-${i}`}
                          initial={{ scaleX: i < stage ? 1 : 0 }}
                          animate={{ scaleX: i <= stage ? 1 : 0 }}
                          transition={i === stage ? { duration: STAGE_MS / 1000, ease: 'linear' } : { duration: 0.2 }}
                        />
                      </button>
                    ))}
                  </div>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={stage}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.3 }}
                    >
                      <h3 className="ob-walk-title">{stages[stage].title}</h3>
                      <p className="ob-walk-desc">{stages[stage].desc}</p>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </DotPanel>
      }
    >
      <motion.button
        type="button"
        className={`ob-btn ob-connect${open ? ' ob-connect--open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        whileTap={{ scale: 0.97 }}
      >
        <span className="ob-connect-stack">
          {stack.map((h, i) => (
            <span key={h.id} className="ob-connect-avatar" style={{ zIndex: 3 - i }}>
              <HostLogo host={h} size={20} />
            </span>
          ))}
        </span>
        <span className="ob-connect-copy">
          <strong>{open ? 'Setting up your AI tool' : 'Connect your AI tool'}</strong>
          <span>Claude, Claude Code, Codex and more</span>
        </span>
        <span className="ob-connect-arrow" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </span>
      </motion.button>
    </StepShell>
  );
}
