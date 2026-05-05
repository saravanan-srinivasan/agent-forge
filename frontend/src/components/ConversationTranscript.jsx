import React, { useEffect, useRef } from 'react';
import { Loader2, ArrowRight, Database, CheckCircle2, AlertTriangle } from 'lucide-react';
import { agentOf, toolIcon } from '../utils/agents';
import { Markdown } from '../utils/markdown.jsx';

/**
 * Vertical timeline of all events. The signature output view —
 * each event is a card with the agent's color identity.
 */
export default function ConversationTranscript({ events, finalAnswer, isRunning }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [events.length, finalAnswer]);

  if (events.length === 0 && !isRunning) {
    return null;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {events.map((ev, i) => (
        <EventCard key={i} event={ev} index={i} />
      ))}
      {isRunning && events.length === 0 && (
        <div style={{
          padding: '20px',
          textAlign: 'center',
          color: 'var(--ink-mute)',
          fontSize: '12px',
          fontFamily: 'JetBrains Mono, monospace',
        }}>
          <Loader2 size={16} className="spin" style={{ verticalAlign: 'middle', marginRight: 8 }} />
          <span className="shimmer-text">initializing crew...</span>
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}

function EventCard({ event, index }) {
  const agent = event.agent ? agentOf(event.agent) : null;
  const t = new Date(event.timestamp);
  const time = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  // Header for each event type
  const headerByKind = {
    workflow_started:    { label: 'WORKFLOW INITIATED', icon: null, color: 'var(--signal)' },
    agent_thinking:      { label: 'THINKING', icon: Loader2, color: agent?.color, spin: true },
    agent_message:       { label: event.payload?.final ? 'FINAL ANSWER' : 'MESSAGE', icon: null, color: agent?.color },
    tool_call_started:   { label: 'TOOL CALL', icon: null, color: 'var(--ink-soft)' },
    tool_call_completed: { label: 'TOOL RESULT', icon: CheckCircle2, color: 'var(--ink-soft)' },
    agent_handoff:       { label: 'HANDOFF', icon: ArrowRight, color: 'var(--signal)' },
    memory_update:       { label: 'MEMORY UPDATED', icon: Database, color: 'var(--ink-mute)' },
    workflow_completed:  { label: 'WORKFLOW COMPLETE', icon: CheckCircle2, color: '#4ade80' },
    workflow_error:      { label: 'ERROR', icon: AlertTriangle, color: '#ef4444' },
  };
  const meta = headerByKind[event.kind] || { label: event.kind.toUpperCase(), color: 'var(--ink-mute)' };
  const Icon = meta.icon;

  // Bail out for events we don't render
  if (event.kind === 'workflow_started' || event.kind === 'workflow_completed') return null;

  return (
    <div
      className="fade-in"
      style={{
        position: 'relative',
        paddingLeft: '20px',
        animationDelay: `${Math.min(index * 0.04, 0.4)}s`,
      }}
    >
      {/* Vertical timeline rail */}
      <div style={{
        position: 'absolute',
        left: '7px',
        top: '8px',
        bottom: '-12px',
        width: '1px',
        background: 'var(--line-soft)',
      }} />
      {/* Timeline node */}
      <div style={{
        position: 'absolute',
        left: '3px',
        top: '8px',
        width: '9px',
        height: '9px',
        borderRadius: '50%',
        background: agent?.color || meta.color,
        boxShadow: `0 0 0 2px var(--bg-base)`,
      }} />

      {/* Card */}
      <div className="panel-elev fade-in" style={{
        padding: '12px 14px',
        borderColor: agent ? `rgba(${agent.rgb}, 0.18)` : 'var(--line-soft)',
        borderLeftColor: agent?.color || meta.color,
        borderLeftWidth: '2px',
      }}>
        {/* Card header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: event.message || event.tool_name ? '8px' : 0,
          flexWrap: 'wrap',
        }}>
          {agent && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              <span style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '13px',
                color: agent.color,
              }}>{agent.glyph}</span>
              <span className="label-mono" style={{ color: agent.color, letterSpacing: '0.14em' }}>
                {agent.name}
              </span>
            </div>
          )}
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '9.5px',
            letterSpacing: '0.12em',
            padding: '2px 7px',
            borderRadius: '3px',
            background: 'var(--bg-deep)',
            border: '1px solid var(--line-soft)',
            color: meta.color,
            fontWeight: 600,
          }}>
            {Icon && <Icon size={9} className={meta.spin ? 'spin' : ''} />}
            {meta.label}
          </span>
          {event.target_agent && (
            <span style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '10px',
              color: 'var(--ink-mute)',
              display: 'inline-flex', alignItems: 'center', gap: '4px',
            }}>
              <ArrowRight size={9} />
              <span style={{ color: agentOf(event.target_agent).color }}>{agentOf(event.target_agent).name}</span>
            </span>
          )}
          <span style={{
            marginLeft: 'auto',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '9.5px',
            color: 'var(--ink-mute)',
          }}>{time}</span>
        </div>

        {/* Body */}
        {event.kind === 'agent_thinking' && (
          <div style={{
            color: 'var(--ink-soft)',
            fontSize: '12.5px',
            fontFamily: 'JetBrains Mono, monospace',
            fontStyle: 'italic',
          }}><span className="shimmer-text">{event.message}</span></div>
        )}

        {event.kind === 'agent_message' && event.message && (
          <div>
            {event.payload?.plan ? (
              <PlanCard plan={event.payload.plan} accent={agent?.color} />
            ) : (
              <Markdown text={event.message} accent={agent?.color || 'var(--signal)'} />
            )}
          </div>
        )}

        {event.kind === 'tool_call_started' && (
          <ToolCallView
            name={event.tool_name}
            input={event.tool_input}
            color={agent?.color}
            phase="started"
          />
        )}
        {event.kind === 'tool_call_completed' && (
          <ToolCallView
            name={event.tool_name}
            input={event.tool_input}
            output={event.tool_output}
            color={agent?.color}
            phase="completed"
          />
        )}

        {event.kind === 'agent_handoff' && (
          <div style={{
            fontSize: '12px',
            color: 'var(--ink-soft)',
            fontFamily: 'JetBrains Mono, monospace',
          }}>{event.message}</div>
        )}

        {event.kind === 'memory_update' && (
          <div style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '11px',
            color: 'var(--ink-mute)',
          }}>
            stored <span style={{ color: 'var(--signal)' }}>{event.payload?.key}</span> in shared memory
          </div>
        )}

        {event.kind === 'workflow_error' && (
          <div style={{
            fontSize: '12.5px',
            color: '#fca5a5',
            fontFamily: 'JetBrains Mono, monospace',
          }}>{event.payload?.message}</div>
        )}
      </div>
    </div>
  );
}

function PlanCard({ plan, accent = '#fbbf24' }) {
  return (
    <div>
      {plan.reasoning && (
        <div style={{
          fontSize: '12.5px',
          color: 'var(--ink)',
          fontStyle: 'italic',
          marginBottom: '12px',
          paddingLeft: '10px',
          borderLeft: `2px solid ${accent}66`,
        }}>{plan.reasoning}</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {(plan.tasks || []).map((task) => {
          const a = agentOf(task.agent);
          return (
            <div key={task.id} style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '8px 10px',
              borderRadius: '4px',
              background: 'var(--bg-deep)',
              border: `1px solid ${a.color}22`,
            }}>
              <span className="label-mono" style={{
                color: 'var(--ink-mute)',
                minWidth: '24px',
                paddingTop: '2px',
              }}>{String(task.id).padStart(2, '0')}</span>
              <span style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '10px',
                fontWeight: 600,
                color: a.color,
                padding: '2px 7px',
                borderRadius: '3px',
                border: `1px solid ${a.color}44`,
                background: a.bg,
                letterSpacing: '0.1em',
                whiteSpace: 'nowrap',
              }}>{a.name}</span>
              <span style={{
                fontSize: '12.5px',
                color: 'var(--ink)',
                lineHeight: 1.5,
              }}>{task.task}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ToolCallView({ name, input, output, color, phase }) {
  const Icon = toolIcon(name);
  const [expanded, setExpanded] = React.useState(false);
  return (
    <div>
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '5px 10px',
          borderRadius: '4px',
          background: 'var(--bg-deep)',
          border: `1px solid ${color || 'var(--line-mid)'}33`,
          cursor: output ? 'pointer' : 'default',
          fontSize: '12px',
          fontFamily: 'JetBrains Mono, monospace',
        }}>
        <Icon size={11} style={{ color: color || 'var(--ink-soft)' }} />
        <span style={{ color: 'var(--ink-bright)' }}>{name}</span>
        <span style={{ color: 'var(--ink-mute)' }}>(</span>
        <span style={{ color: 'var(--ink-soft)', fontSize: '11px' }}>
          {input ? Object.entries(input).map(([k, v]) => `${k}: "${String(v).slice(0, 40)}${String(v).length > 40 ? '…' : ''}"`).join(', ') : ''}
        </span>
        <span style={{ color: 'var(--ink-mute)' }}>)</span>
        {phase === 'started' && (
          <Loader2 size={10} className="spin" style={{ color: color || 'var(--ink-soft)' }} />
        )}
        {phase === 'completed' && output && (
          <span style={{
            color: 'var(--ink-mute)',
            fontSize: '10px',
          }}>
            {expanded ? '▼' : '▶'} {expanded ? 'hide' : 'view'} result
          </span>
        )}
      </div>
      {expanded && output && (
        <pre style={{
          marginTop: '8px',
          padding: '10px 12px',
          background: 'var(--bg-deep)',
          border: '1px solid var(--line-soft)',
          borderRadius: '4px',
          fontSize: '11px',
          fontFamily: 'JetBrains Mono, monospace',
          color: 'var(--ink-soft)',
          overflow: 'auto',
          maxHeight: '240px',
          lineHeight: 1.55,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>{JSON.stringify(output, null, 2)}</pre>
      )}
    </div>
  );
}
