import React, { useEffect, useState } from 'react';
import { X, BarChart3, Cpu, Zap, Layers } from 'lucide-react';
import { api } from '../utils/api';
import { agentOf, AGENT_ORDER } from '../utils/agents';
import { formatDuration } from '../utils/markdown.jsx';

export default function StatsDashboard({ open, onClose }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api.stats().then(setStats).catch(() => {}).finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;
  const maxAgentTokens = stats ? Math.max(1, ...Object.values(stats.tokens_by_agent || {})) : 1;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'fade-in 0.18s',
        padding: '20px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bracket"
        style={{
          width: '720px', maxWidth: '92vw', maxHeight: '85vh',
          background: 'var(--bg-base)',
          border: '1px solid var(--line-mid)',
          borderRadius: '6px',
          display: 'flex', flexDirection: 'column',
          animation: 'slide-from-bottom 0.25s ease-out',
        }}
      >
        <div style={{
          padding: '20px 22px',
          borderBottom: '1px solid var(--line-soft)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div className="label-mono" style={{ marginBottom: '6px' }}>aggregate analytics</div>
            <div className="serif-display" style={{ fontSize: '26px', color: 'var(--ink-bright)' }}>
              Crew Performance
            </div>
          </div>
          <button onClick={onClose} className="hover-lift" style={{
            padding: '7px', background: 'var(--bg-elev-1)',
            border: '1px solid var(--line-soft)', borderRadius: '4px',
            color: 'var(--ink-soft)',
          }}><X size={13} /></button>
        </div>

        <div style={{ padding: '22px', overflowY: 'auto' }}>
          {loading && (
            <div style={{
              padding: '60px', textAlign: 'center',
              color: 'var(--ink-mute)', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px',
            }}>loading metrics...</div>
          )}
          {stats && !loading && (
            <>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px',
                marginBottom: '24px',
              }}>
                <BigNum
                  icon={Layers}
                  label="workflows"
                  value={stats.total_workflows}
                  color="#fbbf24"
                />
                <BigNum
                  icon={Cpu}
                  label="tokens used"
                  value={stats.total_tokens.toLocaleString()}
                  color="#60a5fa"
                  small
                />
                <BigNum
                  icon={Zap}
                  label="tool calls"
                  value={stats.total_tool_calls}
                  color="#4ade80"
                />
                <BigNum
                  icon={BarChart3}
                  label="avg runtime"
                  value={formatDuration(stats.avg_elapsed_ms || 0)}
                  color="#c084fc"
                  small
                />
              </div>

              <div style={{
                marginBottom: '8px',
              }}>
                <div className="label-mono" style={{ marginBottom: '14px' }}>tokens by agent</div>
                {AGENT_ORDER.map(role => {
                  const a = agentOf(role);
                  const tk = stats.tokens_by_agent?.[role] || 0;
                  const pct = (tk / maxAgentTokens) * 100;
                  return (
                    <div key={role} style={{ marginBottom: '10px' }}>
                      <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        marginBottom: '5px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: a.color, fontFamily: 'JetBrains Mono, monospace', fontSize: '14px' }}>{a.glyph}</span>
                          <span style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: '11px', fontWeight: 600,
                            letterSpacing: '0.14em', color: a.color,
                          }}>{a.name}</span>
                          <span className="label-mono" style={{ color: 'var(--ink-mute)' }}>
                            {a.title}
                          </span>
                        </div>
                        <span style={{
                          fontFamily: 'JetBrains Mono, monospace',
                          fontSize: '12px',
                          color: a.color, fontWeight: 600,
                          fontVariantNumeric: 'tabular-nums',
                        }}>{tk.toLocaleString()}</span>
                      </div>
                      <div style={{
                        height: '6px',
                        background: 'rgba(255,255,255,0.04)',
                        borderRadius: '3px',
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${pct}%`,
                          background: `linear-gradient(90deg, ${a.color}66, ${a.color})`,
                          transition: 'width 0.6s ease',
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function BigNum({ icon: Icon, label, value, color, small }) {
  return (
    <div style={{
      padding: '14px 16px',
      borderRadius: '4px',
      background: 'var(--bg-deep)',
      border: `1px solid ${color}33`,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        marginBottom: '8px',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '9px',
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: 'var(--ink-mute)',
      }}>
        <Icon size={10} style={{ color }} />
        {label}
      </div>
      <div style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: small ? '20px' : '28px',
        fontWeight: 600,
        color,
        lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
      }}>{value}</div>
    </div>
  );
}
