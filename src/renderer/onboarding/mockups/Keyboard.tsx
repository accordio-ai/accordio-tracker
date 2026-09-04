/**
 * The bottom-left corner of a Mac keyboard, dimmed except for the keys that
 * make up the global shortcut.
 */

type Key = { key: string; top?: string; main: string; w?: number; align?: 'left' | 'center' };

const ROWS: Key[][] = [
  [
    { key: 'esc', main: 'esc', w: 1.55, align: 'left' },
    { key: 'F1', top: '☼', main: 'F1' },
    { key: 'F2', top: '☀', main: 'F2' },
    { key: 'F3', top: '⊞', main: 'F3' },
    { key: 'F4', top: '⌕', main: 'F4' },
    { key: 'F5', top: '🎙', main: 'F5' },
  ],
  [
    { key: '§', top: '±', main: '§' },
    { key: '1', top: '!', main: '1' },
    { key: '2', top: '@', main: '2' },
    { key: '3', top: '#', main: '3' },
    { key: '4', top: '$', main: '4' },
    { key: '5', top: '%', main: '5' },
  ],
  [
    { key: 'tab', main: '⇥', w: 1.55, align: 'left' },
    { key: 'Q', main: 'Q' },
    { key: 'W', main: 'W' },
    { key: 'E', main: 'E' },
    { key: 'R', main: 'R' },
    { key: 'T', main: 'T' },
  ],
  [
    { key: 'caps', top: '•', main: '⇪', w: 1.85, align: 'left' },
    { key: 'A', main: 'A' },
    { key: 'S', main: 'S' },
    { key: 'D', main: 'D' },
    { key: 'F', main: 'F' },
    { key: 'G', main: 'G' },
  ],
  [
    { key: 'shift', main: '⇧', w: 1.35, align: 'left' },
    { key: '`', top: '~', main: '`' },
    { key: 'Z', main: 'Z' },
    { key: 'X', main: 'X' },
    { key: 'C', main: 'C' },
    { key: 'V', main: 'V' },
  ],
  [
    { key: 'fn', top: 'fn', main: '🌐' },
    { key: 'control', top: '^', main: 'control' },
    { key: 'option', top: '⌥', main: 'option' },
    { key: 'command', top: '⌘', main: 'command', w: 1.25 },
  ],
];

export function KeyboardMockup({ highlight }: { highlight: string[] }) {
  const unit = 82;
  const gap = 8;
  const lit = new Set(highlight.map((k) => k.toLowerCase()));
  return (
    <div
      style={{
        position: 'absolute',
        left: 110,
        top: 118,
        width: 760,
        padding: 22,
        borderRadius: 28,
        background: 'linear-gradient(180deg, #1c211e 0%, #131715 60%, #0f1311 100%)',
        boxShadow:
          '0 50px 90px -30px rgba(0,0,0,0.95), 0 20px 40px -20px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -3px 8px rgba(0,0,0,0.5)',
      }}
    >
      {ROWS.map((row, ri) => (
        <div key={ri} style={{ display: 'flex', gap, marginBottom: ri === ROWS.length - 1 ? 0 : gap + 4 }}>
          {row.map((k) => {
            const on = lit.has(k.key.toLowerCase());
            const w = unit * (k.w ?? 1) + gap * ((k.w ?? 1) - 1);
            const isMod = k.key === 'command' || k.key === 'option' || k.key === 'control' || k.key === 'fn';
            return (
              <div
                key={k.key}
                style={{
                  width: w,
                  height: unit,
                  borderRadius: 12,
                  background: on
                    ? 'linear-gradient(180deg, #3a423d 0%, #262d29 55%, #1f2622 100%)'
                    : 'linear-gradient(180deg, #1f2422 0%, #171b19 60%, #141816 100%)',
                  boxShadow: on
                    ? '0 6px 0 #0b0f0c, 0 14px 24px -10px rgba(0,0,0,0.8), 0 0 44px -4px rgba(120,210,119,0.5), 0 0 0 1px rgba(255,255,255,0.16), inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -2px 4px rgba(0,0,0,0.35)'
                    : '0 5px 0 #0a0d0b, 0 10px 18px -10px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -2px 4px rgba(0,0,0,0.4)',
                  color: on ? '#ffffff' : 'rgba(255,255,255,0.3)',
                  textShadow: on ? '0 0 12px rgba(120,210,119,0.6)' : '0 1px 0 rgba(0,0,0,0.6)',
                  transform: on ? 'translateY(-2px)' : 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: k.align === 'left' ? 'flex-start' : 'center',
                  justifyContent: isMod || k.top ? 'space-between' : 'center',
                  padding: k.align === 'left' ? '12px 14px' : '12px 10px',
                  fontSize: isMod ? 16 : 20,
                  fontWeight: 500,
                  transition: 'all 0.3s ease',
                  flex: 'none',
                }}
              >
                {k.top && <span style={{ fontSize: isMod ? 18 : 14, alignSelf: k.align === 'left' ? 'flex-start' : 'flex-end', opacity: on ? 0.9 : 0.8 }}>{k.top}</span>}
                <span style={{ fontSize: isMod ? 15 : undefined }}>{k.main}</span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
