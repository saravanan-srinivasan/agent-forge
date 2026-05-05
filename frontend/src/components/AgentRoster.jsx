import React from 'react';
import { Users } from 'lucide-react';
import { agentOf, AGENT_ORDER, toolIcon } from '../utils/agents';

export default function AgentRoster({ agentsEnabled }) {
  return (
    <div className="panel-elev" style={{ padding: '16px' }}>
      <div className="label-mono" style={{
        marginBottom: '14px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}>
        <Users size={11} /> Agent Roster
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {AGENT_ORDER.map(role => {
          const a = agentOf(role);
          const enabled = agentsEnabled.includes(role);
          const Icon = a.icon;
          return (
            <div key={role} style={{
              padding: '10px 12px',
              borderRadius: '4px',
              background: enabled ? a.bg : 'var(--bg-deep)',
              border: `1px solid ${enabled ? `${a.color}33` : 'var(--line-soft)'}`,
              opacity: enabled ? 1 : 0.5,
              transition: 'all 0.2s',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '6px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '15px',
                    color: a.color,
                  }}>{a.glyph}</span>
                  <span style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.14em',
                    color: a.color,
                  }}>{a.name}</span>
                </div>
                {!enabled && (
                  <span style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '8.5px',
                    color: 'var(--ink-mute)',
                    letterSpacing: '0.12em',
                  }}>OFFLINE</span>
                )}
              </div>
              <div style={{
                fontSize: '10.5px',
                color: 'var(--ink-soft)',
                marginBottom: '8px',
                lineHeight: 1.5,
                fontFamily: 'Manrope, sans-serif',
              }}>{a.title}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {(a.tools || []).map(tName => {
                  const TIcon = toolIcon(tName);
                  return (
                    <span key={tName} style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 7px',
                      borderRadius: '3px',
                      background: 'var(--bg-deep)',
                      border: '1px solid var(--line-soft)',
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: '9.5px',
                      color: 'var(--ink-mute)',
                    }}>
                      <TIcon size={8} style={{ color: a.color }} />
                      {tName.replace(/_/g, ' ')}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
