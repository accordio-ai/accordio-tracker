import { useCallback, useEffect, useRef, useState } from 'react';

interface UseFileDropZoneOptions {
  /** Called once with the dropped FileList. */
  onDrop: (files: FileList) => void;
  /** When false, listeners are detached (e.g. unrelated tab is active). */
  isActive?: boolean;
}

/**
 * Window-level drag-and-drop listener for files.
 *
 * Uses the counter pattern (dragenter/leave fire on every child element, so a
 * single boolean would flicker as the cursor crosses element boundaries). Only
 * activates for drags that carry `Files` — text/URL drags from inside the page
 * are ignored. Consumers render their own overlay using the returned
 * `isDragOver` state.
 */
export function useFileDropZone({ onDrop, isActive = true }: UseFileDropZoneOptions) {
  const [isDragOver, setIsDragOver] = useState(false);
  const counterRef = useRef(0);
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

  const hasFiles = useCallback((e: DragEvent) => {
    return !!e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
  }, []);

  useEffect(() => {
    if (!isActive) {
      counterRef.current = 0;
      setIsDragOver(false);
      return;
    }

    const onDragEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      counterRef.current += 1;
      setIsDragOver(true);
    };
    const onDragOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };
    const onDragLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      counterRef.current = Math.max(0, counterRef.current - 1);
      if (counterRef.current === 0) setIsDragOver(false);
    };
    const onDocDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      counterRef.current = 0;
      setIsDragOver(false);
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) onDropRef.current(files);
    };

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDocDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDocDrop);
    };
  }, [isActive, hasFiles]);

  return { isDragOver };
}
