import { parseShortcut } from './mockups/brand';

/** Bottom-of-screen card after setup: the one thing to remember. */
export function HotkeyHint({ shortcut }: { shortcut: string }) {
  const keys = parseShortcut(shortcut || 'CommandOrControl+Shift+A');
  return (
    <div className="ob-float">
      <div className="ob-hint-card">
        <div className="ob-hint-title">Open Accordio any time</div>
        <div className="ob-hint-sub">Use the hotkey to open the menu bar app</div>
        <div className="ob-hint-keys">
          {keys.map((k) => (
            <span key={k.key} className="ob-hint-key">
              <b>{k.symbol}</b>
              {k.label && <span>{k.label === 'command' ? 'cmd' : k.label}</span>}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
