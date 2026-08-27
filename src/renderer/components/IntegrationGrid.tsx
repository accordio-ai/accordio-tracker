interface Integration {
  provider: string;
  connected: boolean;
  lastSync?: number;
  name?: string;
}

interface IntegrationGridProps {
  integrations: Integration[];
  onConnect: (provider: string) => void;
  onOpenSettings: () => void;
}

// Integration metadata with SVG file paths
const integrationMeta: Record<string, { name: string; icon: string; color: string }> = {
  notion: {
    name: 'Notion',
    color: '#000000',
    icon: 'notion.svg',
  },
  todoist: {
    name: 'Todoist',
    color: '#E44332',
    icon: 'todoist.svg',
  },
  google_calendar: {
    name: 'Calendar',
    color: '#4285F4',
    icon: 'google-calendar.svg',
  },
  asana: {
    name: 'Asana',
    color: '#F06A6A',
    icon: 'asana.svg',
  },
  linear: {
    name: 'Linear',
    color: '#5E6AD2',
    icon: 'linear.svg',
  },
  slack: {
    name: 'Slack',
    color: '#4A154B',
    icon: 'slack.svg',
  },
  gmail: {
    name: 'Gmail',
    color: '#EA4335',
    icon: 'gmail.svg',
  },
  trello: {
    name: 'Trello',
    color: '#0052CC',
    icon: 'trello.svg',
  },
  jira: {
    name: 'Jira',
    color: '#0052CC',
    icon: 'jira.svg',
  },
  clickup: {
    name: 'ClickUp',
    color: '#7B68EE',
    icon: 'clickup.svg',
  },
};

// All available integrations
const allIntegrations = [
  'notion', 'todoist', 'google_calendar', 'asana', 'gmail', 'trello', 'jira', 'clickup'
];

export function IntegrationGrid({
  integrations,
  onConnect,
  onOpenSettings,
}: IntegrationGridProps) {
  // Build map of connected integrations
  const connectedMap = new Map<string, Integration>();
  integrations.forEach(int => {
    connectedMap.set(int.provider, int);
  });

  // Count connected
  const connectedCount = integrations.filter(i => i.connected).length;

  return (
    <div className="integration-grid">
      <div className="integration-grid-header">
        <h3 className="integration-grid-title">Connected Tools</h3>
        <span className="integration-grid-count">
          {connectedCount}/{allIntegrations.length} connected
        </span>
      </div>

      <div className="integration-grid-items">
        {allIntegrations.map(provider => {
          const meta = integrationMeta[provider];
          if (!meta) return null;

          const integration = connectedMap.get(provider);
          const isConnected = integration?.connected;

          return (
            <button
              key={provider}
              className={`integration-tile ${isConnected ? 'connected' : ''}`}
              onClick={() => isConnected ? onOpenSettings() : onConnect(provider)}
              title={isConnected ? `${meta.name} connected` : `Connect ${meta.name}`}
            >
              <div className="integration-tile-icon">
                <img
                  src={`./integrations/${meta.icon}`}
                  alt={meta.name}
                  width={18}
                  height={18}
                  style={{ opacity: isConnected ? 1 : 0.5 }}
                />
              </div>
              <span className="integration-tile-name">{meta.name}</span>
              {isConnected ? (
                <span className="integration-tile-status connected">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9.9997 15.1709L19.1921 5.97852L20.6063 7.39273L9.9997 17.9993L3.63574 11.6354L5.04996 10.2212L9.9997 15.1709Z"/>
                  </svg>
                </span>
              ) : (
                <span className="integration-tile-status disconnected">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                </span>
              )}
            </button>
          );
        })}
      </div>

      <button className="integration-grid-manage" onClick={onOpenSettings}>
        Manage integrations in web app
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
          <polyline points="15 3 21 3 21 9"/>
          <line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
      </button>
    </div>
  );
}

export default IntegrationGrid;
