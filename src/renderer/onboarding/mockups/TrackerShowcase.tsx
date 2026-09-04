import { useEffect, useState } from 'react';
import { BrandMark } from './brand';

/**
 * The time page's "It watches your workflow. You do nothing." asset, ported
 * from the marketing site (components/landing/MacTrackerShowcase.tsx): the
 * popover on the Tracker tab with Working Now cycling through apps, and a
 * macOS dock underneath where the tracked app lifts as focus moves. Loops
 * forever; no scroll gating here.
 */

const APP = {
  primary: '#78D277',
  bgBase: '#0f1411',
  bgCard: '#1a1f1c',
  textPrimary: '#f0f4f1',
  textSecondary: '#9ca89e',
  textTertiary: '#6b756d',
  borderSoft: '#2a312c',
  success: '#22c55e',
};

const favicon = (domain: string) => `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

const TRACKED_APPS = [
  { name: 'Cursor', domain: 'cursor.com', window: 'auth.tsx — accordio', badge: 'Dev', badgeColor: '#3b82f6' },
  { name: 'Figma', domain: 'figma.com', window: 'Mobile App / Wireframes', badge: 'Design', badgeColor: '#ec4899' },
  { name: 'Slack', domain: 'slack.com', window: 'Acme Inc / #client-acme', badge: 'Chat', badgeColor: '#8b5cf6' },
  { name: 'Google Chrome', domain: 'google.com/chrome', window: 'React docs - Hooks', badge: 'Research', badgeColor: '#6366f1' },
];

const DOCK_APPS = [
  { name: 'Finder', domain: 'apple.com', tracked: false },
  { name: 'Cursor', domain: 'cursor.com', tracked: true },
  { name: 'Figma', domain: 'figma.com', tracked: true },
  { name: 'Google Chrome', domain: 'google.com/chrome', tracked: true },
  { name: 'Slack', domain: 'slack.com', tracked: true },
  { name: 'Notion', domain: 'notion.so', tracked: false },
  { name: 'Linear', domain: 'linear.app', tracked: false },
  { name: 'Mail', domain: 'mail.google.com', tracked: false },
];

function HubAppIcon({ domain, name, size = 20 }: { domain: string; name: string; size?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: size, height: size, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)' }}>
      <img src={favicon(domain)} alt={name} width={Math.round(size * 0.8)} height={Math.round(size * 0.8)} draggable={false} style={{ borderRadius: size > 20 ? 4 : 2, objectFit: 'contain' }} />
    </div>
  );
}

export function TrackerShowcase() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % TRACKED_APPS.length), 2400);
    return () => clearInterval(t);
  }, []);
  const current = TRACKED_APPS[idx];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif" }}>
      <div style={{ position: 'relative', width: 400 }}>
        <div style={{ position: 'absolute', left: '50%', top: -5, width: 11, height: 11, transform: 'translateX(-50%) rotate(45deg)', backgroundColor: APP.bgBase, borderTop: '1px solid rgba(255,255,255,0.08)', borderLeft: '1px solid rgba(255,255,255,0.08)' }} />
        <div style={{ position: 'relative', overflow: 'hidden', backgroundColor: APP.bgBase, borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 28px 64px -16px rgba(0,0,0,0.75), inset 0 1px 0 0 rgba(255,255,255,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px 6px' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 2, padding: 3, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 999 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', fontSize: 12, fontWeight: 500, color: APP.textSecondary, borderRadius: 999 }}>
                <BrandMark size={13} color={APP.textSecondary} />
                Agent
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', fontSize: 12, fontWeight: 500, color: '#fff', borderRadius: 999, background: 'linear-gradient(135deg, hsl(120, 47%, 65%) 0%, hsl(142, 69%, 58%) 100%)', border: '1px solid rgba(255,255,255,0.2)', boxShadow: '0 4px 12px rgba(120,210,119,0.3), 0 2px 6px rgba(120,210,119,0.2)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                Tracker
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, color: APP.textTertiary }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 1L21.5 6.5V17.5L12 23L2.5 17.5V6.5L12 1ZM12 3.311L4.5 7.653V16.347L12 20.689L19.5 16.347V7.653L12 3.311ZM12 16C9.79 16 8 14.21 8 12S9.79 8 12 8S16 9.79 16 12S14.21 16 12 16ZM12 14C13.105 14 14 13.105 14 12S13.105 10 12 10S10 10.895 10 12S10.895 14 12 14Z" /></svg>
            </div>
          </div>

          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: APP.bgCard, border: `1px solid ${APP.borderSoft}`, borderRadius: 8, padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, fontWeight: 500, color: APP.textSecondary }}>
                <span>Working Now</span>
                <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: 'rgba(34,197,94,0.15)', color: APP.success }}>Auto</span>
              </div>
              <div style={{ margin: '10px 0 0' }}>
                <div style={{ padding: 10, background: 'rgba(34,197,94,0.08)', borderRadius: 8 }}>
                  <div key={idx} className="ob-track-appear" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <HubAppIcon domain={current.domain} name={current.name} size={20} />
                    <span style={{ fontSize: 15, fontWeight: 500, color: APP.textPrimary }}>{current.name}</span>
                    <span style={{ backgroundColor: `${current.badgeColor}20`, color: current.badgeColor, padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 500 }}>{current.badge}</span>
                  </div>
                  <div style={{ fontSize: 12, color: APP.textSecondary, paddingLeft: 16 }}>{current.window}</div>
                </div>
              </div>
            </div>

            <div style={{ background: APP.bgCard, border: `1px solid ${APP.borderSoft}`, borderRadius: 8, padding: '12px 16px' }}>
              <div style={{ marginBottom: 12, textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.5px', color: APP.textTertiary, fontWeight: 500 }}>Work Hours</div>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 12, color: APP.textTertiary }}>Total time worked</span>
                  <span style={{ fontSize: 14, fontWeight: 500, color: APP.textSecondary }}>
                    <span style={{ fontSize: 28, fontWeight: 600, color: APP.textPrimary, letterSpacing: '-1px' }}>5</span> hr <span style={{ fontSize: 28, fontWeight: 600, color: APP.textPrimary, letterSpacing: '-1px' }}>30</span> min
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <span style={{ fontSize: 12, color: APP.textTertiary }}>Percent of work day</span>
                  <span style={{ fontSize: 14, color: APP.textSecondary }}>
                    <span style={{ fontSize: 20, fontWeight: 600, color: APP.primary }}>68%</span>
                    <span style={{ fontSize: 12, color: APP.textTertiary }}> of 8 hr</span>
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTop: `1px solid ${APP.borderSoft}` }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', gap: 6, fontSize: 11 }}><span style={{ color: APP.textTertiary }}>Tracking:</span><span style={{ color: APP.textSecondary, fontWeight: 500 }}>On</span></div>
                  <div style={{ display: 'flex', gap: 6, fontSize: 11 }}><span style={{ color: APP.textTertiary }}>This week:</span><span style={{ color: APP.textSecondary, fontWeight: 500 }}>23h 31m</span></div>
                </div>
                <span style={{ padding: '8px 16px', borderRadius: 20, border: `1px solid ${APP.borderSoft}`, color: APP.textSecondary, fontSize: 12, fontWeight: 500 }}>Disable Tracking</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* macOS dock — the tracked app lifts as focus moves */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 9, padding: '7px 10px', borderRadius: 18, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 16px 40px -12px rgba(0,0,0,0.6), inset 0 1px 0 0 rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)' }}>
        {DOCK_APPS.map((app) => {
          const isCurrent = app.name === current.name;
          return (
            <div key={app.name} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', transform: isCurrent ? 'translateY(-8px) scale(1.16)' : 'translateY(0) scale(1)', transition: 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 9, background: 'rgba(255,255,255,0.1)' }}>
                <img src={favicon(app.domain)} alt={app.name} width={24} height={24} draggable={false} style={{ borderRadius: 5, objectFit: 'contain' }} />
              </div>
              <span style={{ position: 'absolute', bottom: -7, width: 3, height: 3, borderRadius: 999, background: isCurrent ? APP.primary : 'rgba(255,255,255,0.4)', opacity: isCurrent || app.tracked ? 1 : 0, transition: 'background 0.3s' }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
