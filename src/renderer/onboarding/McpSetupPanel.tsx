import { useState } from 'react';
import { motion } from 'framer-motion';

/**
 * The web app's Settings → MCP server page, replayed inside the setup
 * window's dark panel: host picker, then three steps on one vertical rail
 * (add the server, authenticate, ask the first question). Copy and hosts
 * mirror Accordio/components/mcp/hosts.ts; keep them in step by hand.
 */

export const MCP_URL = 'https://mcp.accordio.ai/mcp';
const FIRST_QUESTION = 'What did I work on today?';

type HostId = 'claude' | 'claude-code' | 'codex' | 'cursor' | 'chatgpt' | 'gemini';

interface Host {
  id: HostId;
  label: string;
  logo: string;
  /** Painted in the current text colour (single-colour marks). */
  mono?: boolean;
  snippetLabel: string;
  code: string;
  link?: { label: string; href: string };
  authenticate: string;
  askIn: string;
}

const json = (v: unknown) => JSON.stringify(v, null, 2);

export const HOSTS: Host[] = [
  {
    id: 'claude',
    label: 'Claude',
    logo: './ai-logos/claude.svg',
    snippetLabel: 'Add a custom connector in Claude and paste this URL:',
    code: MCP_URL,
    link: { label: 'Open Claude', href: 'https://claude.ai/new?modal=add-custom-connector#customize/connectors' },
    authenticate: 'Claude opens the Accordio sign-in as soon as the connector is added. Approve it to log in with your Accordio account.',
    askIn: 'a new Claude chat',
  },
  {
    id: 'claude-code',
    label: 'Claude Code',
    logo: './ai-logos/claude-code.svg',
    snippetLabel: 'Run this command in your terminal:',
    code: `claude mcp add --transport http accordio ${MCP_URL}`,
    authenticate: 'Run /mcp inside Claude Code and select accordio to log in with your Accordio account.',
    askIn: 'Claude Code',
  },
  {
    id: 'codex',
    label: 'Codex',
    logo: './ai-logos/codex.png',
    snippetLabel: 'Add this to ~/.codex/config.toml:',
    code: `[mcp_servers.accordio]\nurl = "${MCP_URL}"`,
    authenticate: 'Run codex mcp login accordio in your terminal and approve the Accordio sign-in it opens.',
    askIn: 'Codex',
  },
  {
    id: 'cursor',
    label: 'Cursor',
    logo: './ai-logos/cursor.svg',
    mono: true,
    snippetLabel: 'Add this to ~/.cursor/mcp.json:',
    code: json({ mcpServers: { accordio: { url: MCP_URL } } }),
    authenticate: 'Open Cursor Settings, then MCP, and click Connect next to accordio to log in with your Accordio account.',
    askIn: 'Cursor chat',
  },
  {
    id: 'chatgpt',
    label: 'ChatGPT',
    logo: './ai-logos/chatgpt.svg',
    mono: true,
    snippetLabel: 'Turn on developer mode (Settings, Apps, Advanced settings), then Settings, Connectors, Create. Name it Accordio, pick OAuth, and paste this URL:',
    code: MCP_URL,
    link: { label: 'Open ChatGPT settings', href: 'https://chatgpt.com/#settings/Connectors' },
    authenticate: 'ChatGPT opens the Accordio sign-in when you create the connector. Approve it to log in with your Accordio account.',
    askIn: 'ChatGPT',
  },
  {
    id: 'gemini',
    label: 'Gemini CLI',
    logo: './ai-logos/gemini.svg',
    snippetLabel: 'Run this command in your terminal:',
    code: `gemini mcp add --transport http accordio ${MCP_URL}`,
    authenticate: 'Run /mcp auth accordio inside Gemini CLI and approve the Accordio sign-in it opens.',
    askIn: 'Gemini CLI',
  },
];

export function HostLogo({ host, size = 16 }: { host: Host; size?: number }) {
  if (host.mono) {
    return (
      <span
        aria-hidden="true"
        style={{
          display: 'inline-block',
          width: size,
          height: size,
          backgroundColor: 'currentColor',
          WebkitMask: `url(${host.logo}) center / contain no-repeat`,
          mask: `url(${host.logo}) center / contain no-repeat`,
        }}
      />
    );
  }
  return <img src={host.logo} alt="" width={size} height={size} draggable={false} style={{ width: size, height: size, objectFit: 'contain', display: 'block' }} aria-hidden="true" />;
}

/** The MCP mark, in the current text colour. */
export function McpMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 180 180" fill="none" aria-hidden="true" stroke="currentColor" strokeWidth="12" strokeLinecap="round">
      <path d="M18 84.8528L85.8822 16.9706C95.2548 7.59798 110.451 7.59798 119.823 16.9706C129.196 26.3431 129.196 41.5391 119.823 50.9117L68.5581 102.177" />
      <path d="M69.2652 101.47L119.823 50.9117C129.196 41.5391 144.392 41.5391 153.765 50.9117L154.118 51.2652C163.491 60.6378 163.491 75.8338 154.118 85.2063L92.7248 146.6C89.6006 149.724 89.6006 154.789 92.7248 157.913L105.331 170.52" />
      <path d="M102.853 33.9411L52.6482 84.1457C43.2756 93.5183 43.2756 108.714 52.6482 118.087C62.0208 127.459 77.2167 127.459 86.5893 118.087L136.794 67.8822" />
    </svg>
  );
}

function Check({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m20 6-11 11-5-5" />
    </svg>
  );
}

function CodeBlock({ code, copyLabel }: { code: string; copyLabel: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="ob-mcp-code">
      <pre>{code}</pre>
      <button
        type="button"
        className="ob-mcp-copy"
        aria-label={copyLabel}
        onClick={() => {
          void navigator.clipboard.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          });
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

type StepState = 'upcoming' | 'active' | 'done';

function Step({
  n,
  title,
  description,
  state,
  last,
  onReopen,
  children,
}: {
  n: number;
  title: string;
  description?: string;
  state: StepState;
  last?: boolean;
  onReopen?: () => void;
  children?: React.ReactNode;
}) {
  const open = state === 'active';
  return (
    <motion.div
      className="ob-mcp-step"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.12 + n * 0.08, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="ob-mcp-rail">
        <span className={`ob-mcp-node ob-mcp-node--${state}`}>{state === 'done' && <Check size={11} />}</span>
        {!last && <span className="ob-mcp-line" />}
      </div>
      <div className={`ob-mcp-body${last ? ' ob-mcp-body--last' : ''}`}>
        <button type="button" className={`ob-mcp-title ob-mcp-title--${state}`} onClick={state === 'done' ? onReopen : undefined}>
          {title}
          {state === 'done' && <span className="ob-mcp-tick"><Check size={12} /></span>}
        </button>
        {open && description && <p className="ob-mcp-desc">{description}</p>}
        {open && children && (
          <motion.div
            className="ob-mcp-card"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            {children}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

export function McpSetupPanel({ initialHost = 'claude' }: { initialHost?: HostId }) {
  const [hostId, setHostId] = useState<HostId>(initialHost);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [added, setAdded] = useState(false);
  const [authed, setAuthed] = useState(false);
  const host = HOSTS.find((h) => h.id === hostId) ?? HOSTS[0];
  const stateOf = (n: 1 | 2 | 3, done: boolean): StepState => (step === n ? 'active' : done ? 'done' : 'upcoming');

  return (
    <div className="ob-mcp">
      <motion.div
        className="ob-mcp-head"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      >
        <span className="ob-mcp-mark"><McpMark size={22} /></span>
        <div>
          <div className="ob-mcp-kicker">Integrations</div>
          <div className="ob-mcp-h1">MCP server</div>
        </div>
      </motion.div>

      <Step n={1} title="Add the MCP server" description="Choose the AI tool you want to connect to Accordio." state={stateOf(1, added)} onReopen={() => setStep(1)}>
        <div className="ob-mcp-tabs" role="tablist" aria-label="AI tool">
          {HOSTS.map((h) => (
            <button key={h.id} type="button" role="tab" aria-selected={hostId === h.id} className={`ob-mcp-tab${hostId === h.id ? ' ob-mcp-tab--on' : ''}`} onClick={() => setHostId(h.id)}>
              <HostLogo host={h} size={15} />
              {h.label}
            </button>
          ))}
        </div>
        <p className="ob-mcp-snippet-label">{host.snippetLabel}</p>
        <CodeBlock code={host.code} copyLabel={`Copy for ${host.label}`} />
        <div className="ob-mcp-actions">
          <button type="button" className="ob-btn ob-mcp-primary" onClick={() => { setAdded(true); setStep(2); }}>
            <Check size={13} />
            I&rsquo;ve added the server
          </button>
          {host.link && (
            <button type="button" className="ob-mcp-link" onClick={() => window.electron.app.openExternal(host.link!.href)}>
              {host.link.label}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9" /></svg>
            </button>
          )}
        </div>
      </Step>

      <Step n={2} title="Authenticate" description={host.authenticate} state={stateOf(2, authed)} onReopen={() => setStep(2)}>
        <div className="ob-mcp-waitrow">
          <span className="ob-mcp-spinner" />
          <span className="ob-mcp-waitcopy">
            <strong>Waiting for {host.label}…</strong>
            <span>This updates on its own once the sign-in is approved.</span>
          </span>
          <button type="button" className="ob-mcp-link" onClick={() => { setAuthed(true); setStep(3); }}>Skip</button>
        </div>
      </Step>

      <Step n={3} title="Ask your first question" description={`Say this in ${host.askIn}. The answer comes from your real tracked time.`} state={stateOf(3, false)} last>
        <CodeBlock code={FIRST_QUESTION} copyLabel="Copy the first question" />
        <div className="ob-mcp-waitrow ob-mcp-waitrow--after">
          <span className="ob-mcp-spinner" />
          <span className="ob-mcp-waitcopy">
            <strong>Waiting for the first call…</strong>
            <span>Ask it in {host.askIn} and this turns green.</span>
          </span>
          <button type="button" className="ob-mcp-link" onClick={() => window.electron.app.openExternal('https://accordio.ai/mcp')}>
            See every tool
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9" /></svg>
          </button>
        </div>
        <p className="ob-mcp-fine">Read access plus drafting. It can never send, sign or delete anything. Revoke it any time in Settings.</p>
      </Step>
    </div>
  );
}
