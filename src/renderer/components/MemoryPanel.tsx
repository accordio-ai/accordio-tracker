import { useState, useMemo, useRef } from 'react';

interface Memory {
  id: string;
  content: string;
  category?: string;
  type?: 'preference' | 'instruction' | 'fact' | 'context' | 'goal';
  createdAt?: number;
  source?: string;
}

interface MemoryPanelProps {
  memories: Memory[];
  onAdd: (content: string, type?: Memory['type']) => void;
  onDelete: (id: string) => void;
}

// Auto-categorize memory content based on keywords
function inferMemoryType(content: string): Memory['type'] {
  const lower = content.toLowerCase();

  // Instructions / Business rules
  if (lower.includes('always') || lower.includes('never') || lower.includes('must') ||
      lower.includes('require') || lower.includes('rule') || lower.includes('policy')) {
    return 'instruction';
  }

  // Preferences
  if (lower.includes('prefer') || lower.includes('like') || lower.includes('usually') ||
      lower.includes('favorite') || lower.includes('want')) {
    return 'preference';
  }

  // Goals
  if (lower.includes('goal') || lower.includes('target') || lower.includes('aim') ||
      lower.includes('plan to') || lower.includes('working toward')) {
    return 'goal';
  }

  // Facts (client info, rates, etc.)
  if (lower.includes('rate') || lower.includes('price') || lower.includes('client') ||
      lower.includes('contact') || lower.includes('email') || lower.includes('phone') ||
      lower.includes('$/') || lower.includes('per hour')) {
    return 'fact';
  }

  return 'context';
}

const typeLabels: Record<string, { label: string; icon: string; color: string }> = {
  preference: { label: 'Preferences', icon: '🎯', color: '#06b6d4' },
  instruction: { label: 'Business Rules', icon: '📋', color: '#8b5cf6' },
  fact: { label: 'Clients & Rates', icon: '👥', color: '#f59e0b' },
  goal: { label: 'Goals', icon: '🚀', color: '#22c55e' },
  context: { label: 'Other', icon: '💡', color: '#6b7280' },
};

export function MemoryPanel({ memories, onAdd, onDelete }: MemoryPanelProps) {
  const [newMemory, setNewMemory] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['preference', 'instruction', 'fact'])
  );
  const inputRef = useRef<HTMLInputElement>(null);

  // Group memories by type
  const groupedMemories = useMemo(() => {
    const groups: Record<string, Memory[]> = {
      preference: [],
      instruction: [],
      fact: [],
      goal: [],
      context: [],
    };

    memories.forEach(memory => {
      const type = memory.type || inferMemoryType(memory.content);
      const groupKey = type || 'context';
      if (groups[groupKey]) {
        groups[groupKey].push(memory);
      } else {
        groups.context.push(memory);
      }
    });

    return groups;
  }, [memories]);

  const toggleSection = (type: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const handleAdd = () => {
    if (!newMemory.trim()) return;
    const type = inferMemoryType(newMemory);
    onAdd(newMemory.trim(), type);
    setNewMemory('');
    setIsAdding(false);
  };

  const handleStartAdding = () => {
    setIsAdding(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // Order of sections to display
  const sectionOrder: Array<NonNullable<Memory['type']>> = ['preference', 'instruction', 'fact', 'goal', 'context'];

  return (
    <div className="memory-panel">
      {/* Header */}
      <div className="memory-panel-header">
        <h3 className="memory-panel-title">AI Memory <span className="memory-panel-count">{memories.length} items</span></h3>
      </div>

      {/* Memory sections */}
      <div className="memory-panel-sections">
        {sectionOrder.map(type => {
          const items = groupedMemories[type] || [];
          if (items.length === 0) return null;

          const { label, icon } = typeLabels[type];
          const isExpanded = expandedSections.has(type);

          return (
            <div key={type} className="memory-section">
              <button
                className="memory-section-header"
                onClick={() => toggleSection(type!)}
              >
                <span className="memory-section-icon">{icon}</span>
                <span className="memory-section-title">{label}</span>
                <span className="memory-section-count">{items.length}</span>
                <svg
                  className={`memory-section-chevron ${isExpanded ? 'expanded' : ''}`}
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>

              {isExpanded && (
                <div className="memory-section-content">
                  {items.map(memory => (
                    <div key={memory.id} className="memory-item">
                      <span className="memory-item-content">{memory.content}</span>
                      <button
                        className="memory-item-delete"
                        onClick={() => onDelete(memory.id)}
                        title="Remove memory"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18"/>
                          <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add new memory */}
      <div className="memory-panel-add">
        {isAdding ? (
          <div className="memory-add-form">
            <input
              ref={inputRef}
              type="text"
              className="memory-add-input"
              value={newMemory}
              onChange={(e) => setNewMemory(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
                if (e.key === 'Escape') {
                  setIsAdding(false);
                  setNewMemory('');
                }
              }}
              placeholder="Type something for the AI to remember..."
            />
            <div className="memory-add-actions">
              <button
                className="memory-add-cancel"
                onClick={() => {
                  setIsAdding(false);
                  setNewMemory('');
                }}
              >
                Cancel
              </button>
              <button
                className="memory-add-save"
                onClick={handleAdd}
                disabled={!newMemory.trim()}
              >
                Save
              </button>
            </div>
            {newMemory.trim() && (
              <div className="memory-add-preview">
                Will be saved as: <span style={{ color: typeLabels[inferMemoryType(newMemory) || 'context'].color }}>
                  {typeLabels[inferMemoryType(newMemory) || 'context'].label}
                </span>
              </div>
            )}
          </div>
        ) : (
          <button className="memory-add-btn" onClick={handleStartAdding}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add memory
          </button>
        )}
      </div>

      {/* Help text */}
      <div className="memory-panel-help">
        <p>Memories help the AI understand your preferences, clients, and working style.</p>
      </div>
    </div>
  );
}

export default MemoryPanel;
