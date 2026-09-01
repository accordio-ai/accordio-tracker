/**
 * The clickable preview under a completed tool call.
 *
 * Ported from the dashboard's `MagneticArtifactCard`: a document sheet that
 * bleeds off the bottom edge of the card, an info bar with title and one line
 * of facts, and motion that signals clickability without an "Open" button.
 * The 3D tilt is dropped — in a 400px popover it reads as wobble — leaving
 * the fade-in, hover lift and press.
 *
 * Electron has no in-app page for a contract or an invoice, so the card
 * opens the web app in the default browser via the main process, which
 * validates the URL before `shell.openExternal`. The base URL is the same
 * one the chat transport talks to, so a dev build pointed at a custom
 * `apiUrl` opens its documents there too.
 */

import { motion } from 'framer-motion';
import { ArrowUpRight, FileText, Receipt, UserRound, ExternalLink, type LucideIcon } from 'lucide-react';
import { getApiUrl } from '../../lib/chat/apiUrl';
import { artifactHref, type Artifact, type ArtifactKind } from '../../lib/chat/artifacts';

const ICONS: Record<ArtifactKind, LucideIcon> = {
  contract: FileText,
  invoice: Receipt,
  client: UserRound,
  link: ExternalLink,
};

async function open(path: string) {
  const base = await getApiUrl();
  await window.electron.app.openExternal(artifactHref(base, path));
}

const cardMotion = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  whileHover: { scale: 1.015, y: -1 },
  whileTap: { scale: 0.985 },
  transition: { type: 'spring', stiffness: 320, damping: 24, mass: 0.6 } as const,
};

const cardClass =
  'group w-full text-left rounded-xl border border-(--border-medium) bg-(--bg-card) overflow-hidden ' +
  'transition-[border-color,box-shadow] duration-200 hover:border-[#78D277]/50 hover:shadow-lg ' +
  'focus-visible:border-[#78D277]/60';

export function ArtifactCard({ artifact }: { artifact: Artifact }) {
  const Icon = ICONS[artifact.kind];
  const onClick = () => void open(artifact.path);

  if (!artifact.sheet) {
    return (
      <motion.button type="button" onClick={onClick} className={`${cardClass} flex items-center gap-3 px-3.5 py-3`} {...cardMotion}>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#78D277]/15 text-[#78D277] transition-colors group-hover:bg-[#78D277]/25">
          <Icon size={15} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-(--text-primary)">{artifact.title}</span>
          {artifact.subtitle && (
            <span className="block truncate text-[11px] text-(--text-secondary)">{artifact.subtitle}</span>
          )}
        </span>
        <ArrowUpRight size={14} className="shrink-0 text-(--text-tertiary) transition-colors group-hover:text-[#78D277]" />
      </motion.button>
    );
  }

  const { sheet } = artifact;

  return (
    <motion.button type="button" onClick={onClick} className={`${cardClass} block`} {...cardMotion}>
      {/* Desk surface. The sheet is taller than its container so it bleeds off
          the bottom edge, matching the contract archive's card style. */}
      <div className="relative h-[124px] overflow-hidden bg-(--bg-raised) px-3 pt-3">
        <div
          aria-hidden
          className="relative w-full overflow-hidden rounded-t-sm bg-white shadow-sm"
          style={{ height: 'calc(100% + 40px)' }}
        >
          <div className="pointer-events-none select-none p-3 text-[9px] leading-tight text-gray-500">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="truncate text-[10px] font-medium text-gray-900">{sheet.heading}</span>
              {sheet.status && (
                <span className="shrink-0 rounded-full bg-gray-100 px-1.5 py-0.5 text-[7px] font-medium text-gray-500">
                  {sheet.status}
                </span>
              )}
            </div>
            {sheet.counterparty && (
              <div className="mb-2">
                <span className="text-[7px] uppercase tracking-wide text-gray-400">Client</span>
                <div className="truncate text-gray-800">{sheet.counterparty}</div>
              </div>
            )}
            {sheet.lines?.map((line, i) => (
              <div key={i} className="mb-1 truncate text-gray-600">
                {line}
              </div>
            ))}
            {/* Skeleton lines stand in for body copy the result doesn't carry. */}
            <div className="mt-2 space-y-1">
              <div className="h-1 w-11/12 rounded bg-gray-200" />
              <div className="h-1 w-4/5 rounded bg-gray-200" />
              <div className="h-1 w-3/5 rounded bg-gray-200" />
            </div>
            {sheet.amount && (
              <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-1.5">
                <span className="text-[7px] uppercase tracking-wide text-gray-400">Total</span>
                <span className="text-[10px] font-medium text-gray-900">{sheet.amount}</span>
              </div>
            )}
          </div>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-(--bg-raised) to-transparent" />
      </div>

      <div className="flex items-center gap-3 border-t border-(--border-soft) px-3.5 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#78D277]/15 text-[#78D277] transition-colors group-hover:bg-[#78D277]/25">
          <Icon size={15} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-(--text-primary)">{artifact.title}</span>
          {artifact.subtitle && (
            <span className="block truncate text-[11px] text-(--text-secondary)">{artifact.subtitle}</span>
          )}
        </span>
        <ArrowUpRight size={14} className="shrink-0 text-(--text-tertiary) transition-colors group-hover:text-[#78D277]" />
      </div>
    </motion.button>
  );
}

export default ArtifactCard;
