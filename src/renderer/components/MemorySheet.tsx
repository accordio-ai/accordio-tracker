import { useState, useEffect, useCallback } from 'react';
import { MemoryPanel } from './MemoryPanel';

interface Memory {
  id: string;
  content: string;
  category?: string;
  type?: 'preference' | 'instruction' | 'fact' | 'context' | 'goal';
  createdAt?: number;
  source?: string;
}

interface MemorySheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MemorySheet({ isOpen, onClose }: MemorySheetProps) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Load and sync memories when sheet opens
  useEffect(() => {
    if (!isOpen) return;

    const loadMemories = async () => {
      try {
        const syncResult = await window.electron.memory.syncFromServer();
        if (syncResult.success && syncResult.memories) {
          setMemories(syncResult.memories);
        } else {
          const localMemories = await window.electron.memory.list();
          setMemories(localMemories || []);
        }
      } catch {
        const localMemories = await window.electron.memory.list();
        setMemories(localMemories || []);
      }
    };
    loadMemories();
  }, [isOpen]);

  // Animate in/out
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsAnimating(true));
      });
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleAddMemory = useCallback(async (content: string, type?: Memory['type']) => {
    const memory = await window.electron.memory.add(content, type);
    setMemories((prev) => [...prev, memory]);
  }, []);

  const handleRemoveMemory = useCallback(async (id: string) => {
    await window.electron.memory.delete(id);
    setMemories((prev) => prev.filter((m) => m.id !== id));
  }, []);

  if (!isVisible) return null;

  return (
    <div className={`memory-sheet-backdrop ${isAnimating ? 'active' : ''}`} onClick={onClose}>
      <div
        className={`memory-sheet ${isAnimating ? 'active' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="icon-btn icon-btn-ghost memory-sheet-close" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
        <div className="memory-sheet-content">
          <MemoryPanel
            memories={memories}
            onAdd={handleAddMemory}
            onDelete={handleRemoveMemory}
          />
        </div>
      </div>
    </div>
  );
}
