import { BrandMark } from './brand';

/**
 * Three fanned cards; the front one is the "first moment": a menu bar with a
 * timer that has just started, and a note over it.
 */
export function StackedCards() {
  const card = (rot: number, bg: string, z: number, offset: number) => ({
    position: 'absolute' as const,
    left: 40 + offset,
    top: 30,
    width: 300,
    height: 176,
    borderRadius: 18,
    background: bg,
    transform: `rotate(${rot}deg)`,
    transformOrigin: '50% 60%',
    boxShadow: '0 24px 40px -22px rgba(26,31,28,0.5), 0 0 0 1px rgba(26,31,28,0.05)',
    zIndex: z,
  });
  return (
    <div style={{ position: 'relative', width: 380, height: 250, margin: '8px auto 0' }}>
      <div style={card(-16, 'linear-gradient(135deg, #ffd6a8 0%, #f2a35a 100%)', 1, 0)} />
      <div style={card(-8, 'linear-gradient(135deg, #a9e0a4 0%, #3e8a47 100%)', 2, 8)} />
      <div style={{ ...card(0, '#ffffff', 3, 16), padding: 10 }}>
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            borderRadius: 12,
            overflow: 'hidden',
            background: 'radial-gradient(90% 70% at 20% 10%, #d8f3d6 0%, #9fdc9c 45%, #3e8a47 100%)',
          }}
        >
          {/* tiny menu bar */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 20, background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', padding: '0 8px', gap: 7, fontSize: 8, fontWeight: 600, color: 'rgba(0,0,0,0.8)' }}>
            <span>Accordio</span>
            <span style={{ fontWeight: 400 }}>Track</span>
            <span style={{ flex: 1 }} />
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 6px', borderRadius: 4, background: 'rgba(52,78,65,0.14)', color: '#2f5a3b', fontVariantNumeric: 'tabular-nums' }}>
              <BrandMark size={8} color="#3E8A47" />
              0:00:07
            </span>
          </div>
          {/* note bubble */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: 62,
              transform: 'translateX(-50%)',
              padding: '8px 14px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.82)',
              color: '#1a1f1c',
              fontSize: 12,
              fontWeight: 500,
              whiteSpace: 'nowrap',
              boxShadow: '0 8px 20px -10px rgba(0,0,0,0.3)',
            }}
          >
            My first tracked hour 🎉
          </div>
          {/* dock */}
          <div style={{ position: 'absolute', left: '50%', bottom: 10, transform: 'translateX(-50%)', display: 'flex', gap: 6, padding: 5, borderRadius: 12, background: 'rgba(255,255,255,0.35)', backdropFilter: 'blur(10px)' }}>
            {['#2d7cf6', '#78D277', '#f2a35a', '#e5e7eb'].map((c, i) => (
              <span key={i} style={{ width: 26, height: 26, borderRadius: 7, background: c, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                {i === 1 && <BrandMark size={14} color="#ffffff" />}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
