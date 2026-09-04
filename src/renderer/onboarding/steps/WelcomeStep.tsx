import { useEffect, useState } from 'react';
import { StepShell } from './StepShell';
import { DotPanel } from '../mockups/DotPanel';
import { DesktopScene, MacBookFrame, MenuBarStrip, PopoverMockup } from '../mockups/MacBook';

/* Remix glyphs on gradient tiles, one per promise. */
function Glyph({ d }: { d: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
const TRACK_D = 'M19.5 4.7832V7.6709L22 9.11426V14.8867L19.499 16.3311L19.5 19.2178L14.5 22.1045L12 20.6611L9.5 22.1045L4.5 19.2178V16.3311L2 14.8877L2.00098 9.11328L4.5 7.66992V4.78418L9.5 1.89746L11.999 3.34082L14.501 1.89648L19.5 4.7832ZM13 5.07227V7H11V5.07324L9.5 4.20703L6.49902 5.93848V8.8252L4 10.2676V13.7334L6.5 15.1768V18.0635L9.5 19.7959L11 18.9287V17H13V18.9297L14.5 19.7959L17.5 18.0625V15.1768L20 13.7324V10.2695L17.499 8.8252L17.5 5.9375L14.501 4.20605L13 5.07227ZM14.2646 13.1602C14.3529 12.9473 14.6472 12.9473 14.7354 13.1602L14.8623 13.4648C15.0783 13.986 15.4807 14.4027 15.9873 14.6279L16.3457 14.7871C16.5511 14.8784 16.5511 15.1773 16.3457 15.2686L15.9658 15.4375C15.4721 15.6571 15.0761 16.0586 14.8564 16.5625L14.7334 16.8447C14.6432 17.0517 14.3569 17.0517 14.2666 16.8447L14.1436 16.5625C13.9239 16.0586 13.5279 15.6571 13.0342 15.4375L12.6543 15.2686C12.4489 15.1773 12.4489 14.8784 12.6543 14.7871L13.0127 14.6279C13.5193 14.4027 13.9217 13.986 14.1377 13.4648L14.2646 13.1602ZM9.58789 7.7793C9.74239 7.40671 10.2577 7.4067 10.4121 7.7793L10.6338 8.31445C11.0118 9.22695 11.7161 9.95624 12.6025 10.3506L13.2305 10.6289C13.5899 10.7887 13.5897 11.3117 13.2305 11.4717L12.5654 11.7676C11.7013 12.152 11.0086 12.8548 10.624 13.7373L10.4082 14.2324C10.2504 14.5948 9.74973 14.5948 9.5918 14.2324L9.37598 13.7373C8.99143 12.8548 8.29875 12.152 7.43457 11.7676L6.76953 11.4717C6.41033 11.3117 6.41022 10.7887 6.76953 10.6289L7.39746 10.3506C8.2839 9.95624 8.98832 9.22697 9.36621 8.31445L9.58789 7.7793Z';
const DETECT_D = 'M3 3C2.44772 3 2 3.44772 2 4V20C2 20.5523 2.44772 21 3 21H21C21.5523 21 22 20.5523 22 20V4C22 3.44772 21.5523 3 21 3H3ZM4 19V5H20V19H4ZM14 7H6V9H14V7ZM18 15V17H10V15H18ZM16 11H8V13H16V11Z';
const SORT_D = 'M16 13L22.9641 17.0622L19.9913 17.9129L22.116 21.5933L20.384 22.5933L18.2592 18.9129L16.0359 21.0622L16 13ZM14 6H16V8H21C21.5523 8 22 8.44772 22 9V13H20V10H10V20H14V22H9C8.44772 22 8 21.5523 8 21V16H6V14H8V9C8 8.44772 8.44772 8 9 8H14V6ZM4 14V16H2V14H4ZM4 10V12H2V10H4ZM4 6V8H2V6H4ZM4 2V4H2V2H4ZM8 2V4H6V2H8ZM12 2V4H10V2H12ZM16 2V4H14V2H16Z';
const INVOICE_D = 'M3.00488 3.00275H21.0049C21.5572 3.00275 22.0049 3.45046 22.0049 4.00275V20.0027C22.0049 20.555 21.5572 21.0027 21.0049 21.0027H3.00488C2.4526 21.0027 2.00488 20.555 2.00488 20.0027V4.00275C2.00488 3.45046 2.4526 3.00275 3.00488 3.00275ZM4.00488 5.00275V19.0027H20.0049V5.00275H4.00488ZM8.50488 14.0027H14.0049C14.281 14.0027 14.5049 13.7789 14.5049 13.5027C14.5049 13.2266 14.281 13.0027 14.0049 13.0027H10.0049C8.62417 13.0027 7.50488 11.8835 7.50488 10.5027C7.50488 9.12203 8.62417 8.00275 10.0049 8.00275H11.0049V6.00275H13.0049V8.00275H15.5049V10.0027H10.0049C9.72874 10.0027 9.50488 10.2266 9.50488 10.5027C9.50488 10.7789 9.72874 11.0027 10.0049 11.0027H14.0049C15.3856 11.0027 16.5049 12.122 16.5049 13.5027C16.5049 14.8835 15.3856 16.0027 14.0049 16.0027H13.0049V18.0027H11.0049V16.0027H8.50488V14.0027Z';

const FEATURES = [
  { key: 'track', tile: 'linear-gradient(145deg, #8fe08a 0%, #3E8A47 100%)', lead: 'Track', rest: 'hours automatically from the menu bar.', icon: <Glyph d={TRACK_D} /> },
  { key: 'detect', tile: 'linear-gradient(145deg, #4f6d5c 0%, #1f2f27 100%)', lead: 'Detect', rest: 'meetings, idle time, and app switches.', icon: <Glyph d={DETECT_D} /> },
  { key: 'sort', tile: 'linear-gradient(145deg, #5cc27a 0%, #1f6b3a 100%)', lead: 'Sort', rest: 'hours into clients and projects with AI.', icon: <Glyph d={SORT_D} /> },
  { key: 'invoice', tile: 'linear-gradient(145deg, #2a302c 0%, #0f1411 100%)', lead: 'Invoice', rest: 'tracked time in one click.', icon: <Glyph d={INVOICE_D} /> },
];

const TIMERS = ['0:42:16', '0:42:17', '0:42:18', '0:42:19'];

const RENDER_SRC = './onboarding/welcome-laptop.png';

export function WelcomeStep({ onNext }: { onNext: () => void }) {
  const [active, setActive] = useState(0);
  const [tick, setTick] = useState(0);
  // Probe once: a shipped render wins, otherwise the CSS laptop stays.
  const [render, setRender] = useState(false);
  useEffect(() => {
    const img = new Image();
    img.onload = () => setRender(true);
    img.onerror = () => setRender(false);
    img.src = RENDER_SRC;
  }, []);

  useEffect(() => {
    const a = setInterval(() => setActive((i) => (i + 1) % FEATURES.length), 2800);
    const t = setInterval(() => setTick((i) => (i + 1) % TIMERS.length), 1000);
    return () => {
      clearInterval(a);
      clearInterval(t);
    };
  }, []);

  return (
    <StepShell
      title={
        <>
          Welcome to <span className="ob-title-muted">Accordio</span>
        </>
      }
      subtitle="Set up your menu bar time tracker for hours that log themselves, clean timesheets, and invoices that write themselves."
      onNext={onNext}
      right={
        <DotPanel>
          {render ? (
            /* Photoreal render (public/onboarding/welcome-laptop.png): transparent
               background, real tracker on screen. Zoomed like the reference so the
               screen fills the panel and the laptop bleeds off right and bottom.
               Delete the file and the CSS laptop below takes over. */
            <img
              src={RENDER_SRC}
              alt=""
              draggable={false}
              style={{ position: 'absolute', left: -166, top: -12, width: 808, height: 1009, maxWidth: 'none', filter: 'drop-shadow(0 40px 60px rgba(0,0,0,0.6))' }}
              aria-hidden="true"
            />
          ) : (
            <MacBookFrame width={640} style={{ left: 56, top: 72 }}>
              <DesktopScene>
                <MenuBarStrip timer={TIMERS[tick]} />
                <PopoverMockup width={280} style={{ right: 96, top: 36 }} />
              </DesktopScene>
            </MacBookFrame>
          )}
        </DotPanel>
      }
    >
      <div className="ob-pills">
        {FEATURES.map((f, i) => (
          <div key={f.key} className={`ob-pill${i === active ? ' ob-pill--active' : ''}`}>
            <span className="ob-pill-icon" style={{ background: f.tile, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25), 0 4px 10px -6px rgba(0,0,0,0.5)' }}>{f.icon}</span>
            <span>
              <strong>{f.lead}</strong> {f.rest}
            </span>
          </div>
        ))}
      </div>
    </StepShell>
  );
}
