import React, { useEffect, useState } from 'react';
import { X, Trash2, Clock, Zap, RefreshCw, Activity } from 'lucide-react';
import { api } from '../utils/api';
import { formatRelativeTime, formatDuration } from '../utils/markdown.jsx';

export default function HistoryDrawer({ open, onClose, onLoad }) {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    refresh();
  }, [open]);

  async function refresh() {
    setLoading(true);
    try {
      const data = await api.listWorkflows();
      setWorkflows(data.workflows || []);
    } catch (e) {
      console.error('Failed to load workflows', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id, e) {
    e.stopPropagation();
    try {
      await api.deleteWorkflow(id);
      setWorkflows(prev => prev.filter(w => w.id !== id));
    } catch (e) {
      console.error('Failed to delete', e);
    }
  }

  async function handleLoad(workflow) {
    try {
      const full = await api.getWorkflow(workflow.id);
      onLoad(full);
      onClose();
    } catch (e) {
      console.error('Failed to load workflow', e);
    }
  }

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        justifyContent: 'flex-end',
        animation: 'fade-in 0.2s ease-out',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '440px',
          maxWidth: '92vw',
          height: '100%',
          background: 'var(--bg-base)',
          borderLeft: '1px solid var(--line-mid)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'slide-from-right 0.25s ease-out',
        }}
      >
        <div style={{
          padding: '18px 20px',
          borderBottom: '1px solid var(--line-soft)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div className="serif-display" style={{ fontSize: '24px', color: 'var(--ink-bright)', marginBottom: '4px' }}>
              Workflow Archive
            </div>
            <div className="label-mono">{workflows.length} runs · all-time</div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={refresh}
              className="hover-lift"
              style={{
                padding: '6px',
                background: 'var(--bg-elev-1)',
                border: '1px solid var(--line-soft)',
                borderRadius: '4px',
                color: 'var(--ink-soft)',
              }}
            ><RefreshCw size={13} className={loading ? 'spin' : ''} /></button>
            <button
              onClick={onClose}
              className="hover-lift"
              style={{
                padding: '6px',
                background: 'var(--bg-elev-1)',
                border: '1px solid var(--line-soft)',
                borderRadius: '4px',
                color: 'var(--ink-soft)',
              }}
            ><X size={13} /></button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>
          {loading && workflows.length === 0 && (
            <div style={{
              padding: '40px 20px',
              textAlign: 'center',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '11px',
              color: 'var(--ink-mute)',
            }}>loading archive...</div>
          )}
          {!loading && workflows.length === 0 && (
            <div style={{
              padding: '40px 20px',
              textAlign: 'center',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '11px',
              color: 'var(--ink-mute)',
            }}>// no workflows yet — run your first one</div>
          )}
          {workflows.map(w => (
            <div
              key={w.id}
              onClick={() => handleLoad(w)}
              className="hover-lift"
              style={{
                padding: '12px',
                marginBottom: '8px',
                background: 'var(--bg-elev-1)',
                border: '1px solid var(--line-soft)',
                borderRadius: '6px',
                cursor: 'pointer',
                position: 'relative',
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '9.5px',
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  color: w.state === 'completed' ? '#4ade80' : w.state === 'failed' ? '#ef4444' : 'var(--signal)',
                }}>
                  <span className="pulse-dot" style={{
                    display: 'inline-block', width: '5px', height: '5px',
                    borderRadius: '50%',
                    background: w.state === 'completed' ? '#4ade80' : w.state === 'failed' ? '#ef4444' : 'var(--signal)',
                  }} />
                  {w.state}
                </div>
                <button
                  onClick={(e) => handleDelete(w.id, e)}
                  style={{
                    padding: '3px',
                    color: 'var(--ink-mute)',
                  }}
                  className="hover-lift"
                ><Trash2 size={11} /></button>
              </div>

              <div style={{
                fontSize: '13px',
                color: 'var(--ink-bright)',
                marginBottom: '8px',
                lineHeight: 1.4,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>{w.objective}</div>

              <div style={{
                display: 'flex',
                gap: '14px',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '10px',
                color: 'var(--ink-mute)',
              }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={9} />{formatRelativeTime(w.started_at)}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Activity size={9} />{formatDuration(w.elapsed_ms || 0)}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Zap size={9} />{w.tool_calls_count || 0} tools
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
