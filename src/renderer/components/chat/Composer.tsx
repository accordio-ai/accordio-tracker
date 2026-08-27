/**
 * The composer.
 *
 * One component for both the empty state and an active conversation. The app
 * previously had two: a raw `<input type="text">` in a `<form>` for the empty
 * state with its own attachment state, and `ChatPromptInput` for the active
 * chat. They shared nothing, so every fix had to be made twice — and drag-and-
 * drop, tiles and the stop button only ever existed in neither.
 *
 * Ported from the dashboard's `ai-prompt-input.tsx`, minus everything that
 * doesn't fit a 400px popover: the `+` dropdown, the Tools grid, the Drive
 * picker, the project selector and voice mode.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUp, Paperclip, Square } from 'lucide-react';
import { AttachmentTile } from './AttachmentTile';
import { useFileDropZone } from '../../hooks/useFileDropZone';
import { MAX_FILE_SIZE, MAX_FILE_SIZE_MB } from '../../lib/chat/attachments';

const ACCEPTED =
  'image/*,.pdf,.txt,.md,.csv,.json,.xml,.yaml,.yml,.html,.css,.js,.ts,.tsx,.jsx,.py,.rb,.go,.rs,.sh,.sql,.doc,.docx';

// Same textarea bounds as the dashboard's ai-prompt-input.
const AUTOSIZE_MIN = 60;
const AUTOSIZE_MAX = 120;

interface ComposerProps {
  onSubmit: (message: string, files?: File[]) => void | Promise<void>;
  onStop?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  /** Cycled while the field is empty. A single entry disables the carousel. */
  placeholders?: string[];
  /** Drag-and-drop is window-level, so it must be off when chat isn't visible. */
  dropZoneActive?: boolean;
  autoFocus?: boolean;
}

export function Composer({
  onSubmit,
  onStop,
  isLoading = false,
  disabled = false,
  placeholders = ['Ask me anything...'],
  dropZoneActive = true,
  autoFocus = false,
}: ComposerProps) {
  const [value, setValue] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [warning, setWarning] = useState<string | null>(null);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const plusMenuRef = useRef<HTMLDivElement>(null);

  // Close the + menu on outside click or Escape — hand-rolled because the
  // desktop app doesn't ship Radix dropdown-menu; visuals mirror the web's.
  useEffect(() => {
    if (!plusMenuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!plusMenuRef.current?.contains(e.target as Node)) setPlusMenuOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPlusMenuOpen(false);
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [plusMenuOpen]);

  const addFiles = useCallback((incoming: File[]) => {
    const accepted: File[] = [];
    const rejected: string[] = [];

    for (const file of incoming) {
      if (file.size > MAX_FILE_SIZE) {
        rejected.push(`"${file.name}" exceeds ${MAX_FILE_SIZE_MB}MB`);
      } else {
        accepted.push(file);
      }
    }

    if (rejected.length > 0) {
      setWarning(rejected.join(', '));
      setTimeout(() => setWarning(null), 5000);
    }
    if (accepted.length > 0) setFiles((prev) => [...prev, ...accepted]);
  }, []);

  const { isDragOver } = useFileDropZone({
    isActive: dropZoneActive && !disabled,
    onDrop: (list) => addFiles(Array.from(list)),
  });

  // Image previews as object URLs, minted once per files change and revoked on
  // the next change/unmount. The first version called URL.createObjectURL
  // inline in the render map — a fresh, never-revoked blob URL per render,
  // which leaks continuously while a response streams.
  const previews = useMemo(
    () => files.map((f) => (f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined)),
    [files]
  );
  useEffect(
    () => () => {
      for (const url of previews) if (url) URL.revokeObjectURL(url);
    },
    [previews]
  );

  // Autosize.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(Math.max(el.scrollHeight, AUTOSIZE_MIN), AUTOSIZE_MAX)}px`;
  }, [value]);

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus]);

  // Placeholder carousel — only while the field is empty, so it never animates
  // underneath text the user is typing.
  useEffect(() => {
    if (placeholders.length <= 1 || value) return;
    const interval = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % placeholders.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [placeholders.length, value]);

  const canSend = (value.trim().length > 0 || files.length > 0) && !disabled;

  const submit = useCallback(() => {
    if (!canSend || isLoading) return;
    const text = value.trim();
    const attached = files.length > 0 ? files : undefined;
    setValue('');
    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    void onSubmit(text, attached);
  }, [canSend, isLoading, value, files, onSubmit]);

  // Markup and classes mirror the dashboard's ai-prompt-input "Main Input
  // Container" verbatim where the feature exists here: two tiers — full-width
  // textarea on top, toolbar row below with the 48px green square send on the
  // right. Web-only controls (+ dropdown, Tools, project chip, voice) are the
  // only omissions.
  return (
    <div
      className={`copilot-input-card relative z-10 flex flex-col rounded-2xl border bg-white dark:bg-[#0f1411] shadow-sm transition-all ${
        isDragOver
          ? 'border-dashed border-[#78D277]'
          : 'border-gray-200 dark:border-[#2a312c] focus-within:border-gray-300 dark:focus-within:border-[#3a433c]'
      } ${isLoading ? 'is-streaming' : ''}`}
    >
      {isDragOver && (
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 rounded-2xl bg-white/70 backdrop-blur-sm dark:bg-[#0f1411]/70">
          <Paperclip size={18} className="text-[#78D277]" />
          <span className="text-[12px] text-gray-500 dark:text-muted-foreground">Drop files here</span>
        </div>
      )}

      {warning && (
        <div className="px-4 pt-3 text-[11px] text-amber-500">{warning}</div>
      )}

      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 pt-3">
          {files.map((file, i) => (
            <AttachmentTile
              key={`${file.name}-${i}`}
              filename={file.name}
              mediaType={file.type}
              url={previews[i]}
              onRemove={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
            />
          ))}
        </div>
      )}

      <div className="relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          disabled={disabled}
          className="w-full resize-none border-0 bg-transparent px-4 py-4 text-base text-gray-900 focus:outline-none focus:ring-0 disabled:opacity-50 dark:text-foreground"
          style={{ minHeight: AUTOSIZE_MIN, maxHeight: AUTOSIZE_MAX }}
        />

        {/* Placeholder carousel — same geometry and motion as the dashboard. */}
        {!value && (
          <div className="pointer-events-none absolute left-4 right-4 top-4 h-[1.5em] overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.span
                key={placeholderIndex}
                initial={{ y: 16, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -16, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="block truncate text-base text-gray-400 dark:text-muted-foreground"
              >
                {placeholders[placeholderIndex]}
              </motion.span>
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Bottom toolbar — the web's + menu on the left, send/stop on the right. */}
      <div className="flex items-center gap-2 px-3 pb-3">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED}
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(Array.from(e.target.files));
          }}
        />

        {/* Plus dropdown — trigger and menu mirror the dashboard's
            ai-prompt-input verbatim; only options with a desktop backend are
            listed (integrations / Drive / projects have no plumbing here). */}
        <div className="relative" ref={plusMenuRef}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setPlusMenuOpen((open) => !open)}
            aria-label="Add attachments"
            title="Add attachments"
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] border transition-colors ${
              files.length > 0
                ? 'border-[#78D277]/40 bg-[#78D277]/10 text-[#78D277]'
                : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50 dark:border-[#2a312c] dark:bg-white/[0.03] dark:text-white/50 dark:hover:bg-white/[0.06]'
            } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
          >
            {/* RiAddLine */}
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className={`h-[22px] w-[22px] transition-transform duration-200 ${
                plusMenuOpen ? 'rotate-45' : ''
              }`}
            >
              <path d="M11 11V5H13V11H19V13H13V19H11V13H5V11H11Z" />
            </svg>
          </button>

          <AnimatePresence>
            {plusMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.98 }}
                transition={{ duration: 0.12, ease: 'easeOut' }}
                className="absolute bottom-full left-0 z-50 mb-2 w-64 rounded-md border border-gray-200 bg-white p-1 shadow-md dark:border-[#2a312c] dark:bg-[#1a1f1c]"
              >
                <button
                  type="button"
                  onClick={() => {
                    fileInputRef.current?.click();
                    setPlusMenuOpen(false);
                  }}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-sm px-2 py-2.5 text-sm text-gray-900 transition-colors hover:bg-gray-50 dark:text-foreground dark:hover:bg-white/[0.06]"
                >
                  {/* RiAttachmentLine */}
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-gray-500 dark:text-muted-foreground">
                    <path d="M14 13.5V8C14 5.79086 12.2091 4 10 4C7.79086 4 6 5.79086 6 8V13.5C6 17.0899 8.91015 20 12.5 20C16.0899 20 19 17.0899 19 13.5V4H21V13.5C21 18.1944 17.1944 22 12.5 22C7.80558 22 4 18.1944 4 13.5V8C4 4.68629 6.68629 2 10 2C13.3137 2 16 4.68629 16 8V13.5C16 15.433 14.433 17 12.5 17C10.567 17 9 15.433 9 13.5V8H11V13.5C11 14.3284 11.6716 15 12.5 15C13.3284 15 14 14.3284 14 13.5Z" />
                  </svg>
                  <span>Upload files or photos</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex-1" />

        {/* Stop and send are separate buttons. A single button that swapped its
            icon while staying `disabled` during loading is why the previous
            stop affordance was visible but unclickable. */}
        <AnimatePresence mode="wait" initial={false}>
          {isLoading ? (
            <motion.button
              key="stop"
              type="button"
              onClick={onStop}
              disabled={!onStop}
              aria-label="Stop generation"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.12 }}
              className="flex h-12 w-12 items-center justify-center rounded-[10px] bg-gray-100 text-gray-700 shadow-sm transition-colors hover:bg-gray-200 disabled:opacity-40 dark:bg-white/10 dark:text-[#e8e4dd] dark:hover:bg-white/15"
            >
              <Square size={14} className="fill-current" />
            </motion.button>
          ) : (
            <motion.button
              key="send"
              type="button"
              onClick={submit}
              disabled={!canSend}
              aria-label="Send message"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.12 }}
              className="flex h-12 w-12 items-center justify-center rounded-[10px] bg-[#78D277] text-white shadow-sm transition-colors hover:bg-[#68C267] disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 dark:disabled:bg-white/10 dark:disabled:text-[#e8e4dd]/50"
            >
              <ArrowUp size={20} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
