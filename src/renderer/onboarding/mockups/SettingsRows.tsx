import { AppIcon } from './brand';

/**
 * The System Settings privacy list, oversized and lit like a product render:
 * a raised dark slab, bevelled icon tiles, recessed label pills and toggles
 * with a real knob. Accordio's own row flips green the moment macOS reports
 * the grant.
 */
export function SettingsRowsMockup({ accordioOn }: { accordioOn: boolean }) {
  const rows: Array<{ key: string; on: boolean; icon: 'generic' | 'accordio' }> = [
    { key: 'a', on: true, icon: 'generic' },
    { key: 'b', on: true, icon: 'generic' },
    { key: 'accordio', on: accordioOn, icon: 'accordio' },
  ];
  return (
    <div
      style={{
        position: 'absolute',
        left: 92,
        top: -34,
        width: 560,
        borderRadius: 26,
        background: 'linear-gradient(180deg, #232826 0%, #1b1f1d 55%, #171a18 100%)',
        boxShadow:
          '0 50px 90px -30px rgba(0,0,0,0.95), 0 20px 40px -20px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.07)',
        overflow: 'hidden',
      }}
    >
      {rows.map((r, i) => (
        <div
          key={r.key}
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: 30,
            height: 152,
            padding: '0 76px 0 36px',
            borderTop: i === 0 ? 'none' : '1px solid rgba(0,0,0,0.45)',
            boxShadow: i === 0 ? 'none' : 'inset 0 1px 0 rgba(255,255,255,0.045)',
          }}
        >
          {r.icon === 'accordio' ? (
            <span style={{ display: 'inline-flex', filter: 'drop-shadow(0 14px 18px rgba(0,0,0,0.55)) drop-shadow(0 0 22px rgba(120,210,119,0.25))' }}>
              <AppIcon size={86} />
            </span>
          ) : (
            <span
              style={{
                width: 84,
                height: 84,
                borderRadius: 22,
                background: 'linear-gradient(160deg, #3b403d 0%, #2b2f2d 60%, #242826 100%)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -2px 4px rgba(0,0,0,0.35), 0 12px 22px -12px rgba(0,0,0,0.8)',
                flex: 'none',
              }}
            />
          )}

          {/* recessed label pill */}
          <span
            style={{
              width: 176,
              height: 46,
              borderRadius: 23,
              background: 'linear-gradient(180deg, #2a2e2c 0%, #303432 100%)',
              boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.5), inset 0 -1px 0 rgba(255,255,255,0.05)',
            }}
          />
          <span style={{ flex: 1 }} />

          {/* toggle */}
          <span
            style={{
              position: 'relative',
              width: 98,
              height: 52,
              borderRadius: 26,
              flex: 'none',
              background: r.on
                ? 'linear-gradient(180deg, #8ee28c 0%, #62c05f 100%)'
                : 'linear-gradient(180deg, #2a2e2c 0%, #343836 100%)',
              boxShadow: r.on
                ? 'inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -2px 4px rgba(0,0,0,0.18), 0 0 26px rgba(120,210,119,0.5), 0 10px 20px -12px rgba(0,0,0,0.7)'
                : 'inset 0 2px 5px rgba(0,0,0,0.55), inset 0 -1px 0 rgba(255,255,255,0.05)',
              transition: 'background 0.35s ease, box-shadow 0.35s ease',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: 4,
                left: 4,
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: r.on
                  ? 'radial-gradient(circle at 35% 30%, #ffffff 0%, #eef5ee 60%, #d9e6da 100%)'
                  : 'radial-gradient(circle at 35% 30%, #f4f4f4 0%, #dcdcdc 60%, #c4c4c4 100%)',
                boxShadow: '0 4px 10px rgba(0,0,0,0.45), 0 1px 2px rgba(0,0,0,0.4), inset 0 -2px 3px rgba(0,0,0,0.08)',
                transform: r.on ? 'translateX(46px)' : 'translateX(0)',
                transition: 'transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1)',
              }}
            />
          </span>
        </div>
      ))}
      <div style={{ height: 110, background: 'linear-gradient(180deg, #171a18 0%, #141715 100%)', borderTop: '1px solid rgba(0,0,0,0.45)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }} />
    </div>
  );
}
