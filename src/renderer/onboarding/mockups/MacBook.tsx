import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BrandMark } from './brand';
import { AppTile, type AppName } from './AppLogos';

/**
 * Story mockups: a MacBook frame, the macOS menu bar with Accordio's live
 * timer in it, the popover itself, and the day-summary cards. All CSS/SVG,
 * no raster, so they scale with the panel and pick up the chosen theme.
 */

export function MacBookFrame({
  children,
  width = 720,
  style,
}: {
  children: ReactNode;
  width?: number;
  style?: CSSProperties;
}) {
  const screenH = Math.round(width * 0.64);
  return (
    <div style={{ position: 'absolute', width, ...style }}>
      <div
        style={{
          position: 'relative',
          width,
          height: screenH,
          borderRadius: 26,
          padding: 14,
          background: 'linear-gradient(180deg, #2b2f2c 0%, #161917 100%)',
          boxShadow: '0 40px 80px -30px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.08)',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            borderRadius: 14,
            overflow: 'hidden',
            background: '#0f1411',
          }}
        >
          {children}
          {/* notch */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              width: Math.round(width * 0.17),
              height: 16,
              borderRadius: '0 0 10px 10px',
              background: '#161917',
            }}
          />
        </div>
      </div>
      {/* base */}
      <div
        style={{
          width: width + 60,
          marginLeft: -30,
          height: 18,
          borderRadius: '0 0 16px 16px',
          background: 'linear-gradient(180deg, #3a403c 0%, #1c201d 100%)',
          boxShadow: '0 30px 40px -20px rgba(0,0,0,0.9)',
        }}
      />
    </div>
  );
}

/** Wallpaper for the mockup screen. */
export function DesktopScene({ dark = false, children }: { dark?: boolean; children?: ReactNode }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: dark
          ? 'radial-gradient(90% 70% at 20% 10%, #244c31 0%, #0f1a13 45%, #0a0e0b 100%)'
          : 'radial-gradient(90% 70% at 20% 10%, #d8f3d6 0%, #9fdc9c 45%, #3e8a47 100%)',
      }}
    >
      {children}
    </div>
  );
}

export function MenuBarStrip({
  timer = '0:42:16',
  dark = false,
  scale = 1,
}: {
  timer?: string;
  dark?: boolean;
  scale?: number;
}) {
  const fg = dark ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.85)';
  const dim = dark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)';
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 30 * scale,
        display: 'flex',
        alignItems: 'center',
        padding: `0 ${14 * scale}px`,
        gap: 18 * scale,
        fontSize: 12.5 * scale,
        fontWeight: 500,
        color: fg,
        background: dark ? 'rgba(20,24,21,0.72)' : 'rgba(255,255,255,0.58)',
        backdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
      }}
    >
      <svg width={13 * scale} height={16 * scale} viewBox="0 0 13 16" fill={fg} aria-hidden="true">
        <path d="M10.6 8.5c0-1.6 1.3-2.4 1.4-2.4-.8-1.1-2-1.3-2.4-1.3-1-.1-2 .6-2.5.6s-1.3-.6-2.2-.6C3.8 4.8 2.7 5.5 2.1 6.5c-1.3 2.2-.3 5.4.9 7.2.6.9 1.3 1.8 2.2 1.8.9 0 1.2-.6 2.3-.6s1.4.6 2.3.6 1.6-.9 2.2-1.8c.7-1 1-2 1-2-.1 0-2-.8-2.4-3.2zM9 3.4c.5-.6.8-1.4.7-2.2-.7 0-1.5.5-2 1.1-.4.5-.8 1.3-.7 2.1.8.1 1.6-.4 2-1z" />
      </svg>
      <span style={{ fontWeight: 700 }}>Accordio</span>
      <span>Track</span>
      <span>Window</span>
      <span>Help</span>
      <span style={{ flex: 1 }} />
      {/* the live timer chip — the whole point of the app */}
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6 * scale,
          padding: `${3 * scale}px ${9 * scale}px`,
          borderRadius: 7 * scale,
          background: dark ? 'rgba(120,210,119,0.16)' : 'rgba(52,78,65,0.12)',
          color: dark ? '#9fe49c' : '#2f5a3b',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <BrandMark size={12 * scale} color={dark ? '#78D277' : '#3E8A47'} />
        {timer}
      </span>
      <span style={{ color: dim }}>
        <svg width={16 * scale} height={12 * scale} viewBox="0 0 16 12" fill="currentColor" aria-hidden="true">
          <path d="M8 9.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM4.9 7.4a4.4 4.4 0 0 1 6.2 0l-1 1a3 3 0 0 0-4.2 0l-1-1zM2.1 4.6a8.4 8.4 0 0 1 11.8 0l-1 1a7 7 0 0 0-9.8 0l-1-1z" />
        </svg>
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 * scale, color: dim }}>
        <span
          style={{
            width: 22 * scale,
            height: 10 * scale,
            borderRadius: 3 * scale,
            border: `1px solid ${dim}`,
            padding: 1,
          }}
        >
          <span style={{ display: 'block', width: '80%', height: '100%', borderRadius: 2, background: fg }} />
        </span>
      </span>
      <span style={{ color: fg }}>Fri 4 Sep  12:06</span>
    </div>
  );
}

function Ring({ pct, color, size = 52, stroke = 4 }: { pct: number; color: string; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(128,128,128,0.18)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${(c * pct) / 100} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" dy="0.36em" textAnchor="middle" fontSize={size * 0.24} fontWeight={600} fill={color}>
        {pct}%
      </text>
    </svg>
  );
}

/**
 * The menu bar popover as it actually ships: Agent/Tracker pill tabs, then
 * "Working now", "Work hours" and "Scores" cards (Tracker), or the chat
 * (Agent). Colours follow the app's own tokens for each theme.
 */
const RECENT: { app: AppName; title: string; minutes: number }[] = [
  { app: 'Figma', title: 'Northwind rebrand · Homepage v3', minutes: 84 },
  { app: 'VS Code', title: 'client-portal · InvoiceTable.tsx', minutes: 62 },
  { app: 'Google Meet', title: 'Weekly sync · Acme', minutes: 31 },
  { app: 'Notion', title: 'Proposal draft · Q4 retainer', minutes: 24 },
  { app: 'Slack', title: '#northwind-design', minutes: 12 },
];
const WEEK = [
  { d: 'M', h: 6.2 }, { d: 'T', h: 7.7 }, { d: 'W', h: 5.1 }, { d: 'T', h: 8.3 }, { d: 'F', h: 3.4 }, { d: 'S', h: 0 }, { d: 'S', h: 0 },
];

function fmtMin(m: number) {
  const h = Math.floor(m / 60);
  return h ? `${h}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`;
}



/** A live session timer for the chip under the composer: h:mm:ss, ticking. */
function TickingTimer({ from }: { from: number }) {
  const [secs, setSecs] = useState(from);
  useEffect(() => {
    const t = setInterval(() => setSecs((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const sec = secs % 60;
  return <>{`${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`}</>;
}

const PLACEHOLDERS = ['Ask anything...', 'Review this week...', 'Draft an invoice for...', "Summarize today's work...", 'Send a Slack message to...'];

function RotatingPlaceholder({ color, size }: { color: string; size: number }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % PLACEHOLDERS.length), 3000);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ position: 'relative', height: size * 1.3 }}>
      <AnimatePresence mode="wait">
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.3 }}
          style={{ position: 'absolute', left: 0, top: 0, color, fontSize: size, lineHeight: 1.3 }}
        >
          {PLACEHOLDERS[i]}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

/**
 * The brand mark as the popover paints it on load: grey at rest, then the
 * green pours in top-to-bottom with a light edge leading it, and the whole
 * mark springs once. Same 18-unit grid and 19-unit travel as App.tsx.
 */
function PourMark({ size, dark }: { size: number; dark: boolean }) {
  const id = `ob-pour-${dark ? 'd' : 'l'}`;
  return (
    <div className="ob-pour" style={{ width: size, height: size }}>
      <svg viewBox="-1 -1 20 20" width={size} height={size} aria-hidden="true">
        <defs>
          <clipPath id={`${id}-clip`}>
            <path d="M14.3509 4.82496C15.172 3.99533 15.9931 2.77388 17.1805 0.420348C17.2791 0.224884 17.1291 -0.00512837 16.9102 8.7099e-05C4.51767 0.295389 2.66382 11.9639 1.78948 17.2987C1.76662 17.4381 1.87502 17.5601 2.01635 17.5601H3.29916C3.40749 17.5601 3.50087 17.4835 3.52487 17.3779C4.15774 14.5918 5.65209 12.9875 7.94948 12.7296C11.3032 12.306 13.7384 9.43117 14.6869 6.86346C14.7439 6.70915 14.6573 6.54102 14.5005 6.49145L13.4854 6.17067C13.322 6.11901 13.2711 5.91268 13.3919 5.79102L14.3509 4.82496Z" />
            <path d="M2.5208 0.320351C2.63278 0.115601 2.92685 0.115601 3.03883 0.320351L3.21191 0.636821C3.64538 1.42939 4.29703 2.08103 5.08959 2.5145L5.40606 2.68759C5.61081 2.79957 5.61081 3.09363 5.40606 3.20562L5.08959 3.3787C4.29703 3.81217 3.64538 4.46381 3.21191 5.25638L3.03883 5.57285C2.92685 5.7776 2.63278 5.7776 2.5208 5.57285L2.34771 5.25638C1.91425 4.46381 1.2626 3.81217 0.470033 3.3787L0.153563 3.20562C-0.0511877 3.09363 -0.0511874 2.79957 0.153563 2.68759L0.470033 2.5145C1.2626 2.08103 1.91425 1.42939 2.34771 0.636821L2.5208 0.320351Z" />
          </clipPath>
          <linearGradient id={`${id}-shimmer`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.8" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g clipPath={`url(#${id}-clip)`}>
          <rect x="-1" y="-1" width="20" height="20" fill={dark ? '#6b756d' : '#8a958c'} opacity="0.5" />
          <g className="ob-pour-fill">
            <rect x="-1" y="-20" width="20" height="20" fill="#78D277" />
            <rect x="-1" y="0" width="20" height="5" fill={`url(#${id}-shimmer)`} className="ob-pour-shimmer" />
          </g>
        </g>
      </svg>
    </div>
  );
}

export function PopoverMockup({
  dark = true,
  variant: initialVariant = 'tracker',
  width = 300,
  style,
  interactive = false,
  height,
  agentState = 'empty',
}: {
  dark?: boolean;
  variant?: 'tracker' | 'agent';
  width?: number;
  style?: CSSProperties;
  /** Tabs switch and the tracker body scrolls, like the real popover. */
  interactive?: boolean;
  /** Fixed height (px). With `interactive` the body scrolls inside it. */
  height?: number;
  /** Agent tab before any message (brand mark + composer) or mid-conversation. */
  agentState?: 'empty' | 'chat';
}) {
  const [tab, setTab] = useState<'tracker' | 'agent'>(initialVariant);
  const variant = interactive ? tab : initialVariant;
  const base = dark ? '#0f1411' : '#f5f7f6';
  const card = dark ? '#1a1f1c' : '#ffffff';
  const raised = dark ? '#252b27' : '#f0f2f1';
  const ink = dark ? '#f0f4f1' : '#1a1f1c';
  const muted = dark ? '#9ca89e' : '#5a655c';
  const tertiary = dark ? '#6b756d' : '#8a958c';
  const line = dark ? '#2a312c' : '#e2e8e4';
  const s = width / 400;
  const cardStyle: CSSProperties = {
    borderRadius: 14 * s,
    background: card,
    border: `1px solid ${line}`,
    padding: `${14 * s}px ${16 * s}px`,
  };
  const label: CSSProperties = {
    fontSize: 10.5 * s,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: tertiary,
    fontWeight: 500,
  };

  return (
    <div
      style={{
        position: 'absolute',
        width,
        borderRadius: 18 * s,
        background: base,
        color: ink,
        boxShadow: '0 30px 60px -20px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,0,0,0.25)',
        overflow: 'hidden',
        fontSize: 13 * s,
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
        ...(height ? { height, display: 'flex', flexDirection: 'column' } : {}),
        ...style,
      }}
    >
      {/* tab bar */}
      <div style={{ display: 'flex', alignItems: 'center', padding: `${12 * s}px ${12 * s}px`, gap: 8 * s }}>
        <div style={{ display: 'flex', alignItems: 'center', background: raised, borderRadius: 999, padding: 4 * s, gap: 2 * s, border: `1px solid ${line}` }}>
          {(['Agent', 'Tracker'] as const).map((t) => {
            const active = (variant === 'agent') === (t === 'Agent');
            return (
              <span
                key={t}
                onClick={interactive ? () => setTab(t === 'Agent' ? 'agent' : 'tracker') : undefined}
                style={{
                  cursor: interactive ? 'pointer' : 'default',
                  transition: 'background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7 * s,
                  padding: `${7 * s}px ${16 * s}px`,
                  borderRadius: 999,
                  background: active ? '#78D277' : 'transparent',
                  color: active ? '#0f1411' : muted,
                  fontWeight: 500,
                  fontSize: 13.5 * s,
                  boxShadow: active ? '0 0 0 3px rgba(120,210,119,0.22), 0 0 18px rgba(120,210,119,0.35)' : 'none',
                }}
              >
                {t === 'Agent' ? (
                  <BrandMark size={13 * s} color={active ? '#0f1411' : muted} />
                ) : (
                  <svg width={13 * s} height={13 * s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" />
                    <polyline points="12 7 12 12 15.5 14" />
                  </svg>
                )}
                {t}
              </span>
            );
          })}
        </div>
        <span style={{ flex: 1 }} />
        <svg width={18 * s} height={18 * s} viewBox="0 0 24 24" fill="none" stroke={muted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
        </svg>
      </div>

      {variant === 'tracker' ? (
        <div
          className="ob-popover-scroll"
          style={{
            padding: `0 ${12 * s}px ${12 * s}px`,
            display: 'flex',
            flexDirection: 'column',
            gap: 10 * s,
            ...(height ? { flex: 1, minHeight: 0, overflowY: interactive ? 'auto' : 'hidden' } : {}),
          }}
        >
          {/* Working now */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={label}>Working now</span>
              <span style={{ padding: `${4 * s}px ${12 * s}px`, borderRadius: 999, background: 'rgba(120,210,119,0.16)', color: '#78D277', fontSize: 12 * s, fontWeight: 600 }}>Auto</span>
            </div>
            <div style={{ marginTop: 12 * s, padding: `${12 * s}px ${14 * s}px`, borderRadius: 12 * s, background: raised, border: `1px solid ${line}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 * s }}>
                <AppTile name="Figma" size={22 * s} dark={dark} />
                <span style={{ fontSize: 16 * s, fontWeight: 500 }}>Figma</span>
                <span style={{ padding: `${2 * s}px ${8 * s}px`, borderRadius: 6 * s, background: 'rgba(47,124,246,0.18)', color: '#6aa6ff', fontSize: 11 * s, fontWeight: 500 }}>Design</span>
              </div>
              <div style={{ marginTop: 5 * s, color: muted, fontSize: 13 * s }}>Northwind rebrand · Homepage v3</div>
            </div>
          </div>

          {/* Work hours */}
          <div style={cardStyle}>
            <span style={label}>Work hours</span>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 12 * s }}>
              <div>
                <div style={{ color: muted, fontSize: 12.5 * s }}>Total time worked</div>
                <div style={{ marginTop: 6 * s, fontSize: 30 * s, fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1 }}>
                  3<span style={{ fontSize: 14 * s, fontWeight: 400, color: muted, margin: `0 ${6 * s}px 0 ${3 * s}px` }}>hr</span>
                  21<span style={{ fontSize: 14 * s, fontWeight: 400, color: muted, marginLeft: 3 * s }}>min</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: muted, fontSize: 12.5 * s }}>Percent of work day</div>
                <div style={{ marginTop: 6 * s, fontSize: 22 * s, fontWeight: 500, color: '#78D277', lineHeight: 1 }}>
                  42%<span style={{ fontSize: 12.5 * s, fontWeight: 400, color: muted, marginLeft: 4 * s }}>of 8 hr</span>
                </div>
              </div>
            </div>
            <div style={{ height: 1, background: line, margin: `${12 * s}px 0` }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ color: muted, fontSize: 12.5 * s, lineHeight: 1.7 }}>
                <div>Tracking: <span style={{ color: ink, fontWeight: 500 }}>On</span></div>
                <div>This week: <span style={{ color: ink, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>18:42:10</span></div>
              </div>
              <span style={{ padding: `${8 * s}px ${16 * s}px`, borderRadius: 999, border: `1px solid ${dark ? '#3a433c' : '#d0d8d2'}`, color: ink, fontSize: 12.5 * s, fontWeight: 500 }}>Disable Tracking</span>
            </div>
          </div>

          {/* Scores */}
          <div style={cardStyle}>
            <span style={label}>Scores</span>
            <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 12 * s }}>
              <Ring pct={61} color="#38bdf8" size={52 * s} stroke={4 * s} />
              <Ring pct={23} color="#a259ff" size={52 * s} stroke={4 * s} />
              <Ring pct={16} color="#78D277" size={52 * s} stroke={4 * s} />
            </div>
          </div>

          {/* Recent activity — real app marks */}
          <div style={cardStyle}>
            <span style={label}>Recent activity</span>
            <div style={{ marginTop: 10 * s, display: 'flex', flexDirection: 'column', gap: 8 * s }}>
              {RECENT.map((r) => (
                <div key={r.app} style={{ display: 'flex', alignItems: 'center', gap: 10 * s, padding: `${8 * s}px ${10 * s}px`, borderRadius: 10 * s, background: raised, border: `1px solid ${line}` }}>
                  <AppTile name={r.app} size={28 * s} dark={dark} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 13 * s }}>{r.app}</div>
                    <div style={{ color: muted, fontSize: 11.5 * s, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</div>
                  </div>
                  <span style={{ color: muted, fontSize: 12 * s, fontVariantNumeric: 'tabular-nums' }}>{fmtMin(r.minutes)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* This week */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={label}>This week</span>
              <span style={{ color: muted, fontSize: 12 * s }}>30h 42m</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 * s, height: 64 * s, marginTop: 12 * s }}>
              {WEEK.map((w, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 * s, height: '100%', justifyContent: 'flex-end' }}>
                  <span style={{ width: '100%', height: `${Math.max(4, (w.h / 8.5) * 100)}%`, borderRadius: 4 * s, background: w.h ? (i === 3 ? '#78D277' : 'rgba(120,210,119,0.45)') : line }} />
                  <span style={{ fontSize: 10 * s, color: tertiary }}>{w.d}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : agentState === 'empty' ? (
        /* The real empty state: the brand mark pours in green on mount, the
           composer sits underneath, then the live timer chip. */
        <div style={{ padding: `${8 * s}px ${16 * s}px ${16 * s}px`, display: 'flex', flexDirection: 'column', alignItems: 'center', ...(height ? { flex: 1, minHeight: 0, justifyContent: 'center' } : { minHeight: 320 * s, justifyContent: 'center' }) }}>
          <PourMark size={56 * s} dark={dark} />
          <div style={{ marginTop: 34 * s, width: '100%', borderRadius: 22 * s, background: dark ? '#141917' : '#ffffff', border: `1px solid ${dark ? '#2a312c' : '#e2e8e4'}`, padding: `${22 * s}px ${22 * s}px ${18 * s}px` }}>
            <RotatingPlaceholder color={muted} size={19 * s} />
            <div style={{ marginTop: 26 * s, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ width: 54 * s, height: 54 * s, borderRadius: 12 * s, background: raised, border: `1px solid ${line}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: muted }}>
                <svg width={20 * s} height={20 * s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
              </span>
              <span style={{ width: 54 * s, height: 54 * s, borderRadius: 12 * s, background: raised, border: `1px solid ${line}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: muted }}>
                <svg width={20 * s} height={20 * s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
              </span>
            </div>
          </div>
          <div style={{ marginTop: 50 * s, display: 'inline-flex', alignItems: 'center', gap: 9 * s, padding: `${11 * s}px ${22 * s}px`, borderRadius: 999, background: dark ? '#1a1f1c' : '#ffffff', border: `1px solid ${line}`, color: ink, fontSize: 14 * s, fontWeight: 500 }}>
            <span style={{ width: 16 * s, height: 16 * s, borderRadius: 4 * s, background: '#2a1a12', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src="./ai-logos/claude.svg" alt="" width={11 * s} height={11 * s} draggable={false} style={{ display: 'block' }} />
            </span>
            Claude
            <span style={{ color: muted, fontWeight: 400, fontVariantNumeric: 'tabular-nums' }}><TickingTimer from={3852} /></span>
          </div>
        </div>
      ) : (
        <div style={{ padding: `0 ${12 * s}px ${12 * s}px` }}>
          <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 10 * s }}>
            <div style={{ alignSelf: 'flex-end', maxWidth: '82%', padding: `${8 * s}px ${12 * s}px`, borderRadius: `${14 * s}px ${14 * s}px ${4 * s}px ${14 * s}px`, background: dark ? '#252b27' : '#1a1f1c', color: dark ? ink : '#fff' }}>
              Invoice Northwind for this week
            </div>
            <div style={{ display: 'flex', gap: 8 * s, alignItems: 'flex-start' }}>
              <BrandMark size={14 * s} />
              <div style={{ flex: 1 }}>
                <div style={{ color: ink, lineHeight: 1.45 }}>
                  Drafted from <b>12.5 tracked hours</b> across 4 days. Ready to send.
                </div>
                <div style={{ marginTop: 8 * s, padding: `${10 * s}px ${12 * s}px`, borderRadius: 10 * s, background: raised, border: `1px solid ${line}`, display: 'flex', alignItems: 'center', gap: 10 * s }}>
                  <span style={{ width: 30 * s, height: 30 * s, borderRadius: 8 * s, background: '#78D277', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#0f1411', fontWeight: 700 }}>$</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500 }}>INV-0042 · Northwind</div>
                    <div style={{ color: muted, fontSize: 11.5 * s }}>12.5h × $120 · due in 14 days</div>
                  </div>
                  <div style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>$1,500</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const DAYS = [
  { day: 'Thursday', total: '6h 12m', rows: [['Figma', '#a259ff', 0.7], ['VS Code', '#2f80ed', 0.5], ['Meet', '#00ac47', 0.25]] },
  { day: 'Wednesday', total: '7h 40m', rows: [['VS Code', '#2f80ed', 0.9], ['Slack', '#e01e5a', 0.3], ['Notion', '#1a1f1c', 0.4]] },
  { day: 'Tuesday', total: '5h 03m', rows: [['Figma', '#a259ff', 0.6], ['Meet', '#00ac47', 0.45]] },
  { day: 'Monday', total: '8h 15m', rows: [['VS Code', '#2f80ed', 0.95], ['Figma', '#a259ff', 0.35], ['Mail', '#2d7cf6', 0.2]] },
] as const;

/** A column of day summaries, like screenshots stacked in a corner. */
export function DayCardsStack({ dark = false, style }: { dark?: boolean; style?: CSSProperties }) {
  const bg = dark ? '#151a17' : '#ffffff';
  const ink = dark ? '#f0f4f1' : '#1a1f1c';
  const muted = dark ? '#9ca89e' : '#6b756d';
  const raised = dark ? '#1f2622' : '#f3f6f4';
  return (
    <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', gap: 10, ...style }}>
      {DAYS.map((d) => (
        <div
          key={d.day}
          style={{
            width: 210,
            padding: '10px 12px',
            borderRadius: 12,
            background: bg,
            color: ink,
            boxShadow: '0 16px 30px -14px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,0,0,0.06)',
            fontSize: 11,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 500 }}>
            <span>{d.day}</span>
            <span style={{ color: muted, fontVariantNumeric: 'tabular-nums' }}>{d.total}</span>
          </div>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
            {d.rows.map(([name, color, w]) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
                <span style={{ width: 44, color: muted }}>{name}</span>
                <span style={{ flex: 1, height: 4, borderRadius: 2, background: raised }}>
                  <span style={{ display: 'block', width: `${w * 100}%`, height: '100%', borderRadius: 2, background: '#78D277' }} />
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
