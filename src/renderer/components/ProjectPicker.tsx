/**
 * ProjectPicker — Searchable project dropdown for assigning time entries.
 * Replaces native <select> with a custom dropdown that matches the app's design.
 */

import { useState, useRef, useEffect, useCallback } from 'react';

interface Project {
  id: string;
  name: string;
  client_name?: string;
  color?: string;
}

// Project color map — matches web app (components/time/constants/time-constants.ts)
export const PROJECT_COLOR_HEX: Record<string, string> = {
  emerald: '#10b981',
  amber: '#fbbf24',
  orange: '#fb923c',
  violet: '#8b5cf6',
  blue: '#3b82f6',
  teal: '#14b8a6',
  pink: '#f472b6',
  slate: '#64748b',
  cyan: '#06b6d4',
  rose: '#f43f5e',
};

const PROJECT_COLOR_NAMES = Object.keys(PROJECT_COLOR_HEX);

/**
 * Projects have no stored colour — `projects.color` does not exist in the
 * schema. Derive one from the id so the list is scannable and a given project
 * keeps the same colour everywhere. Swap this body out if a real column lands.
 */
function hashToColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  const name = PROJECT_COLOR_NAMES[Math.abs(hash) % PROJECT_COLOR_NAMES.length];
  return PROJECT_COLOR_HEX[name];
}

export function getProjectColor(colorName?: string, projectId?: string): string {
  if (colorName && PROJECT_COLOR_HEX[colorName]) return PROJECT_COLOR_HEX[colorName];
  if (projectId) return hashToColor(projectId);
  return PROJECT_COLOR_HEX.slate;
}

/**
 * The empty state has to be honest about *why* it is empty. Collapsing every
 * cause into "No projects available" is what hid a server error for months.
 */
function renderEmptyState({
  projects,
  query,
  status,
  errorCode,
  onRetry,
}: {
  projects: Project[];
  query: string;
  status: ProjectPickerStatus;
  errorCode: ProjectPickerErrorCode | null;
  onRetry?: () => void;
}) {
  // A cached list is still useful while a refresh is in flight or failing.
  if (projects.length > 0 && query.trim()) {
    return <>No projects match “{query.trim()}”</>;
  }

  if (status === 'loading') {
    return <>Loading projects…</>;
  }

  if (status === 'error') {
    const isAuth = errorCode === 'auth_expired' || errorCode === 'not_authenticated';
    return (
      <>
        <div>{isAuth ? 'Sign in to load your projects.' : "Couldn't load projects."}</div>
        {!isAuth && onRetry && (
          <button type="button" className="project-picker-empty-action" onClick={onRetry}>
            Try again
          </button>
        )}
      </>
    );
  }

  return <>No projects yet — create one in Accordio.</>;
}

export type ProjectPickerStatus = 'loading' | 'ready' | 'error';

export type ProjectPickerErrorCode =
  | 'not_authenticated'
  | 'auth_expired'
  | 'server_error'
  | 'network_error';

interface ProjectPickerProps {
  projects: Project[];
  onSelect: (projectId: string) => void;
  onClose?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** Defaults to 'ready' so existing callers keep working. */
  status?: ProjectPickerStatus;
  errorCode?: ProjectPickerErrorCode | null;
  onRetry?: () => void;
}

export function ProjectPicker({
  projects,
  onSelect,
  onClose,
  placeholder = 'Search projects...',
  autoFocus = true,
  status = 'ready',
  errorCode = null,
  onRetry,
}: ProjectPickerProps) {
  const [query, setQuery] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = query.trim()
    ? projects.filter((p) => {
        const q = query.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          (p.client_name?.toLowerCase().includes(q) ?? false)
        );
      })
    : projects;

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  // Reset highlight when filter changes
  useEffect(() => {
    setHighlightIndex(0);
  }, [query]);

  // Scroll highlighted item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.children[highlightIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [highlightIndex]);

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose?.();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[highlightIndex]) {
          onSelect(filtered[highlightIndex].id);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
      }
    },
    [filtered, highlightIndex, onSelect, onClose]
  );

  return (
    <div className="project-picker" ref={containerRef}>
      <div className="project-picker-search">
        <svg className="project-picker-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          className="project-picker-input"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
      <div className="project-picker-list" ref={listRef}>
        {filtered.length === 0 ? (
          <div className="project-picker-empty">
            {renderEmptyState({ projects, query, status, errorCode, onRetry })}
          </div>
        ) : (
          filtered.map((project, i) => (
            <button
              key={project.id}
              className={`project-picker-item ${i === highlightIndex ? 'highlighted' : ''}`}
              onClick={() => onSelect(project.id)}
              onMouseEnter={() => setHighlightIndex(i)}
            >
              <span
                className="project-picker-swatch"
                style={{ background: getProjectColor(project.color, project.id) }}
              />
              <span className="project-picker-item-name">{project.name}</span>
              {project.client_name && (
                <span className="project-picker-item-client">({project.client_name})</span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
