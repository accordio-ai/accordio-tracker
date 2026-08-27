/**
 * Click-to-edit duration.
 *
 * The single most important correction affordance: when the tracker says a
 * meeting took 9 minutes and it took 40, this is how you say so. Everything
 * else about trusting the numbers depends on being able to fix them.
 *
 * Accepts "40m", "1h15", "1:15", "1.5h", or a bare number meaning minutes.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { parseDuration, formatDurationInput } from '../../shared/duration';

interface EditableDurationProps {
  /** Current duration in seconds. */
  seconds: number;
  /** Called with the new duration in seconds. */
  onCommit: (seconds: number) => void;
  /** Rendered when not editing. */
  format: (seconds: number) => string;
  className?: string;
}

export function EditableDuration({ seconds, onCommit, format, className }: EditableDurationProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [invalid, setInvalid] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const startEditing = useCallback(() => {
    setValue(formatDurationInput(seconds));
    setInvalid(false);
    setEditing(true);
  }, [seconds]);

  const commit = useCallback(() => {
    const parsed = parseDuration(value);
    if (parsed === null || parsed <= 0) {
      // Keep the field open rather than silently discarding what they typed.
      setInvalid(true);
      return;
    }
    setEditing(false);
    setInvalid(false);
    if (parsed !== seconds) onCommit(parsed);
  }, [value, seconds, onCommit]);

  const cancel = useCallback(() => {
    setEditing(false);
    setInvalid(false);
  }, []);

  if (!editing) {
    return (
      <button
        type="button"
        className={`editable-duration ${className ?? ''}`}
        onClick={(e) => {
          e.stopPropagation();
          startEditing();
        }}
        title="Click to correct the duration"
      >
        {format(seconds)}
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      type="text"
      className={`editable-duration-input ${invalid ? 'invalid' : ''}`}
      value={value}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        setValue(e.target.value);
        setInvalid(false);
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          cancel();
        }
      }}
    />
  );
}
