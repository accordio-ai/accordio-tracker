/**
 * Artifacts: the things a tool call leaves behind that have a page in the
 * web app.
 *
 * The dashboard chat renders a clickable preview card under a completed
 * `generateContract` / `generateInvoice` and a lighter open-row for the rest.
 * The menubar app ran the same tools but only showed the "Contract created"
 * caption; the id in the result was never read, so there was nothing to click.
 *
 * This module is the pure half: tool result in, artifact description out. It
 * has no DOM or Electron dependency so it can be pinned by `tests/`. The card
 * that renders it and opens the URL lives in `components/chat/ArtifactCard`.
 *
 * Result shapes come from `Accordio/lib/brain-tools.ts`. They are read
 * defensively — a missing field degrades the card, never hides it, except for
 * the id/URL, without which there is nothing to open.
 */

export type ArtifactKind = 'contract' | 'invoice' | 'client' | 'link';

export interface Artifact {
  kind: ArtifactKind;
  /** Path on the web app, e.g. `/contracts/abc`. Always starts with `/`. */
  path: string;
  title: string;
  /** One line under the title: amount, counterparty, status. */
  subtitle: string;
  /** Present only for document kinds — feeds the sheet thumbnail. */
  sheet?: {
    heading: string;
    counterparty?: string;
    amount?: string;
    status?: string;
    lines?: string[];
  };
}

type Rec = Record<string, unknown>;

function rec(v: unknown): Rec | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Rec) : null;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

/** `/contracts/abc` style app path from a URL-ish field, or an id under `base`. */
function appPath(urlish: unknown, base: string, id: unknown): string | null {
  const u = str(urlish);
  if (u && u.startsWith('/')) return u;
  if (u && /^https?:\/\//.test(u)) {
    try {
      return new URL(u).pathname;
    } catch {
      /* fall through */
    }
  }
  const i = str(id);
  return i ? `${base}/${encodeURIComponent(i)}` : null;
}

function cap(v: string | undefined): string | undefined {
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : undefined;
}

function joinDots(parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(' · ');
}

/**
 * Describe what a completed tool produced, or `null` when it produced nothing
 * openable. Failed results (`error` set, or `success === false`) never yield
 * an artifact — a card that opens a 404 is worse than no card.
 */
export function resolveArtifact(toolName: string, output: unknown, input?: unknown): Artifact | null {
  const out = rec(output);
  if (!out) return null;
  if (out.error || out.success === false) return null;
  const args = rec(input) ?? {};

  switch (toolName) {
    case 'createContract': {
      const c = rec(out.contract);
      if (!c) return null;
      const path = appPath(c.editUrl, '/contracts', c.id);
      if (!path) return null;
      const title = str(c.title) ?? 'Contract';
      const client = str(args.clientName);
      const amount = str(c.amount);
      const status = cap(str(c.status)) ?? 'Draft';
      return {
        kind: 'contract',
        path,
        title,
        subtitle: joinDots([amount, client, status]),
        sheet: {
          heading: title,
          counterparty: client,
          amount,
          status,
          lines: [str(args.projectDescription), str(args.paymentTerms)].filter((s): s is string => !!s),
        },
      };
    }

    case 'createInvoice': {
      const inv = rec(out.invoice);
      if (!inv) return null;
      const path = appPath(inv.viewUrl, '/invoices', inv.id);
      if (!path) return null;
      const number = str(inv.number);
      const title = number ? `Invoice ${number}` : 'Invoice';
      const client = str(args.clientName);
      const amount = str(inv.amount);
      const status = cap(str(inv.status)) ?? 'Draft';
      const due = str(inv.dueDate);
      return {
        kind: 'invoice',
        path,
        title,
        subtitle: joinDots([amount, client, status]),
        sheet: {
          heading: title,
          counterparty: client,
          amount,
          status,
          lines: [str(args.description), due ? `Due ${due}` : undefined].filter((s): s is string => !!s),
        },
      };
    }

    case 'createClient': {
      const client = rec(out.client);
      const path = appPath(out.viewUrl, '/clients', client?.id);
      if (!path) return null;
      const name = str(client?.company_name) ?? str(client?.contact_name) ?? str(args.companyName) ?? str(args.contactName) ?? 'Client';
      return {
        kind: 'client',
        path,
        title: name,
        subtitle: out.alreadyExists ? 'Already in your clients' : 'Added to clients',
      };
    }

    default: {
      // Any other tool that hands back a link gets a plain open-row. The
      // dashboard honours `redirectUrl` the same way.
      const path = appPath(out.redirectUrl ?? out.viewUrl ?? out.editUrl, '', undefined);
      if (!path) return null;
      return {
        kind: 'link',
        path,
        title: str(out.title) ?? 'Open in Accordio',
        subtitle: str(out.message) ?? '',
      };
    }
  }
}

/** Absolute URL for an artifact on the configured web app. */
export function artifactHref(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}${path}`;
}
