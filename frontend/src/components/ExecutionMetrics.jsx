import React, { useMemo } from 'react';
import { Activity, Database, Zap, Clock, Hash } from 'lucide-react';
import { agentOf, AGENT_ORDER } from '../utils/agents';
import { formatDuration } from '../utils/markdown.jsx';

/**
 * Execution metrics — live numbers as the workflow runs.
 * Shows: per-agent token contribution, tool calls made, elapsed time, memory size.
 */
export default function ExecutionMetrics({ events, isRunning, startedAt }) {
  const stats = useMemo(() => calcStats(events), [events]);
  const elapsed = startedAt ? Date.now() - startedAt : 0;

  return (
    <div className="panel-elev" style={{ padding: '16px' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '14px',
      }}>
        <span className="label-mono" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Activity size={11} /> live metrics
        </span>
        {isRunning && (
          <span className="pulse-dot" style={{
            display: 'inline-block',
            width: '6px', height: '6px',
            borderRadius: '50%',
            background: '#4ade80',
            boxShadow: '0 0 6px #4ade80',
          }} />
        )}
      </div>

      {/* Top counters */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '8px',
        marginBottom: '14px',
      }}>
        <Counter
          icon={Zap}
          label="tool calls"
          value={stats.toolCalls}
          accent="#fbbf24"
        />
        <Counter
          icon={Clock}
          label="elapsed"
          value={isRunning ? formatDuration(elapsed) : (startedAt ? formatDuration(elapsed) : '—')}
          accent="#60a5fa"
          isString
        />
        <Counter
          icon={Database}
          label="memory ops"
          value={stats.memoryOps}
          accent="#4ade80"
        />
        <Counter
          icon={Hash}
          label="events"
          value={stats.eventCount}
          accent="rgba(255,255,255,0.7)"
        />
      </div>

      {/* Per-agent contribution bars */}
      <div style={{ marginBottom: '6px' }}>
        <div className="label-mono" style={{ marginBottom: '8px' }}>per-agent activity</div>
        {AGENT_ORDER.map(role => {
          const a = agentOf(role);
          const messageCount = stats.byAgent[role]?.messages || 0;
          const toolCount = stats.byAgent[role]?.tools || 0;
          const total = messageCount + toolCount;
          const max = Math.max(1, ...Object.values(stats.byAgent).map(x => (x.messages || 0) + (x.tools || 0)));
          const pct = (total / max) * 100;
          return (
            <div key={role} style={{ marginBottom: '8px' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '4px',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '10px',
                  letterSpacing: '0.12em',
                }}>
                  <span style={{ color: a.color }}>{a.glyph}</span>
                  <span style={{ color: a.color, fontWeight: 600 }}>{a.name}</span>
                </div>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '10px',
                  color: 'var(--ink-mute)',
                }}>
                  {messageCount}m · {toolCount}t
                </span>
              </div>
              <div style={{
                height: '4px',
                background: 'rgba(255,255,255,0.04)',
                borderRadius: '2px',
                overflow: 'hidden',
                position: 'relative',
              }}>
                <div style={{
                  height: '100%',
                  width: `${pct}%`,
                  background: `linear-gradient(90deg, ${a.color}88, ${a.color})`,
                  transition: 'width 0.4s ease',
                }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Counter({ icon: Icon, label, value, accent, isString }) {
  return (
    <div style={{
      padding: '10px 12px',
      borderRadius: '4px',
      background: 'var(--bg-deep)',
      border: '1px solid var(--line-soft)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        marginBottom: '4px',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '9px',
        color: 'var(--ink-mute)',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
      }}>
        <Icon size={9} style={{ color: accent }} />
        {label}
      </div>
      <div style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: isString ? '14px' : '20px',
        fontWeight: 600,
        color: accent,
        lineHeight: 1.1,
        fontVariantNumeric: 'tabular-nums',
      }}>{value}</div>
    </div>
  );
}

function calcStats(events) {
  const stats = {
    toolCalls: 0,
    memoryOps: 0,
    eventCount: events.length,
    byAgent: {
      planner: { messages: 0, tools: 0 },
      researcher: { messages: 0, tools: 0 },
      analyst: { messages: 0, tools: 0 },
    },
  };
  for (const e of events) {
    if (e.kind === 'tool_call_completed') stats.toolCalls++;
    if (e.kind === 'memory_update') stats.memoryOps++;
    if (e.kind === 'agent_message' && e.agent) {
      stats.byAgent[e.agent] = stats.byAgent[e.agent] || { messages: 0, tools: 0 };
      stats.byAgent[e.agent].messages++;
    }
    if (e.kind === 'tool_call_started' && e.agent) {
      stats.byAgent[e.agent] = stats.byAgent[e.agent] || { messages: 0, tools: 0 };
      stats.byAgent[e.agent].tools++;
    }
  }
  return stats;
}
