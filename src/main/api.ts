/**
 * AGI API Client
 *
 * Handles communication with the Accordio AGI (Accordio General Intelligence) API.
 */

export interface ImageSource {
  type: 'base64';
  media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  data: string;
}

export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ImageBlock {
  type: 'image';
  source: ImageSource;
}

export type ContentBlock = TextBlock | ImageBlock;

export interface AGIMessage {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

export interface AGISession {
  id: string;
  title: string;
  messages: AGIMessage[];
  created_at: string;
  updated_at: string;
}

export interface CurrentFocus {
  task?: {
    id: string;
    title: string;
    status: string;
    priority: string;
    project?: {
      id: string;
      name: string;
    };
  };
  timer?: {
    started_at: string;
    elapsed_seconds: number;
  };
}

export interface TimeEntryInput {
  app_name: string;
  window_title: string;
  url?: string;
  category: string;
  start_time: string;
  end_time: string;
  duration_seconds: number;
  project_id?: string;
  client_id: string;
}

export interface TimeSummaryResponse {
  today: {
    total_seconds: number;
    by_category: Record<string, number>;
    by_project: Array<{ id: string; name: string; seconds: number }>;
  };
  week: {
    total_seconds: number;
    by_category: Record<string, number>;
    by_project: Array<{ id: string; name: string; seconds: number }>;
  };
}

export interface Memory {
  id: string;
  content: string;
  category?: string;
  created_at: string;
}

export interface IntegrationStatus {
  provider: string;
  connected: boolean;
  name: string;
  icon?: string;
}

export interface IntegrationsResponse {
  integrations: IntegrationStatus[];
  summary: {
    total: number;
    connected: number;
  };
}

export interface UserLimits {
  id: string;
  user_id: string;
  ai_actions_used: number;
  ai_actions_limit: number;
  signatures_used: number;
  signatures_limit: number;
  period_start: string;
  period_end: string;
}

export interface UserCredits {
  credit_balance: number;        // Current credits remaining
  monthly_allocation: number;    // Total monthly allocation
  legend_credit_tier: number;    // 0 = free, 1+ = Legend tiers
  is_legend: boolean;            // Whether user is on Legend plan
}

export interface CreditUpdate {
  creditsUsed: number;
  creditsRemaining: number;
}

export interface LoggedEntry {
  id: string;
  project_id: string | null;
  project_name: string | null;
  project_color: string | null;
  description: string | null;
  app_name: string | null;
  window_title: string | null;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number;
  source: string;
  is_billable: boolean;
}


export interface UserContext {
  projects?: Array<{ id: string; name: string; client_name?: string; status?: string }>;
  clients?: Array<{ id: string; name: string; email?: string }>;
  active_contracts?: Array<{ id: string; title: string; client_name?: string; status: string }>;
  recent_invoices?: Array<{ id: string; amount: number; status: string; client_name?: string }>;
  pending_payments?: number;
  today_hours?: number;
  focus_task?: { id: string; title: string; project_name?: string };
  memories?: Array<{ content: string; category?: string }>;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  logo_url: string | null;
  business_name: string | null;
  phone_number: string | null;
  address: string | null;
  location: string | null;
  skills: string[] | null;
  plan: string | null;
  preferred_currency: string | null;
  brand_color: string | null;
  onboarding_completed: boolean | null;
  slug: string | null;
  created_at: string | null;
}

export interface UnifiedContext {
  user: { id: string; name: string | null; business_name: string | null };
  current_state: {
    focus_task: unknown;
    running_timer: unknown;
    tracked_today_minutes: number;
    tracked_today_hours: number;
    billable_today_minutes: number;
    billable_today_hours: number;
  };
  tasks: {
    focus: unknown;
    next_up: unknown[];
    high_priority: unknown[];
    total_active: number;
    by_source: Record<string, number>;
  };
  deadlines: {
    overdue: unknown[];
    upcoming: unknown[];
    total_this_week: number;
  };
  time_tracking: {
    recent_entries: unknown[];
    summary: { last_7_days_minutes: number; last_7_days_hours: number };
  } | null;
  calendar: {
    upcoming_events: unknown[];
    today_count: number;
  } | null;
  finances: {
    unpaid_invoices: unknown[];
    total_outstanding: string;
    total_overdue: string;
    overdue_count: number;
  };
  projects: {
    active: unknown[];
    total_active: number;
  };
  contracts: {
    awaiting_signature: unknown[];
    active: unknown[];
    total_value: string;
  };
  clients: {
    list: unknown[];
    total: number;
  };
  integrations: {
    connected: Array<{ provider: string; workspace_name?: string; last_synced_at?: string }>;
  };
  memories: {
    by_category: Record<string, string[]>;
    total: number;
  };
  generated_at: string;
}

/**
 * An API failure that callers can branch on without regex-matching a message.
 * `status` is the HTTP status (0 when the request never reached the server);
 * `code` is the machine-readable code the route returned, when it sent one.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }

  /** True when the request never got a response (offline, DNS, TLS). */
  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

export class AGIApiClient {
  private baseUrl: string;
  private token: string;
  onSessionExpired?: () => void;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });
    } catch (e) {
      // fetch only rejects when the request never reached the server.
      throw new ApiError((e as Error).message || 'Network request failed', 0);
    }

    if (!response.ok) {
      if (response.status === 401) {
        this.onSessionExpired?.();
      }
      const body = await response.text();
      // Routes return { error, code }; fall back to the raw body when they don't.
      let code: string | undefined;
      let message = body;
      try {
        const parsed = JSON.parse(body);
        code = typeof parsed.code === 'string' ? parsed.code : undefined;
        message = parsed.error || body;
      } catch {
        // Non-JSON error body — keep the raw text.
      }
      throw new ApiError(`API error: ${response.status} ${message}`, response.status, code);
    }

    return response.json();
  }

  // chat() / chatStream() / abortChat() lived here. They hand-parsed the SSE
  // stream and flattened it to a string, which meant matching on a 'tool-call'
  // chunk type that does not exist in the AI SDK v6 UI message stream — so
  // every tool and reasoning chunk was silently dropped. The renderer now owns
  // chat via the AI SDK (renderer/lib/chat/transport.ts).

  /**
   * Get current focus task and timer
   */
  async getCurrentFocus(): Promise<CurrentFocus> {
    return this.request<CurrentFocus>('/api/agi/focus');
  }

  /**
   * Get chat sessions
   */
  async getSessions(): Promise<AGISession[]> {
    const response = await this.request<{ sessions: AGISession[] }>(
      '/api/agi/sessions'
    );
    return response.sessions;
  }

  /**
   * Create a new session
   */
  async createSession(title?: string): Promise<AGISession> {
    return this.request<AGISession>('/api/agi/sessions', {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
  }

  /**
   * Get a specific session
   */
  async getSession(sessionId: string): Promise<AGISession> {
    return this.request<AGISession>(`/api/agi/sessions/${sessionId}`);
  }

  /**
   * Get logged time entries from the server (Web → Desktop sync)
   */
  async getLoggedEntries(date?: string): Promise<LoggedEntry[]> {
    try {
      const params = date ? `?date=${date}` : '';
      const response = await this.request<{ entries: LoggedEntry[] }>(`/api/agi/activity/logged${params}`);
      return response.entries || [];
    } catch (error) {
      console.error('[API] Failed to fetch logged entries:', error);
      return [];
    }
  }

  /**
   * Get user credits / daily message balance
   */
  async getCredits(): Promise<UserCredits> {
    return this.request<UserCredits>('/api/agi/credits');
  }

  /**
   * Get user limits (signatures, AI actions)
   */
  async getLimits(): Promise<UserLimits> {
    // /api/limits uses cookie-based auth (deprecated endpoint)
    // Fall back gracefully — limits are secondary to credits
    try {
      return await this.request<UserLimits>('/api/limits');
    } catch {
      return { id: '', user_id: '', ai_actions_used: 0, ai_actions_limit: 999, signatures_used: 0, signatures_limit: 999, period_start: '', period_end: '' };
    }
  }

  /**
   * Set focus task
   */
  async setFocusTask(taskId: string): Promise<{ success: boolean }> {
    return this.request('/api/bot/task', {
      method: 'POST',
      body: JSON.stringify({ task_id: taskId, set_focus: true }),
    });
  }

  /**
   * Clear focus task
   */
  async clearFocusTask(): Promise<{ success: boolean }> {
    return this.request('/api/bot/task', {
      method: 'POST',
      body: JSON.stringify({ clear_focus: true }),
    });
  }

  /**
   * Get user memories from server
   */
  async getMemories(): Promise<{ memories: Memory[] }> {
    return this.request<{ memories: Memory[] }>('/api/agi/memory');
  }

  /**
   * Save a memory to the server
   */
  async saveMemory(content: string, category?: string, type?: string): Promise<{ success: boolean; memory: Memory }> {
    return this.request<{ success: boolean; memory: Memory }>('/api/agi/memory', {
      method: 'POST',
      body: JSON.stringify({ content, category, type: type || 'instruction' }),
    });
  }

  /**
   * Delete a memory from the server
   */
  async deleteMemory(id: string): Promise<{ success: boolean }> {
    return this.request(`/api/agi/memory?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get user projects for dropdown
   */
  /**
   * Throws ApiError on failure — do NOT swallow into an empty array. An empty
   * list must mean "this user has no projects", never "the request failed",
   * or the picker renders "No projects available" over a server error.
   */
  async getProjects(): Promise<Array<{ id: string; name: string; client_name?: string; color?: string }>> {
    const response = await this.request<{
      projects: Array<{ id: string; name: string; color?: string | null; client_name?: string | null }>;
      count: number;
    }>('/api/agi/projects');

    return (response.projects || []).map(p => ({
      id: p.id,
      name: p.name,
      color: p.color || undefined,
      client_name: p.client_name || undefined,
    }));
  }

  /**
   * Get full user context for AI chat
   * Note: Context is fetched server-side in /api/agi/chat, so we skip it here
   * to avoid auth issues (bot endpoints require service key)
   */
  async getUserContext(): Promise<UserContext | null> {
    // Context is fetched server-side by /api/agi/chat endpoint
    // No need to fetch here - the server has access to user data via the JWT
    return null;
  }

  /**
   * Get user profile from the web app
   */
  async getProfile(): Promise<UserProfile> {
    const response = await this.request<{ profile: UserProfile }>('/api/agi/profile');
    return response.profile;
  }

  /**
   * Get unified context — the richest business context snapshot
   * Includes tasks, deadlines, finances, calendar, integrations, memories, etc.
   */
  async getUnifiedContext(): Promise<UnifiedContext> {
    return this.request<UnifiedContext>('/api/agi/unified-context');
  }

  /**
   * Get user's integration status
   */
  async getIntegrations(): Promise<IntegrationsResponse> {
    return this.request<IntegrationsResponse>('/api/agi/integrations');
  }
}
