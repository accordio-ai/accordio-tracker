/**
 * Project Suggestion Hook (Timely-style learning)
 *
 * Learns from user's manual project assignments and gets smarter over time.
 * Tracks multiple signals: app name, window title context, URL domain.
 * Supports auto-assign for high-confidence matches.
 */

import { useState, useCallback, useMemo } from 'react';

interface Project {
  id: string;
  name: string;
  client_name?: string;
}

interface TimeEntry {
  id: string;
  appName: string;
  windowTitle: string;
  url?: string;
  projectId?: string;
  duration: number;
}

export interface ProjectSuggestion {
  project: Project;
  confidence: number; // 0-1
  reason: 'history' | 'keyword' | 'path' | 'url' | 'title_context' | 'recent';
}

// Storage key for assignment history
const ASSIGNMENT_HISTORY_KEY = 'projectAssignmentHistory_v2';
const AUTO_ASSIGN_THRESHOLD = 0.85;

/**
 * Pattern types we track for learning.
 * Each manual assignment generates multiple patterns.
 */
interface PatternEntry {
  projectId: string;
  count: number;
  lastAssigned: number;
}

interface AssignmentHistory {
  // By app name (non-browser apps)
  byApp: Record<string, PatternEntry>;
  // By window title context (extracted project/file name)
  byTitleContext: Record<string, PatternEntry>;
  // By URL domain (for browser tabs)
  byUrlDomain: Record<string, PatternEntry>;
}

function loadHistory(): AssignmentHistory {
  try {
    const stored = localStorage.getItem(ASSIGNMENT_HISTORY_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Handle v2 format
      if (parsed.byApp) return parsed;
    }

    // Migrate from v1 format
    const v1 = localStorage.getItem('projectAssignmentHistory');
    if (v1) {
      const v1Data = JSON.parse(v1) as Record<string, { projectId: string; count: number; lastAssigned: number }>;
      const migrated: AssignmentHistory = { byApp: {}, byTitleContext: {}, byUrlDomain: {} };
      for (const [appName, entry] of Object.entries(v1Data)) {
        migrated.byApp[appName.toLowerCase()] = entry;
      }
      saveHistory(migrated);
      return migrated;
    }

    return { byApp: {}, byTitleContext: {}, byUrlDomain: {} };
  } catch {
    return { byApp: {}, byTitleContext: {}, byUrlDomain: {} };
  }
}

function saveHistory(history: AssignmentHistory): void {
  try {
    localStorage.setItem(ASSIGNMENT_HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Ignore storage errors
  }
}

const BROWSER_APPS = new Set([
  'google chrome', 'chrome', 'safari', 'firefox', 'microsoft edge',
  'brave browser', 'brave', 'librewolf', 'tor browser', 'mullvad browser', 'waterfox', 'helium',
  'arc', 'arc browser', 'vivaldi', 'opera', 'opera gx', 'wavebox', 'sidekick', 'shift', 'sigmaos', 'stack',
  'zen browser', 'dia', 'orion', 'comet', 'floorp',
  'firefox developer edition', 'safari technology preview', 'polypane',
  'chromium', 'min',
]);

/**
 * Extract a project context key from a window title.
 * Returns a normalized string for matching.
 */
function extractTitleContext(windowTitle: string, appName: string): string | null {
  const title = windowTitle.trim();
  if (!title || title.length < 3) return null;

  // VS Code / Cursor: "project-name — file.tsx — Visual Studio Code"
  const vscodeMatch = title.match(/^(.+?)\s*[-–—]\s*.+\s*[-–—]\s*(?:Visual Studio Code|Code|Cursor)$/i);
  if (vscodeMatch) return vscodeMatch[1].trim().toLowerCase();

  // Figma: "File Name — Figma"
  const figmaMatch = title.match(/^(.+?)\s*[-–—]\s*Figma$/i);
  if (figmaMatch) return figmaMatch[1].trim().toLowerCase();

  // Terminal with path: ~/project-name or /Users/.../project-name
  if (/terminal|iterm|warp|hyper|alacritty|kitty/i.test(appName)) {
    const pathMatch = title.match(/(?:~\/|\/[^/]+\/)+([^/\s]+)/);
    if (pathMatch) return pathMatch[1].trim().toLowerCase();
  }

  // Linear/Jira ticket: "ACC-123 — Task title"
  const ticketMatch = title.match(/^([A-Z]+-\d+)/);
  if (ticketMatch) {
    return ticketMatch[1].split('-')[0].toLowerCase() + '-'; // "acc-"
  }

  // GitHub: "owner/repo" in title
  const githubMatch = title.match(/([a-zA-Z0-9-]+\/[a-zA-Z0-9._-]+)/);
  if (githubMatch && !githubMatch[1].includes('://')) {
    return githubMatch[1].toLowerCase();
  }

  return null;
}

/**
 * Extract domain from URL for pattern matching.
 */
function extractUrlDomain(url?: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');
    // Skip generic domains
    const GENERIC = new Set([
      'google.com', 'bing.com', 'duckduckgo.com',
      'youtube.com', 'twitter.com', 'x.com', 'reddit.com',
      'facebook.com', 'instagram.com', 'linkedin.com',
      'stackoverflow.com', 'github.com',
      'mail.google.com', 'docs.google.com', 'slack.com',
    ]);
    if (GENERIC.has(host)) return null;
    return host;
  } catch {
    return null;
  }
}

export function useProjectSuggestion(projects: Project[], entries: TimeEntry[]) {
  const [history, setHistory] = useState<AssignmentHistory>(() => loadHistory());

  /**
   * Record a project assignment — learns multiple patterns from the entry.
   * Called on both manual and auto assignments.
   */
  const recordAssignment = useCallback((
    appName: string,
    projectId: string,
    windowTitle?: string,
    url?: string
  ) => {
    setHistory(prev => {
      const updated = { ...prev };

      // 1. Learn app name (non-browser)
      const lowerApp = appName.toLowerCase();
      if (!BROWSER_APPS.has(lowerApp)) {
        const existing = updated.byApp[lowerApp];
        updated.byApp = {
          ...updated.byApp,
          [lowerApp]: {
            projectId,
            count: (existing?.count || 0) + 1,
            lastAssigned: Date.now(),
          },
        };
      }

      // 2. Learn window title context
      if (windowTitle) {
        const context = extractTitleContext(windowTitle, appName);
        if (context) {
          const existing = updated.byTitleContext[context];
          updated.byTitleContext = {
            ...updated.byTitleContext,
            [context]: {
              projectId,
              count: (existing?.count || 0) + 1,
              lastAssigned: Date.now(),
            },
          };
        }
      }

      // 3. Learn URL domain
      const domain = extractUrlDomain(url);
      if (domain) {
        const existing = updated.byUrlDomain[domain];
        updated.byUrlDomain = {
          ...updated.byUrlDomain,
          [domain]: {
            projectId,
            count: (existing?.count || 0) + 1,
            lastAssigned: Date.now(),
          },
        };
      }

      saveHistory(updated);
      return updated;
    });

    // Also call server-side learn-pattern endpoint (fire-and-forget)
    try {
      window.electron.time.learnPattern?.(appName, projectId, windowTitle || '', url);
    } catch {
      // Non-critical
    }
  }, []);

  /**
   * Record a deletion/unassignment — decrements patterns so the system
   * stops suggesting this app/title/url combo for the same project.
   */
  const recordDeletion = useCallback((
    appName: string,
    windowTitle?: string,
    url?: string
  ) => {
    setHistory(prev => {
      const updated = { ...prev };

      // Decrement app pattern
      const lowerApp = appName.toLowerCase();
      if (!BROWSER_APPS.has(lowerApp) && updated.byApp[lowerApp]) {
        updated.byApp[lowerApp].count = Math.max(0, updated.byApp[lowerApp].count - 2);
        if (updated.byApp[lowerApp].count <= 0) {
          const { [lowerApp]: _, ...rest } = updated.byApp;
          updated.byApp = rest;
        }
      }

      // Decrement title context pattern
      if (windowTitle) {
        const context = extractTitleContext(windowTitle, appName);
        if (context && updated.byTitleContext[context]) {
          updated.byTitleContext[context].count = Math.max(0, updated.byTitleContext[context].count - 2);
          if (updated.byTitleContext[context].count <= 0) {
            const { [context]: _, ...rest } = updated.byTitleContext;
            updated.byTitleContext = rest;
          }
        }
      }

      // Decrement URL domain pattern
      const domain = extractUrlDomain(url);
      if (domain && updated.byUrlDomain[domain]) {
        updated.byUrlDomain[domain].count = Math.max(0, updated.byUrlDomain[domain].count - 2);
        if (updated.byUrlDomain[domain].count <= 0) {
          const { [domain]: _, ...rest } = updated.byUrlDomain;
          updated.byUrlDomain = rest;
        }
      }

      saveHistory(updated);
      return updated;
    });
  }, []);

  // Get recent projects from entries
  const recentProjects = useMemo(() => {
    const projectCounts = new Map<string, { project: Project; count: number; lastUsed: number }>();

    entries.forEach(entry => {
      if (entry.projectId) {
        const project = projects.find(p => p.id === entry.projectId);
        if (project) {
          const existing = projectCounts.get(entry.projectId);
          if (existing) {
            existing.count += 1;
            existing.lastUsed = Math.max(existing.lastUsed, Date.now());
          } else {
            projectCounts.set(entry.projectId, { project, count: 1, lastUsed: Date.now() });
          }
        }
      }
    });

    return Array.from(projectCounts.values())
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return b.lastUsed - a.lastUsed;
      })
      .map(item => item.project)
      .slice(0, 5);
  }, [entries, projects]);

  /**
   * Suggest a project for a given entry.
   * Uses multiple signals with confidence scoring.
   */
  const suggestProject = useCallback((
    appName: string,
    windowTitle: string,
    url?: string
  ): ProjectSuggestion | null => {
    const suggestions: ProjectSuggestion[] = [];

    // 1. URL domain match (highest signal for browsers)
    const domain = extractUrlDomain(url);
    if (domain) {
      const domainEntry = history.byUrlDomain[domain];
      if (domainEntry) {
        const project = projects.find(p => p.id === domainEntry.projectId);
        if (project) {
          const confidence = Math.min(0.95, 0.7 + (domainEntry.count * 0.05));
          suggestions.push({ project, confidence, reason: 'url' });
        }
      }
    }

    // 2. Window title context match
    const titleContext = extractTitleContext(windowTitle, appName);
    if (titleContext) {
      const contextEntry = history.byTitleContext[titleContext];
      if (contextEntry) {
        const project = projects.find(p => p.id === contextEntry.projectId);
        if (project) {
          const confidence = Math.min(0.95, 0.7 + (contextEntry.count * 0.05));
          suggestions.push({ project, confidence, reason: 'title_context' });
        }
      }
    }

    // 3. App name history (non-browser)
    const lowerApp = appName.toLowerCase();
    if (!BROWSER_APPS.has(lowerApp)) {
      const appEntry = history.byApp[lowerApp];
      if (appEntry) {
        const project = projects.find(p => p.id === appEntry.projectId);
        if (project) {
          const confidence = Math.min(0.95, 0.6 + (appEntry.count * 0.05));
          suggestions.push({ project, confidence, reason: 'history' });
        }
      }
    }

    // 4. Keyword match in window title / app name
    const lowerTitle = windowTitle.toLowerCase();
    for (const project of projects) {
      const projectWords = project.name.toLowerCase().split(/\s+/);
      const clientWords = project.client_name?.toLowerCase().split(/\s+/) || [];
      const allKeywords = [...projectWords, ...clientWords].filter(w => w.length > 2);

      for (const keyword of allKeywords) {
        if (lowerTitle.includes(keyword) || lowerApp.includes(keyword)) {
          suggestions.push({ project, confidence: 0.75, reason: 'keyword' });
          break;
        }
      }
    }

    // 5. Path pattern match
    const pathMatch = windowTitle.match(/[/\\]([^/\\]+)[/\\]?(?:src|lib|app)?[/\\]?/);
    if (pathMatch) {
      const folderName = pathMatch[1].toLowerCase();
      for (const project of projects) {
        const projectSlug = project.name.toLowerCase().replace(/\s+/g, '-');
        const clientSlug = project.client_name?.toLowerCase().replace(/\s+/g, '-') || '';

        if (folderName.includes(projectSlug) || folderName.includes(clientSlug) ||
            projectSlug.includes(folderName) || clientSlug.includes(folderName)) {
          suggestions.push({ project, confidence: 0.8, reason: 'path' });
        }
      }
    }

    // 6. Recent usage fallback
    if (recentProjects.length > 0 && suggestions.length === 0) {
      suggestions.push({ project: recentProjects[0], confidence: 0.3, reason: 'recent' });
    }

    // Deduplicate by project, keeping highest confidence
    const bestByProject = new Map<string, ProjectSuggestion>();
    for (const s of suggestions) {
      const existing = bestByProject.get(s.project.id);
      if (!existing || s.confidence > existing.confidence) {
        bestByProject.set(s.project.id, s);
      }
    }

    const deduped = Array.from(bestByProject.values()).sort((a, b) => b.confidence - a.confidence);
    return deduped[0] || null;
  }, [projects, history, recentProjects]);

  /**
   * Check if an entry should be auto-assigned.
   * Returns the project ID if confidence exceeds threshold.
   */
  const getAutoAssignment = useCallback((
    appName: string,
    windowTitle: string,
    url?: string
  ): { projectId: string; confidence: number } | null => {
    const suggestion = suggestProject(appName, windowTitle, url);
    if (suggestion && suggestion.confidence >= AUTO_ASSIGN_THRESHOLD) {
      return { projectId: suggestion.project.id, confidence: suggestion.confidence };
    }
    return null;
  }, [suggestProject]);

  return {
    suggestProject,
    recordAssignment,
    recordDeletion,
    recentProjects,
    getAutoAssignment,
    autoAssignThreshold: AUTO_ASSIGN_THRESHOLD,
  };
}

export default useProjectSuggestion;
