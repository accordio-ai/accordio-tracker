import { useState, useEffect, useMemo, useRef } from 'react';
import NumberFlow from '@number-flow/react';
import { useTimeTracker, formatDuration } from '../hooks/useTimeTracker';
import { useActiveTask } from '../hooks/useActiveTask';
import { useProjectSuggestion } from '../hooks/useProjectSuggestion';
import { useIntegrations } from '../hooks/useIntegrations';
import { useProjects } from '../hooks/useProjects';
import { computeScores } from '../../shared/categories';
import { AppIcon, CategoryBadge } from './AppIcon';
import { ProjectPicker, getProjectColor } from './ProjectPicker';
import { EditableDuration } from './EditableDuration';

// Map common window-title fragments to domains so we can show a favicon
// even when the browser didn't expose a URL (Dia, Orion, permission denied, etc.).
const TITLE_DOMAIN_PATTERNS: Array<[RegExp, string]> = [
  [/\blinkedin\b|post \| feed/i, 'linkedin.com'],
  [/\bslack\b/i, 'slack.com'],
  [/\bgithub\b/i, 'github.com'],
  [/\bfigma\b/i, 'figma.com'],
  [/\bnotion\b/i, 'notion.so'],
  [/\byoutube\b/i, 'youtube.com'],
  [/\btwitter\b|\s𝕏\b|\s\/ X$/i, 'twitter.com'],
  [/\breddit\b/i, 'reddit.com'],
  [/\bgmail\b|inbox.*mail/i, 'gmail.com'],
  [/google docs|untitled document/i, 'docs.google.com'],
  [/google sheets|untitled spreadsheet/i, 'sheets.google.com'],
  [/google slides|untitled presentation/i, 'slides.google.com'],
  [/google drive/i, 'drive.google.com'],
  [/google calendar/i, 'calendar.google.com'],
  [/google meet/i, 'meet.google.com'],
  [/\bnetflix\b/i, 'netflix.com'],
  [/\bspotify\b/i, 'spotify.com'],
  [/stack overflow/i, 'stackoverflow.com'],
  [/\btelegram\b/i, 'web.telegram.org'],
  [/\bwhatsapp\b/i, 'web.whatsapp.com'],
  [/\bchatgpt\b|open ?ai/i, 'chatgpt.com'],
  [/\bclaude\b/i, 'claude.ai'],
  [/\bvercel\b/i, 'vercel.com'],
  [/\bsupabase\b/i, 'supabase.com'],
  [/\bstripe\b/i, 'stripe.com'],
  [/\bcomposio\b/i, 'composio.dev'],
  [/\blinear\b/i, 'linear.app'],
  [/\bsubstack\b/i, 'substack.com'],
  [/\bgoogle search\b|- google search/i, 'google.com'],
];

function inferUrlFromTitle(title: string | undefined | null): string | undefined {
  if (!title) return undefined;
  for (const [pattern, domain] of TITLE_DOMAIN_PATTERNS) {
    if (pattern.test(title)) return `https://${domain}`;
  }
  return undefined;
}

interface ActivityHubProps {
  onShowSettings?: () => void;
}

// Circular progress component for stats
function CircularProgress({
  value,
  max,
  size = 52,
  strokeWidth = 5,
  color = '#78D277',
  children
}: {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  children?: React.ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const progress = max > 0 ? Math.min(value / max, 1) : 0;
  const offset = circumference - progress * circumference;

  return (
    <div className="circular-progress" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
          stroke="rgba(0,0,0,0.1)"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      {children && (
        <div className="circular-progress-content">
          {children}
        </div>
      )}
    </div>
  );
}

export function ActivityHub({ onShowSettings: _onShowSettings }: ActivityHubProps) {
  const {
    projects,
    status: projectsStatus,
    errorCode: projectsErrorCode,
    reload: reloadProjects,
  } = useProjects();
  const [isSyncing, setIsSyncing] = useState(false);
  const [timerError, setTimerError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const [expandedGroupKey, setExpandedGroupKey] = useState<string | null>(null);
  const memoriesListRef = useRef<HTMLDivElement>(null);

  // Integrations hook (used in settings, not activity tab)
  const { priorityIntegrations: _priorityIntegrations, connectIntegration: _connectIntegration } = useIntegrations();

  // Track last meaningful activity (not Electron/Accordio AGI)
  const lastMeaningfulActivityRef = useRef<typeof currentActivity>(null);

  const {
    currentActivity,
    entries,
    allEntries,
    summary,
    settings,
    syncStatus,
    formattedWeek,
    isIdle,
    absences,
    currentMeeting,
    permissionStatus,
    permissionError,
    isCheckingPermissions,
    hasEmptyTitles,
    syncNow,
    assignProject,
    updateEntryDuration,
    updateSettings,
    isManualTimerRunning,
    formattedManualTimer,
    manualTimerElapsed,
    startTimer,
    stopTimer,
  } = useTimeTracker();

  const {
    task: focusTask,
    formattedElapsed: focusElapsed,
    hasTask: hasFocusTask,
    hasTimer: hasFocusTimer,
  } = useActiveTask();

  // Smart project suggestions with auto-assign for high-confidence matches
  const { recordAssignment, recordDeletion, suggestProject, getAutoAssignment } = useProjectSuggestion(projects, entries);

  // Re-fetch when a project picker opens, so projects created after launch
  // (or a late-recovering auth) show up without restarting the app.
  // Loading, retry and caching all live in useProjects.
  useEffect(() => {
    if (!expandedEntryId?.startsWith('pick-')) return;
    reloadProjects();
  }, [expandedEntryId, reloadProjects]);

  // Auto-assign unlogged entries when confidence is high enough
  const autoAssignedRef = useRef(new Set<string>());
  useEffect(() => {
    if (projects.length === 0) return;
    const unlogged = entries.filter(e =>
      !e.projectId &&
      !autoAssignedRef.current.has(e.id) &&
      !['Electron', 'Accordio AGI', 'Accordio AI'].includes(e.appName) &&
      e.duration >= 5
    );
    for (const entry of unlogged) {
      const match = getAutoAssignment(entry.appName, entry.windowTitle, entry.url);
      if (match) {
        autoAssignedRef.current.add(entry.id);
        assignProject(entry.id, match.projectId);
      }
    }
  }, [entries, projects, getAutoAssignment, assignProject]);

  // Track last meaningful activity — persists across null gaps and Electron/Accordio AGI
  useEffect(() => {
    if (currentActivity && !['Electron', 'Accordio AGI', 'Accordio AI'].includes(currentActivity.appName)) {
      lastMeaningfulActivityRef.current = currentActivity;
    }
  }, [currentActivity]);

  // Show last meaningful activity when:
  // - current is null (between activities — up to idle timeout)
  // - current is Electron/Accordio AGI (user is in our own app)
  const displayActivity = (() => {
    if (currentActivity && !['Electron', 'Accordio AGI', 'Accordio AI'].includes(currentActivity.appName)) {
      return currentActivity;
    }
    // Fall back to last meaningful activity (don't show "waiting" immediately)
    return lastMeaningfulActivityRef.current;
  })();

  const missingAccessibility = !!permissionStatus && !permissionStatus.accessibility;
  const missingScreenRecording = !!permissionStatus && !permissionStatus.screenRecording;
  const showPermissionWarning = (missingAccessibility || missingScreenRecording) && (settings?.enabled || !!permissionError);

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncError(null);
    const result = await syncNow();
    if (result && !result.success) {
      setSyncError(
        result.failed
          ? `${result.failed} ${result.failed === 1 ? 'entry' : 'entries'} couldn't sync`
          : result.error || 'Sync failed'
      );
    }
    setIsSyncing(false);
  };

  const handleStartTimer = async () => {
    setTimerError(null);
    await startTimer('Manual time entry');
  };

  const handleStopTimer = async () => {
    setTimerError(null);
    if (manualTimerElapsed < 10) {
      setTimerError('Min 10 seconds');
      return;
    }
    const result = await stopTimer();
    if (!result.success && result.error) {
      setTimerError(result.error);
    }
  };

  const handleAssignProject = async (entryId: string, projectId: string) => {
    const entry = entries.find(e => e.id === entryId);
    if (entry) {
      if (projectId) {
        recordAssignment(entry.appName, projectId, entry.windowTitle, entry.url);
      } else {
        // Unassigning — record negative feedback so it stops suggesting this pattern
        recordDeletion(entry.appName, entry.windowTitle, entry.url);
      }
    }
    await assignProject(entryId, projectId);
    setExpandedEntryId(null);
  };

  // Daily scores. All the logic lives in the shared scorer so the menubar app,
  // the /time page and the server can never disagree about the same day —
  // three separate implementations used to exist and did.
  //
  // Note what is NOT here any more: the old "any gap between 1 minute and 2
  // hours is a break" rule. A gap is equally a dead tracker, a quit app or a
  // sleeping Mac; only an absence the monitor witnessed both ends of counts.
  const dayScores = useMemo(() => {
    const meetings = allEntries
      .filter(e => e.sessionKind === 'meeting')
      .map(e => ({ startTime: e.startTime, endTime: e.endTime }));
    if (currentMeeting) {
      meetings.push({ startTime: currentMeeting.startTime, endTime: Date.now() });
    }
    return computeScores(allEntries, meetings, absences);
  }, [allEntries, absences, currentMeeting]);

  // Calculate time breakdown by category (using entry.category from activity monitor)
  const dayBreakdown = useMemo(() => {
    const categoryLabels: Record<string, { label: string; color: string }> = {
      // Focus
      development: { label: 'Development', color: '#3b82f6' },
      design: { label: 'Design', color: '#ec4899' },
      writing: { label: 'Writing & Docs', color: '#14b8a6' },
      research: { label: 'Research', color: '#6366f1' },
      // Work
      email: { label: 'Email', color: '#f97316' },
      messaging: { label: 'Messaging', color: '#8b5cf6' },
      meetings: { label: 'Meetings', color: '#a855f7' },
      pm: { label: 'Project Mgmt', color: '#22c55e' },
      finance: { label: 'Finance & Admin', color: '#64748b' },
      // Non-work
      social: { label: 'Social Media', color: '#f43f5e' },
      entertainment: { label: 'Entertainment', color: '#ef4444' },
      personal: { label: 'Personal', color: '#78716c' },
      utilities: { label: 'Utilities', color: '#94a3b8' },
      // Legacy / fallback
      communication: { label: 'Communication', color: '#8b5cf6' },
      productivity: { label: 'Productivity', color: '#22c55e' },
      browsers: { label: 'Browsing', color: '#f59e0b' },
      other: { label: 'Other', color: '#6b7280' },
      uncategorized: { label: 'Uncategorized', color: '#6b7280' },
    };

    const categoryMinutes: Record<string, number> = {};

    for (const entry of entries) {
      // Skip Electron/Accordio AGI
      if (['Electron', 'Accordio AGI', 'Accordio AI'].includes(entry.appName)) continue;

      const durationMinutes = entry.duration / 60;
      // Normalize category to lowercase to avoid duplicates
      const category = (entry.category || 'other').toLowerCase();
      categoryMinutes[category] = (categoryMinutes[category] || 0) + durationMinutes;
    }

    const total = Object.values(categoryMinutes).reduce((a, b) => a + b, 0);
    const maxMinutes = Math.max(...Object.values(categoryMinutes), 1);

    return Object.entries(categoryMinutes)
      .map(([category, minutes]) => {
        const { label, color } = categoryLabels[category] || categoryLabels.other;
        return {
          category: label,
          minutes: Math.round(minutes),
          color,
          percent: total > 0 ? Math.round((minutes / total) * 100) : 0,
          barWidth: Math.round((minutes / maxMinutes) * 100),
        };
      })
      .sort((a, b) => b.minutes - a.minutes);
  }, [entries]);

  return (
    <div className="activity-hub-standalone">
      <div className="hub-content">
          <div className="hub-activity">
            {/* Loading skeleton — shown briefly while data loads */}
            {!summary && !currentActivity && entries.length === 0 && (
              <div className="hub-loading">
                <div className="hub-skeleton hub-skeleton-block" />
                <div className="hub-skeleton hub-skeleton-line long" />
                <div className="hub-skeleton hub-skeleton-line medium" />
                <div className="hub-skeleton hub-skeleton-line short" />
                <div style={{ height: 16 }} />
                <div className="hub-skeleton hub-skeleton-block" />
                <div className="hub-skeleton hub-skeleton-line long" />
                <div className="hub-skeleton hub-skeleton-line medium" />
              </div>
            )}

            {/* Working Now Section */}
            <div className="hub-working-now">
              <div className="hub-section-header">
                <span>Working Now</span>
                <button
                  className={`hub-toggle ${settings?.enabled ? 'on' : 'off'}`}
                  onClick={() => updateSettings({ enabled: !settings?.enabled })}
                  title={settings?.enabled ? 'Auto-tracking on' : 'Auto-tracking off'}
                >
                  {settings?.enabled ? 'Auto' : 'Off'}
                </button>
              </div>

              {showPermissionWarning && (
                <div className="permission-warning">
                  <div>
                    <div className="permission-warning-title">Permissions required</div>
                    <div className="permission-warning-text">
                      {missingAccessibility && missingScreenRecording
                        ? 'Enable Accessibility and Screen Recording to start auto-tracking.'
                        : missingAccessibility
                          ? 'Enable Accessibility to start auto-tracking.'
                          : 'Enable Screen Recording to capture window titles for auto-tracking.'}
                    </div>
                  </div>
                  <div className="permission-warning-actions">
                    {missingAccessibility && (
                      <button
                        className="permission-warning-btn"
                        onClick={() => window.electron.permissions.openSettings('accessibility')}
                      >
                        Open Accessibility
                      </button>
                    )}
                    {missingScreenRecording && (
                      <button
                        className="permission-warning-btn"
                        onClick={() => window.electron.permissions.openSettings('screenRecording')}
                      >
                        Open Screen Recording
                      </button>
                    )}
                    {isCheckingPermissions && (
                      <span className="permission-warning-text">Checking permissions...</span>
                    )}
                  </div>
                </div>
              )}

              {hasEmptyTitles && !showPermissionWarning && (
                <div className="permission-warning">
                  <div>
                    <div className="permission-warning-title">Browser tabs not detected</div>
                    <div className="permission-warning-text">
                      Screen Recording permission was granted but the app needs a restart to apply it.
                    </div>
                  </div>
                  <div className="permission-warning-actions">
                    <button
                      className="permission-warning-btn"
                      onClick={() => window.electron.app.relaunch()}
                    >
                      Restart now
                    </button>
                  </div>
                </div>
              )}

              {/* Current Activity */}
              <div className="hub-current-work">
                {displayActivity && !isIdle ? (
                  <div className="hub-current-activity">
                    <div className="hub-activity-header">
                      <AppIcon appPath={displayActivity.appPath} appName={displayActivity.appName} url={displayActivity.url} size={20} />
                      <span className="hub-activity-app">{displayActivity.appName}</span>
                      <CategoryBadge category={displayActivity.category} />
                    </div>
                    <div className="hub-activity-window">
                      {displayActivity.windowTitle.length > 50
                        ? displayActivity.windowTitle.substring(0, 50) + '...'
                        : displayActivity.windowTitle}
                    </div>
                  </div>
                ) : isIdle ? (
                  <div className="hub-idle-state">
                    <span className={`hub-status-dot idle`} />
                    <span>Idle - tracking paused</span>
                  </div>
                ) : (
                  <div className="hub-no-activity">
                    <span className={`hub-status-dot ${settings?.enabled ? 'ready' : 'off'}`} />
                    <span>{settings?.enabled ? 'Waiting for activity...' : 'Auto-tracking disabled'}</span>
                  </div>
                )}
              </div>

              {/* Manual Timer - only show when running or when auto-tracking is off */}
              {(isManualTimerRunning || !settings?.enabled) && (
                <div className="hub-timer-section">
                  {isManualTimerRunning ? (
                    <button className="hub-timer-btn recording" onClick={handleStopTimer}>
                      <span className="hub-timer-dot" />
                      <span>{formattedManualTimer}</span>
                      <span className="hub-timer-stop">Stop</span>
                    </button>
                  ) : (
                    <button className="hub-timer-btn" onClick={handleStartTimer}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5,3 19,12 5,21"/>
                      </svg>
                      <span>Start Timer</span>
                    </button>
                  )}
                  {timerError && <span className="hub-timer-error">{timerError}</span>}
                </div>
              )}
            </div>

            {/* Work Hours Summary - Rize style */}
            <div className="hub-work-hours">
              <div className="hub-section-header">
                <span>Work Hours</span>
              </div>
              <div className="hub-work-hours-content">
                <div className="hub-work-hours-main">
                  <span className="hub-work-hours-label">Total time worked</span>
                  <span className="hub-work-hours-value">
                    {(() => {
                      const totalSeconds = summary?.today || 0;
                      const hours = Math.floor(totalSeconds / 3600);
                      const minutes = Math.floor((totalSeconds % 3600) / 60);
                      if (hours > 0) {
                        return <><span className="hub-work-hours-num"><NumberFlow value={hours} /></span> hr <span className="hub-work-hours-num"><NumberFlow value={minutes} /></span> min</>;
                      }
                      return <><span className="hub-work-hours-num"><NumberFlow value={minutes} /></span> min</>;
                    })()}
                  </span>
                </div>
                <div className="hub-work-hours-percent">
                  <span className="hub-work-hours-label">Percent of work day</span>
                  <span className="hub-work-hours-percent-value">
                    <span className="hub-work-hours-percent-num">
                      <NumberFlow value={Math.min(100, Math.round(((summary?.today || 0) / (8 * 3600)) * 100))} suffix="%" />
                    </span>
                    <span className="hub-work-hours-percent-of"> of 8 hr</span>
                  </span>
                </div>
              </div>
              <div className="hub-work-hours-footer">
                <div className="hub-work-hours-meta">
                  <div className="hub-work-hours-meta-row">
                    <span className="hub-work-hours-meta-label">Tracking:</span>
                    <span className="hub-work-hours-meta-value">{settings?.enabled ? 'On' : 'Off'}</span>
                  </div>
                  <div className="hub-work-hours-meta-row">
                    <span className="hub-work-hours-meta-label">This week:</span>
                    <span className="hub-work-hours-meta-value">{formattedWeek}</span>
                  </div>
                </div>
                <button
                  className="hub-work-hours-toggle"
                  onClick={() => updateSettings({ enabled: !settings?.enabled })}
                >
                  {settings?.enabled ? 'Disable Tracking' : 'Enable Tracking'}
                </button>
              </div>
            </div>

            {/* Focus Task — only while actively working on it (timer running) */}
            {hasFocusTask && focusTask && hasFocusTimer && (
              <div className="hub-focus-card">
                <div className="hub-section-header">
                  <span>Focus Task</span>
                  {focusElapsed !== '0:00:00' && (
                    <span className="hub-focus-time">{focusElapsed}</span>
                  )}
                </div>
                <div className="hub-current-work">
                  <div className="hub-focus-task">
                    <div className="hub-focus-title">{focusTask.title}</div>
                    {focusTask.project && (
                      <div className="hub-focus-project">{focusTask.project.name}</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Scores - Focus, Meetings, Breaks */}
            <div className="hub-scores">
              <div className="hub-section-header">
                <span>Scores</span>
              </div>
              <div className="hub-scores-grid">
                <div className="hub-score-item">
                  <CircularProgress value={dayScores.focusPercent} max={100} size={48} strokeWidth={4} color="#06b6d4">
                    <span className="hub-score-value cyan"><NumberFlow value={dayScores.focusPercent} suffix="%" /></span>
                  </CircularProgress>
                  <div className="hub-score-info">
                    <span className="hub-score-label">
                      <svg className="hub-score-icon cyan" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C17.52 2 22 6.48 22 12C22 17.52 17.52 22 12 22C6.48 22 2 17.52 2 12C2 6.48 6.48 2 12 2ZM12 4C7.58 4 4 7.58 4 12C4 16.42 7.58 20 12 20C16.42 20 20 16.42 20 12C20 7.58 16.42 4 12 4ZM12 6C15.31 6 18 8.69 18 12C18 15.31 15.31 18 12 18C8.69 18 6 15.31 6 12C6 8.69 8.69 6 12 6Z"/>
                      </svg>
                      Focus
                    </span>
                    <span className="hub-score-time">{formatDuration(dayScores.focusMinutes * 60)}</span>
                  </div>
                </div>
                <div className="hub-score-item">
                  <CircularProgress value={dayScores.meetingsPercent} max={100} size={48} strokeWidth={4} color="#a855f7">
                    <span className="hub-score-value purple"><NumberFlow value={dayScores.meetingsPercent} suffix="%" /></span>
                  </CircularProgress>
                  <div className="hub-score-info">
                    <span className="hub-score-label">
                      <svg className="hub-score-icon purple" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M2 22C2 17.5817 5.58172 14 10 14C14.4183 14 18 17.5817 18 22H16C16 18.6863 13.3137 16 10 16C6.68629 16 4 18.6863 4 22H2ZM10 13C6.685 13 4 10.315 4 7C4 3.685 6.685 1 10 1C13.315 1 16 3.685 16 7C16 10.315 13.315 13 10 13ZM10 11C12.21 11 14 9.21 14 7C14 4.79 12.21 3 10 3C7.79 3 6 4.79 6 7C6 9.21 7.79 11 10 11ZM18.2837 14.7028C21.0644 15.9561 23 18.752 23 22H21C21 19.564 19.5483 17.4671 17.4628 16.5271L18.2837 14.7028ZM17.5962 3.41321C19.5944 4.23703 21 6.20361 21 8.5C21 11.3702 18.8042 13.7252 16 13.9776V11.9646C17.6967 11.7222 19 10.264 19 8.5C19 7.11935 18.2016 5.92603 17.041 5.35635L17.5962 3.41321Z"/>
                      </svg>
                      Meetings
                    </span>
                    <span className="hub-score-time">{formatDuration(dayScores.meetingsMinutes * 60)}</span>
                  </div>
                </div>
                <div className="hub-score-item">
                  <CircularProgress value={dayScores.breaksPercent} max={100} size={48} strokeWidth={4} color="#78D277">
                    <span className="hub-score-value green"><NumberFlow value={dayScores.breaksPercent} suffix="%" /></span>
                  </CircularProgress>
                  <div className="hub-score-info">
                    <span className="hub-score-label">
                      <svg className="hub-score-icon green" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M11 6V8C7.68629 8 5 10.6863 5 14C5 17.3137 7.68629 20 11 20C14.2384 20 16.8776 17.4344 16.9959 14.2249L17 14H19C19 18.4183 15.4183 22 11 22C6.58172 22 3 18.4183 3 14C3 9.66509 6.58 6 11 6ZM21 2V4L15.6726 10H21V12H13V10L18.3256 4H13V2H21Z"/>
                      </svg>
                      Breaks
                    </span>
                    <span className="hub-score-time">{formatDuration(dayScores.breaksMinutes * 60)}</span>
                  </div>
                </div>
              </div>

              {/* Say what the percentages are actually based on. Untracked time
                  is excluded from the denominator rather than silently booked
                  as a break, so it has to be visible or the numbers look wrong. */}
              {dayScores.untrackedMinutes >= 1 && (
                <div className="hub-score-basis">
                  Based on {formatDuration(dayScores.totalMinutes * 60)} tracked
                  {' · '}
                  {formatDuration(dayScores.untrackedMinutes * 60)} not tracked
                </div>
              )}
            </div>

            {/* Time Breakdown */}
            {dayBreakdown.length > 0 && (
              <div className="hub-breakdown">
                <div className="hub-section-header">
                  <span>Time Breakdown</span>
                </div>
                <div className="hub-breakdown-list">
                  {dayBreakdown.slice(0, 6).map((item) => (
                    <div key={item.category} className="hub-breakdown-row">
                      <span className="hub-breakdown-percent">{item.percent}%</span>
                      <span className="hub-breakdown-category">{item.category}</span>
                      <div className="hub-breakdown-bar-container">
                        <div
                          className="hub-breakdown-bar"
                          style={{ width: `${item.barWidth}%`, background: `linear-gradient(90deg, ${item.color}99 0%, ${item.color} 100%)` }}
                        />
                      </div>
                      <span className="hub-breakdown-time">{formatDuration(item.minutes * 60)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ═══ LOGGED — entries assigned to projects ═══ */}
            {(() => {
              const loggedEntries = entries.filter(e =>
                e.projectId && !['Electron', 'Accordio AGI', 'Accordio AI'].includes(e.appName) && e.duration >= 5
              );
              if (loggedEntries.length === 0) return null;

              const byProject = new Map<string, { projectId: string; totalDuration: number; entries: typeof loggedEntries }>();
              loggedEntries.forEach(entry => {
                const pid = entry.projectId!;
                const existing = byProject.get(pid);
                if (existing) {
                  existing.totalDuration += entry.duration;
                  existing.entries.push(entry);
                } else {
                  byProject.set(pid, { projectId: pid, totalDuration: entry.duration, entries: [entry] });
                }
              });
              const sortedProjects = Array.from(byProject.values()).sort((a, b) => b.totalDuration - a.totalDuration);
              const totalLogged = loggedEntries.reduce((sum, e) => sum + e.duration, 0);

              return (
                <div className="hub-logged">
                  <div className="hub-section-header">
                    <span>Logged</span>
                    <span className="hub-section-meta">{formatDuration(totalLogged)}</span>
                  </div>
                  {sortedProjects.map(group => {
                    const project = projects.find(p => p.id === group.projectId);
                    const name = project?.name || 'Unknown';
                    const client = project?.client_name;
                    const isExpanded = expandedEntryId === `logged-${group.projectId}`;
                    const apps = Array.from(new Set(group.entries.map(e => e.appName)));

                    return (
                      <div key={group.projectId} className={`logged-project ${isExpanded ? 'expanded' : ''}`}>
                        <button
                          className="logged-project-header"
                          onClick={() => setExpandedEntryId(isExpanded ? null : `logged-${group.projectId}`)}
                        >
                          <div className="logged-project-color" style={{ background: getProjectColor(project?.color, project?.id) }} />
                          <div className="logged-project-info">
                            <span className="logged-project-name">{name}</span>
                            {client && <span className="logged-project-client">{client}</span>}
                          </div>
                          <span className="logged-project-duration">{formatDuration(group.totalDuration)}</span>
                          <svg className={`hub-chevron-sm ${isExpanded ? 'expanded' : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="9 18 15 12 9 6"/>
                          </svg>
                        </button>
                        {isExpanded && (
                          <div className="logged-project-entries">
                            {apps.map(appName => {
                              const appEntries = group.entries.filter(e => e.appName === appName);
                              const appDuration = appEntries.reduce((s, e) => s + e.duration, 0);
                              return (
                                <div key={appName} className="logged-entry-row">
                                  <AppIcon appPath={appEntries[0]?.appPath} appName={appName} url={appEntries[0]?.url} size={18} />
                                  <span className="logged-entry-name">{appName}</span>
                                  <span className="logged-entry-count">{appEntries.length}</span>
                                  <span className="logged-entry-duration">{formatDuration(appDuration)}</span>
                                  <button
                                    className="logged-entry-unlog"
                                    title="Unlog"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      appEntries.forEach(entry => assignProject(entry.id, ''));
                                    }}
                                  >
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                    </svg>
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* ═══ MEMORIES — unlogged entries, grouped by app+context ═══ */}
            {(() => {
              const memoryEntries = entries.filter(e =>
                !e.projectId &&
                !['Electron', 'Accordio AGI', 'Accordio AI'].includes(e.appName) &&
                e.appName && e.appName.trim() !== '' &&
                e.duration >= 5
              );
              if (memoryEntries.length === 0) return null;

              const totalMemory = memoryEntries.reduce((sum, e) => sum + e.duration, 0);

              // Group by app+context (flat list, sorted by duration)
              const contextGroups = new Map<string, {
                key: string;
                appName: string;
                appPath?: string;
                url?: string;
                contextName: string;
                totalDuration: number;
                entries: typeof memoryEntries;
              }>();

              const browserAppNames = new Set([
                'safari', 'google chrome', 'chrome', 'firefox', 'microsoft edge',
                'brave browser', 'brave', 'arc', 'vivaldi', 'opera', 'opera gx',
                'dia', 'orion', 'zen browser', 'comet', 'floorp', 'wavebox',
                'sidekick', 'polypane', 'chromium', 'min',
              ]);

              memoryEntries.forEach(entry => {
                const rawTitle = entry.windowTitle || '';
                // Dia prepends the current space name (e.g. "Work: Page Title") to the window title.
                // Strip it before anything else so downstream extraction/grouping sees the clean title.
                const title = entry.appName === 'Dia'
                  ? rawTitle.replace(/^[A-Za-z][\w &]{0,18}:\s+/, '')
                  : rawTitle;
                let context = entry.appName;

                // Extract meaningful context
                const vscodeMatch = title.match(/^(.+?)\s*[-–—]\s*.+\s*[-–—]\s*(?:Visual Studio Code|Code|Cursor)$/i);
                if (vscodeMatch) { context = vscodeMatch[1].trim(); }
                else {
                  const figmaMatch = title.match(/^(.+?)\s*[-–—]\s*Figma$/i);
                  if (figmaMatch) { context = figmaMatch[1].trim(); }
                  else if (entry.url) {
                    try { context = new URL(entry.url).hostname.replace(/^www\./, ''); } catch { /* */ }
                  }
                  else if (browserAppNames.has(entry.appName.toLowerCase()) && title) {
                    // Strip browser name suffix: "Page Title — Dia", "Page - Site — Arc", etc.
                    const stripped = title.replace(/\s*[-–—]\s*(?:Dia|Arc|Zen Browser|Orion|Comet|Brave|Brave Browser|Chrome|Google Chrome|Safari|Firefox|Microsoft Edge|Edge|Opera|Opera GX|Vivaldi|Floorp|Wavebox|Sidekick|Polypane|Chromium|Min|LibreWolf|Tor Browser|SigmaOS|Stack)\s*$/i, '').trim();
                    if (stripped && stripped !== title.trim()) {
                      // Got a clean page title — try to extract site name from "Page Title - Site Name"
                      const lastDash = stripped.lastIndexOf(' - ');
                      const lastEm = stripped.lastIndexOf(' — ');
                      const lastSep = Math.max(lastDash, lastEm);
                      context = lastSep > 0 ? stripped.substring(lastSep + (lastEm > lastDash ? 3 : 3)).trim() || stripped : stripped;
                    } else if (title.trim()) {
                      // Browser suffix not found — use the full title as context (better than just "Dia")
                      context = title.trim();
                    }
                  }
                  else if (/terminal|iterm|warp/i.test(entry.appName)) {
                    const pathMatch = title.match(/(?:~\/|\/[^/]+\/)+([^/\s]+)/);
                    if (pathMatch) context = pathMatch[1].trim();
                  }
                }

                if (context.length > 40) context = context.substring(0, 40) + '...';
                const groupKey = `${entry.appName}::${context}`;

                const existing = contextGroups.get(groupKey);
                if (existing) {
                  existing.totalDuration += entry.duration;
                  existing.entries.push(entry);
                } else {
                  // Fall back to title-based domain inference so browsers without URL access
                  // (Dia, Orion, permission denied) still show a site favicon instead of the app icon.
                  const isBrowserEntry = browserAppNames.has(entry.appName.toLowerCase());
                  const resolvedUrl = entry.url || (isBrowserEntry ? inferUrlFromTitle(title) : undefined);
                  contextGroups.set(groupKey, {
                    key: groupKey,
                    appName: entry.appName,
                    appPath: entry.appPath,
                    url: resolvedUrl,
                    contextName: context,
                    totalDuration: entry.duration,
                    entries: [entry],
                  });
                }
              });

              const sortedMemories = Array.from(contextGroups.values())
                .sort((a, b) => b.totalDuration - a.totalDuration);

              return (<>
                <div className="hub-memories">
                  <div className="hub-section-header">
                    <span>Memories</span>
                    <span className="hub-section-meta">{formatDuration(totalMemory)}</span>
                  </div>

                  <div className="hub-memories-list" ref={memoriesListRef}>
                    {sortedMemories.map(group => {
                      const showPicker = expandedEntryId === `pick-${group.key}`;
                      // Get suggestion for this group (display only, no auto-assign)
                      const suggestion = suggestProject(group.appName, group.entries[0]?.windowTitle || '', group.url);
                      const isGroupExpanded = expandedGroupKey === group.key;
                      const formatTime = (ts: number) => {
                        const d = new Date(ts);
                        return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
                      };
                      return (
                        <div key={group.key} className="memory-row">
                          <div
                            className="memory-row-main"
                            onClick={() => group.entries.length > 1 && setExpandedGroupKey(isGroupExpanded ? null : group.key)}
                            style={{ cursor: group.entries.length > 1 ? 'pointer' : 'default' }}
                          >
                            <AppIcon appPath={group.appPath} appName={group.appName} url={group.url} size={22} />
                            <div className="memory-row-info">
                              <span className="memory-row-context">
                                {group.contextName !== group.appName
                                  ? group.contextName
                                  : group.appName}
                              </span>
                              {group.contextName !== group.appName && (
                                <span className="memory-row-app">{group.appName}</span>
                              )}
                            </div>
                            <span className="memory-row-count">{group.entries.length > 1 ? group.entries.length : ''}</span>
                            <span className="memory-row-duration">{formatDuration(group.totalDuration)}</span>
                            <span className="memory-row-actions" onClick={(e) => e.stopPropagation()}>
                              {/* Suggestion pill and manual log coexist — the
                                  suggestion is one option, not the only one. */}
                              {suggestion && suggestion.confidence >= 0.6 && !showPicker && (
                                <button
                                  className="memory-row-log suggestion"
                                  title={`Suggested: ${suggestion.project.name} (${Math.round(suggestion.confidence * 100)}%)`}
                                  onClick={async () => {
                                    for (const entry of group.entries) {
                                      await handleAssignProject(entry.id, suggestion.project.id);
                                    }
                                  }}
                                >
                                  {suggestion.project.name.length > 12 ? suggestion.project.name.substring(0, 12) + '...' : suggestion.project.name}
                                </button>
                              )}
                              <button
                                className={`memory-row-log ${suggestion && suggestion.confidence >= 0.6 && !showPicker ? 'memory-row-log-icon' : ''}`}
                                title={suggestion && suggestion.confidence >= 0.6 ? 'Log to a different project' : undefined}
                                onClick={() => setExpandedEntryId(showPicker ? null : `pick-${group.key}`)}
                              >
                                {suggestion && suggestion.confidence >= 0.6 && !showPicker ? '+' : '+ Log'}
                              </button>
                            </span>
                          </div>
                          {showPicker && (
                            <div className="memory-row-picker">
                              <ProjectPicker
                                projects={projects}
                                onSelect={async (projectId) => {
                                  for (const entry of group.entries) {
                                    await handleAssignProject(entry.id, projectId);
                                  }
                                  setExpandedEntryId(null);
                                }}
                                onClose={() => setExpandedEntryId(null)}
                                placeholder="Log to project..."
                                status={projectsStatus}
                                errorCode={projectsErrorCode}
                                onRetry={reloadProjects}
                              />
                            </div>
                          )}
                          {/* Expanded entries dropdown */}
                          {isGroupExpanded && (
                            <div style={{
                              padding: '4px 0',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '1px',
                              maxHeight: '240px',
                              overflowY: 'auto',
                              marginTop: '2px',
                              borderTop: '1px solid rgba(255,255,255,0.04)',
                            }}>
                              {group.entries
                                .sort((a, b) => b.startTime - a.startTime)
                                .slice(0, 50)
                                .map(entry => {
                                  const entryTitle = entry.windowTitle || entry.appName;
                                  const truncTitle = entryTitle.length > 35 ? entryTitle.substring(0, 35) + '...' : entryTitle;
                                  return (
                                    <div key={entry.id} style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      padding: '3px 12px',
                                      fontSize: '11px',
                                      color: 'var(--text-secondary)',
                                    }}>
                                      <span style={{ opacity: 0.4, fontVariantNumeric: 'tabular-nums', flexShrink: 0, fontSize: '10px' }}>
                                        {formatTime(entry.startTime)}–{formatTime(entry.endTime)}
                                      </span>
                                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                        {truncTitle}
                                      </span>
                                      <EditableDuration
                                        seconds={entry.duration}
                                        format={formatDuration}
                                        onCommit={(secs) => updateEntryDuration(entry.id, secs)}
                                      />
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          window.electron.time.deleteEntry(entry.id);
                                        }}
                                        style={{
                                          flexShrink: 0,
                                          background: 'none',
                                          border: 'none',
                                          cursor: 'pointer',
                                          padding: '2px',
                                          color: 'var(--text-tertiary)',
                                          opacity: 0.4,
                                          transition: 'opacity 0.15s',
                                        }}
                                        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                                        onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.4')}
                                        title="Delete entry"
                                      >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                          <path d="M17 6H22V8H20V21C20 21.5523 19.5523 22 19 22H5C4.44772 22 4 21.5523 4 21V8H2V6H7V3C7 2.44772 7.44772 2 8 2H16C16.5523 2 17 2.44772 17 3V6ZM18 8H6V20H18V8ZM9 4V6H15V4H9Z"/>
                                        </svg>
                                      </button>
                                    </div>
                                  );
                                })}
                              {group.entries.length > 50 && (
                                <div style={{ fontSize: '10px', opacity: 0.4, padding: '2px 10px' }}>
                                  +{group.entries.length - 50} more
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                </div>

                {/* Sync button — only show when there are pending entries */}
                {syncStatus.pendingCount > 0 && (
                  <button
                    className={`hub-log-all-btn ${isSyncing ? 'shimmer' : ''}`}
                    disabled={isSyncing}
                    onClick={handleSync}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                    </svg>
                    {isSyncing ? 'Syncing...' : `Sync ${syncStatus.pendingCount} entries`}
                  </button>
                )}
              </>
              );
            })()}

            {/* Sync Status */}
            <div className="hub-sync">
              <div className="hub-sync-info">
                <span className={`hub-sync-dot ${isSyncing ? 'syncing' : syncError ? 'pending' : syncStatus.pendingCount === 0 ? 'synced' : 'pending'}`} />
                <span>{isSyncing ? 'Syncing...' : syncError ? syncError : syncStatus.pendingCount === 0 ? 'Synced' : `${syncStatus.pendingCount} pending`}</span>
              </div>
              {syncStatus.pendingCount > 0 && (
                <button
                  className="hub-sync-btn"
                  onClick={handleSync}
                  disabled={isSyncing}
                >
                  {isSyncing ? (
                    <span className="hub-sync-spinner" />
                  ) : (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                      </svg>
                      Sync
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
      </div>
    </div>
  );
}

export default ActivityHub;
