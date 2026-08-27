/**
 * Presentation for each brain tool.
 *
 * Seeded from `Accordio/lib/brain-tools.ts`. The dashboard has its own ~54-entry
 * registry, but the two surfaces run different agents and share only two tool
 * names (`saveMemory`, `sendReminder`) — so the card design is ported and this
 * table is desktop-specific.
 *
 * Three deliberate departures from the dashboard's version, all because this
 * renders in a 400px popover rather than a full page:
 *
 * - `processing` is one string, not a rotating array. The dashboard cycles
 *   messages every 4s; at this width that reads as noise. A single honest
 *   present-tense line also removes the need for the dashboard's
 *   `unfinishedToolLabel()` regex, which strips trailing ellipses off the
 *   first carousel entry to caption interrupted cards.
 * - `tint` is an enum, not raw class strings. 35 entries × two class strings
 *   is 70 chances to typo a colour.
 * - Default duration is 20s, not the dashboard's 55s. That default is tuned
 *   for `generateContract`; almost every tool here is a sub-2s Supabase read,
 *   and a 55s progress bar makes a finished card look stuck.
 */

import {
  Timer, TimerOff, Clock, ListChecks, PencilLine, Trash2, FileSpreadsheet,
  Plus, CheckCircle2, Target, ListTodo, CalendarClock, AlertTriangle,
  FolderOpen, Send, UserPlus, Users, Brain, BookOpen, FileText, Receipt,
  CreditCard, Search, Activity, BarChart3, FolderInput, Layers, MonitorSmartphone,
  Plug, Link2, Globe, RefreshCw, Bell, Sparkles, Wrench, type LucideIcon,
} from 'lucide-react';

export type ToolTint = 'green' | 'blue' | 'amber' | 'purple' | 'red' | 'neutral';

export interface ToolConfig {
  icon: LucideIcon;
  /** Past tense — shown once the tool has returned. */
  label: string;
  /** Present tense — shown while running, and on interrupted/failed cards. */
  processing: string;
  tint: ToolTint;
  /** Expected runtime in seconds; drives the progress fill. */
  duration?: number;
}

export const DEFAULT_TOOL_DURATION = 20;

export const TOOL_CONFIGS: Record<string, ToolConfig> = {
  // ── Time ──────────────────────────────────────────────
  trackTime:          { icon: Timer,            label: 'Time tracked',        processing: 'Tracking time',        tint: 'green', duration: 3 },
  stopTimer:          { icon: TimerOff,         label: 'Timer stopped',       processing: 'Stopping timer',       tint: 'green', duration: 3 },
  getTimeSummary:     { icon: Clock,            label: 'Time summary',        processing: 'Adding up your hours', tint: 'green', duration: 4 },
  listTimeEntries:    { icon: ListChecks,       label: 'Time entries',        processing: 'Loading time entries', tint: 'green', duration: 4 },
  updateTimeEntry:    { icon: PencilLine,       label: 'Entry updated',       processing: 'Updating entry',       tint: 'green', duration: 3 },
  deleteTimeEntry:    { icon: Trash2,           label: 'Entry deleted',       processing: 'Deleting entry',       tint: 'red',   duration: 3 },
  generateTimesheet:  { icon: FileSpreadsheet,  label: 'Timesheet ready',     processing: 'Building timesheet',   tint: 'green', duration: 8 },

  // ── Tasks and focus ───────────────────────────────────
  createTask:         { icon: Plus,             label: 'Task created',        processing: 'Creating task',        tint: 'blue',  duration: 3 },
  updateTask:         { icon: PencilLine,       label: 'Task updated',        processing: 'Updating task',        tint: 'blue',  duration: 3 },
  completeTask:       { icon: CheckCircle2,     label: 'Task completed',      processing: 'Completing task',      tint: 'blue',  duration: 3 },
  getFocus:           { icon: Target,           label: 'Current focus',       processing: 'Checking your focus',  tint: 'blue',  duration: 3 },
  listTasks:          { icon: ListTodo,         label: 'Tasks',               processing: 'Loading tasks',        tint: 'blue',  duration: 4 },
  checkDeadlines:     { icon: CalendarClock,    label: 'Deadlines checked',   processing: 'Checking deadlines',   tint: 'blue',  duration: 5 },
  analyzeRisk:        { icon: AlertTriangle,    label: 'Risk analysed',       processing: 'Analysing risk',       tint: 'red',   duration: 10 },

  // ── Projects and clients ──────────────────────────────
  listProjects:       { icon: FolderOpen,       label: 'Projects',            processing: 'Loading projects',     tint: 'blue',  duration: 4 },
  generateClientUpdate:{ icon: Send,            label: 'Update drafted',      processing: 'Drafting update',      tint: 'amber', duration: 15 },
  createClient:       { icon: UserPlus,         label: 'Client created',      processing: 'Creating client',      tint: 'blue',  duration: 4 },
  listClients:        { icon: Users,            label: 'Clients',             processing: 'Loading clients',      tint: 'blue',  duration: 4 },

  // ── Memory and context ────────────────────────────────
  saveMemory:         { icon: Brain,            label: 'Memorised',           processing: 'Saving to memory',     tint: 'purple', duration: 2 },
  listMemories:       { icon: BookOpen,         label: 'Memories',            processing: 'Recalling',            tint: 'purple', duration: 3 },
  getUnifiedContext:  { icon: Layers,           label: 'Context loaded',      processing: 'Gathering context',    tint: 'purple', duration: 6 },

  // ── Money ─────────────────────────────────────────────
  createContract:     { icon: FileText,         label: 'Contract created',    processing: 'Generating contract',  tint: 'amber', duration: 45 },
  createInvoice:      { icon: Receipt,          label: 'Invoice created',     processing: 'Creating invoice',     tint: 'amber', duration: 12 },
  checkPayments:      { icon: CreditCard,       label: 'Payments checked',    processing: 'Checking payments',    tint: 'amber', duration: 5 },
  searchContracts:    { icon: Search,           label: 'Contracts found',     processing: 'Searching contracts',  tint: 'amber', duration: 5 },
  sendReminder:       { icon: Bell,             label: 'Reminder sent',       processing: 'Sending reminder',     tint: 'amber', duration: 8 },

  // ── Desktop activity ──────────────────────────────────
  getActivityFeed:    { icon: Activity,         label: 'Activity',            processing: 'Loading activity',     tint: 'green', duration: 4 },
  getActivitySummary: { icon: BarChart3,        label: 'Activity summary',    processing: 'Summarising activity', tint: 'green', duration: 5 },
  assignActivityToProject: { icon: FolderInput, label: 'Activity assigned',   processing: 'Assigning activity',   tint: 'green', duration: 4 },

  // ── Device and integrations ───────────────────────────
  getDeviceStatus:    { icon: MonitorSmartphone,label: 'Device status',       processing: 'Checking device',      tint: 'neutral', duration: 3 },
  getIntegrationStatus:{ icon: Plug,            label: 'Integrations',        processing: 'Checking integrations',tint: 'neutral', duration: 4 },
  generateLinkCode:   { icon: Link2,            label: 'Link code ready',     processing: 'Generating code',      tint: 'neutral', duration: 3 },
  requestBrowserAction:{ icon: Globe,           label: 'Browser task done',   processing: 'Using the browser',    tint: 'neutral', duration: 60 },
  syncExternalTasks:  { icon: RefreshCw,        label: 'Tasks synced',        processing: 'Syncing tasks',        tint: 'neutral', duration: 15 },

  // ── Reasoning ─────────────────────────────────────────
  advisor:            { icon: Sparkles,         label: 'Advice ready',        processing: 'Thinking it through',  tint: 'purple', duration: 40 },
};

/** camelCase → "Sentence case", for tools with no registry entry. */
export function humanizeToolName(name: string): string {
  const spaced = name
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Never return undefined. The server can add a tool without a desktop release,
 * and a card that renders nothing looks like a bug.
 */
export function resolveToolConfig(name: string): ToolConfig {
  const known = TOOL_CONFIGS[name];
  if (known) return known;

  const humanized = humanizeToolName(name);
  return {
    icon: Wrench,
    label: humanized,
    processing: humanized,
    tint: 'neutral',
    duration: DEFAULT_TOOL_DURATION,
  };
}

/** Tailwind classes per tint. Fill is withheld until the tool completes. */
export const TINT_CLASSES: Record<ToolTint, { border: string; bg: string; icon: string }> = {
  green:   { border: 'border-[#78D277]/30', bg: 'bg-[#78D277]/10',  icon: 'text-[#78D277]' },
  blue:    { border: 'border-blue-400/30',  bg: 'bg-blue-500/10',   icon: 'text-blue-400' },
  amber:   { border: 'border-amber-400/30', bg: 'bg-amber-500/10',  icon: 'text-amber-400' },
  purple:  { border: 'border-violet-400/30',bg: 'bg-violet-500/10', icon: 'text-violet-400' },
  red:     { border: 'border-red-400/30',   bg: 'bg-red-500/10',    icon: 'text-red-400' },
  neutral: { border: 'border-(--border-medium)', bg: 'bg-white/[0.04]', icon: 'text-(--text-secondary)' },
};
