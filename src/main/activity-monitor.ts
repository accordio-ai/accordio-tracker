/**
 * Activity Monitor
 *
 * Monitors active windows and applications on macOS for automatic time tracking.
 * Uses active-win package for window detection and Electron's powerMonitor for idle detection.
 *
 * Categorization:
 * 1. Native apps matched by APP_CATEGORIES (app name → category)
 * 2. Browser tabs matched by URL_CATEGORIES (domain → category)
 * 3. Window-title heuristics for meetings in browsers (Google Meet tab, etc.)
 */

import { powerMonitor } from 'electron';
import { EventEmitter } from 'events';
import logger from './logger';
import { enrichWithAppleScript } from './applescript-bridge';

// ============================================
// Category definitions
// ============================================

/**
 * Comprehensive category system inspired by Rize.
 * Categories are split into Focus (deep work) and Non-Focus (shallow work).
 */
export const CATEGORIES = {
  // Focus categories (count toward Focus score)
  development: { label: 'Development', color: '#3b82f6', focus: true },
  design: { label: 'Design', color: '#ec4899', focus: true },
  writing: { label: 'Writing & Docs', color: '#14b8a6', focus: true },
  research: { label: 'Research', color: '#6366f1', focus: true },

  // Work categories (count toward Work Hours but not Focus)
  email: { label: 'Email', color: '#f97316', focus: false },
  messaging: { label: 'Messaging', color: '#8b5cf6', focus: false },
  meetings: { label: 'Meetings', color: '#a855f7', focus: false },
  pm: { label: 'Project Management', color: '#22c55e', focus: false },
  finance: { label: 'Finance & Admin', color: '#64748b', focus: false },

  // Non-work categories
  social: { label: 'Social Media', color: '#f43f5e', focus: false },
  entertainment: { label: 'Entertainment', color: '#ef4444', focus: false },
  personal: { label: 'Personal', color: '#78716c', focus: false },
  utilities: { label: 'Utilities', color: '#94a3b8', focus: false },

  // Catch-all
  uncategorized: { label: 'Uncategorized', color: '#6b7280', focus: false },
} as const;

export type CategoryKey = keyof typeof CATEGORIES;

// ============================================
// App → Category mapping (native apps)
// ============================================

export const APP_CATEGORIES: Record<string, string[]> = {
  // --- Focus ---
  development: [
    'Code', 'Visual Studio Code', 'Xcode', 'Terminal', 'iTerm', 'iTerm2',
    'Ghostty', 'Claude',
    'Hyper', 'Sublime Text', 'WebStorm', 'IntelliJ IDEA', 'PyCharm',
    'Android Studio', 'Cursor', 'Nova', 'BBEdit', 'TextMate', 'Atom',
    'Neovim', 'Vim', 'Warp', 'Alacritty', 'kitty', 'Rio',
    'GoLand', 'PhpStorm', 'RubyMine', 'CLion', 'DataGrip', 'Fleet',
    'RustRover', 'Rider', 'Eclipse', 'NetBeans',
    'Docker Desktop', 'Postman', 'Insomnia', 'TablePlus', 'Sequel Pro',
    'pgAdmin', 'MongoDB Compass', 'Redis Insight', 'Cyberduck',
    'Transmit', 'Fork', 'Tower', 'GitKraken', 'Sourcetree', 'GitHub Desktop',
    'Dash', 'Proxyman', 'Charles',
  ],
  design: [
    'Figma', 'Sketch', 'Adobe Photoshop', 'Adobe Illustrator', 'Adobe XD',
    'Affinity Designer', 'Affinity Designer 2', 'Affinity Photo', 'Affinity Photo 2',
    'Affinity Publisher', 'Affinity Publisher 2',
    'Canva', 'Framer', 'Principle', 'InVision Studio', 'Pixelmator', 'Pixelmator Pro',
    'Procreate', 'Blender', 'Cinema 4D', 'SketchUp',
    'Adobe InDesign', 'Adobe After Effects', 'Adobe Premiere Pro',
    'DaVinci Resolve', 'Final Cut Pro', 'iMovie', 'ScreenFlow',
    'Adobe Lightroom', 'Capture One', 'Darkroom',
    'Spline', 'Rive', 'LottieFiles', 'Zeplin', 'Abstract',
    'OmniGraffle', 'Miro', 'FigJam', 'Whimsical',
  ],
  writing: [
    'Notion', 'Obsidian', 'Bear', 'Ulysses', 'iA Writer', 'Typora',
    'Scrivener', 'Pages', 'Microsoft Word', 'Google Docs',
    'Craft', 'Logseq', 'Roam Research', 'Capacities',
    'Notes', 'Apple Notes', 'Evernote', 'Simplenote',
    'Quill', 'Grammarly', 'Hemingway Editor',
    'Marked', 'MacDown', 'Byword',
  ],
  research: [
    // Research is primarily browser-based, but some native apps count
    'DEVONthink', 'Zotero', 'Mendeley', 'Papers',
    'Raindrop', 'Pocket', 'Reader', 'Readwise',
    'Preview', // Reading PDFs
  ],

  // --- Work (non-focus) ---
  email: [
    'Mail', 'Outlook', 'Spark', 'Airmail', 'Mimestream',
    'Superhuman', 'Newton', 'Canary Mail', 'Hey',
    'Mailspring', 'Thunderbird', 'Postbox',
  ],
  messaging: [
    'Slack', 'Discord', 'Microsoft Teams', 'Messages', 'Telegram',
    'WhatsApp', 'Signal', 'Beeper', 'Element', 'Rocket.Chat',
    'Crisp', 'Intercom', 'Zendesk', 'Front',
    'WeChat', 'Line', 'Viber',
  ],
  meetings: [
    'Zoom', 'zoom.us', 'Google Meet', 'Microsoft Teams', // Teams also counts as meetings when in call
    'Webex', 'Webex Meetings', 'GoTo Meeting', 'Around',
    'Loom', 'mmhmm', 'Riverside', 'StreamYard',
    'FaceTime', 'Skype',
    'Tuple', 'Pop', 'Tandem', // Pair programming / collaboration
  ],
  pm: [
    'Linear', 'Asana', 'Jira', 'Trello', 'Monday',
    'ClickUp', 'Basecamp', 'Wrike', 'Shortcut',
    'Height', 'Plane', 'Hive', 'Teamwork',
    'Things', 'Todoist', 'OmniFocus', 'Reminders', 'TickTick',
    'Calendar', 'Fantastical', 'Cron', 'Amie', 'Vimcal', 'Morgen',
    'Harvest', 'Toggl Track', 'Clockify',
  ],
  finance: [
    'QuickBooks', 'FreshBooks', 'Xero', 'Wave',
    'Numbers', 'Microsoft Excel', 'Google Sheets',
    'Calculator', 'Numi',
    'Stripe Dashboard', '1Password', 'Bitwarden', 'LastPass',
  ],

  // --- Non-work ---
  social: [
    'Twitter', 'TweetDeck', 'Ivory', 'Ice Cubes', // Mastodon
    'Facebook', 'Instagram', 'TikTok', 'Threads',
    'LinkedIn', 'Reddit',
    'Bluesky',
  ],
  entertainment: [
    'Spotify', 'Music', 'Apple Music', 'YouTube Music', 'Tidal',
    'Netflix', 'Disney+', 'Apple TV', 'Hulu', 'HBO Max', 'Prime Video',
    'YouTube', 'Twitch',
    'VLC', 'Plex', 'IINA', 'Infuse', 'Movist',
    'Steam', 'Epic Games', 'GOG Galaxy',
    'Podcasts', 'Overcast', 'Pocket Casts', 'Castro',
  ],
  personal: [
    'Photos', 'Preview', // Only when not researching
    'Contacts', 'Maps', 'Weather', 'News', 'Stocks',
    'App Store', 'System Settings', 'System Preferences',
    'Activity Monitor', 'Disk Utility', 'Console',
    'Keychain Access',
  ],
  utilities: [
    'Finder', 'Alfred', 'Raycast', 'Spotlight',
    'CleanMyMac', 'Bartender', 'iStat Menus',
    'Magnet', 'Rectangle', 'BetterTouchTool',
    'Karabiner-Elements', 'TextExpander', 'Keyboard Maestro',
    'Hazel', 'Dropzone', 'Default Folder X',
  ],
};

// ============================================
// Browser detection
// ============================================

export const BROWSER_APPS = [
  // Mainstream
  'Safari', 'Google Chrome', 'Chrome', 'Firefox', 'Microsoft Edge',
  // Privacy-focused
  'Brave Browser', 'Brave', 'LibreWolf', 'Tor Browser', 'Mullvad Browser',
  'Waterfox', 'Helium',
  // Productivity / power-user
  'Arc', 'Vivaldi', 'Opera', 'Opera GX', 'Wavebox', 'Sidekick', 'Shift',
  'SigmaOS', 'Stack',
  // New / trending (2025-2026)
  'Zen Browser', 'Dia', 'Orion', 'Comet', 'Floorp',
  // Developer
  'Firefox Developer Edition', 'Safari Technology Preview', 'Polypane',
  // Other
  'Chromium', 'Ungoogled Chromium', 'Min',
];

// ============================================
// Dedicated meeting apps — always categorized as 'meetings' regardless of
// window title. Unlike Slack/Teams which are messaging unless in a call,
// these apps are only open when the user is in a meeting.
// ============================================

const DEDICATED_MEETING_APPS = new Set([
  'zoom.us', 'Zoom', 'FaceTime', 'Webex', 'Webex Meetings',
  'GoTo Meeting', 'Around', 'Loom', 'Riverside', 'StreamYard',
  'Tuple', 'Pop', 'Tandem', 'mmhmm', 'Skype',
]);

// ============================================
// URL → Category mapping (for browser tabs)
// Matched by domain or domain prefix.
// More specific domains (e.g. mail.google.com) take priority.
// ============================================

export const URL_CATEGORIES: Array<{ pattern: string; category: CategoryKey; label?: string }> = [
  // --- Development ---
  { pattern: 'github.com', category: 'development' },
  { pattern: 'gitlab.com', category: 'development' },
  { pattern: 'bitbucket.org', category: 'development' },
  { pattern: 'stackoverflow.com', category: 'development' },
  { pattern: 'stackexchange.com', category: 'development' },
  { pattern: 'npmjs.com', category: 'development' },
  { pattern: 'pypi.org', category: 'development' },
  { pattern: 'crates.io', category: 'development' },
  { pattern: 'pkg.go.dev', category: 'development' },
  { pattern: 'rubygems.org', category: 'development' },
  { pattern: 'packagist.org', category: 'development' },
  { pattern: 'hub.docker.com', category: 'development' },
  { pattern: 'vercel.com', category: 'development' },
  { pattern: 'netlify.com', category: 'development' },
  { pattern: 'railway.app', category: 'development' },
  { pattern: 'render.com', category: 'development' },
  { pattern: 'fly.io', category: 'development' },
  { pattern: 'heroku.com', category: 'development' },
  { pattern: 'aws.amazon.com', category: 'development' },
  { pattern: 'console.cloud.google.com', category: 'development' },
  { pattern: 'portal.azure.com', category: 'development' },
  { pattern: 'supabase.com', category: 'development' },
  { pattern: 'firebase.google.com', category: 'development' },
  { pattern: 'planetscale.com', category: 'development' },
  { pattern: 'neon.tech', category: 'development' },
  { pattern: 'sentry.io', category: 'development' },
  { pattern: 'datadog.com', category: 'development' },
  { pattern: 'grafana.com', category: 'development' },
  { pattern: 'codecov.io', category: 'development' },
  { pattern: 'codepen.io', category: 'development' },
  { pattern: 'codesandbox.io', category: 'development' },
  { pattern: 'replit.com', category: 'development' },
  { pattern: 'jsfiddle.net', category: 'development' },
  { pattern: 'developer.mozilla.org', category: 'development' },
  { pattern: 'devdocs.io', category: 'development' },
  { pattern: 'docs.rs', category: 'development' },
  { pattern: 'v0.dev', category: 'development' },
  { pattern: 'claude.ai', category: 'development' },
  { pattern: 'chat.openai.com', category: 'development' },
  { pattern: 'chatgpt.com', category: 'development' },
  { pattern: 'copilot.microsoft.com', category: 'development' },
  { pattern: 'cursor.com', category: 'development' },
  { pattern: 'gitbook.io', category: 'development' },
  { pattern: 'readme.io', category: 'development' },
  { pattern: 'swagger.io', category: 'development' },
  { pattern: 'postman.com', category: 'development' },
  { pattern: 'localhost', category: 'development' },

  // --- Design ---
  { pattern: 'figma.com', category: 'design' },
  { pattern: 'sketch.com', category: 'design' },
  { pattern: 'canva.com', category: 'design' },
  { pattern: 'framer.com', category: 'design' },
  { pattern: 'webflow.com', category: 'design' },
  { pattern: 'dribbble.com', category: 'design' },
  { pattern: 'behance.net', category: 'design' },
  { pattern: 'coolors.co', category: 'design' },
  { pattern: 'fontawesome.com', category: 'design' },
  { pattern: 'fonts.google.com', category: 'design' },
  { pattern: 'unsplash.com', category: 'design' },
  { pattern: 'pexels.com', category: 'design' },
  { pattern: 'iconify.design', category: 'design' },
  { pattern: 'heroicons.com', category: 'design' },
  { pattern: 'lucide.dev', category: 'design' },
  { pattern: 'spline.design', category: 'design' },
  { pattern: 'rive.app', category: 'design' },
  { pattern: 'lottiefiles.com', category: 'design' },
  { pattern: 'miro.com', category: 'design' },
  { pattern: 'whimsical.com', category: 'design' },
  { pattern: 'excalidraw.com', category: 'design' },
  { pattern: 'tldraw.com', category: 'design' },
  { pattern: 'adobe.com', category: 'design' },
  { pattern: 'color.adobe.com', category: 'design' },
  { pattern: 'realtime.colors', category: 'design' },
  { pattern: 'colorhunt.co', category: 'design' },
  { pattern: 'awwwards.com', category: 'design' },
  { pattern: 'siteinspire.com', category: 'design' },
  { pattern: 'land-book.com', category: 'design' },

  // --- Writing & Docs ---
  { pattern: 'notion.so', category: 'writing' },
  { pattern: 'notion.site', category: 'writing' },
  { pattern: 'docs.google.com', category: 'writing' },
  { pattern: 'medium.com', category: 'writing' },
  { pattern: 'substack.com', category: 'writing' },
  { pattern: 'ghost.org', category: 'writing' },
  { pattern: 'wordpress.com', category: 'writing' },
  { pattern: 'grammarly.com', category: 'writing' },
  { pattern: 'hemingwayapp.com', category: 'writing' },
  { pattern: 'coda.io', category: 'writing' },
  { pattern: 'craft.do', category: 'writing' },
  { pattern: 'dropbox.com/paper', category: 'writing' },
  { pattern: 'slite.com', category: 'writing' },
  { pattern: 'gitbook.com', category: 'writing' },
  { pattern: 'confluence.atlassian.com', category: 'writing' },
  { pattern: 'hackmd.io', category: 'writing' },
  { pattern: 'obsidian.md', category: 'writing' },

  // --- Research ---
  { pattern: 'scholar.google.com', category: 'research' },
  { pattern: 'arxiv.org', category: 'research' },
  { pattern: 'wikipedia.org', category: 'research' },
  { pattern: 'perplexity.ai', category: 'research' },
  { pattern: 'phind.com', category: 'research' },
  { pattern: 'you.com', category: 'research' },
  { pattern: 'wolfram.com', category: 'research' },
  { pattern: 'archive.org', category: 'research' },
  { pattern: 'hn.algolia.com', category: 'research' },
  { pattern: 'news.ycombinator.com', category: 'research' },
  { pattern: 'producthunt.com', category: 'research' },

  // --- Email (more specific than google.com) ---
  { pattern: 'mail.google.com', category: 'email' },
  { pattern: 'outlook.live.com', category: 'email' },
  { pattern: 'outlook.office.com', category: 'email' },
  { pattern: 'outlook.office365.com', category: 'email' },
  { pattern: 'mail.yahoo.com', category: 'email' },
  { pattern: 'mail.proton.me', category: 'email' },
  { pattern: 'protonmail.com', category: 'email' },
  { pattern: 'fastmail.com', category: 'email' },
  { pattern: 'hey.com', category: 'email' },
  { pattern: 'superhuman.com', category: 'email' },
  { pattern: 'mailchimp.com', category: 'email' },
  { pattern: 'sendgrid.com', category: 'email' },
  { pattern: 'constantcontact.com', category: 'email' },

  // --- Messaging ---
  { pattern: 'slack.com', category: 'messaging' },
  { pattern: 'app.slack.com', category: 'messaging' },
  { pattern: 'discord.com', category: 'messaging' },
  { pattern: 'teams.microsoft.com', category: 'messaging' },
  { pattern: 'web.telegram.org', category: 'messaging' },
  { pattern: 'web.whatsapp.com', category: 'messaging' },
  { pattern: 'messenger.com', category: 'messaging' },
  { pattern: 'intercom.com', category: 'messaging' },
  { pattern: 'crisp.chat', category: 'messaging' },
  { pattern: 'zendesk.com', category: 'messaging' },
  { pattern: 'freshdesk.com', category: 'messaging' },

  // --- Meetings ---
  { pattern: 'meet.google.com', category: 'meetings' },
  { pattern: 'zoom.us', category: 'meetings' },
  { pattern: 'app.zoom.us', category: 'meetings' },
  { pattern: 'calendly.com', category: 'meetings' },
  { pattern: 'cal.com', category: 'meetings' },
  { pattern: 'savvycal.com', category: 'meetings' },
  { pattern: 'loom.com', category: 'meetings' },
  { pattern: 'around.co', category: 'meetings' },
  { pattern: 'whereby.com', category: 'meetings' },
  { pattern: 'tuple.app', category: 'meetings' },
  { pattern: 'riverside.fm', category: 'meetings' },

  // --- Project Management ---
  { pattern: 'linear.app', category: 'pm' },
  { pattern: 'asana.com', category: 'pm' },
  { pattern: 'atlassian.net', category: 'pm' }, // Jira
  { pattern: 'trello.com', category: 'pm' },
  { pattern: 'monday.com', category: 'pm' },
  { pattern: 'clickup.com', category: 'pm' },
  { pattern: 'basecamp.com', category: 'pm' },
  { pattern: 'shortcut.com', category: 'pm' },
  { pattern: 'height.app', category: 'pm' },
  { pattern: 'wrike.com', category: 'pm' },
  { pattern: 'teamwork.com', category: 'pm' },
  { pattern: 'todoist.com', category: 'pm' },
  { pattern: 'ticktick.com', category: 'pm' },
  { pattern: 'calendar.google.com', category: 'pm' },
  { pattern: 'airtable.com', category: 'pm' },

  // --- Finance & Admin ---
  { pattern: 'dashboard.stripe.com', category: 'finance' },
  { pattern: 'paypal.com', category: 'finance' },
  { pattern: 'wise.com', category: 'finance' },
  { pattern: 'mercury.com', category: 'finance' },
  { pattern: 'brex.com', category: 'finance' },
  { pattern: 'quickbooks.intuit.com', category: 'finance' },
  { pattern: 'freshbooks.com', category: 'finance' },
  { pattern: 'xero.com', category: 'finance' },
  { pattern: 'wave.com', category: 'finance' },
  { pattern: 'gusto.com', category: 'finance' },
  { pattern: 'deel.com', category: 'finance' },
  { pattern: 'sheets.google.com', category: 'finance' },
  { pattern: 'accordio.ai', category: 'finance' },

  // --- Social Media ---
  { pattern: 'twitter.com', category: 'social' },
  { pattern: 'x.com', category: 'social' },
  { pattern: 'facebook.com', category: 'social' },
  { pattern: 'instagram.com', category: 'social' },
  { pattern: 'tiktok.com', category: 'social' },
  { pattern: 'linkedin.com', category: 'social' },
  { pattern: 'reddit.com', category: 'social' },
  { pattern: 'threads.net', category: 'social' },
  { pattern: 'bsky.app', category: 'social' },
  { pattern: 'mastodon.social', category: 'social' },
  { pattern: 'pinterest.com', category: 'social' },
  { pattern: 'snapchat.com', category: 'social' },

  // --- Entertainment ---
  { pattern: 'youtube.com', category: 'entertainment' },
  { pattern: 'netflix.com', category: 'entertainment' },
  { pattern: 'twitch.tv', category: 'entertainment' },
  { pattern: 'disneyplus.com', category: 'entertainment' },
  { pattern: 'hulu.com', category: 'entertainment' },
  { pattern: 'primevideo.com', category: 'entertainment' },
  { pattern: 'hbomax.com', category: 'entertainment' },
  { pattern: 'max.com', category: 'entertainment' },
  { pattern: 'spotify.com', category: 'entertainment' },
  { pattern: 'soundcloud.com', category: 'entertainment' },
  { pattern: 'music.apple.com', category: 'entertainment' },
  { pattern: 'music.youtube.com', category: 'entertainment' },
  { pattern: 'crunchyroll.com', category: 'entertainment' },
  { pattern: '9gag.com', category: 'entertainment' },
  { pattern: 'imgur.com', category: 'entertainment' },

  // --- Personal ---
  { pattern: 'amazon.com', category: 'personal' },
  { pattern: 'ebay.com', category: 'personal' },
  { pattern: 'etsy.com', category: 'personal' },
  { pattern: 'walmart.com', category: 'personal' },
  { pattern: 'target.com', category: 'personal' },
  { pattern: 'maps.google.com', category: 'personal' },
  { pattern: 'yelp.com', category: 'personal' },
  { pattern: 'doordash.com', category: 'personal' },
  { pattern: 'ubereats.com', category: 'personal' },
  { pattern: 'airbnb.com', category: 'personal' },
  { pattern: 'booking.com', category: 'personal' },
  { pattern: 'zillow.com', category: 'personal' },
  { pattern: 'bankofamerica.com', category: 'personal' },
  { pattern: 'chase.com', category: 'personal' },
  { pattern: 'wellsfargo.com', category: 'personal' },

  // --- Google catchall (must come AFTER specific google domains) ---
  { pattern: 'drive.google.com', category: 'writing' },
  { pattern: 'slides.google.com', category: 'design' },
  { pattern: 'google.com/search', category: 'research' },
  { pattern: 'google.com', category: 'research' },
];

// ============================================
// Exports
// ============================================

export interface ActivityDetail {
  /** Human-readable context extracted from window title */
  context: string;
  /** For VS Code / editors: project/folder name */
  project?: string;
  /** For VS Code / editors: current file being edited */
  file?: string;
  /** For browsers: page title (cleaned of browser suffix) */
  pageTitle?: string;
  /** For browsers: domain name */
  domain?: string;
  /** For Slack/Discord: channel or workspace */
  channel?: string;
  /** For terminals: working directory */
  directory?: string;
}

export interface TitleHistoryEntry {
  title: string;
  detail: ActivityDetail;
  firstSeen: number;
  lastSeen: number;
  durationSeconds: number;
}

export interface ActivityEntry {
  id: string;
  appName: string;
  windowTitle: string;
  url?: string; // For browser tabs
  category: string;
  startTime: number;
  endTime: number;
  duration: number; // in seconds
  projectId?: string;
  projectSuggestion?: string;
  bundleId?: string; // macOS bundle identifier
  appPath?: string; // Path to the application
  /** Rich structured detail extracted from the current window title */
  detail?: ActivityDetail;
  /** History of all window titles seen during this app session */
  titleHistory?: TitleHistoryEntry[];
}

/**
 * Why the user was absent. `idle` is the only one that means "took a break" —
 * the rest mean the machine or the app was unavailable, which is untracked
 * time, not leisure.
 */
export type AbsenceReason = 'idle' | 'locked' | 'suspended';

export interface AbsenceRecord {
  start: number;
  end: number;
  reason: AbsenceReason;
}

export interface ActivityMonitorOptions {
  pollInterval?: number; // milliseconds (default: 5000 = 5s)
  idleTimeout?: number; // minutes (default: 10)
  trackBrowserTabs?: boolean;
  excludedApps?: string[];
  categories?: Record<string, string[]>;
}

type ActiveWinResult = {
  title: string;
  id: number;
  bounds: { x: number; y: number; width: number; height: number };
  owner: {
    name: string;
    processId: number;
    bundleId?: string;
    path?: string;
  };
  url?: string;
  memoryUsage?: number;
};

// ============================================
// Categorization engine
// ============================================

/**
 * Check if an app name matches a known browser.
 */
function isBrowser(appName: string): boolean {
  const lower = appName.toLowerCase();
  return BROWSER_APPS.some(b => lower.includes(b.toLowerCase()));
}

/**
 * Extract hostname from a URL string.
 */
function extractHostname(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    // Handle URLs without protocol
    try {
      const parsed = new URL('https://' + url);
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return null;
    }
  }
}

/**
 * Categorize a browser tab by URL.
 * Uses specificity matching: longer (more specific) patterns win.
 */
function categorizeUrl(url: string): CategoryKey {
  const hostname = extractHostname(url);
  if (!hostname) return 'uncategorized';

  // Also check the full URL path for path-specific rules
  let normalizedUrl = url;
  try {
    const parsed = new URL(url);
    normalizedUrl = parsed.hostname.replace(/^www\./, '') + parsed.pathname;
  } catch {
    // Use hostname only
    normalizedUrl = hostname;
  }

  // Find the most specific matching pattern
  let bestMatch: { pattern: string; category: CategoryKey } | null = null;

  for (const rule of URL_CATEGORIES) {
    // Check if hostname or full path matches
    if (hostname.includes(rule.pattern) || normalizedUrl.startsWith(rule.pattern)) {
      // Prefer longer (more specific) patterns
      if (!bestMatch || rule.pattern.length > bestMatch.pattern.length) {
        bestMatch = rule;
      }
    }
  }

  return bestMatch?.category ?? 'uncategorized';
}

/**
 * Categorize a native app by name.
 *
 * Two rules, both learned the hard way:
 *
 * 1. **Exact match beats substring match.** The old implementation used
 *    `appName.includes(app)` and returned the first hit in object-key order,
 *    so 'Pop' (meetings) matched any app containing "pop" and 'Around'
 *    matched "Turnaround".
 * 2. **An app listed in several buckets resolves by explicit precedence, not
 *    by which key happened to be declared first.** 'Microsoft Teams' appears
 *    in both `messaging` and `meetings`; because `messaging` was declared
 *    first, Teams was *always* messaging. Teams genuinely is a chat app most
 *    of the time — the meeting detector promotes it to `meetings` when a call
 *    is actually live, so `messaging` is the right resting state. Keeping it
 *    explicit means the next person can see that it was a decision.
 */
const CATEGORY_PRECEDENCE: CategoryKey[] = [
  'development', 'design', 'writing', 'research',
  'email', 'messaging', 'meetings', 'pm', 'finance',
  'social', 'entertainment', 'personal', 'utilities',
];

function categorizeApp(appName: string, categories: Record<string, string[]>): CategoryKey {
  const name = appName.toLowerCase().trim();
  const keys = Object.keys(categories);
  // Walk known categories in precedence order, then anything custom.
  const ordered = [
    ...CATEGORY_PRECEDENCE.filter(c => keys.includes(c)),
    ...keys.filter(k => !CATEGORY_PRECEDENCE.includes(k as CategoryKey)),
  ];

  // Pass 1: exact name match.
  for (const category of ordered) {
    if (categories[category]?.some(app => app.toLowerCase() === name)) {
      return category as CategoryKey;
    }
  }

  // Pass 2: substring, longest pattern first so the most specific entry wins.
  let best: { category: string; length: number } | null = null;
  for (const category of ordered) {
    for (const app of categories[category] ?? []) {
      const pattern = app.toLowerCase();
      // Require a word boundary so 'Pop' can't match "Popclip".
      if (!new RegExp(`\\b${escapeRegExp(pattern)}\\b`).test(name)) continue;
      if (!best || pattern.length > best.length) {
        best = { category, length: pattern.length };
      }
    }
  }

  return (best?.category as CategoryKey) ?? 'uncategorized';
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Detect meetings from window titles (for apps that host meetings in-app).
 * E.g., Slack showing "Huddle" or Teams showing "Meeting".
 */
function detectMeetingFromTitle(appName: string, windowTitle: string): boolean {
  const title = windowTitle.toLowerCase();

  // Slack huddle/call/standup
  if (appName.includes('Slack') && (title.includes('huddle') || title.includes('call') || title.includes('standup'))) {
    return true;
  }

  // Teams meeting/call
  if (appName.includes('Teams') && (title.includes('meeting') || title.includes('call'))) {
    return true;
  }

  // Discord voice channel
  if (appName.includes('Discord') && (title.includes('voice') || title.includes('stage'))) {
    return true;
  }

  // WhatsApp call/video (desktop app changes title during calls)
  if (appName.includes('WhatsApp') && (title.includes('call') || title.includes('video'))) {
    return true;
  }

  // Zoom: in a meeting the title shows the meeting name.
  // Home screen shows "Zoom Workplace" or "zoom.us". Skip those.
  if ((appName.includes('Zoom') || appName.includes('zoom.us')) && title.length > 0) {
    if (!title.includes('zoom workplace') && !title.includes('zoom.us') && title !== 'zoom') {
      return true;
    }
  }

  // FaceTime active call
  if (appName.includes('FaceTime') && title.length > 0) {
    return true;
  }

  // Browser-based meetings detected from title
  if (isBrowser(appName)) {
    if (title.includes('google meet') || title.includes('zoom meeting') ||
        title.includes('microsoft teams') || title.includes('webex') ||
        title.includes('whereby') || title.includes('around.co')) {
      return true;
    }
  }

  return false;
}

/**
 * Try to categorize a browser tab by its window title when URL is unavailable.
 * Many browsers (Dia, Orion, etc.) don't expose URLs to active-win.
 * Window titles typically look like "Page Title — Dia" or "Page Title - Site Name — Dia".
 */
function categorizeBrowserByTitle(windowTitle: string): CategoryKey {
  const title = windowTitle.toLowerCase();

  // Check if any URL pattern keywords appear in the window title
  for (const rule of URL_CATEGORIES) {
    // Match domain-like patterns in the title (e.g., "Netflix", "GitHub", "Gmail")
    const keyword = rule.pattern.replace(/\.com$|\.org$|\.io$|\.app$|\.ai$|\.dev$|\.tv$|\.net$/, '');
    if (keyword.length >= 3 && title.includes(keyword)) {
      return rule.category;
    }
  }

  // Common window title patterns for known sites
  const TITLE_PATTERNS: Array<{ pattern: RegExp; category: CategoryKey }> = [
    { pattern: /youtube/i, category: 'entertainment' },
    { pattern: /netflix/i, category: 'entertainment' },
    { pattern: /spotify/i, category: 'entertainment' },
    { pattern: /twitch/i, category: 'entertainment' },
    { pattern: /disney\+/i, category: 'entertainment' },
    { pattern: /gmail|inbox.*mail/i, category: 'email' },
    { pattern: /google docs|untitled document/i, category: 'writing' },
    { pattern: /google sheets|untitled spreadsheet/i, category: 'finance' },
    { pattern: /google slides|untitled presentation/i, category: 'design' },
    { pattern: /google meet/i, category: 'meetings' },
    { pattern: /figma/i, category: 'design' },
    { pattern: /github/i, category: 'development' },
    { pattern: /stack overflow/i, category: 'development' },
    { pattern: /slack/i, category: 'messaging' },
    { pattern: /notion/i, category: 'writing' },
    { pattern: /linear/i, category: 'pm' },
    { pattern: /jira/i, category: 'pm' },
    { pattern: /twitter|𝕏/i, category: 'social' },
    { pattern: /reddit/i, category: 'social' },
    { pattern: /linkedin/i, category: 'social' },
    { pattern: /instagram/i, category: 'social' },
    { pattern: /facebook/i, category: 'social' },
    { pattern: /amazon|ebay|etsy/i, category: 'personal' },
    { pattern: /google search|search results/i, category: 'research' },
    { pattern: /wikipedia/i, category: 'research' },
  ];

  for (const { pattern, category } of TITLE_PATTERNS) {
    if (pattern.test(windowTitle)) {
      return category;
    }
  }

  return 'uncategorized';
}

/**
 * Main categorization function.
 * Priority: meeting detection > URL (for browsers) > window title (for browsers) > app name > uncategorized
 */
export function categorizeActivity(
  appName: string,
  windowTitle: string,
  url: string | undefined,
  categories: Record<string, string[]>
): CategoryKey {
  // 1. Meeting detection from window title (highest priority)
  if (detectMeetingFromTitle(appName, windowTitle)) {
    return 'meetings';
  }

  // 2. Dedicated meeting apps (always meetings, bypasses category ordering)
  if (DEDICATED_MEETING_APPS.has(appName)) {
    return 'meetings';
  }

  // 3. For browsers, use URL-based categorization
  if (isBrowser(appName)) {
    if (url) {
      return categorizeUrl(url);
    }
    // 3. Fallback: parse window title for browsers that don't expose URLs (Dia, Orion, etc.)
    const titleCategory = categorizeBrowserByTitle(windowTitle);
    if (titleCategory !== 'uncategorized') {
      return titleCategory;
    }
    return 'uncategorized';
  }

  // 4. Native app categorization
  return categorizeApp(appName, categories);
}

// ============================================
// Rich detail extraction from window titles
// ============================================

/**
 * Extract the domain from a URL for browser session grouping.
 */
function extractDomainForGrouping(url?: string, windowTitle?: string): string | undefined {
  if (url) {
    const hostname = extractHostname(url);
    if (hostname) return hostname;
  }
  // Fallback: try to infer from window title for browsers without URL access
  // e.g. "GitHub - repo — Dia" → "github"
  if (windowTitle) {
    for (const rule of URL_CATEGORIES) {
      const keyword = rule.pattern.replace(/\.com$|\.org$|\.io$|\.app$|\.ai$|\.dev$|\.tv$|\.net$/, '');
      if (keyword.length >= 3 && windowTitle.toLowerCase().includes(keyword)) {
        return rule.pattern;
      }
    }
  }
  return undefined;
}

/**
 * Extract rich, structured detail from a window title based on the app.
 * This powers better AI matching and more descriptive timeline entries.
 */
export function extractDetail(appName: string, windowTitle: string, url?: string): ActivityDetail {
  const title = windowTitle.trim();

  // --- VS Code / Cursor / Code editors ---
  // Pattern: "filename.ts — folder — Visual Studio Code"
  // Pattern: "filename.ts — Visual Studio Code"
  if (/Visual Studio Code|^Code$|Cursor|WebStorm|IntelliJ|PyCharm|GoLand|PhpStorm|RubyMine|CLion|Fleet|RustRover|Rider/i.test(appName)) {
    // Try: "file — project — Editor"
    const threePartMatch = title.match(/^(.+?)\s*[—\-]\s*(.+?)\s*[—\-]\s*(?:Visual Studio Code|Code|Cursor|WebStorm|IntelliJ.*|PyCharm.*|GoLand.*|PhpStorm.*|RubyMine.*|CLion.*|Fleet|RustRover.*|Rider.*)$/i);
    if (threePartMatch) {
      return {
        context: `${threePartMatch[2].trim()} / ${threePartMatch[1].trim()}`,
        project: threePartMatch[2].trim(),
        file: threePartMatch[1].trim(),
      };
    }
    // Try: "file — Editor" (no project folder visible)
    const twoPartMatch = title.match(/^(.+?)\s*[—\-]\s*(?:Visual Studio Code|Code|Cursor|WebStorm|IntelliJ.*|PyCharm.*|GoLand.*|PhpStorm.*|RubyMine.*|CLion.*|Fleet|RustRover.*|Rider.*)$/i);
    if (twoPartMatch) {
      return {
        context: twoPartMatch[1].trim(),
        file: twoPartMatch[1].trim(),
      };
    }
    // Fallback: just the window title
    return { context: title || appName };
  }

  // --- Xcode ---
  // Pattern: "ProjectName — FileName.swift"
  if (appName === 'Xcode') {
    const xcodeMatch = title.match(/^(.+?)\s*[—\-]\s*(.+)$/);
    if (xcodeMatch) {
      return {
        context: `${xcodeMatch[1].trim()} / ${xcodeMatch[2].trim()}`,
        project: xcodeMatch[1].trim(),
        file: xcodeMatch[2].trim(),
      };
    }
    return { context: title || 'Xcode' };
  }

  // --- Terminal / iTerm / Warp / Alacritty / kitty ---
  // Pattern: "user@host: ~/project/dir" or "~/project — zsh" or just path
  if (/Terminal|iTerm|Warp|Alacritty|kitty|Rio|Hyper/i.test(appName)) {
    // Try: "user@host: path"
    const sshMatch = title.match(/^.+?:\s*(.+)$/);
    if (sshMatch) {
      const dir = sshMatch[1].trim().replace(/^~\//, '');
      const parts = dir.split('/');
      return {
        context: dir,
        directory: dir,
        project: parts[0] || undefined,
      };
    }
    // Try: "~/path — shell"
    const pathMatch = title.match(/^(~?\/.+?)(?:\s*[—\-]\s*.+)?$/);
    if (pathMatch) {
      const dir = pathMatch[1].trim().replace(/^~\//, '');
      const parts = dir.split('/');
      return {
        context: dir,
        directory: dir,
        project: parts[0] || undefined,
      };
    }
    return { context: title || 'Terminal' };
  }

  // --- Slack ---
  // Pattern: "channel-name | Workspace — Slack" or "Person | Workspace — Slack"
  if (/Slack/i.test(appName)) {
    const slackMatch = title.match(/^(.+?)\s*[|]\s*(.+?)\s*[—\-]\s*Slack$/i);
    if (slackMatch) {
      return {
        context: `${slackMatch[2].trim()} #${slackMatch[1].trim()}`,
        channel: slackMatch[1].trim(),
      };
    }
    // Simpler: "channel — Slack"
    const simpleSlack = title.match(/^(.+?)\s*[—\-]\s*Slack$/i);
    if (simpleSlack) {
      return {
        context: simpleSlack[1].trim(),
        channel: simpleSlack[1].trim(),
      };
    }
    return { context: title || 'Slack' };
  }

  // --- Discord ---
  // Pattern: "#channel | Server — Discord" or "Server — Discord"
  if (/Discord/i.test(appName)) {
    const discordMatch = title.match(/^#?(.+?)\s*[|]\s*(.+?)\s*[—\-]\s*Discord$/i);
    if (discordMatch) {
      return {
        context: `${discordMatch[2].trim()} #${discordMatch[1].trim()}`,
        channel: discordMatch[1].trim(),
      };
    }
    return { context: title || 'Discord' };
  }

  // --- Figma ---
  // Pattern: "Design Name — Figma"
  if (/Figma/i.test(appName)) {
    const figmaMatch = title.match(/^(.+?)\s*[—\-]\s*Figma$/i);
    if (figmaMatch) {
      return {
        context: figmaMatch[1].trim(),
        project: figmaMatch[1].trim(),
      };
    }
    return { context: title || 'Figma' };
  }

  // --- Notion ---
  // Pattern: "Page Title — Notion" or "Page Title / SubPage — Notion"
  if (/Notion/i.test(appName) || title.toLowerCase().includes('notion')) {
    const notionMatch = title.match(/^(.+?)\s*[—\-]\s*Notion$/i);
    if (notionMatch) {
      return { context: notionMatch[1].trim(), pageTitle: notionMatch[1].trim() };
    }
    return { context: title || 'Notion' };
  }

  // --- Linear ---
  if (/Linear/i.test(appName) || title.toLowerCase().includes('linear')) {
    const linearMatch = title.match(/^(.+?)\s*[—\-]\s*Linear$/i);
    if (linearMatch) {
      return { context: linearMatch[1].trim(), pageTitle: linearMatch[1].trim() };
    }
    return { context: title || 'Linear' };
  }

  // --- Browsers (Safari, Chrome, Firefox, Arc, Dia, Brave, etc.) ---
  if (isBrowser(appName)) {
    let domain: string | undefined;
    let pageTitle: string | undefined;

    if (url) {
      domain = extractHostname(url) || undefined;
    }

    // Browser titles typically: "Page Title — BrowserName" or "Page Title - Site — BrowserName"
    // Strip browser name suffix
    let cleanTitle = title;
    for (const browser of BROWSER_APPS) {
      const suffixPattern = new RegExp(`\\s*[—\\-]\\s*${browser.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i');
      cleanTitle = cleanTitle.replace(suffixPattern, '');
    }

    pageTitle = cleanTitle.trim() || undefined;

    // Try to extract domain from title if no URL
    if (!domain && pageTitle) {
      domain = extractDomainForGrouping(undefined, pageTitle);
    }

    const contextParts: string[] = [];
    if (pageTitle) contextParts.push(pageTitle);
    if (domain && !pageTitle?.toLowerCase().includes(domain.replace(/\.com$|\.org$|\.io$/, ''))) {
      contextParts.push(`(${domain})`);
    }

    return {
      context: contextParts.join(' ') || appName,
      pageTitle,
      domain,
    };
  }

  // --- Generic app: "Something — AppName" pattern ---
  const genericMatch = title.match(/^(.+?)\s*[—\-]\s*.+$/);
  if (genericMatch && genericMatch[1].trim().length > 0) {
    return { context: genericMatch[1].trim() };
  }

  return { context: title || appName };
}

// ============================================
// ActivityMonitor class
// ============================================

export class ActivityMonitor extends EventEmitter {
  private pollInterval: number;
  private idleTimeout: number; // in minutes
  private trackBrowserTabs: boolean;
  private excludedApps: Set<string>;
  private categories: Record<string, string[]>;

  private pollTimer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private isPaused = false;
  private isIdle = false;
  private idleHandlersRegistered = false;

  // Hard presence overrides. Kept separate from `isIdle` so that a live meeting
  // can keep tracking through HID idle, while a locked or sleeping Mac cannot.
  private screenLocked = false;
  private systemSuspended = false;
  /** True while the meeting detector reports a live call (see setMeetingActive). */
  private meetingActive = false;

  /**
   * Injected by the time tracker: returns the user's category correction for
   * an app+title pair, if they've made one. Kept as a callback so the monitor
   * doesn't depend on the tracker.
   */
  categoryOverrideLookup?: (appName: string, windowTitle: string) => string | undefined;

  private idleHandlers = {
    onLock: () => {
      logger.log('[ActivityMonitor] Screen locked');
      this.screenLocked = true;
      this.handleIdle(Date.now(), 'locked');
    },
    onUnlock: () => {
      logger.log('[ActivityMonitor] Screen unlocked');
      this.screenLocked = false;
      this.handleActive();
    },
    onSuspend: () => {
      logger.log('[ActivityMonitor] System suspended');
      this.systemSuspended = true;
      this.handleIdle(Date.now(), 'suspended');
    },
    onResume: () => {
      logger.log('[ActivityMonitor] System resumed');
      // If suspend handler didn't fire (process frozen before handler ran),
      // the activity is still running with stale startTime. Catch it here.
      if (!this.isIdle && this.currentActivity && this.lastPollTime > 0) {
        const gapMs = Date.now() - this.lastPollTime;
        const thresholdMs = this.pollInterval * this.GAP_THRESHOLD_MULTIPLIER;
        if (gapMs > thresholdMs) {
          logger.log(`[ActivityMonitor] Resume: finalizing stale activity (gap: ${Math.round(gapMs / 1000)}s)`);
          this.finalizeCurrentActivityAtTime(this.lastPollTime);
          this.lastFinalizedActivity = null;
          this.lastFinalizedAt = 0;
          // The frozen window is real untracked time — record it so the scorer
          // doesn't have to guess what the hole means.
          this.recordAbsence(this.lastPollTime, Date.now(), 'suspended');
        }
      }
      this.systemSuspended = false;
      this.handleActive();
    },
  };

  private currentActivity: ActivityEntry | null = null;
  private activityBuffer: ActivityEntry[] = [];

  // Witnessed absences — periods where the monitor was alive and observed the
  // user leave and come back. These replace the old "any gap is a break"
  // inference: only a gap we watched both ends of can honestly be called a
  // break. Everything else is untracked.
  private absenceBuffer: AbsenceRecord[] = [];
  private openAbsence: { start: number; reason: AbsenceReason } | null = null;
  private readonly MAX_ABSENCE_RECORDS = 500;

  // Grace period: remember last finalized activity for merging back
  private lastFinalizedActivity: ActivityEntry | null = null;
  private lastFinalizedAt: number = 0;
  private readonly MERGE_GRACE_PERIOD_MS = 30_000; // 30 seconds
  private readonly MIN_ACTIVITY_DURATION_S = 30; // minimum 30 seconds to record

  // Re-entrancy guard for poll() — see the wrapper below.
  private isPolling = false;

  // Sleep/suspend gap detection
  private lastPollTime: number = 0;
  private readonly GAP_THRESHOLD_MULTIPLIER = 3; // gap = pollInterval * multiplier
  private readonly MAX_ACTIVITY_DURATION_S = 12 * 60 * 60; // 12 hours absolute cap

  // Browser empty title detection (Screen Recording permission)
  private consecutiveEmptyTitles = 0;
  private hasEmittedEmptyTitleWarning = false;

  // Track title changes within current app session
  private currentTitleHistory: Map<string, TitleHistoryEntry> = new Map();
  private currentTitleStartTime: number = 0;

  // Track consecutive null window results to detect permission issues
  private consecutiveNullWindows = 0;
  private hasLoggedPermissionWarning = false;

  // Dynamic import for active-win (ESM module)
  // The function signature includes options to prevent permission dialogs
  private activeWin: ((options?: { screenRecordingPermission: boolean; accessibilityPermission: boolean }) => Promise<ActiveWinResult | undefined>) | null = null;

  constructor(options: ActivityMonitorOptions = {}) {
    super();
    this.pollInterval = options.pollInterval || 5000;
    this.idleTimeout = options.idleTimeout || 10;
    this.trackBrowserTabs = options.trackBrowserTabs ?? true;
    this.excludedApps = new Set(options.excludedApps || []);
    this.categories = options.categories || APP_CATEGORIES;
  }

  /**
   * Start monitoring activity
   */
  async start(): Promise<void> {
    if (this.isRunning) return;

    // Dynamically import active-win (ESM module)
    try {
      logger.log('[ActivityMonitor] Loading active-win module...');
      const activeWinModule = await import('active-win');
      // The module exports default as the main function
      this.activeWin = activeWinModule.default;
      logger.log('[ActivityMonitor] active-win loaded, type:', typeof this.activeWin);

      // Test if it works - pass options to prevent permission dialogs
      // screenRecordingPermission: false - don't prompt for screen recording
      // accessibilityPermission: false - don't prompt for accessibility
      const testResult = await this.activeWin({ screenRecordingPermission: false, accessibilityPermission: false });
      logger.log('[ActivityMonitor] Test poll result:', testResult ? testResult.owner?.name : 'no window');
    } catch (error) {
      logger.error('[ActivityMonitor] Failed to load active-win:', error);
      this.emit('error', new Error('Failed to load active-win module'));
      return;
    }

    this.isRunning = true;
    this.isPaused = false;
    this.isIdle = false;
    // Presence state must not survive a restart — a stale `screenLocked` would
    // keep the monitor permanently absent.
    this.screenLocked = false;
    this.systemSuspended = false;
    this.openAbsence = null;
    this.lastPollTime = Date.now();

    // Set up idle detection
    this.setupIdleDetection();

    // Start polling
    this.pollTimer = setInterval(() => this.poll(), this.pollInterval);

    // Initial poll
    await this.poll();

    this.emit('started');
    logger.log('[ActivityMonitor] Started');
  }

  /**
   * Stop monitoring activity
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    if (this.idleHandlersRegistered) {
      powerMonitor.removeListener('lock-screen', this.idleHandlers.onLock);
      powerMonitor.removeListener('unlock-screen', this.idleHandlers.onUnlock);
      powerMonitor.removeListener('suspend', this.idleHandlers.onSuspend);
      powerMonitor.removeListener('resume', this.idleHandlers.onResume);
      this.idleHandlersRegistered = false;
    }

    // Finalize current activity
    this.finalizeCurrentActivity();

    this.lastPollTime = 0;

    this.emit('stopped');
    logger.log('[ActivityMonitor] Stopped');
  }

  /**
   * Pause monitoring (e.g., when app is hidden)
   */
  pause(): void {
    if (!this.isRunning || this.isPaused) return;
    this.isPaused = true;
    this.finalizeCurrentActivity();
    this.emit('paused');
    logger.log('[ActivityMonitor] Paused');
  }

  /**
   * Resume monitoring
   */
  resume(): void {
    if (!this.isRunning || !this.isPaused) return;
    this.isPaused = false;
    this.emit('resumed');
    logger.log('[ActivityMonitor] Resumed');
  }

  /**
   * Get buffered activities
   */
  getActivities(): ActivityEntry[] {
    return [...this.activityBuffer];
  }

  /**
   * Clear buffered activities (after successful sync)
   */
  clearActivities(): void {
    this.activityBuffer = [];
  }

  /**
   * Get current activity
   */
  getCurrentActivity(): ActivityEntry | null {
    if (!this.currentActivity) return null;

    // Build current title history snapshot
    const titleHistory = Array.from(this.currentTitleHistory.values())
      .filter(t => t.durationSeconds >= 5 || t.title === this.currentActivity?.windowTitle)
      .sort((a, b) => b.durationSeconds - a.durationSeconds);

    // Return a copy with updated duration (capped to prevent sleep inflation)
    const now = Date.now();
    const rawDuration = Math.floor((now - this.currentActivity.startTime) / 1000);
    const duration = Math.min(rawDuration, this.MAX_ACTIVITY_DURATION_S);

    if (rawDuration > this.MAX_ACTIVITY_DURATION_S) {
      logger.warn(`[ActivityMonitor] getCurrentActivity: duration ${rawDuration}s exceeds max, capping to ${this.MAX_ACTIVITY_DURATION_S}s`);
    }

    return {
      ...this.currentActivity,
      endTime: now,
      duration,
      titleHistory,
    };
  }

  /**
   * Update settings
   */
  updateSettings(options: Partial<ActivityMonitorOptions>): void {
    if (options.pollInterval !== undefined) {
      this.pollInterval = options.pollInterval;
      // Restart polling with new interval
      if (this.isRunning && this.pollTimer) {
        clearInterval(this.pollTimer);
        this.pollTimer = setInterval(() => this.poll(), this.pollInterval);
      }
    }
    if (options.idleTimeout !== undefined) {
      this.idleTimeout = options.idleTimeout;
    }
    if (options.trackBrowserTabs !== undefined) {
      this.trackBrowserTabs = options.trackBrowserTabs;
    }
    if (options.excludedApps !== undefined) {
      this.excludedApps = new Set(options.excludedApps);
    }
    if (options.categories !== undefined) {
      this.categories = options.categories;
    }
  }

  /**
   * Assign a project to an activity
   */
  assignProject(activityId: string, projectId: string): boolean {
    const activity = this.activityBuffer.find((a) => a.id === activityId);
    if (activity) {
      activity.projectId = projectId;
      return true;
    }
    return false;
  }

  // Private methods

  private setupIdleDetection(): void {
    if (this.idleHandlersRegistered) return;
    this.idleHandlersRegistered = true;

    // Check idle time every poll
    powerMonitor.on('lock-screen', this.idleHandlers.onLock);
    powerMonitor.on('unlock-screen', this.idleHandlers.onUnlock);
    powerMonitor.on('suspend', this.idleHandlers.onSuspend);
    powerMonitor.on('resume', this.idleHandlers.onResume);
  }

  /**
   * Is the user present right now?
   *
   * HID idle alone is a bad proxy for "not working" — sitting in a call
   * listening looks identical to having left the desk. Lock and suspend are
   * hard overrides: a sleeping Mac cannot be in a meeting.
   */
  private computePresence(idleSeconds: number): { present: boolean; reason: AbsenceReason | null } {
    if (this.systemSuspended) return { present: false, reason: 'suspended' };
    if (this.screenLocked) return { present: false, reason: 'locked' };
    if (idleSeconds / 60 < this.idleTimeout) return { present: true, reason: null };
    // Passive presence: a live meeting counts as work even with no input.
    if (this.meetingActive) return { present: true, reason: null };
    return { present: false, reason: 'idle' };
  }

  /**
   * @param idleStartMs when the user actually stopped interacting — NOT
   *   `Date.now()`. Finalizing at "now" credited up to a full idleTimeout of
   *   already-idle time as work.
   */
  private handleIdle(idleStartMs: number, reason: AbsenceReason): void {
    if (this.isIdle) return;
    this.isIdle = true;
    this.finalizeCurrentActivityAtTime(idleStartMs);
    // Don't merge across an absence — coming back after a break should start a
    // new entry, not resume the one from before.
    this.lastFinalizedActivity = null;
    this.lastFinalizedAt = 0;
    this.openAbsence = { start: idleStartMs, reason };
    this.emit('idle', { start: idleStartMs, reason });
  }

  private handleActive(): void {
    if (!this.isIdle) return;
    this.isIdle = false;
    if (this.openAbsence) {
      // The user is interacting again as of now minus however long they'd been
      // idle at this instant (usually ~0 on a real keypress).
      const end = Date.now() - powerMonitor.getSystemIdleTime() * 1000;
      this.recordAbsence(this.openAbsence.start, Math.max(end, this.openAbsence.start), this.openAbsence.reason);
      this.openAbsence = null;
    }
    this.emit('active');
  }

  private recordAbsence(start: number, end: number, reason: AbsenceReason): void {
    if (end <= start) return;
    const record: AbsenceRecord = { start, end, reason };
    this.absenceBuffer.push(record);
    // Scoring only ever looks at the current day; keep the buffer bounded in
    // case nothing drains it.
    if (this.absenceBuffer.length > this.MAX_ABSENCE_RECORDS) {
      this.absenceBuffer.splice(0, this.absenceBuffer.length - this.MAX_ABSENCE_RECORDS);
    }
    this.emit('absence', record);
  }

  /** Drain witnessed absences for syncing/scoring. */
  getAbsences(): AbsenceRecord[] {
    return [...this.absenceBuffer];
  }

  clearAbsences(): void {
    this.absenceBuffer = [];
  }

  /**
   * Set by the meeting detector. While true, HID idle does not end tracking.
   */
  setMeetingActive(active: boolean): void {
    this.meetingActive = active;
  }

  private async poll(): Promise<void> {
    // Polling runs on a fixed setInterval while the body awaits AppleScript
    // enrichment, which can block far past one interval when a browser's
    // Automation consent dialog is pending (~120s). Without this guard, polls
    // stack and each one spawns more osascript processes.
    if (this.isPolling) return;
    this.isPolling = true;
    try {
      await this.pollOnce();
    } finally {
      this.isPolling = false;
    }
  }

  private async pollOnce(): Promise<void> {
    // NOTE: `isIdle` is deliberately NOT part of this guard. It used to be, and
    // because nothing else in poll() could clear it, crossing the idle
    // threshold once stopped tracking permanently until the next screen
    // lock/unlock or sleep/wake. Idle recovery is handled below.
    if (this.isPaused || !this.activeWin) return;

    const now = Date.now();

    // --- Sleep/suspend gap detection ---
    // If the gap since last poll is abnormally large, the process was likely
    // frozen during macOS sleep. Finalize the current activity using lastPollTime
    // as the true end time (NOT Date.now(), which would include sleep hours).
    if (this.lastPollTime > 0 && this.currentActivity) {
      const gapMs = now - this.lastPollTime;
      const thresholdMs = this.pollInterval * this.GAP_THRESHOLD_MULTIPLIER;

      if (gapMs > thresholdMs) {
        logger.log(
          `[ActivityMonitor] Sleep/suspend gap detected: ${Math.round(gapMs / 1000)}s since last poll (threshold: ${Math.round(thresholdMs / 1000)}s)`
        );
        this.finalizeCurrentActivityAtTime(this.lastPollTime);
        // Clear grace period so the next activity starts fresh
        this.lastFinalizedActivity = null;
        this.lastFinalizedAt = 0;
      }
    }
    this.lastPollTime = now;

    // Presence, not raw HID idle — a live meeting keeps us present, a locked
    // or suspended machine does not, regardless of input.
    const idleSeconds = powerMonitor.getSystemIdleTime();
    const presence = this.computePresence(idleSeconds);

    if (!presence.present) {
      if (!this.isIdle) {
        // Finalize at the moment input actually stopped, not now.
        this.handleIdle(now - idleSeconds * 1000, presence.reason ?? 'idle');
      }
      return;
    }

    if (this.isIdle) {
      this.handleActive();
    }

    try {
      // Pass options to prevent permission dialogs on every poll
      const win = await this.activeWin({ screenRecordingPermission: false, accessibilityPermission: false });

      if (!win) {
        this.consecutiveNullWindows++;
        if (this.consecutiveNullWindows >= 5 && !this.hasLoggedPermissionWarning) {
          logger.log('[ActivityMonitor] Multiple consecutive polls returned no window data.');
          logger.log('[ActivityMonitor] If you have apps open, this may indicate missing permissions.');
          logger.log('[ActivityMonitor] Try granting Accessibility and Screen Recording permissions in System Settings.');
          this.hasLoggedPermissionWarning = true;
          this.emit('permissionWarning');
        }
        return;
      }

      // Reset counter on successful poll
      if (this.consecutiveNullWindows > 0 || !this.hasLoggedPermissionWarning) {
        // Log first successful poll with full details for diagnostics
        if (this.consecutiveNullWindows === 0 && !this.hasLoggedPermissionWarning) {
          const titleStatus = win.title ? `"${win.title.substring(0, 60)}"` : '(EMPTY - Screen Recording may need app restart)';
          const urlStatus = win.url ? `"${win.url.substring(0, 60)}"` : '(none)';
          logger.log(`[ActivityMonitor] First poll: app=${win.owner.name}, title=${titleStatus}, url=${urlStatus}`);
          if (!win.title) {
            logger.log('[ActivityMonitor] WARNING: Window titles are empty. Try quitting and relaunching the app after granting Screen Recording permission.');
          }
        }
      }
      this.consecutiveNullWindows = 0;

      const appName = win.owner.name;

      // Check if app is excluded
      if (this.excludedApps.has(appName)) {
        this.finalizeCurrentActivity();
        return;
      }

      let windowTitle = win.title || '';
      let url = this.trackBrowserTabs ? win.url : undefined;
      const isBrowserApp = isBrowser(appName);

      // AppleScript enrichment: when active-win returns empty title/URL
      // (Screen Recording permission not granted, or browser doesn't expose URLs).
      // Several browsers (Dia, Orion, Zen) NEVER expose data to active-win regardless
      // of permissions — AppleScript is the only path. So we always try enrichment
      // before judging whether titles are actually missing.
      if (!windowTitle || (isBrowserApp && this.trackBrowserTabs && !url)) {
        try {
          const enrichment = await enrichWithAppleScript(
            appName,
            isBrowserApp,
            !!windowTitle,
            !!url,
            this.trackBrowserTabs,
          );
          if (enrichment.title || enrichment.url) {
            logger.debug(`[ActivityMonitor] AppleScript enriched "${appName}": title="${enrichment.title?.substring(0, 60) || ''}" url="${enrichment.url?.substring(0, 60) || ''}"`);
          }
          if (enrichment.title && !windowTitle) windowTitle = enrichment.title;
          if (enrichment.url && !url) url = enrichment.url;
        } catch (e) {
          logger.error('[ActivityMonitor] AppleScript enrichment error:', e);
        }
      }

      // Detect "Screen Recording granted but needs app restart" — only valid when
      // BOTH active-win AND AppleScript came up empty for a browser. Previously this
      // checked raw `win.title` and fired constantly for Dia/Orion/Zen users (those
      // browsers don't expose data to active-win at all; AppleScript fills the gap),
      // producing a permanent false-positive "needs restart" warning.
      if (isBrowserApp && !windowTitle) {
        this.consecutiveEmptyTitles++;
        if (this.consecutiveEmptyTitles >= 3 && !this.hasEmittedEmptyTitleWarning) {
          this.hasEmittedEmptyTitleWarning = true;
          this.emit('emptyTitles');
        }
      } else if (windowTitle) {
        // Either active-win or AppleScript got a title — system is working.
        // If we previously warned, tell the renderer to clear the sticky banner;
        // otherwise the user keeps seeing "needs restart" after the transient
        // empty-title condition (browser launching, about:blank, focus race) clears.
        if (this.hasEmittedEmptyTitleWarning) {
          this.emit('titlesRecovered');
        }
        this.consecutiveEmptyTitles = 0;
        this.hasEmittedEmptyTitleWarning = false;
      }

      // A user correction for this app+title beats the classifier — otherwise
      // "this was a meeting" has to be re-applied every single day.
      const category =
        this.categoryOverrideLookup?.(appName, windowTitle) ??
        categorizeActivity(appName, windowTitle, url, this.categories);
      const projectSuggestion = this.suggestProject(appName, windowTitle, url);
      const bundleId = win.owner.bundleId;
      const appPath = win.owner.path;
      const detail = extractDetail(appName, windowTitle, url);


      // Determine if this is the "same session" as the current activity.
      // For non-browsers: same app name (different window titles are just sub-activities)
      // For browsers: same app + same domain (different domains = different work context)
      const isSameSession = (current: ActivityEntry): boolean => {
        if (current.appName !== appName) return false;

        // For browsers, also require same domain to avoid merging unrelated browsing
        if (isBrowser(appName)) {
          const currentDomain = extractDomainForGrouping(current.url, current.windowTitle);
          const newDomain = extractDomainForGrouping(url, windowTitle);
          // If both have domains, they must match. If neither has a domain, they match.
          if (currentDomain || newDomain) {
            return currentDomain === newDomain;
          }
        }

        return true;
      };

      // Check if this is a continuation of the current activity
      if (this.currentActivity) {
        if (isSameSession(this.currentActivity)) {
          // Same app session — update window title tracking but don't create new entry
          this.trackTitleChange(windowTitle, url, detail);
          // Update the "current" window title and detail to the latest
          this.currentActivity.windowTitle = windowTitle;
          this.currentActivity.url = url;
          this.currentActivity.detail = detail;
          // Update category if it changed (e.g., browser navigated to different category site)
          if (category !== 'uncategorized') {
            this.currentActivity.category = category;
          }
        } else {
          // Different app/context — finalize old, check grace period, start new
          this.finalizeCurrentActivity();

          // Grace period: if we're returning to the same app we just left within 30s, merge back
          if (
            this.lastFinalizedActivity &&
            Date.now() - this.lastFinalizedAt <= this.MERGE_GRACE_PERIOD_MS &&
            isSameSession(this.lastFinalizedActivity)
          ) {
            this.resumeActivity(this.lastFinalizedActivity, windowTitle, url, category, detail);
          } else {
            this.startNewActivity(appName, windowTitle, url, category, projectSuggestion, bundleId, appPath, detail);
          }
        }
      } else {
        // No current activity — check grace period for merge, or start fresh
        if (
          this.lastFinalizedActivity &&
          Date.now() - this.lastFinalizedAt <= this.MERGE_GRACE_PERIOD_MS &&
          isSameSession(this.lastFinalizedActivity)
        ) {
          this.resumeActivity(this.lastFinalizedActivity, windowTitle, url, category, detail);
        } else {
          this.startNewActivity(appName, windowTitle, url, category, projectSuggestion, bundleId, appPath, detail);
        }
      }
    } catch (error) {
      logger.error('[ActivityMonitor] Poll error:', error);
    }
  }

  private startNewActivity(
    appName: string,
    windowTitle: string,
    url: string | undefined,
    category: string,
    projectSuggestion: string | undefined,
    bundleId?: string,
    appPath?: string,
    detail?: ActivityDetail
  ): void {
    const now = Date.now();
    this.currentTitleHistory.clear();
    this.currentTitleStartTime = now;

    const entryDetail = detail || extractDetail(appName, windowTitle, url);

    this.currentActivity = {
      id: `${now}-${Math.random().toString(36).substr(2, 9)}`,
      appName,
      windowTitle,
      url,
      category,
      startTime: now,
      endTime: now,
      duration: 0,
      projectSuggestion,
      bundleId,
      appPath,
      detail: entryDetail,
      titleHistory: [],
    };

    // Track the initial title
    this.trackTitleChange(windowTitle, url, entryDetail);

    this.emit('activityStarted', this.currentActivity);
  }

  /**
   * Resume a previously finalized activity (grace period merge).
   * Removes it from the buffer and makes it current again.
   */
  private resumeActivity(
    previous: ActivityEntry,
    windowTitle: string,
    url: string | undefined,
    category: string,
    detail: ActivityDetail
  ): void {
    // Remove from buffer (it was added during finalization)
    const bufferIdx = this.activityBuffer.findIndex(a => a.id === previous.id);
    if (bufferIdx !== -1) {
      this.activityBuffer.splice(bufferIdx, 1);
    }

    // Restore title history
    this.currentTitleHistory.clear();
    if (previous.titleHistory) {
      for (const entry of previous.titleHistory) {
        this.currentTitleHistory.set(entry.title, entry);
      }
    }

    // Resume as current activity
    this.currentActivity = {
      ...previous,
      windowTitle,
      url,
      detail,
      // Keep original start time, update end time
      endTime: Date.now(),
    };

    // Update category if the new one is more specific
    if (category !== 'uncategorized') {
      this.currentActivity.category = category;
    }

    this.currentTitleStartTime = Date.now();
    this.trackTitleChange(windowTitle, url, detail);

    this.lastFinalizedActivity = null;
    logger.log(`[ActivityMonitor] Resumed ${previous.appName} activity (grace period merge)`);
    this.emit('activityResumed', previous.id);
    this.emit('activityStarted', this.currentActivity);
  }

  /**
   * Track a window title change within the current app session.
   */
  private trackTitleChange(windowTitle: string, _url: string | undefined, detail: ActivityDetail): void {
    const now = Date.now();
    const existing = this.currentTitleHistory.get(windowTitle);

    if (existing) {
      // Update duration for this title
      existing.lastSeen = now;
      existing.durationSeconds += Math.floor((now - this.currentTitleStartTime) / 1000);
    } else {
      // New title in this session
      this.currentTitleHistory.set(windowTitle, {
        title: windowTitle,
        detail,
        firstSeen: now,
        lastSeen: now,
        durationSeconds: 0,
      });
    }
    this.currentTitleStartTime = now;
  }

  private finalizeCurrentActivity(): void {
    if (!this.currentActivity) return;

    const now = Date.now();
    // Cap duration to prevent sleep/suspend inflation
    const duration = Math.min(
      Math.floor((now - this.currentActivity.startTime) / 1000),
      this.MAX_ACTIVITY_DURATION_S
    );

    // Finalize the last tracked title's duration
    if (this.currentTitleStartTime > 0) {
      const lastTitle = this.currentActivity.windowTitle;
      const existing = this.currentTitleHistory.get(lastTitle);
      if (existing) {
        existing.lastSeen = now;
        existing.durationSeconds += Math.floor((now - this.currentTitleStartTime) / 1000);
      }
    }

    // Build sorted title history (by duration, descending)
    const titleHistory = Array.from(this.currentTitleHistory.values())
      .filter(t => t.durationSeconds >= 5) // Only include titles seen for 5+ seconds
      .sort((a, b) => b.durationSeconds - a.durationSeconds);

    // Only save activities that meet minimum duration
    if (duration >= this.MIN_ACTIVITY_DURATION_S) {
      const finalActivity: ActivityEntry = {
        ...this.currentActivity,
        endTime: now,
        duration,
        titleHistory,
      };

      // Set the best project suggestion from title history
      if (!finalActivity.projectSuggestion) {
        for (const entry of titleHistory) {
          if (entry.detail.project) {
            finalActivity.projectSuggestion = entry.detail.project;
            break;
          }
        }
      }

      this.activityBuffer.push(finalActivity);
      this.emit('activityEnded', finalActivity);

      // Remember for grace period merging
      this.lastFinalizedActivity = finalActivity;
      this.lastFinalizedAt = now;
    }

    this.currentActivity = null;
    this.currentTitleHistory.clear();
    this.currentTitleStartTime = 0;
  }

  /**
   * Finalize current activity using a specific timestamp as the end time.
   * Used when a sleep/suspend gap is detected — we use lastPollTime (the last
   * time we know the user was active), not Date.now() which includes sleep hours.
   */
  private finalizeCurrentActivityAtTime(endTimeMs: number): void {
    if (!this.currentActivity) return;

    const duration = Math.min(
      Math.floor((endTimeMs - this.currentActivity.startTime) / 1000),
      this.MAX_ACTIVITY_DURATION_S
    );

    // Finalize the last tracked title's duration
    if (this.currentTitleStartTime > 0) {
      const lastTitle = this.currentActivity.windowTitle;
      const existing = this.currentTitleHistory.get(lastTitle);
      if (existing) {
        existing.lastSeen = endTimeMs;
        existing.durationSeconds += Math.floor((endTimeMs - this.currentTitleStartTime) / 1000);
      }
    }

    // Build sorted title history
    const titleHistory = Array.from(this.currentTitleHistory.values())
      .filter(t => t.durationSeconds >= 5)
      .sort((a, b) => b.durationSeconds - a.durationSeconds);

    if (duration >= this.MIN_ACTIVITY_DURATION_S) {
      const finalActivity: ActivityEntry = {
        ...this.currentActivity,
        endTime: endTimeMs,
        duration,
        titleHistory,
      };

      if (!finalActivity.projectSuggestion) {
        for (const entry of titleHistory) {
          if (entry.detail.project) {
            finalActivity.projectSuggestion = entry.detail.project;
            break;
          }
        }
      }

      this.activityBuffer.push(finalActivity);
      this.emit('activityEnded', finalActivity);

      // Do NOT set lastFinalizedActivity — after a sleep gap, we want a
      // clean break, not a grace-period merge into the stale activity.
    }

    this.currentActivity = null;
    this.currentTitleHistory.clear();
    this.currentTitleStartTime = 0;
  }

  private suggestProject(
    appName: string,
    windowTitle: string,
    url?: string
  ): string | undefined {
    // VS Code pattern
    const vscodeMatch = windowTitle.match(/^(.+?)\s*[-\u2014]\s*.+\s*[-\u2014]\s*(?:Visual Studio Code|Code|Cursor)$/i);
    if (vscodeMatch) {
      return vscodeMatch[1].trim();
    }

    // Terminal/iTerm pattern with path
    const terminalMatch = windowTitle.match(/^(?:~\/)?(.+?)(?:\/|$)/);
    if (terminalMatch && (appName.includes('Terminal') || appName.includes('iTerm'))) {
      return terminalMatch[1].trim();
    }

    // Figma pattern
    const figmaMatch = windowTitle.match(/^(.+?)\s*[-\u2014]\s*Figma$/i);
    if (figmaMatch) {
      return figmaMatch[1].trim();
    }

    // GitHub repo pattern from URL
    if (url && url.includes('github.com')) {
      const repoMatch = url.match(/github\.com\/([^/]+\/[^/]+)/);
      if (repoMatch) {
        return repoMatch[1];
      }
    }

    // Linear/Jira ticket pattern
    const ticketMatch = windowTitle.match(/([A-Z]+-\d+)/);
    if (ticketMatch) {
      return ticketMatch[1];
    }

    return undefined;
  }
}

// Singleton instance
let activityMonitorInstance: ActivityMonitor | null = null;

export function createActivityMonitor(options?: ActivityMonitorOptions): ActivityMonitor {
  if (activityMonitorInstance) {
    activityMonitorInstance.stop();
  }
  activityMonitorInstance = new ActivityMonitor(options);
  return activityMonitorInstance;
}

export function getActivityMonitor(): ActivityMonitor | null {
  return activityMonitorInstance;
}