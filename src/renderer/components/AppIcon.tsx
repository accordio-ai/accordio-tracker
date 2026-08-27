import { useState, useEffect } from 'react';

interface AppIconProps {
  appPath?: string;
  appName: string;
  url?: string; // For browser tabs - show favicon instead
  size?: number;
  className?: string;
}

// Cache icons in memory to avoid repeated IPC calls
const iconCache = new Map<string, string>();

// Browser app names for favicon handling
export const browserApps = [
  'Safari', 'Google Chrome', 'Chrome', 'Firefox', 'Microsoft Edge',
  'Brave Browser', 'Brave', 'LibreWolf', 'Tor Browser', 'Mullvad Browser', 'Waterfox', 'Helium',
  'Arc', 'Vivaldi', 'Opera', 'Opera GX', 'Wavebox', 'Sidekick', 'Shift', 'SigmaOS', 'Stack',
  'Zen Browser', 'Dia', 'Orion', 'Comet', 'Floorp',
  'Firefox Developer Edition', 'Safari Technology Preview', 'Polypane',
  'Chromium', 'Min',
];

// Extract domain from URL for favicon
export function getDomainFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return null;
  }
}

// Get favicon URL using Google's favicon service
function getFaviconUrl(domain: string, size: number = 32): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;
}

// Get category from app name
function getCategoryFromAppName(appName: string): string {
  const appLower = appName.toLowerCase();

  const categories: Record<string, string[]> = {
    development: ['code', 'cursor', 'xcode', 'terminal', 'iterm', 'sublime', 'webstorm', 'intellij', 'pycharm', 'android studio', 'vim', 'neovim'],
    design: ['figma', 'sketch', 'photoshop', 'illustrator', 'affinity', 'canva', 'framer'],
    communication: ['slack', 'discord', 'teams', 'zoom', 'skype', 'messages', 'mail', 'outlook', 'telegram', 'whatsapp'],
    productivity: ['notion', 'obsidian', 'notes', 'bear', 'evernote', 'things', 'todoist', 'linear', 'asana', 'jira', 'calendar'],
    browsers: ['safari', 'chrome', 'firefox', 'arc', 'brave', 'edge', 'opera', 'dia'],
    entertainment: ['spotify', 'music', 'netflix', 'youtube', 'vlc', 'plex'],
  };

  for (const [category, apps] of Object.entries(categories)) {
    if (apps.some(app => appLower.includes(app))) {
      return category;
    }
  }
  return 'other';
}

// SVG icons for each category
function CategoryIcon({ category, size }: { category: string; size: number }) {
  const iconSize = Math.round(size * 0.6);

  switch (category) {
    case 'development':
      return (
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 12L18.3 17.7L16.89 16.29L21.17 12L16.89 7.71L18.3 6.3L24 12ZM0 12L5.7 6.3L7.11 7.71L2.83 12L7.11 16.29L5.7 17.7L0 12ZM9.17 19.5L7.83 18.87L14.83 4.5L16.17 5.13L9.17 19.5Z"/>
        </svg>
      );
    case 'design':
      return (
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 22C6.49 22 2 17.51 2 12S6.49 2 12 2s10 4.04 10 9c0 3.31-2.69 6-6 6h-1.77c-.28 0-.5.22-.5.5 0 .12.05.23.13.33.41.47.64 1.06.64 1.67A2.5 2.5 0 0 1 12 22zm0-18c-4.41 0-8 3.59-8 8s3.59 8 8 8c.28 0 .5-.22.5-.5a.54.54 0 0 0-.14-.35c-.41-.46-.63-1.05-.63-1.65a2.5 2.5 0 0 1 2.5-2.5H16c2.21 0 4-1.79 4-4 0-3.86-3.59-7-8-7z"/>
          <circle cx="6.5" cy="11.5" r="1.5"/>
          <circle cx="9.5" cy="7.5" r="1.5"/>
          <circle cx="14.5" cy="7.5" r="1.5"/>
          <circle cx="17.5" cy="11.5" r="1.5"/>
        </svg>
      );
    case 'communication':
      return (
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
        </svg>
      );
    case 'productivity':
      return (
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 10h2v7H7zm4-3h2v10h-2zm4 6h2v4h-2z"/>
        </svg>
      );
    case 'browsers':
      return (
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
        </svg>
      );
    case 'entertainment':
      return (
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
        </svg>
      );
    default:
      return (
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="currentColor">
          <path d="M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm0 2v10h16V7H4z"/>
        </svg>
      );
  }
}

// Known app paths for macOS (used when appPath is not provided)
const knownAppPaths: Record<string, string> = {
  // Code editors
  'Code': '/Applications/Visual Studio Code.app',
  'Visual Studio Code': '/Applications/Visual Studio Code.app',
  'Cursor': '/Applications/Cursor.app',
  'Xcode': '/Applications/Xcode.app',
  'Sublime Text': '/Applications/Sublime Text.app',
  'WebStorm': '/Applications/WebStorm.app',
  'IntelliJ IDEA': '/Applications/IntelliJ IDEA.app',
  'PyCharm': '/Applications/PyCharm.app',
  'Android Studio': '/Applications/Android Studio.app',
  'Nova': '/Applications/Nova.app',
  'BBEdit': '/Applications/BBEdit.app',
  'TextMate': '/Applications/TextMate.app',

  // Terminals
  'Terminal': '/System/Applications/Utilities/Terminal.app',
  'iTerm': '/Applications/iTerm.app',
  'iTerm2': '/Applications/iTerm.app',
  'Hyper': '/Applications/Hyper.app',
  'Warp': '/Applications/Warp.app',
  'Alacritty': '/Applications/Alacritty.app',
  'kitty': '/Applications/kitty.app',

  // Design
  'Figma': '/Applications/Figma.app',
  'Sketch': '/Applications/Sketch.app',
  'Adobe Photoshop': '/Applications/Adobe Photoshop 2024/Adobe Photoshop 2024.app',
  'Adobe Illustrator': '/Applications/Adobe Illustrator 2024/Adobe Illustrator.app',
  'Affinity Designer': '/Applications/Affinity Designer.app',
  'Affinity Photo': '/Applications/Affinity Photo.app',
  'Canva': '/Applications/Canva.app',
  'Framer': '/Applications/Framer.app',
  'Principle': '/Applications/Principle.app',
  'Pixelmator Pro': '/Applications/Pixelmator Pro.app',

  // Browsers
  'Safari': '/Applications/Safari.app',
  'Google Chrome': '/Applications/Google Chrome.app',
  'Chrome': '/Applications/Google Chrome.app',
  'Firefox': '/Applications/Firefox.app',
  'Arc': '/Applications/Arc.app',
  'Brave Browser': '/Applications/Brave Browser.app',
  'Microsoft Edge': '/Applications/Microsoft Edge.app',
  'Opera': '/Applications/Opera.app',
  'Vivaldi': '/Applications/Vivaldi.app',
  'Dia': '/Applications/Dia.app',
  'Orion': '/Applications/Orion.app',

  // Communication
  'Slack': '/Applications/Slack.app',
  'Discord': '/Applications/Discord.app',
  'Zoom': '/Applications/zoom.us.app',
  'zoom.us': '/Applications/zoom.us.app',
  'Microsoft Teams': '/Applications/Microsoft Teams.app',
  'Skype': '/Applications/Skype.app',
  'Telegram': '/Applications/Telegram.app',
  'WhatsApp': '/Applications/WhatsApp.app',
  'Messages': '/System/Applications/Messages.app',
  'Mail': '/System/Applications/Mail.app',
  'Outlook': '/Applications/Microsoft Outlook.app',
  'Spark': '/Applications/Spark.app',
  'Loom': '/Applications/Loom.app',

  // Productivity
  'Notion': '/Applications/Notion.app',
  'Obsidian': '/Applications/Obsidian.app',
  'Notes': '/System/Applications/Notes.app',
  'Bear': '/Applications/Bear.app',
  'Evernote': '/Applications/Evernote.app',
  'Things': '/Applications/Things3.app',
  'Todoist': '/Applications/Todoist.app',
  'OmniFocus': '/Applications/OmniFocus 3.app',
  'Reminders': '/System/Applications/Reminders.app',
  'Calendar': '/System/Applications/Calendar.app',
  'Fantastical': '/Applications/Fantastical.app',
  'Cron': '/Applications/Cron.app',
  'Linear': '/Applications/Linear.app',

  // Media
  'Spotify': '/Applications/Spotify.app',
  'Music': '/System/Applications/Music.app',
  'Apple Music': '/System/Applications/Music.app',
  'VLC': '/Applications/VLC.app',
  'Podcasts': '/System/Applications/Podcasts.app',
  'Apple TV': '/System/Applications/TV.app',

  // System
  'Finder': '/System/Library/CoreServices/Finder.app',
  'Preview': '/System/Applications/Preview.app',
  'Activity Monitor': '/System/Applications/Utilities/Activity Monitor.app',
  'System Preferences': '/System/Applications/System Preferences.app',
  'System Settings': '/System/Applications/System Settings.app',
  'App Store': '/System/Applications/App Store.app',
  'Photos': '/System/Applications/Photos.app',

  // Other
  '1Password': '/Applications/1Password.app',
  'Raycast': '/Applications/Raycast.app',
  'Alfred': '/Applications/Alfred 5.app',
  'CleanMyMac': '/Applications/CleanMyMac X.app',
  'Docker': '/Applications/Docker.app',
  'Postman': '/Applications/Postman.app',
  'TablePlus': '/Applications/TablePlus.app',
  'Transmit': '/Applications/Transmit.app',
  'Tower': '/Applications/Tower.app',
  'Fork': '/Applications/Fork.app',
  'GitHub Desktop': '/Applications/GitHub Desktop.app',

  // Common app name variations
  'Electron': '/Applications/Electron.app',
  'Code - Insiders': '/Applications/Visual Studio Code - Insiders.app',
  'VS Code': '/Applications/Visual Studio Code.app',
  'VSCode': '/Applications/Visual Studio Code.app',
  'Google Chrome Canary': '/Applications/Google Chrome Canary.app',
  'Firefox Developer Edition': '/Applications/Firefox Developer Edition.app',
  'Firefox Nightly': '/Applications/Firefox Nightly.app',
  'zoom': '/Applications/zoom.us.app',
  'Zoom.us': '/Applications/zoom.us.app',
  'Microsoft Outlook': '/Applications/Microsoft Outlook.app',
  'Tweetbot': '/Applications/Tweetbot 3.app',
  'Quip': '/Applications/Quip.app',
  'Zeplin': '/Applications/Zeplin.app',
  'Abstract': '/Applications/Abstract.app',
  'InVision Studio': '/Applications/InVision Studio.app',
  'ScreenFlow': '/Applications/ScreenFlow.app',
  'Camtasia': '/Applications/Camtasia 2022.app',
  'DaVinci Resolve': '/Applications/DaVinci Resolve/DaVinci Resolve.app',
  'Final Cut Pro': '/Applications/Final Cut Pro.app',
  'Logic Pro': '/Applications/Logic Pro.app',
  'GarageBand': '/Applications/GarageBand.app',
  'Keynote': '/Applications/Keynote.app',
  'Pages': '/Applications/Pages.app',
  'Numbers': '/Applications/Numbers.app',
  'TextEdit': '/System/Applications/TextEdit.app',
  'Console': '/System/Applications/Utilities/Console.app',
  'Disk Utility': '/System/Applications/Utilities/Disk Utility.app',
  'Script Editor': '/System/Applications/Utilities/Script Editor.app',
  'Automator': '/System/Applications/Automator.app',
};

export function AppIcon({ appPath, appName, url, size = 16, className = '' }: AppIconProps) {
  // Check if this is a browser with a URL - use favicon
  const isBrowser = browserApps.includes(appName);
  const domain = url ? getDomainFromUrl(url) : null;
  const faviconUrl = isBrowser && domain ? getFaviconUrl(domain, size > 16 ? 32 : 16) : null;

  const [iconUrl, setIconUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [faviconError, setFaviconError] = useState(false);
  const [iconError, setIconError] = useState(false);

  // Create a stable cache key
  const cacheKey = appPath || appName;

  // Reset error state when app changes
  useEffect(() => {
    setIconError(false);
    setFaviconError(false);
    setIconUrl(null);
    setLoading(true);
  }, [appName, appPath]);

  useEffect(() => {
    let cancelled = false;

    const fetchIcon = async () => {
      // For browsers with URL, use favicon
      if (faviconUrl && !faviconError) {
        setIconUrl(faviconUrl);
        setLoading(false);
        return;
      }

      // Check cache first
      if (iconCache.has(cacheKey)) {
        if (!cancelled) {
          setIconUrl(iconCache.get(cacheKey)!);
          setLoading(false);
        }
        return;
      }

      // Also check by app name if different from cacheKey
      if (iconCache.has(appName)) {
        if (!cancelled) {
          setIconUrl(iconCache.get(appName)!);
          setLoading(false);
        }
        return;
      }

      // Fetch from main process
      // The main process handler accepts both paths and app names
      // Pass appPath if available, otherwise pass appName directly
      const identifier = appPath || knownAppPaths[appName] || appName;

      try {
        const iconDataUrl = await window.electron.app.getIcon(identifier);
        if (!cancelled) {
          if (iconDataUrl) {
            iconCache.set(cacheKey, iconDataUrl);
            // Also cache by app name for faster lookups
            if (cacheKey !== appName) {
              iconCache.set(appName, iconDataUrl);
            }
            setIconUrl(iconDataUrl);
          }
          setLoading(false);
        }
      } catch (error) {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchIcon();

    return () => { cancelled = true; };
  }, [appPath, appName, cacheKey, faviconUrl, faviconError]);

  if (iconUrl && !iconError) {
    return (
      <img
        src={iconUrl}
        alt=""
        width={size}
        height={size}
        className={`app-icon ${className}`}
        style={{
          borderRadius: size > 20 ? 4 : 2,
          display: 'block',
          objectFit: 'contain',
        }}
        onError={() => {
          console.log(`[AppIcon] Image failed to load for ${appName}: ${iconUrl?.substring(0, 50)}...`);
          // If favicon fails, try app icon
          if (faviconUrl && iconUrl === faviconUrl) {
            setFaviconError(true);
            setIconUrl(null);
          } else {
            // App icon failed, show fallback
            setIconError(true);
          }
        }}
      />
    );
  }

  // Fallback to category SVG icon
  const category = getCategoryFromAppName(appName);

  return (
    <span
      className={`app-icon-fallback ${className}`}
      style={{
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 4,
        backgroundColor: 'rgba(120, 210, 119, 0.15)',
        color: '#78D277'
      }}
    >
      {loading ? (
        <span style={{ fontSize: size * 0.5, color: '#78D277' }}>...</span>
      ) : (
        <CategoryIcon category={category} size={size} />
      )}
    </span>
  );
}

// Category badge component
interface CategoryBadgeProps {
  category: string;
  className?: string;
}

export function CategoryBadge({ category, className = '' }: CategoryBadgeProps) {
  const categoryLabels: Record<string, { label: string; color: string }> = {
    // Focus
    development: { label: 'Dev', color: '#3b82f6' },
    design: { label: 'Design', color: '#ec4899' },
    writing: { label: 'Writing', color: '#14b8a6' },
    research: { label: 'Research', color: '#6366f1' },
    // Work
    email: { label: 'Email', color: '#f97316' },
    messaging: { label: 'Chat', color: '#8b5cf6' },
    meetings: { label: 'Meeting', color: '#a855f7' },
    pm: { label: 'PM', color: '#22c55e' },
    finance: { label: 'Finance', color: '#64748b' },
    // Non-work
    social: { label: 'Social', color: '#f43f5e' },
    entertainment: { label: 'Media', color: '#ef4444' },
    personal: { label: 'Personal', color: '#78716c' },
    utilities: { label: 'Utility', color: '#94a3b8' },
    // Legacy fallbacks
    communication: { label: 'Comms', color: '#8b5cf6' },
    productivity: { label: 'Work', color: '#22c55e' },
    browsers: { label: 'Browse', color: '#f59e0b' },
    other: { label: 'Other', color: '#6b7280' },
    uncategorized: { label: 'Other', color: '#6b7280' },
  };

  const { label, color } = categoryLabels[category] || categoryLabels.uncategorized;

  return (
    <span
      className={`category-badge ${className}`}
      style={{
        backgroundColor: `${color}20`,
        color: color,
        padding: '2px 6px',
        borderRadius: '4px',
        fontSize: '10px',
        fontWeight: 500,
      }}
    >
      {label}
    </span>
  );
}
