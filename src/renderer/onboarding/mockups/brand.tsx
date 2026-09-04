/**
 * Brand pieces shared by the setup mockups: the quill + sparkle mark and the
 * squircle app icon built from the same three layers the macOS icon uses
 * (design/icon-layers). Everything is vector so it stays crisp at any size.
 */

interface MarkProps {
  size?: number;
  color?: string;
  className?: string;
}

/** Feather + sparkle, cropped to the mark's bounding box. */
export function BrandMark({ size = 24, color = '#78D277', className }: MarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="-0.5 -0.4 23.6 23.6"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M18.8895 6.35089C19.9703 5.25889 21.051 3.65114 22.614 0.553286C22.7438 0.296005 22.5463 -0.00675025 22.2582 0.000114645C5.94642 0.388808 3.50628 15.7476 2.35542 22.7695C2.32533 22.9531 2.46801 23.1137 2.65404 23.1137H4.34255C4.48513 23.1137 4.60805 23.0128 4.63963 22.8738C5.47266 19.2066 7.43961 17.0949 10.4636 16.7554C14.8779 16.1978 18.0833 12.4139 19.3318 9.03408C19.4068 8.83097 19.2928 8.60966 19.0863 8.54442L17.7503 8.12218C17.5351 8.0542 17.4682 7.78261 17.6272 7.62248L18.8895 6.35089Z"
        fill={color}
      />
      <path
        d="M3.31802 0.421664C3.46542 0.15216 3.85248 0.152161 3.99988 0.421665L4.2277 0.838221C4.79826 1.88144 5.65599 2.73918 6.69922 3.30973L7.11577 3.53756C7.38528 3.68495 7.38527 4.07202 7.11577 4.21942L6.69921 4.44724C5.65599 5.0178 4.79826 5.87553 4.2277 6.91875L3.99988 7.33531C3.85248 7.60481 3.46542 7.60481 3.31802 7.33531L3.0902 6.91875C2.51964 5.87553 1.66191 5.0178 0.618684 4.44724L0.202128 4.21942C-0.0673762 4.07202 -0.0673758 3.68495 0.202128 3.53755L0.618685 3.30973C1.66191 2.73918 2.51964 1.88144 3.0902 0.83822L3.31802 0.421664Z"
        fill={color}
      />
    </svg>
  );
}

interface AppIconProps {
  size?: number;
  className?: string;
}

/**
 * The shipped macOS app icon — the same PNG the marketing site's download
 * hero shows (public/landing/macos-app-icon.png), not a redraw. The PNG
 * already carries the squircle, glass and shadow, so it sits on any surface.
 */
export function AppIcon({ size = 64, className }: AppIconProps) {
  return (
    <img
      src="./macos-app-icon.png"
      alt=""
      width={size}
      height={size}
      draggable={false}
      className={className}
      style={{ width: size, height: size, display: 'block', objectFit: 'contain' }}
      aria-hidden="true"
    />
  );
}

/** ⌘ / ⇧ / letter keycap used in the walkthrough and the hotkey card. */
export function KeyCap({
  symbol,
  label,
  size = 96,
  lit = true,
}: {
  symbol: string;
  label?: string;
  size?: number;
  lit?: boolean;
}) {
  return (
    <div
      className="ob-keycap"
      style={{
        width: size * 1.35,
        height: size,
        opacity: lit ? 1 : 0.45,
        borderRadius: size * 0.14,
      }}
    >
      <span className="ob-keycap-sym" style={{ fontSize: size * 0.22 }}>{symbol}</span>
      {label && <span className="ob-keycap-label" style={{ fontSize: size * 0.17 }}>{label}</span>}
    </div>
  );
}

/** "CommandOrControl+Shift+A" → [{symbol:'⌘', label:'command'}, …] */
export function parseShortcut(accelerator: string): { symbol: string; label: string; key: string }[] {
  const map: Record<string, { symbol: string; label: string }> = {
    commandorcontrol: { symbol: '⌘', label: 'command' },
    cmdorctrl: { symbol: '⌘', label: 'command' },
    command: { symbol: '⌘', label: 'command' },
    cmd: { symbol: '⌘', label: 'command' },
    control: { symbol: '⌃', label: 'control' },
    ctrl: { symbol: '⌃', label: 'control' },
    shift: { symbol: '⇧', label: 'shift' },
    alt: { symbol: '⌥', label: 'option' },
    option: { symbol: '⌥', label: 'option' },
    space: { symbol: '␣', label: 'space' },
  };
  return accelerator
    .split('+')
    .filter(Boolean)
    .map((part) => {
      const entry = map[part.toLowerCase()];
      if (entry) return { ...entry, key: entry.label };
      return { symbol: part.toUpperCase(), label: '', key: part.toUpperCase() };
    });
}

export function shortcutGlyphs(accelerator: string): string {
  return parseShortcut(accelerator).map((k) => k.symbol).join('');
}
