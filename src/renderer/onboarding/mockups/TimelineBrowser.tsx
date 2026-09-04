import type { CSSProperties } from 'react';
import { BrandMark } from './brand';
import { AppTile, type AppName } from './AppLogos';

/**
 * app.accordio.ai/time, Day view, in a browser window: the controls bar
 * (Day/Week/Month, date nav, totals), the Timesheet column on the left and
 * the Timeline panel on the right — hour rail, logged-entry bars, memory
 * rows with the coloured app pills, and the red "now" line. Structure and
 * classes mirror Accordio/app/(dashboard)/time and components/time/panels.
 */

const START = 8;
const END = 19;
const RANGE = END - START;
const RAIL_H = 560;

const pct = (h: number, m = 0) => (((h - START) * 60 + m) / (RANGE * 60)) * 100;

// Project groups as the Timesheet panel renders them: a colour-filled card per
// project, its height scaled by the hours (70px + 30px per hour, capped).
const ENTRIES = [
  { project: 'Northwind rebrand', client: 'Northwind Studio', desc: 'Homepage v3 — hero and pricing', from: '9:10', to: '11:40', minutes: 150, dur: '2h 30m', earn: '$300.00', color: '#8b5cf6', ink: '#ffffff', top: pct(9, 10), h: pct(11, 40) - pct(9, 10) },
  { project: 'Client portal', client: 'Acme Corp', desc: 'InvoiceTable.tsx, pagination', from: '12:30', to: '14:15', minutes: 105, dur: '1h 45m', earn: '$210.00', color: '#3b82f6', ink: '#ffffff', top: pct(12, 30), h: pct(14, 15) - pct(12, 30) },
  { project: 'Weekly sync', client: 'Acme Corp', desc: 'Roadmap call + follow-up notes', from: '15:00', to: '15:45', minutes: 45, dur: '45m', earn: '$90.00', color: '#22c55e', ink: '#052e16', top: pct(15), h: pct(15, 45) - pct(15) },
  { project: 'Proposal draft', client: 'Lumen Labs', desc: 'Q4 retainer scope', from: '16:00', to: '17:12', minutes: 72, dur: '1h 12m', earn: '$144.00', color: '#1f2937', ink: '#ffffff', top: pct(16), h: pct(17, 12) - pct(16) },
];

const MEMORIES: { top: number; apps: { app: AppName; project?: string; dur: string; pill: number; color: [string, string]; count?: number }[] }[] = [
  { top: pct(9, 10), apps: [{ app: 'Figma', project: 'Northwind rebrand', dur: '2h 12m', pill: 96, color: ['rgba(168,85,247,0.15)', 'rgba(168,85,247,0.3)'], count: 3 }, { app: 'Slack', project: '#northwind-design', dur: '18m', pill: 26, color: ['rgba(236,72,153,0.15)', 'rgba(236,72,153,0.3)'] }] },
  { top: pct(12, 30), apps: [{ app: 'VS Code', project: 'client-portal', dur: '1h 38m', pill: 74, color: ['rgba(59,130,246,0.15)', 'rgba(59,130,246,0.3)'], count: 2 }] },
  { top: pct(15), apps: [{ app: 'Google Meet', project: 'Weekly sync · Acme', dur: '44m', pill: 34, color: ['rgba(34,197,94,0.15)', 'rgba(34,197,94,0.3)'] }] },
  { top: pct(16), apps: [{ app: 'Notion', project: 'Proposal draft', dur: '1h 10m', pill: 54, color: ['rgba(120,113,108,0.15)', 'rgba(120,113,108,0.3)'] }, { app: 'Slack', project: '#lumen', dur: '9m', pill: 0, color: ['rgba(236,72,153,0.15)', 'rgba(236,72,153,0.3)'] }] },
];

const NOW = pct(17, 26);

// Remix icon paths, in the order the web sidebar lists them: Agent, Clients,
// Projects, Time, Proposals, Contracts, Finances, Meetings.
const SIDEBAR = [
  'M11 17.2498C11 19.597 9.09721 21.4998 6.75 21.4998C4.40279 21.4998 2.5 19.597 2.5 17.2498C2.50011 14.9027 4.40286 12.9998 6.75 12.9998H11V17.2498ZM17.25 12.9998C19.5971 12.9998 21.4999 14.9027 21.5 17.2498C21.5 19.597 19.5972 21.4998 17.25 21.4998C14.9028 21.4998 13 19.597 13 17.2498V12.9998H17.25ZM6.75 14.9998C5.50743 14.9998 4.50011 16.0073 4.5 17.2498C4.5 18.4925 5.50736 19.4998 6.75 19.4998C7.99264 19.4998 9 18.4925 9 17.2498V14.9998H6.75ZM15 17.2498C15 18.4925 16.0074 19.4998 17.25 19.4998C18.4926 19.4998 19.5 18.4925 19.5 17.2498C19.4999 16.0073 18.4926 14.9998 17.25 14.9998H15V17.2498ZM6.75 2.4998C9.09714 2.4998 10.9999 4.40269 11 6.74981V10.9998H6.75C4.40279 10.9998 2.5 9.09703 2.5 6.74981C2.50011 4.40269 4.40286 2.4998 6.75 2.4998ZM16.75 2.83965C16.9375 2.38722 17.5626 2.38722 17.75 2.83965L18.0195 3.48809C18.4785 4.59556 19.3346 5.48026 20.4111 5.95879L21.1729 6.29766C21.609 6.49178 21.6091 7.12607 21.1729 7.32013L20.3652 7.67852C19.3158 8.14506 18.4748 8.99814 18.0078 10.0692L17.7461 10.6697C17.5544 11.1095 16.9457 11.1095 16.7539 10.6697L16.4922 10.0692C16.0252 8.99814 15.1842 8.14506 14.1348 7.67852L13.3271 7.32013C12.891 7.1261 12.891 6.49175 13.3271 6.29766L14.0889 5.95879C15.1654 5.48026 16.0216 4.59556 16.4805 3.48809L16.75 2.83965ZM6.75 4.49981C5.50743 4.49981 4.50011 5.50726 4.5 6.74981C4.5 7.99245 5.50736 8.99982 6.75 8.99982H9V6.74981C8.99989 5.50726 7.99257 4.49981 6.75 4.49981Z',
  'M4 22C4 17.5817 7.58172 14 12 14C16.4183 14 20 17.5817 20 22H18C18 18.6863 15.3137 16 12 16C8.68629 16 6 18.6863 6 22H4ZM12 13C8.685 13 6 10.315 6 7C6 3.685 8.685 1 12 1C15.315 1 18 3.685 18 7C18 10.315 15.315 13 12 13ZM12 11C14.21 11 16 9.21 16 7C16 4.79 14.21 3 12 3C9.79 3 8 4.79 8 7C8 9.21 9.79 11 12 11Z',
  'M7 5V2C7 1.44772 7.44772 1 8 1H16C16.5523 1 17 1.44772 17 2V5H21C21.5523 5 22 5.44772 22 6V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V6C2 5.44772 2.44772 5 3 5H7ZM4 16V19H20V16H4ZM4 14H20V7H4V14ZM9 3V5H15V3H9ZM11 11H13V13H11V11Z',
  'M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20ZM13 12H17V14H11V7H13V12Z',
  'M16.4356 3.21188C16.8261 2.82185 17.4592 2.82157 17.8496 3.21188L20.6777 6.04099C21.0681 6.43152 21.0682 7.06457 20.6777 7.45505L7.2422 20.8896H3.00001V16.6475L16.4356 3.21188ZM5.00001 17.4756V18.8896H6.41407L15.7276 9.57615L14.3135 8.16208L5.00001 17.4756ZM4.5293 1.3193C4.70583 0.893505 5.29418 0.893508 5.47071 1.3193L5.72364 1.93063C6.15555 2.97342 6.96155 3.80613 7.97462 4.2568L8.69239 4.57614C9.10267 4.75896 9.10262 5.35616 8.69239 5.53903L7.93263 5.87692C6.94497 6.3162 6.15339 7.11943 5.71387 8.1279L5.4668 8.69334C5.28636 9.10747 4.71366 9.10747 4.53321 8.69334L4.28614 8.1279C3.84661 7.11943 3.05506 6.3162 2.06739 5.87692L1.30762 5.53903C0.897483 5.35617 0.897435 4.75896 1.30762 4.57614L2.0254 4.2568C3.03845 3.80614 3.84446 2.97344 4.27637 1.93063L4.5293 1.3193ZM15.7276 6.74802L17.1426 8.16208L18.5567 6.74802L17.1426 5.33395L15.7276 6.74802Z',
  'M13 3.99982H11V8.99983C11 9.55212 10.5523 9.99983 10 9.99983H5V19.9999H19V9.99983H21V21.0077C21 21.5553 20.5552 21.9997 20.0068 21.9999H3.99316C3.44464 21.9997 3.00001 21.5498 3 20.993V7.99983L9 2.00275V1.99982H13V3.99982ZM5.8291 7.99983H9V4.83088L5.8291 7.99983ZM19.4707.329338C19.2943-.096459 18.7059-.0964476 18.5293.329338L18.2764.940667C17.8445 1.98348 17.0385 2.81618 16.0254 3.26684L15.3076 3.58618C14.8974 3.76899 14.8975 4.36621 15.3076 4.54907L16.0674 4.88696C17.0552 5.32629 17.8476 6.12931 18.2871 7.13794L18.5332 7.70337C18.7137 8.11751 19.2864 8.11751 19.4668 7.70337L19.7139 7.13794C20.1534 6.12947 20.945 5.32624 21.9326 4.88696L22.6924 4.54907C23.1026 4.3662 23.1027 3.769 22.6924 3.58618L21.9746 3.26684C20.9616 2.81618 20.1556 1.98346 19.7237.940667L19.4707.329338Z',
  'M12.0049 22.0027C6.48204 22.0027 2.00488 17.5256 2.00488 12.0027C2.00488 6.4799 6.48204 2.00275 12.0049 2.00275C17.5277 2.00275 22.0049 6.4799 22.0049 12.0027C22.0049 17.5256 17.5277 22.0027 12.0049 22.0027ZM12.0049 20.0027C16.4232 20.0027 20.0049 16.421 20.0049 12.0027C20.0049 7.58447 16.4232 4.00275 12.0049 4.00275C7.5866 4.00275 4.00488 7.58447 4.00488 12.0027C4.00488 16.421 7.5866 20.0027 12.0049 20.0027ZM12.0049 7.053L16.9546 12.0027L12.0049 16.9525L7.05514 12.0027L12.0049 7.053ZM12.0049 9.88143L9.88356 12.0027L12.0049 14.1241L14.1262 12.0027L12.0049 9.88143Z',
  'M4.7134 9.12811L4.46682 9.69379C4.28637 10.1079 3.71357 10.1079 3.53312 9.69379L3.28656 9.12811C2.84706 8.11947 2.05545 7.31641 1.06767 6.87708L0.308047 6.53922C-0.102682 6.35653 -0.102682 5.75881 0.308047 5.57612L1.0252 5.25714C2.03838 4.80651 2.84417 3.97373 3.27612 2.93083L3.52932 2.31953C3.70578 1.89349 4.29417 1.89349 4.47063 2.31953L4.72382 2.93083C5.15577 3.97373 5.96158 4.80651 6.9748 5.25714L7.69188 5.57612C8.10271 5.75881 8.10271 6.35653 7.69188 6.53922L6.93228 6.87708C5.94451 7.31641 5.15288 8.11947 4.7134 9.12811ZM1 19V12H3V18H15V6H10V4H16C16.5523 4 17 4.44772 17 5V9.2L22.2133 5.55071C22.4395 5.39235 22.7513 5.44737 22.9096 5.6736C22.9684 5.75764 23 5.85774 23 5.96033V18.0397C23 18.3158 22.7761 18.5397 22.5 18.5397C22.3974 18.5397 22.2973 18.5081 22.2133 18.4493L17 14.8V19C17 19.5523 16.5523 20 16 20H2C1.44772 20 1 19.5523 1 19ZM17 12.3587L21 15.1587V8.84131L17 11.6413V12.3587Z',
];



function Icon({ d, size = 14, color = '#6b7280', stroke = 1.8 }: { d: string; size?: number; color?: string; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}


const LIGHT = {
  base: '#f8fbf8', card: '#ffffff', raised: '#f3f6f4', line: '#e2f0e2',
  ink: '#0f172a', ink2: '#344E41', muted: '#6b7280', tertiary: '#9ca3af', iconMuted: '#5b6660',
  chrome: '#f5f5f7', chromeLine: '#e5e5ea', chromeText: '#3a3a3c',
};
const DARK = {
  base: '#0f1411', card: '#161a17', raised: '#1f2622', line: '#2a312c',
  ink: '#f0f4f1', ink2: '#f0f4f1', muted: '#9ca89e', tertiary: '#6b756d', iconMuted: '#9ca89e',
  chrome: '#1c1c1e', chromeLine: '#2c2c2e', chromeText: '#e5e5e7',
};

export function TimelineBrowser({ width = 1180, style, dark = false }: { width?: number; style?: CSSProperties; dark?: boolean }) {
  const t = dark ? DARK : LIGHT;
  return (
    <div
      style={{
        position: 'absolute',
        width,
        borderRadius: 14,
        overflow: 'hidden',
        background: t.card,
        boxShadow: '0 60px 100px -30px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.08)',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
        color: t.ink,
        fontSize: 13,
        ...style,
      }}
    >
      {/* Browser chrome */}
      <div style={{ height: 44, display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', background: t.chrome, borderBottom: `1px solid ${t.chromeLine}` }}>
        <span style={{ display: 'inline-flex', gap: 7 }}>
          {['#ff5f57', '#febc2e', '#28c840'].map((c) => <span key={c} style={{ width: 12, height: 12, borderRadius: '50%', background: c }} />)}
        </span>
        <span style={{ display: 'inline-flex', gap: 10, marginLeft: 8, color: '#8e8e93' }}>
          <Icon d="M15 18l-6-6 6-6" color="#8e8e93" /><Icon d="M9 18l6-6-6-6" color="#c7c7cc" />
        </span>
        <div style={{ flex: 1, maxWidth: 520, margin: '0 auto', height: 28, borderRadius: 8, background: t.card, border: `1px solid ${t.chromeLine}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, color: t.chromeText }}>
          <Icon d="M12 2a5 5 0 0 1 5 5v3H7V7a5 5 0 0 1 5-5zM5 10h14v12H5z" size={11} color="#8e8e93" />
          app.accordio.ai/time
        </div>
        <span style={{ width: 60 }} />
      </div>

      <div style={{ display: 'flex', background: t.base, height: 720 }}>
        {/* App sidebar rail — the web app's own Remix icons, Time active */}
        <div style={{ width: 60, padding: '14px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: t.card, borderRight: `1px solid ${t.line}` }}>
          <span style={{ marginBottom: 10 }}><BrandMark size={24} /></span>
          {SIDEBAR.map((d, i) => (
            <span
              key={i}
              style={{
                width: 40,
                height: 40,
                borderRadius: 999,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: i === 3 ? '#78D277' : 'transparent',
                boxShadow: i === 3 ? '0 0 0 4px rgba(120,210,119,0.22), 0 0 18px rgba(120,210,119,0.45)' : 'none',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill={i === 3 ? '#0f1411' : t.iconMuted} aria-hidden="true"><path d={d} /></svg>
            </span>
          ))}
        </div>

        <div style={{ flex: 1, minWidth: 0, padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Top controls bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 14px', background: t.card, border: `1px solid ${t.line}`, borderRadius: 12 }}>
            <div style={{ display: 'flex', gap: 2, padding: 3, borderRadius: 999, background: t.raised }}>
              {['Day', 'Week', 'Month'].map((label, i) => (
                <span key={label} style={{ padding: '6px 14px', borderRadius: 999, fontSize: 13, fontWeight: 500, background: i === 0 ? t.card : 'transparent', color: i === 0 ? t.ink : t.muted, boxShadow: i === 0 ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>{label}</span>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon d="M15 18l-6-6 6-6" />
              <span style={{ minWidth: 140, textAlign: 'center', fontWeight: 500, color: t.ink2 }}>Fri, 4 Sep 2026</span>
              <Icon d="M9 18l6-6-6-6" />
              <span style={{ height: 32, padding: '0 12px', borderRadius: 8, border: `1px solid ${t.line}`, display: 'inline-flex', alignItems: 'center', fontSize: 13 }}>Today</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ padding: '6px 12px', borderRadius: 8, background: t.raised, border: `1px solid ${t.line}`, fontWeight: 600, color: t.ink2 }}>
                6h 12m <span style={{ color: '#d1d5db', fontWeight: 400 }}> - </span><span style={{ color: '#78D277' }}>$744</span>
              </span>
              <Icon d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" size={18} />
              <Icon d="M3 3v18h18M7 14l4-4 4 4 5-6" size={18} />
              <span style={{ height: 32, padding: '0 14px', borderRadius: 999, background: 'linear-gradient(135deg, #8fe08a, #3E8A47)', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 500, fontSize: 13 }}>+ Log time</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>
            {/* Timesheet column — project group cards, as the web app draws them */}
            <div style={{ width: 340, flex: 'none', display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '2px 4px 0' }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: t.ink2 }}>Today</span>
                <span style={{ fontSize: 12, color: t.muted }}>6h 12m <span style={{ color: '#d1d5db' }}>·</span> <span style={{ color: '#78D277', fontWeight: 600 }}>$744</span></span>
              </div>
              {ENTRIES.map((e) => {
                const minH = Math.max(64, Math.min(150, 60 + (e.minutes / 60) * 28));
                const dim = e.ink === t.card ? 'rgba(255,255,255,0.75)' : 'rgba(5,46,22,0.7)';
                return (
                  <div key={e.project} style={{ flex: 'none', borderRadius: 12, border: `1px solid ${t.line}`, overflow: 'hidden', background: t.card }}>
                    <div style={{ minHeight: minH, padding: '12px 16px', background: e.color, color: e.ink, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3 }}>{e.desc}</div>
                        <div style={{ fontSize: 12, marginTop: 2, color: dim }}>{e.client}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                          <span style={{ fontSize: 18, fontWeight: 700 }}>{e.dur}</span>
                          <span style={{ fontSize: 12, fontWeight: 500, opacity: 0.8 }}>{e.earn}</span>
                        </div>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: 0.55 }}>
                          <Icon d="M12 3a9 9 0 1 0 9 9M12 7v5l3 2" size={14} color={e.ink} />
                          <Icon d="m6 9 6 6 6-6" size={14} color={e.ink} />
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: t.muted }}>
                        <Icon d="m9 18 6-6-6-6" size={12} color="#9ca3af" />
                        1 entry
                      </span>
                      <span style={{ fontSize: 11, color: t.tertiary, fontVariantNumeric: 'tabular-nums' }}>{e.from} – {e.to}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Timeline panel */}
            <div style={{ flex: 1, minWidth: 0, background: t.card, border: `1px solid ${t.line}`, borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '10px 16px', borderBottom: `1px solid ${t.line}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 11, color: t.tertiary, fontWeight: 500 }}>Budapest</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: t.ink }}>
                    <Icon d="M12 2a7 7 0 0 1 7 7c0 3-2 5-3 6.5V17H8v-1.5C7 14 5 12 5 9a7 7 0 0 1 7-7zM9 21h6" size={15} color="#78D277" />
                    <span style={{ fontWeight: 500 }}>Your Memories</span>
                    <span style={{ fontSize: 12, color: t.tertiary, marginLeft: 4 }}>7h 04m</span>
                  </span>
                </div>
                <div style={{ display: 'inline-flex', border: `1px solid ${t.line}`, borderRadius: 8, overflow: 'hidden' }}>
                  <span style={{ padding: 8, background: '#e8f5e6' }}><Icon d="M12 2 2 7l10 5 10-5zM2 12l10 5 10-5M2 17l10 5 10-5" size={15} color="#344E41" /></span>
                  <span style={{ padding: 8 }}><Icon d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" size={15} /></span>
                </div>
              </div>

              <div style={{ position: 'relative', flex: 1, margin: '12px 0 0', height: RAIL_H }}>
                {/* Hour lines + labels */}
                {Array.from({ length: RANGE + 1 }, (_, i) => START + i).map((h) => (
                  <div key={h} style={{ position: 'absolute', left: 0, right: 0, top: `${pct(h)}%`, display: 'flex', alignItems: 'flex-start' }}>
                    <span style={{ width: 48, textAlign: 'right', paddingRight: 8, marginTop: -6, fontSize: 10, color: t.tertiary, flex: 'none' }}>{h > 12 ? `${h - 12} PM` : h === 12 ? '12 PM' : `${h} AM`}</span>
                    <div style={{ flex: 1, borderTop: `1px solid ${t.line}` }} />
                  </div>
                ))}
                {/* now line */}
                <div style={{ position: 'absolute', left: 48, right: 0, top: `${NOW}%`, height: 2, background: '#ef4444', zIndex: 15 }} />
                {/* logged entry bars */}
                <div style={{ position: 'absolute', left: 48, width: 36, top: 0, bottom: 0, zIndex: 10 }}>
                  {ENTRIES.map((e) => (
                    <div key={e.project} style={{ position: 'absolute', left: 0, right: 0, top: `${e.top}%`, height: `${e.h}%`, borderRadius: 6, background: e.color, opacity: 0.85 }}>
                      <span style={{ position: 'absolute', top: 3, left: 4, fontSize: 7, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>{e.from}</span>
                      <span style={{ position: 'absolute', bottom: 3, left: 4, fontSize: 7, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>{e.to}</span>
                    </div>
                  ))}
                </div>
                {/* selected band for the first entry */}
                <div style={{ position: 'absolute', left: 92, right: 0, top: `${ENTRIES[0].top}%`, height: `${ENTRIES[0].h}%`, background: `${ENTRIES[0].color}12`, borderLeft: `2px solid ${ENTRIES[0].color}40`, borderRadius: 8, zIndex: 5 }} />
                {/* memory rows */}
                <div style={{ position: 'absolute', left: 92, right: 12, top: 0, bottom: 0 }}>
                  {MEMORIES.map((block, bi) => (
                    <div key={bi} style={{ position: 'absolute', left: 0, right: 0, top: `${block.top}%` }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px', padding: '4px 8px' }}>
                        {block.apps.map((a) => (
                          <div key={a.app} style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', gap: 6, minWidth: 0 }}>
                            <div style={{ position: 'relative', width: 28, flex: 'none' }}>
                              {a.pill > 0 && <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: 0, width: 28, height: a.pill, borderRadius: 999, background: a.color[0], border: `1px solid ${a.color[1]}` }} />}
                              <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}><AppTile name={a.app} size={24} dark={dark} /></div>
                              {a.count && a.count > 1 && (
                                <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 14, height: 14, padding: '0 3px', borderRadius: 999, background: t.ink, color: '#fff', fontSize: 9, fontWeight: 500, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{a.count}</span>
                              )}
                            </div>
                            <div style={{ minWidth: 0, paddingTop: 2 }}>
                              <span style={{ display: 'block', fontSize: 12, fontWeight: 500, color: t.ink, whiteSpace: 'nowrap' }}>{a.app}</span>
                              {a.project && <span style={{ display: 'block', fontSize: 10, color: t.muted, whiteSpace: 'nowrap' }}>{a.project}</span>}
                              <span style={{ fontSize: 10, color: t.tertiary }}>{a.dur}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
