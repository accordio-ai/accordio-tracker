/**
 * An 80×80 attachment tile — images preview, everything else gets a type chip.
 * Shared by the user message strip and the composer tray so the two can't drift.
 */

interface AttachmentTileProps {
  url?: string;
  mediaType?: string;
  filename?: string;
  /** Shown while a file is still being read. */
  loading?: boolean;
  onRemove?: () => void;
}

/** Short label + colour for the non-image chip, matching the dashboard. */
function typeChip(mediaType?: string, filename?: string): { label: string; className: string } {
  const name = (filename ?? '').toLowerCase();
  if (mediaType === 'application/pdf' || name.endsWith('.pdf')) {
    return { label: 'PDF', className: 'bg-red-500' };
  }
  if (/\.(docx?|rtf|odt)$/.test(name) || mediaType?.includes('word')) {
    return { label: 'DOC', className: 'bg-blue-500' };
  }
  return { label: 'TXT', className: 'bg-gray-500' };
}

export function AttachmentTile({
  url,
  mediaType,
  filename,
  loading,
  onRemove,
}: AttachmentTileProps) {
  const isImage = mediaType?.startsWith('image/');
  const chip = typeChip(mediaType, filename);

  return (
    <div
      className="group/tile relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-(--border-soft) bg-(--bg-raised)"
      title={filename}
    >
      {isImage && url ? (
        <img src={url} alt={filename ?? 'attachment'} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-1">
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-medium text-white ${chip.className}`}
          >
            {chip.label}
          </span>
          <span className="line-clamp-2 break-all text-center text-[10px] leading-tight text-(--text-tertiary)">
            {filename}
          </span>
        </div>
      )}

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        </div>
      )}

      {onRemove && !loading && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${filename ?? 'attachment'}`}
          className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover/tile:opacity-100"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
