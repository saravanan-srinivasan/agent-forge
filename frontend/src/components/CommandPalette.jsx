import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';

export default function CommandPalette({ open, onClose, commands }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQ(''); setSel(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const filtered = useMemo(() => {
    if (!q) return commands;
    const lq = q.toLowerCase();
    return commands.filter(c =>
      c.label.toLowerCase().includes(lq) ||
      (c.hint && c.hint.toLowerCase().includes(lq))
    );
  }, [q, commands]);

  useEffect(() => { setSel(0); }, [q]);

  if (!open) return null;

  const handleKey = (e) => {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSel(s => Math.min(s + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSel(s => Math.max(s - 1, 0));
    } else if (e.key === 'Enter' && filtered[sel]) {
      filtered[sel].action();
      onClose();
    }
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      paddingTop: 'min(15vh, 100px)',
      animation: 'fade-in 0.15s ease-out',
    }}>
      <div onClick={e => e.stopPropagation()} className="bracket" style={{
        width: '560px', maxWidth: '92vw',
        background: 'var(--bg-base)',
        border: '1px solid var(--line-mid)',
        borderRadius: '6px',
        overflow: 'hidden',
        animation: 'slide-from-bottom 0.2s ease-out',
      }}>
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--line-soft)',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <Search size={14} style={{ color: 'var(--signal)' }} />
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Type a command..."
            style={{
              flex: 1,
              background: 'transparent',
              color: 'var(--ink-bright)',
              fontSize: '14px',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          />
          <kbd>ESC</kbd>
        </div>
        <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{
              padding: '40px', textAlign: 'center',
              fontSize: '12px', color: 'var(--ink-mute)',
              fontFamily: 'JetBrains Mono, monospace',
            }}>// no commands match</div>
          ) : filtered.map((cmd, i) => {
            const Icon = cmd.icon;
            return (
              <div
                key={cmd.label}
                onClick={() => { cmd.action(); onClose(); }}
                onMouseEnter={() => setSel(i)}
                style={{
                  padding: '10px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  background: i === sel ? 'rgba(251, 191, 36, 0.08)' : 'transparent',
                  borderLeft: i === sel ? `2px solid var(--signal)` : '2px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.1s',
                }}
              >
                {Icon && <Icon size={13} style={{ color: cmd.color || 'var(--ink-soft)' }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '13px',
                    color: 'var(--ink-bright)',
                    fontFamily: 'Manrope, sans-serif',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{cmd.label}</div>
                  {cmd.hint && (
                    <div style={{
                      fontSize: '10.5px',
                      color: 'var(--ink-mute)',
                      marginTop: '2px',
                      fontFamily: 'JetBrains Mono, monospace',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{cmd.hint}</div>
                  )}
                </div>
                {cmd.shortcut && <kbd>{cmd.shortcut}</kbd>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
